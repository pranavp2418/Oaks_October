"""Safe replay transport. No shared hosted database or independent reviewer identity is claimed."""
import copy,pathlib,tempfile
from core import ContractError,canonical,digest
from workspace import Workspace,Conflict,Forbidden
from agent import Investigation
class ServiceError(ValueError):
 def __init__(self,status,message):self.status=status;super().__init__(message)

def handle(payload,oidc_token=None):
 if not isinstance(payload,dict) or set(payload)-{'journal','action','investigation'}:raise ServiceError(400,'Unexpected request fields')
 journal=payload.get('journal');action=payload.get('action',{'kind':'inspect'})
 if not isinstance(journal,list) or not 1<=len(journal)<=200:raise ServiceError(400,'Expected 1..200 journal operations')
 if not isinstance(action,dict) or not isinstance(action.get('kind'),str):raise ServiceError(400,'Action kind required')
 try:
  with tempfile.TemporaryDirectory(prefix='lintel-request-') as directory:
   store=Workspace(pathlib.Path(directory)/'workspace.sqlite')
   for operation in journal:
    if not isinstance(operation,dict) or set(operation)!={'key','command','role'}:raise ContractError('Invalid journal operation')
    store.mutate('notebook',operation['key'],operation['command'],operation['role'])
   exported=store.export('notebook');state=exported['state'];kind=action['kind'];investigation=None
   if kind=='mutate':
    if len(journal)>=200:raise ContractError('Notebook reached200operations; export is still available. No change was saved.')
    if set(action)!={'kind','operation'}:raise ContractError('Invalid mutate action')
    operation=action['operation']
    if not isinstance(operation,dict) or set(operation)!={'key','command','role'}:raise ContractError('Invalid operation')
    store.mutate('notebook',operation['key'],operation['command'],operation['role']);journal=journal+[operation];exported=store.export('notebook')
   elif kind in ('investigate','review_investigation'):
    if kind=='investigate':
     if set(action)!={'kind','goal','mode'}:raise ContractError('Invalid investigation action')
     a=Investigation(pathlib.Path(directory)/'agent.sqlite',oidc_token=oidc_token)
     try:values=a.start('case',state['dossier'],action['goal'],action['mode'])
     finally:a.close()
     investigation={'dossier_hash':digest(state['dossier']),'goal':action['goal'],'mode':action['mode'],'values':values}
    else:
     if set(action)!={'kind','review'}:raise ContractError('Invalid review action')
     saved=payload.get('investigation')
     if not isinstance(saved,dict) or set(saved)!={'dossier_hash','goal','mode','values'} or saved['dossier_hash']!=digest(state['dossier']):raise Conflict('Workspace changed; start a new investigation')
     values=saved['values']
     if not isinstance(values,dict) or values.get('status')!='awaiting_review' or not isinstance(values.get('trace'),list) or len(values['trace'])>4:raise ContractError('No valid review checkpoint')
     # Restore by re-running validated read-only tools, not deserializing client code/DB/pickle.
     choices=[{'tool':x['tool'],'arguments':x['arguments']} for x in values['trace']]
     def replay(s):return choices[s['steps']] if s['steps']<len(choices) else {'tool':'finish','arguments':{}}
     a=Investigation(pathlib.Path(directory)/'agent.sqlite',chooser=replay)
     try:
      replayed=a.start('case',state['dossier'],saved['goal'],saved['mode'])
      if replayed['report']!=values.get('report'):raise Conflict('Saved report does not match reproducible tool evidence')
      reviewed=a.resume('case',action['review'],state['dossier'])
     finally:a.close()
     investigation={**saved,'values':reviewed,'restoration':'Tools re-executed from visitor journal; provider receipts are historical, not cryptographically authenticated.'}
   elif kind!='inspect' or set(action)!={'kind'}:raise ContractError('Unknown action')
   # LangGraph interrupt objects are internal control records, never sent to JSON clients.
   if investigation:investigation['values']={k:v for k,v in investigation['values'].items() if k!='__interrupt__'}
   return {'journal':journal,'export':exported,'investigation':investigation,'persistence':'Visitor-owned single-user journal persisted by the browser. Server SQLite is request-local; no multiuser database or independent reviewer identity.'}
 except Forbidden as e:raise ServiceError(403,str(e)) from None
 except Conflict as e:raise ServiceError(409,str(e)) from None
 except ContractError as e:raise ServiceError(400,str(e)) from None
