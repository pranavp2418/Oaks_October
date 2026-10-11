"""Synthetic, replayable privacy-operation rehearsal. No identity/auth claims."""
import sqlite3,json,hashlib,copy
ACTORS={'Avery':'analyst','Blair':'reviewer','Casey':'reviewer','Devon':'operator'}
FIELDS={'subject','activity','region','device','email'}
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=True)
def digest(x):return hashlib.sha256(canonical(x).encode()).hexdigest()
class Conflict(ValueError):pass
def dataset():
 return [{'id':f'evt-{i:03}', 'subject':f'user-{i%5+1}', 'activity':['login','export','view'][i%3],'region':['east','west'][i%2],'device':['desktop','mobile'][i%2],'email':f'synthetic{i%5+1}@example.invalid','sequence':i} for i in range(40)]
def scope_validate(s):
 if not isinstance(s,dict) or set(s)!={'subjects','fields','start','end'}:raise ValueError('Scope requires subjects, fields, start and end')
 if not isinstance(s['subjects'],list) or not s['subjects'] or len(s['subjects'])>5 or len(set(s['subjects']))!=len(s['subjects']) or any(x not in [f'user-{i}' for i in range(1,6)] for x in s['subjects']):raise ValueError('Choose 1..5 distinct synthetic subjects')
 if not isinstance(s['fields'],list) or not s['fields'] or len(set(s['fields']))!=len(s['fields']) or any(x not in FIELDS for x in s['fields']):raise ValueError('Unknown or duplicate field')
 if any(type(s[x]) is not int for x in ['start','end']) or not 0<=s['start']<=s['end']<=39:raise ValueError('Sequence bounds must be integers 0..39')
def project(s):
 scope_validate(s)
 return [{k:r[k] for k in sorted(s['fields'])} for r in dataset() if r['subject'] in s['subjects'] and s['start']<=r['sequence']<=s['end']]
