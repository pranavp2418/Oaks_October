import json,hashlib,sqlite3,copy,re
MISSING=object()
def digest(rows): return hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def validate(rows):
 if not isinstance(rows,list) or len(rows)>100: raise ValueError('Expected at most 100 records')
 by={}
 for r in rows:
  if not isinstance(r,dict) or set(r)!={'id','parent','name','capacity'}: raise ValueError('Record schema: id,parent,name,capacity')
  if not isinstance(r['id'],str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,40}',r['id']): raise ValueError('Invalid id')
  if r['id'] in by: raise ValueError('Duplicate id')
  if not isinstance(r['name'],str) or not 1<=len(r['name'])<=100: raise ValueError('Invalid name')
  if type(r['capacity']) is not int or not 0<=r['capacity']<=100000: raise ValueError('Invalid capacity')
  if r['parent'] is not None and not isinstance(r['parent'],str): raise ValueError('Invalid parent')
  by[r['id']]=r
 order=[];pending=set(by)
 while pending:
  ready=sorted(i for i in pending if by[i]['parent'] is None or by[i]['parent'] in order)
  if not ready: raise ValueError('Dangling parent or dependency cycle')
  order+=ready;pending-=set(ready)
 return [by[i] for i in order]
def plan(base,current,incoming,resolutions=None):
 # Input snapshots are independently valid, but their merge can create dangling parents/cycles.
 base,current,incoming=validate(base),validate(current),validate(incoming)
 maps=[{r['id']:r for r in x} for x in [base,current,incoming]];resolutions=resolutions or {}
 if not isinstance(resolutions,dict): raise ValueError('Resolutions must be an object')
 result=[];conflicts=[];used=set()
 def choose(key,b,c,n):
  if c==n:return c
  if c==b:return n
  if n==b:return c
  if key in resolutions:
   side=resolutions[key]
   if side not in ('current','incoming'): raise ValueError('Resolution must select current or incoming')
   used.add(key);return c if side=='current' else n
  conflicts.append({'key':key,'current':None if c is MISSING else c,'incoming':None if n is MISSING else n});return c
 for i in sorted(set().union(*[set(m) for m in maps])):
  b,c,n=[m.get(i,MISSING) for m in maps]
  if MISSING in (b,c,n):
   row=choose(i+'.record',b,c,n)
   if row is not MISSING:result.append(copy.deepcopy(row))
  else:
   row={'id':i}
   for field in ['parent','name','capacity']:row[field]=choose(i+'.'+field,b[field],c[field],n[field])
   result.append(row)
 if set(resolutions)-used: raise ValueError('Unknown or unnecessary resolution')
 errors=[]
 try: result=validate(result)
 except ValueError as e:errors.append(str(e))
 return {'records':result,'conflicts':conflicts,'errors':errors,'ready':not conflicts and not errors,'expected_hash':digest(current),'changes':[{'id':i,'before':maps[1].get(i),'after':next((r for r in result if r['id']==i),None)} for i in sorted(set(maps[1])|{r['id'] for r in result}) if maps[1].get(i)!=next((r for r in result if r['id']==i),None)]}
def materialize(rows):
 # A real atomic relational transaction, reconstructed per request from the browser journal.
 ordered=validate(rows)
 db=sqlite3.connect(':memory:');db.execute('PRAGMA foreign_keys=ON');db.execute('CREATE TABLE records(id TEXT PRIMARY KEY,parent TEXT REFERENCES records(id),name TEXT NOT NULL,capacity INTEGER CHECK(capacity>=0))')
 try:
  with db:
   db.executemany('INSERT INTO records VALUES (?,?,?,?)',[(r['id'],r['parent'],r['name'],r['capacity']) for r in ordered])
  saved=[dict(zip(['id','parent','name','capacity'],r)) for r in db.execute('SELECT * FROM records ORDER BY id')]
 finally:db.close()
 return saved
def replay(seed,events):
 if not isinstance(events,list) or len(events)>100:raise ValueError('Journal limit 100')
 s={'records':materialize(seed),'revision':0,'audit':[],'undo':None};seen={}
 for e in events:
  if not isinstance(e,dict) or not isinstance(e.get('id'),str) or len(e['id'])>60:raise ValueError('Operation id required')
  key=json.dumps(e,sort_keys=True)
  if e['id'] in seen:
   if seen[e['id']]!=key:raise ValueError('Conflicting operation id')
   continue
  if e.get('revision')!=s['revision']:raise ValueError('Stale revision')
  if not isinstance(e.get('note'),str) or len(e['note'].strip())<3 or len(e['note'])>300:raise ValueError('Review note required')
  before=copy.deepcopy(s['records'])
  if e.get('kind')=='merge':
   p=plan(e['base'],s['records'],e['incoming'],e.get('resolutions'))
   if not p['ready']:raise ValueError('Resolve conflicts and dependencies before commit')
   if p['expected_hash']!=e.get('expected_hash'):raise ValueError('Snapshot changed; preview again')
   s['records']=materialize(p['records']);s['undo']=before
  elif e.get('kind')=='undo':
   if s['undo'] is None:raise ValueError('Nothing to undo')
   s['records']=materialize(s['undo']);s['undo']=None
  else:raise ValueError('Unknown operation')
  s['revision']+=1;s['audit'].append({'operation':e['id'],'kind':e['kind'],'note':e['note'],'before_hash':digest(before),'after_hash':digest(s['records']),'revision':s['revision']});seen[e['id']]=key
 return s
def dispatch(body):
 s=replay(body['seed'],body.get('events',[]))
 if body.get('action')=='plan':return {'state':s,'plan':plan(body['base'],s['records'],body['incoming'],body.get('resolutions'))}
 return {'state':s}
