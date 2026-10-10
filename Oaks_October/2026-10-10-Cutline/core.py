"""Bounded exact finite-stock cutting and transactional reservation ledger."""
import json,hashlib,sqlite3,math,copy
class Conflict(ValueError):pass
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),allow_nan=False)
def digest(v):return hashlib.sha256(canonical(v).encode()).hexdigest()
def integer(v,lo,hi):
 if type(v)!=int or not lo<=v<=hi:raise ValueError(f'Integer must be in {lo}..{hi}')
 return v
def token(v):
 if not isinstance(v,str) or not 1<=len(v)<=70 or any(ord(c)<32 for c in v):raise ValueError('Invalid identifier/text')
 return v
def validate_parts(parts):
 if not isinstance(parts,list) or not 1<=len(parts)<=14:raise ValueError('Use 1..14 pieces')
 ids=set()
 for p in parts:
  token(p['id']);token(p['material']);integer(p['length'],1,20000)
  if p['id'] in ids:raise ValueError('Duplicate piece ID')
  ids.add(p['id'])
def solve(parts,stocks,kerf=3,budget=150000):
 validate_parts(parts);integer(kerf,0,20);integer(budget,1,200000)
 if not isinstance(stocks,list) or len(stocks)>12:raise ValueError('At most 12 available stocks')
 seen=set()
 for s in stocks:
  token(s['id']);token(s['material']);integer(s['length'],1,20000)
  if s['id'] in seen:raise ValueError('Duplicate stock ID')
  seen.add(s['id'])
 stocks=sorted(copy.deepcopy(stocks),key=lambda s:(s['length'],s['id']))
 parts=sorted(copy.deepcopy(parts),key=lambda p:(-p['length'],p['id']))
 bins={};best=None;best_score=(math.inf,math.inf);nodes=0;exhausted=True
 def snapshot():
  return [{'stock':copy.deepcopy(stocks[i]),'pieces':copy.deepcopy(v),'used':sum(p['length']+kerf for p in v),'remnant':stocks[i]['length']-sum(p['length']+kerf for p in v)} for i,v in sorted(bins.items(),key=lambda x:stocks[x[0]]['id'])]
 def search(k):
  nonlocal best,best_score,nodes,exhausted
  if nodes>=budget:exhausted=False;return
  nodes+=1
  count=len(bins);total=sum(stocks[i]['length'] for i in bins)
  if count>best_score[0] or (count==best_score[0] and total>=best_score[1] and k<len(parts)):return
  if k==len(parts):
   score=(count,total)
   if score<best_score:best_score=score;best=snapshot()
   return
  remaining=parts[k:];additional=0
  for material in set(p['material'] for p in remaining):
   demand=sum(p['length']+kerf for p in remaining if p['material']==material)
   free=sum(stocks[i]['length']-sum(p['length']+kerf for p in v) for i,v in bins.items() if stocks[i]['material']==material)
   unopened=[s['length'] for i,s in enumerate(stocks) if i not in bins and s['material']==material]
   deficit=max(0,demand-free)
   if deficit and not unopened:return
   if deficit>sum(unopened):return
   additional+=math.ceil(deficit/max(unopened)) if deficit else 0
  if count+additional>best_score[0]:return
  p=parts[k];size=p['length']+kerf;choices=[];equivalent=set()
  for i,s in enumerate(stocks):
   if s['material']!=p['material']:continue
   used=sum(v['length']+kerf for v in bins.get(i,[]))
   if used+size>s['length']:continue
   signature=(s['material'],s['length'],used,i in bins)
   if signature in equivalent:continue
   equivalent.add(signature);choices.append(i)
  choices.sort(key=lambda i:(i not in bins,stocks[i]['length']-sum(v['length']+kerf for v in bins.get(i,[]))-size,stocks[i]['id']))
  for i in choices:
   bins.setdefault(i,[]).append(p);search(k+1);bins[i].pop()
   if not bins[i]:del bins[i]
 search(0)
 result={'feasible':best is not None,'optimal':exhausted and best is not None,'infeasible_proven':exhausted and best is None,'nodes':nodes,'budget':budget,'kerf':kerf,'bars':best or [],'bar_count':len(best) if best else 0,'total_stock':sum(b['stock']['length'] for b in best or []),'total_pieces':sum(p['length'] for p in parts),'saw_loss':len(parts)*kerf,'remnant_total':sum(b['remnant'] for b in best or [])}
 result['plan_hash']=digest({'parts':parts,'stocks':stocks,'kerf':kerf,'budget':budget,'bars':result['bars']})
 return result
def database(seed):
 db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
 db.executescript('PRAGMA foreign_keys=ON;CREATE TABLE stocks(id TEXT PRIMARY KEY,material TEXT NOT NULL,length INTEGER CHECK(length>0),status TEXT CHECK(status IN (\'available\',\'reserved\',\'consumed\')));CREATE TABLE jobs(id TEXT PRIMARY KEY,status TEXT NOT NULL,plan TEXT NOT NULL,note TEXT NOT NULL);CREATE TABLE produced(id TEXT PRIMARY KEY,job TEXT REFERENCES jobs(id),material TEXT,length INTEGER);')
 stocks=seed['stocks']
 if not isinstance(stocks,list) or len(stocks)>10:raise ValueError('Seed needs up to 10 stocks')
 for s in stocks:db.execute('INSERT INTO stocks VALUES(?,?,?,?)',(token(s['id']),token(s['material']),integer(s['length'],1,20000),'available'))
 validate_parts(seed['pieces']);db.commit();return db
