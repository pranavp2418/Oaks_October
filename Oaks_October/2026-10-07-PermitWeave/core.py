"""Synthetic authorization allocation with interval capacities and event replay."""
import hashlib,json
from datetime import date
class Conflict(ValueError): pass
def canonical(x): return json.dumps(x,sort_keys=True,separators=(",",":"))
def fingerprint(x): return hashlib.sha256(canonical(x).encode()).hexdigest()
def validate(data):
 if not isinstance(data,dict): raise ValueError("Expected object")
 auth=data.get("authorizations",[]); visits=data.get("visits",[])
 if not isinstance(auth,list) or not isinstance(visits,list) or len(auth)>200 or len(visits)>500: raise ValueError("Maximum 200 authorizations and 500 visits")
 ids=set()
 for a in auth:
  if not isinstance(a,dict) or not all(isinstance(a.get(k),str) and 0<len(a[k])<=80 for k in ("id","member","service","start","end")): raise ValueError("Invalid authorization fields")
  if a['id'] in ids: raise ValueError("Duplicate authorization ID")
  ids.add(a['id'])
  if any(date.fromisoformat(a[k]).isoformat()!=a[k] for k in ('start','end')): raise ValueError('Use YYYY-MM-DD dates')
  if date.fromisoformat(a['start'])>date.fromisoformat(a['end']): raise ValueError("Reversed interval")
  if type(a.get('units')) is not int or not 0<=a['units']<=10000: raise ValueError("Invalid capacity")
 ids=set()
 for v in visits:
  if not isinstance(v,dict) or not all(isinstance(v.get(k),str) and 0<len(v[k])<=80 for k in ('id','member','service','date')): raise ValueError("Invalid visit")
  if date.fromisoformat(v['date']).isoformat()!=v['date']: raise ValueError('Use YYYY-MM-DD dates')
  if v['id'] in ids: raise ValueError("Duplicate visit ID")
  ids.add(v['id'])
 return auth,visits
def allocate(data):
 auth,visits=validate(data); remaining={a['id']:a['units'] for a in auth}; out=[]
 # Earliest-deadline-first for unit-demand interval matching; preserve soon-expiring capacity.
 for v in sorted(visits,key=lambda x:(x['date'],x['id'])):
  candidates=[a for a in auth if a['member']==v['member'] and a['service']==v['service'] and a['start']<=v['date']<=a['end']]
  usable=sorted((a for a in candidates if remaining[a['id']]>0),key=lambda a:(a['end'],a['start'],a['id']))
  selected=usable[0] if usable else None
  if selected: remaining[selected['id']]-=1
  out.append({'visit':v['id'],'date':v['date'],'authorization':selected['id'] if selected else None,'reason':'earliest_expiry_capacity' if selected else 'capacity_exhausted' if candidates else 'no_matching_interval'})
 return {'assignments':out,'remaining':remaining,'covered':sum(x['authorization'] is not None for x in out),'uncovered':sum(x['authorization'] is None for x in out),'input_hash':fingerprint(data)}
def replay(data,events):
 validate(data)
 if not isinstance(events,list) or len(events)>100: raise ValueError('Maximum 100 events')
 current=json.loads(canonical(data));seen={};audit=[];revision=0;head='0'*64
 for e in events:
  if not isinstance(e,dict) or not isinstance(e.get('key'),str) or not 1<=len(e['key'])<=80: raise ValueError('Invalid idempotency key')
  digest=fingerprint(e)
  if e['key'] in seen:
   if seen[e['key']]!=digest: raise Conflict('Idempotency key reused with different payload')
   continue
  if e.get('expected_revision')!=revision: raise Conflict('Stale revision')
  if e.get('type')!='capacity': raise ValueError('Unknown event')
  a=next((a for a in current['authorizations'] if a['id']==e.get('authorization')),None)
  if a is None or type(e.get('units')) is not int or not 0<=e['units']<=10000: raise ValueError('Invalid capacity edit')
  a['units']=e['units'];revision+=1;head=fingerprint({'previous':head,'event':e,'revision':revision});audit.append({'revision':revision,'hash':head,'event':e});seen[e['key']]=digest
 return {'revision':revision,'audit':audit,'state':current,'allocation':allocate(current)}
