"""SQLite project state, optimistic transactions and an inspectable tamper-evident journal."""
from __future__ import annotations
import copy,json,sqlite3,contextlib
from core import canonical,digest,compile_dossier,ContractError,text,integer

class Conflict(ContractError):pass
class Forbidden(ContractError):pass

SCHEMA='''
CREATE TABLE IF NOT EXISTS meta (version INTEGER NOT NULL);
INSERT INTO meta SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM meta);
CREATE TABLE IF NOT EXISTS workspace (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS operations (workspace TEXT NOT NULL, key TEXT NOT NULL, request_hash TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(workspace,key));
CREATE TABLE IF NOT EXISTS audit (workspace TEXT NOT NULL, sequence INTEGER NOT NULL, previous TEXT NOT NULL, hash TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(workspace,sequence));
CREATE TABLE IF NOT EXISTS investigations (workspace TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, status TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(workspace,id));
'''

class Workspace:
 def __init__(self,path):
  self.path=str(path)
  with self.connect() as db:
   db.executescript(SCHEMA)
   if db.execute('SELECT version FROM meta').fetchone()[0]!=1:raise ContractError('Unsupported workspace schema')
 def connect(self):
  db=sqlite3.connect(self.path,timeout=10,isolation_level=None);db.execute('PRAGMA foreign_keys=ON');db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA synchronous=FULL');return db
 @contextlib.contextmanager
 def transaction(self):
  db=self.connect()
  try:
   db.execute('BEGIN IMMEDIATE');yield db;db.commit()
  except BaseException:db.rollback();raise
  finally:db.close()
 def load(self,wid):
  with self.connect() as db:
   row=db.execute('SELECT body FROM workspace WHERE id=?',(wid,)).fetchone()
   if not row:raise ContractError('Unknown workspace')
   return json.loads(row[0])
 def mutate(self,wid,key,command,role='operator'):
  text(wid,'workspace',80);text(key,'idempotency key',100)
  if role not in ('operator','reviewer'):raise Forbidden('Mutation role required')
  if not isinstance(command,dict) or 'kind' not in command:raise ContractError('Command kind required')
  request_hash=digest({'command':command,'role':role})
  with self.transaction() as db:
   old=db.execute('SELECT request_hash,result FROM operations WHERE workspace=? AND key=?',(wid,key)).fetchone()
   if old:
    if old[0]!=request_hash:raise Conflict('Idempotency key payload conflict')
    return json.loads(old[1])
   row=db.execute('SELECT body,revision FROM workspace WHERE id=?',(wid,)).fetchone()
   kind=command['kind']
   if kind=='create':
    if set(command)!={'kind','dossier'}:raise ContractError('Invalid create fields')
    if row:raise Conflict('Workspace already exists')
    dossier=copy.deepcopy(command['dossier']);compile_dossier(dossier)
    if dossier['revision']!=0:raise ContractError('Initial revision must be zero')
    state={'schema_version':1,'dossier':dossier,'proposal':None,'prepared_dossier':None}
    revision=0
   else:
    if not row:raise ContractError('Unknown workspace')
    state=json.loads(row[0]);revision=row[1]
    if command.get('expected_revision')!=revision:raise Conflict('Stale workspace revision')
    if kind=='evidence':
     if set(command)!={'kind','expected_revision','id','state','source'}:raise ContractError('Invalid evidence fields')
     if command['state'] not in ('missing','valid','expired','rejected','conflicting'):raise ContractError('Invalid evidence state')
     text(command['source'],'source',400)
     found=False
     for evidence in state['dossier']['evidence']:
      if evidence['id']==command['id']:
       evidence.update(state=command['state'],source=command['source'],version=evidence['version']+1);found=True
     if not found:raise ContractError('Unknown evidence')
     state['proposal']=None;state['prepared_dossier']=None
    elif kind=='propose':
     if set(command)!={'kind','expected_revision','alternative'}:raise ContractError('Invalid propose fields')
     result=compile_dossier(state['dossier']);i=integer(command['alternative'],0,len(result['alternatives'])-1,'alternative')
     choice=result['alternatives'][i]
     state['prepared_dossier']=None
     state['proposal']={'base_hash':result['input_hash'],'alternative':choice,'approved':False,'review_note':None}
     state['proposal']['hash']=digest(state['proposal'])
    elif kind=='review':
     if role!='reviewer':raise Forbidden('Reviewer role required; role is enforced by local transport')
     if set(command)!={'kind','expected_revision','proposal_hash','decision','note'}:raise ContractError('Invalid review fields')
     proposal=state['proposal']
     if not proposal or command['proposal_hash']!=proposal['hash']:raise Conflict('Proposal hash changed')
     if command['decision'] not in ('approve','reject'):raise ContractError('Invalid review decision')
     text(command['note'],'review note',1000)
     state['prepared_dossier']=None
     proposal['approved']=command['decision']=='approve';proposal['review_note']=command['note']
    elif kind=='prepare':
     if role!='reviewer':raise Forbidden('Reviewer role required')
     if set(command)!={'kind','expected_revision','proposal_hash'}:raise ContractError('Invalid prepare fields')
     proposal=state['proposal'];result=compile_dossier(state['dossier'])
     if not proposal or not proposal['approved'] or proposal['hash']!=command['proposal_hash']:raise Forbidden('Approved exact proposal required')
     if not result['ready']:raise Conflict('Missing or conflicting evidence prevents dossier preparation')
     # The plan is invalidated by any evidence edit. Review must follow the last edit.
     state['prepared_dossier']={'evidence_hash':result['input_hash'],'proposal_hash':proposal['hash'],'review_note':proposal['review_note'],'sources':[{'id':e['id'],'version':e['version'],'source':e['source']} for e in state['dossier']['evidence']],'disclaimer':'Synthetic readiness dossier; not filed or legally approved.'}
    else:raise ContractError('Unknown mutation')
    revision+=1;state['dossier']['revision']=revision;compile_dossier(state['dossier'])
   db.execute('INSERT INTO workspace VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,body=excluded.body',(wid,revision,canonical(state)))
   previous=db.execute('SELECT sequence,hash FROM audit WHERE workspace=? ORDER BY sequence DESC LIMIT 1',(wid,)).fetchone()
   sequence=previous[0]+1 if previous else 1;prev=previous[1] if previous else '0'*64
   event={'sequence':sequence,'request_hash':request_hash,'command':command,'role':role,'revision':revision,'state_hash':digest(state)}
   event_hash=digest({'previous':prev,'body':event})
   db.execute('INSERT INTO audit VALUES(?,?,?,?,?)',(wid,sequence,prev,event_hash,canonical(event)))
   result={'revision':revision,'state':state,'receipt':event_hash}
   db.execute('INSERT INTO operations VALUES(?,?,?,?)',(wid,key,request_hash,canonical(result)))
   return result
 def export(self,wid):
  with self.connect() as db:
   db.execute('BEGIN')
   row=db.execute('SELECT body FROM workspace WHERE id=?',(wid,)).fetchone()
   if not row:raise ContractError('Unknown workspace')
   events=[{'previous':r[0],'hash':r[1],'body':json.loads(r[2])} for r in db.execute('SELECT previous,hash,body FROM audit WHERE workspace=? ORDER BY sequence',(wid,))]
   state=json.loads(row[0]);db.commit()
  prev='0'*64
  for i,e in enumerate(events,1):
   if e['previous']!=prev or e['body']['sequence']!=i or digest({'previous':prev,'body':e['body']})!=e['hash']:raise Conflict('Audit corruption detected')
   prev=e['hash']
  if not events or events[-1]['body']['state_hash']!=digest(state):raise Conflict('State/audit mismatch')
  return {'schema_version':1,'workspace':wid,'state':state,'events':events,'head':prev,'compiler':compile_dossier(state['dossier'])}