def view(db,revision,audit):
 return {'revision':revision,'stocks':[dict(s) for s in db.execute('SELECT * FROM stocks ORDER BY id')],'jobs':[dict(s)|{'plan':json.loads(s['plan'])} for s in db.execute('SELECT * FROM jobs ORDER BY rowid')],'produced':[dict(s) for s in db.execute('SELECT * FROM produced ORDER BY id')],'audit':audit}
def available(db):return [dict(s) for s in db.execute('SELECT id,material,length FROM stocks WHERE status=\'available\' ORDER BY id')]
def apply(db,operation,revision,audit):
 integer(operation['expected_revision'],0,80)
 if operation['expected_revision']!=revision:raise Conflict('Workspace revision changed; reload and solve again')
 note=token(operation['note']);kind=operation['kind'];details={}
 with db:
  if kind=='reserve':
   plan=solve(operation['pieces'],available(db),operation['kerf'],operation['budget'])
   if not plan['feasible']:raise ValueError('No feasible plan to reserve')
   if operation['plan_hash']!=plan['plan_hash']:raise Conflict('Stale plan preview; solve available stock again')
   job=token(operation['job'])
   db.execute('INSERT INTO jobs VALUES(?,?,?,?)',(job,'reserved',canonical(plan),note))
   for bar in plan['bars']:
    cur=db.execute('UPDATE stocks SET status=\'reserved\' WHERE id=? AND status=\'available\'',(bar['stock']['id'],))
    if cur.rowcount!=1:raise Conflict('Stock already reserved')
   details={'job':job,'bar_count':plan['bar_count'],'plan_hash':plan['plan_hash']}
  elif kind in ['complete','cancel']:
   job=token(operation['job']);row=db.execute('SELECT * FROM jobs WHERE id=?',(job,)).fetchone()
   if row is None or row['status']!='reserved':raise ValueError('Only reserved jobs can complete/cancel')
   plan=json.loads(row['plan']);retained=0;discarded=0
   for b in plan['bars']:
    db.execute('UPDATE stocks SET status=? WHERE id=?',('consumed' if kind=='complete' else 'available',b['stock']['id']))
    if kind=='complete':
     for p in b['pieces']:db.execute('INSERT INTO produced VALUES(?,?,?,?)',(job+'::'+p['id'],job,p['material'],p['length']))
     if b['remnant']>=50:
      db.execute('INSERT INTO stocks VALUES(?,?,?,?)',(job+'::'+b['stock']['id']+'::remnant',b['stock']['material'],b['remnant'],'available'));retained+=b['remnant']
     else:discarded+=b['remnant']
   db.execute('UPDATE jobs SET status=? WHERE id=?',('completed' if kind=='complete' else 'cancelled',job))
   details={'job':job}
   if kind=='complete':
    if plan['total_stock']!=plan['total_pieces']+plan['saw_loss']+retained+discarded:raise ValueError('Conservation invariant failed')
    details.update(input=plan['total_stock'],products=plan['total_pieces'],kerf=plan['saw_loss'],retained=retained,discarded=discarded)
  else:raise ValueError('Unknown operation')
 audit.append({'revision':revision+1,'id':operation['id'],'kind':kind,'note':note,'details':details});return revision+1
def dispatch(payload):
 seed=payload['seed'];operations=payload.get('operations',[])
 if not isinstance(operations,list) or len(operations)>80:raise ValueError('At most 80 operations')
 db=database(seed);revision=0;audit=[];seen={};clean=[]
 for op in operations:
  token(op['id']);h=digest(op)
  if op['id'] in seen:
   if h!=seen[op['id']]:raise Conflict('Conflicting operation id')
   continue
  try:revision=apply(db,op,revision,audit)
  except sqlite3.IntegrityError as e:raise ValueError('Inventory/job identifiers conflict') from e
  seen[op['id']]=h;clean.append(op)
 action=payload.get('action',{'kind':'view'})
 if action['kind'] in ['reserve','complete','cancel']:
  if len(clean)>=80:raise ValueError('Journal limit reached; export and reset')
  token(action['id']);h=digest(action)
  if action['id'] in seen:
   if seen[action['id']]!=h:raise Conflict('Conflicting operation id')
  else:
   try:revision=apply(db,action,revision,audit)
   except sqlite3.IntegrityError as e:raise ValueError('Inventory/job identifiers conflict') from e
   clean.append(action)
 result={'workspace':{'seed':seed,'operations':clean},'view':view(db,revision,audit)}
 if action['kind']=='solve':result['plan']=solve(action.get('pieces',seed['pieces']),available(db),action.get('kerf',3),action.get('budget',150000))
 elif action['kind'] not in ['view','reserve','complete','cancel']:raise ValueError('Unknown action')
 db.close();return result