class Engine:
 def __init__(self):
  self.db=sqlite3.connect(':memory:',isolation_level=None)
  self.db.row_factory=sqlite3.Row
  self.db.executescript('''PRAGMA foreign_keys=ON;CREATE TABLE cases(id TEXT PRIMARY KEY, creator TEXT NOT NULL,state TEXT NOT NULL,version INTEGER NOT NULL,scope TEXT NOT NULL,plan TEXT,receipt TEXT);CREATE TABLE approvals(case_id TEXT REFERENCES cases(id),actor TEXT NOT NULL,plan_hash TEXT NOT NULL,PRIMARY KEY(case_id,actor));CREATE TABLE ops(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,result TEXT NOT NULL);CREATE TABLE audit(seq INTEGER PRIMARY KEY,entry TEXT NOT NULL,hash TEXT NOT NULL);''')
  self.revision=0
 def case(self,cid):
  r=self.db.execute('SELECT * FROM cases WHERE id=?',(cid,)).fetchone()
  if not r:raise ValueError('Case missing')
  return dict(r)
 def apply(self,a,fail_after=False):
  if not isinstance(a,dict) or not isinstance(a.get('id'),str) or not 1<=len(a['id'])<=80:raise ValueError('Operation ID required')
  if a.get('actor') not in ACTORS:raise ValueError('Unknown synthetic actor')
  fp=digest(a);old=self.db.execute('SELECT * FROM ops WHERE id=?',(a['id'],)).fetchone()
  if old:
   if old['fingerprint']!=fp:raise Conflict('Operation ID reused with different content')
   return json.loads(old['result'])
  if type(a.get('expected_revision')) is not int or a['expected_revision']!=self.revision:raise Conflict('Stale workspace revision')
  kind=a.get('kind');cid=a.get('case');actor=a['actor'];role=ACTORS[actor]
  if not isinstance(cid,str) or not 1<=len(cid)<=50 or not all(c.isalnum() or c in '-_' for c in cid):raise ValueError('Case ID must be 1..50 letters, numbers, hyphens or underscores')
  self.db.execute('BEGIN IMMEDIATE')
  try:
   if kind=='create':
    if role!='analyst':raise ValueError('Analyst role required')
    scope_validate(a.get('scope'));self.db.execute('INSERT INTO cases VALUES(?,?,?,0,?,NULL,NULL)',(cid,actor,'draft',canonical(a['scope'])))
   else:
    c=self.case(cid)
    if type(a.get('expected_version')) is not int or a['expected_version']!=c['version']:raise Conflict('Stale case version')
    if kind=='scope':
     if role!='analyst' or c['creator']!=actor or c['state'] not in ['draft','prepared','approved']:raise ValueError('Scope is editable only by its analyst before release')
     scope_validate(a.get('scope'));self.db.execute('UPDATE cases SET scope=?,state=\'draft\',plan=NULL WHERE id=?',(canonical(a['scope']),cid));self.db.execute('DELETE FROM approvals WHERE case_id=?',(cid,))
    elif kind=='prepare':
     if role!='analyst' or c['creator']!=actor or c['state']!='draft':raise ValueError('Prepare requires the creating analyst and draft state')
     s=json.loads(c['scope']);data=project(s);plan={'scope':s,'records':data,'excluded_records':40-len(data),'dataset_hash':digest(dataset())};plan['hash']=digest(plan)
     self.db.execute('UPDATE cases SET state=\'prepared\',plan=? WHERE id=?',(canonical(plan),cid))
    elif kind=='approve':
     if role!='reviewer' or actor==c['creator'] or c['state'] not in ['prepared','approved']:raise ValueError('Independent reviewer and prepared case required')
     plan=json.loads(c['plan'])
     if a.get('plan_hash')!=plan['hash']:raise Conflict('Review digest does not match prepared scope')
     self.db.execute('INSERT INTO approvals VALUES(?,?,?)',(cid,actor,plan['hash']))
     count=self.db.execute('SELECT COUNT(*) FROM approvals WHERE case_id=?',(cid,)).fetchone()[0]
     if count==2:self.db.execute('UPDATE cases SET state=\'approved\' WHERE id=?',(cid,))
    elif kind=='reject':
     if role!='reviewer' or c['state'] not in ['prepared','approved'] or not isinstance(a.get('note'),str) or not 1<=len(a['note'])<=500:raise ValueError('Reviewer, reviewable state and rejection note required')
     self.db.execute('UPDATE cases SET state=\'draft\',plan=NULL WHERE id=?',(cid,));self.db.execute('DELETE FROM approvals WHERE case_id=?',(cid,))
    elif kind=='release':
     if role!='operator' or c['state']!='approved':raise ValueError('Release requires operator and two approvals')
     plan=json.loads(c['plan']);reviews=[dict(r) for r in self.db.execute('SELECT actor,plan_hash FROM approvals WHERE case_id=? ORDER BY actor',(cid,))]
     if len(reviews)!=2 or any(r['plan_hash']!=plan['hash'] for r in reviews):raise Conflict('Approval set inconsistent')
     receipt={'schema':1,'case':cid,'version':c['version']+1,'scope':plan['scope'],'records':plan['records'],'plan_hash':plan['hash'],'reviews':reviews,'dataset_hash':plan['dataset_hash']};receipt['hash']=digest(receipt)
     self.db.execute('UPDATE cases SET state=\'released\',receipt=? WHERE id=?',(canonical(receipt),cid))
    elif kind=='revoke':
     if role!='operator' or c['state']!='released' or not isinstance(a.get('note'),str) or not 1<=len(a['note'])<=500:raise ValueError('Operator, released case and revocation reason required')
     self.db.execute('UPDATE cases SET state=\'revoked\' WHERE id=?',(cid,))
    else:raise ValueError('Unknown action')
    self.db.execute('UPDATE cases SET version=version+1 WHERE id=?',(cid,))
   result=self.case(cid);result['revision']=self.revision+1
   prev=self.db.execute('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1').fetchone();entry={'seq':self.revision+1,'previous':prev[0] if prev else '0'*64,'operation':a,'state':result['state'],'version':result['version']};h=digest(entry)
   self.db.execute('INSERT INTO audit VALUES(?,?,?)',(entry['seq'],canonical(entry),h));self.db.execute('INSERT INTO ops VALUES(?,?,?)',(a['id'],fp,canonical(result)))
   if fail_after:raise RuntimeError('Injected transaction failure')
   self.db.execute('COMMIT');self.revision+=1;return result
  except sqlite3.IntegrityError as e:self.db.execute('ROLLBACK');raise Conflict('Duplicate case or reviewer') from e
  except Exception:self.db.execute('ROLLBACK');raise
 def view(self):
  cases=[]
  for r in self.db.execute('SELECT * FROM cases ORDER BY id'):
   c=dict(r);c['scope']=json.loads(c['scope']);c['plan']=json.loads(c['plan']) if c['plan'] else None;c['receipt']=json.loads(c['receipt']) if c['receipt'] else None;c['approvals']=[dict(r) for r in self.db.execute('SELECT actor,plan_hash FROM approvals WHERE case_id=? ORDER BY actor',(c['id'],))];cases.append(c)
  return {'revision':self.revision,'cases':cases,'audit':[{'entry':json.loads(r['entry']),'hash':r['hash']} for r in self.db.execute('SELECT * FROM audit ORDER BY seq')],'actors':ACTORS,'dataset':dataset()}
def verify_receipt(r):
 if not isinstance(r,dict) or r.get('schema')!=1:raise ValueError('Invalid receipt')
 x=copy.deepcopy(r);h=x.pop('hash',None)
 if h!=digest(x) or r['records']!=project(r['scope']) or r['dataset_hash']!=digest(dataset()):raise ValueError('Receipt checksum or projection mismatch')
 plan={'scope':r['scope'],'records':r['records'],'excluded_records':40-len(r['records']),'dataset_hash':r['dataset_hash']}
 if r['plan_hash']!=digest(plan) or sorted(x['actor'] for x in r['reviews'])!=['Blair','Casey'] or any(x['plan_hash']!=r['plan_hash'] for x in r['reviews']):raise ValueError('Receipt review binding mismatch')
 return True
def dispatch(x):
 if not isinstance(x,dict) or x.get('schema')!=1 or not isinstance(x.get('events'),list) or len(x['events'])>250 or x.get('revision')!=len(x['events']):raise ValueError('Invalid workspace; maximum 250 operations')
 e=Engine()
 for a in x['events']:
  before=e.revision;e.apply(a)
  if e.revision==before:raise ValueError('Duplicate event in workspace')
 action=x.get('action',{'kind':'view'});events=copy.deepcopy(x['events'])
 if action.get('kind')=='verify':return {'valid':verify_receipt(action.get('receipt'))}
 if action.get('kind')!='view':
  if len(events)==250:raise ValueError('Operation limit reached')
  before=e.revision;e.apply(action)
  if e.revision!=before:events.append(action)
 return {'workspace':{'schema':1,'seed':10112026,'revision':e.revision,'events':events},'view':e.view()}
