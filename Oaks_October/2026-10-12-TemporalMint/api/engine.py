import hashlib,json,sqlite3
SEED=10122026

def dataset():
    anchors=[{"shipment_id":f"ship-{i:02d}","carrier":f"carrier-{i%5}","cutoff":100+i*7,"actual_delay":(i*13+7)%55} for i in range(30)]
    events=[]
    for carrier in range(5):
        for j in range(24):
            events.append({"event_id":f"e-{carrier}-{j}","carrier":f"carrier-{carrier}","event_time":20+j*9+carrier,"ingested_at":22+j*9+carrier,"delay":(j*17+carrier*11)%70,"revision":1})
    return anchors,events

def connect():
    db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
    db.executescript('''CREATE TABLE anchors(shipment_id TEXT PRIMARY KEY,carrier TEXT,cutoff INTEGER,actual_delay INTEGER);
    CREATE TABLE events(event_id TEXT,carrier TEXT,event_time INTEGER,ingested_at INTEGER,delay INTEGER,revision INTEGER,PRIMARY KEY(event_id,revision));''')
    anchors,events=dataset();db.executemany('INSERT INTO anchors VALUES(:shipment_id,:carrier,:cutoff,:actual_delay)',anchors);db.executemany('INSERT INTO events VALUES(:event_id,:carrier,:event_time,:ingested_at,:delay,:revision)',events);return db

def corrected(events, correction):
    rows=[dict(x) for x in events]
    if correction:
        target=next((x for x in rows if x['event_id']==correction.get('event_id')),None)
        if not target: raise ValueError('Unknown correction event.')
        value=correction.get('delay')
        if not isinstance(value,int) or not 0<=value<=360: raise ValueError('Correction delay must be an integer from 0 to 360.')
        rows.append({**target,'delay':value,'revision':target['revision']+1,'ingested_at':correction.get('ingested_at',999)})
    latest={}
    for row in sorted(rows,key=lambda x:(x['event_id'],x['revision'])):latest[row['event_id']]=row
    return list(latest.values())

def materialize(correction=None, allow_leakage=False):
    db=connect();anchors=[dict(x) for x in db.execute('SELECT * FROM anchors ORDER BY shipment_id')];events=corrected(db.execute('SELECT * FROM events'),correction)
    output=[]
    for a in anchors:
        eligible=[e for e in events if e['carrier']==a['carrier'] and (allow_leakage or e['event_time']<=a['cutoff'])]
        eligible.sort(key=lambda x:(x['event_time'],x['event_id']))
        recent=eligible[-5:];future=[e for e in eligible if e['event_time']>a['cutoff']]
        output.append({**a,'event_count':len(eligible),'mean_delay':round(sum(e['delay'] for e in eligible)/len(eligible),2) if eligible else 0,'recent_max':max((e['delay'] for e in recent),default=0),'lineage':[e['event_id']+':r'+str(e['revision']) for e in recent],'leaked_event_ids':[e['event_id'] for e in future]})
    digest=hashlib.sha256(json.dumps(output,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return {'rows':output,'digest':digest,'leakage_count':sum(len(x['leaked_event_ids']) for x in output),'policy':'event_time <= shipment cutoff'}

def response(payload):
    action=payload.get('action','materialize')
    if action=='materialize': return materialize(payload.get('correction'),bool(payload.get('allow_leakage')))
    if action=='backfill':
        before=materialize();after=materialize(payload.get('correction'));changed=[]
        for old,new in zip(before['rows'],after['rows']):
            if old!=new:changed.append({'shipment_id':old['shipment_id'],'before':old['mean_delay'],'after':new['mean_delay'],'lineage':new['lineage']})
        return {'before_digest':before['digest'],'after_digest':after['digest'],'changed':changed,'rows':after['rows']}
    raise ValueError('Unknown action.')
