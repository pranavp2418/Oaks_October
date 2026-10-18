"""Checkpointed, bounded read-only investigation. Human review cannot mutate evidence."""
from __future__ import annotations
import copy,sqlite3
from typing import TypedDict
from langchain_core.tools import tool
from langgraph.graph import StateGraph,START,END
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import interrupt,Command
from core import compile_dossier,canonical,digest,ContractError,text
from provider import choose_live

class AgentState(TypedDict,total=False):
 goal:str
 dossier:dict
 trace:list
 decision:dict
 steps:int
 status:str
 report:dict
 review:dict
 mode:str


def tools_for(dossier):
 @tool
 def inspect_readiness()->dict:
  """Inspect compiled readiness, contradictory evidence, deadline and missing-evidence frontiers."""
  return compile_dossier(dossier)
 @tool
 def trace_evidence(evidence_id:str)->dict:
  """Read a known evidence item, its source/version, and every direct dependent requirement."""
  item=next((e for e in dossier['evidence'] if e['id']==evidence_id),None)
  if item is None:raise ContractError('Unknown evidence id')
  return {'evidence':item,'dependents':[r for r in dossier['requirements'] if evidence_id in r['inputs']]}
 @tool
 def compare_alternatives()->dict:
  """Compare exact evidence completion frontiers by cost, deadline and unresolved contradictions."""
  result=compile_dossier(dossier)
  return {'alternatives':result['alternatives'],'deadline':result['deadline'],'input_hash':result['input_hash']}
 @tool
 def simulate_resolution(evidence_id:str)->dict:
  """Read-only counterfactual: resolve one known evidence item, without changing the workspace."""
  changed=copy.deepcopy(dossier);item=next((e for e in changed['evidence'] if e['id']==evidence_id),None)
  if item is None:raise ContractError('Unknown evidence id')
  item['state']='valid'
  return {'simulated_evidence':evidence_id,'not_applied':True,'result':compile_dossier(changed)}
 return {t.name:t for t in (inspect_readiness,trace_evidence,compare_alternatives,simulate_resolution)}


def deterministic_choice(state):
 """Explicit deterministic agent policy; never presented as a model response."""
 trace=state['trace'];d=state['dossier'];goal=state['goal'].lower()
 if not trace:return {'tool':'inspect_readiness','arguments':{}}
 if len(trace)==1:
  conflicts=[e for e in d['evidence'] if e['state']=='conflicting']
  if conflicts and any(word in goal for word in ('conflict','owner','source')):return {'tool':'trace_evidence','arguments':{'evidence_id':conflicts[0]['id']}}
  return {'tool':'compare_alternatives','arguments':{}}
 if len(trace)==2:
  result=compile_dossier(d);missing=result['alternatives'][0]['missing']
  if missing:
   # Choose the slowest missing item on the cheapest plan for a useful counterfactual.
   es={e['id']:e for e in d['evidence']};key=max(missing,key=lambda k:(es[k]['days'],k))
   return {'tool':'simulate_resolution','arguments':{'evidence_id':key}}
 return {'tool':'finish','arguments':{}}


def make_graph(checkpointer,chooser=None,oidc_token=None):
 def decide(state):
  if state['steps']>=4:return {'status':'budget_exhausted','decision':{'tool':'finish','arguments':{}}}
  try:
   if chooser:choice=chooser(copy.deepcopy(state));receipt=None
   elif state['mode']=='live':
    tools=tools_for(state['dossier']);schemas=[{'name':t.name,'schema':t.args_schema.model_json_schema()} for t in tools.values()]
    r=choose_live(state['goal'],state['trace'],schemas,oidc_token=oidc_token);choice=r['choice'];receipt=r['provider']
   else:choice=deterministic_choice(state);receipt=None
   if not isinstance(choice,dict) or set(choice)!={'tool','arguments'} or not isinstance(choice['tool'],str) or not isinstance(choice['arguments'],dict):raise ContractError('Invalid decision shape')
   # Finish text is not trusted as a factual report. The report is derived from verified tool output.
   if choice['tool']!='finish' and choice['tool'] not in tools_for(state['dossier']):raise ContractError('Tool denied by read-only allowlist')
   return {'decision':{'choice':choice,'provider':receipt},'steps':state['steps']+1,'status':'investigating'}
  except Exception as error:
   # Do not expose provider bodies, credentials or arbitrary exception strings.
   return {'status':'failed','decision':{'error':type(error).__name__},'steps':state['steps']+1}
 def route(state):
  if state['status']=='failed':return 'failed'
  if state['status']=='budget_exhausted' or state['decision']['choice']['tool']=='finish':return 'report'
  return 'tool'
 def execute(state):
  choice=state['decision']['choice'];name=choice['tool'];args=choice['arguments'];tools=tools_for(state['dossier'])
  try:
   fields=tools[name].args_schema.model_fields
   if set(args)-set(fields):raise ContractError('Unexpected tool arguments')
   if any(type(v) is not str for v in args.values()):raise ContractError('Tool ids must be strings')
   value=tools[name].invoke(args)
   observation={'id':f"E{len(state['trace'])+1}",'tool':name,'arguments':args,'result':value,'result_hash':digest(value),'provider':state['decision'].get('provider')}
   return {'trace':state['trace']+[observation]}
  except Exception as error:
   return {'status':'failed','trace':state['trace']+[{'id':f"E{len(state['trace'])+1}",'tool':name,'arguments':args,'error':type(error).__name__}]}
 def after_tool(state):return 'failed' if state['status']=='failed' else 'decide'
 def report(state):
  if not any(x.get('tool')=='inspect_readiness' and 'result' in x for x in state['trace']):return {'status':'failed','report':{'reason':'No verified readiness observation'}}
  result=compile_dossier(state['dossier']);conflicts=[e['id'] for e in state['dossier']['evidence'] if e['state']=='conflicting']
  return {'status':'awaiting_review','report':{'goal':state['goal'],'workspace_revision':state['dossier']['revision'],'evidence_hash':digest(state['dossier']),'ready':result['ready'],'earliest_day':result['earliest_day'],'slack_days':result['slack_days'],'conflicts':conflicts,'alternatives':result['alternatives'],'citations':[x['id'] for x in state['trace'] if 'result' in x],'execution':'live model tool selection' if state['mode']=='live' else 'deterministic bounded agent policy','claim':'Investigation only. No evidence changed, dossier submitted or approval granted.'}}
 def human_review(state):
  answer=interrupt({'report':state['report'],'trace':state['trace'],'action':'Review investigation; this cannot apply project changes.'})
  if not isinstance(answer,dict) or set(answer)!={'decision','evidence_hash','note'} or answer['decision'] not in ('accept','reject') or answer['evidence_hash']!=digest(state['dossier']):raise ContractError('Exact evidence-bound review required')
  text(answer['note'],'review note',1000)
  return {'review':answer,'status':'reviewed' if answer['decision']=='accept' else 'rejected'}
 def failed(state):return {'status':'failed'}
 g=StateGraph(AgentState)
 for name,fn in [('decide',decide),('tool',execute),('report',report),('review',human_review),('failed',failed)]:g.add_node(name,fn)
 g.add_edge(START,'decide');g.add_conditional_edges('decide',route,{'tool':'tool','report':'report','failed':'failed'});g.add_conditional_edges('tool',after_tool,{'decide':'decide','failed':'failed'});g.add_conditional_edges('report',lambda s:'failed' if s['status']=='failed' else 'review',{'failed':'failed','review':'review'});g.add_edge('review',END);g.add_edge('failed',END)
 return g.compile(checkpointer=checkpointer)

class Investigation:
 def __init__(self,path,chooser=None,oidc_token=None):
  self.connection=sqlite3.connect(str(path),check_same_thread=False)
  self.graph=make_graph(SqliteSaver(self.connection),chooser,oidc_token)
 def close(self):self.connection.close()
 def config(self,thread):text(thread,'investigation id',100);return {'configurable':{'thread_id':thread},'recursion_limit':20}
 def start(self,thread,dossier,goal,mode='deterministic'):
  compile_dossier(dossier);text(goal,'goal',1000)
  if mode not in ('deterministic','live'):raise ContractError('Unknown agent mode')
  config=self.config(thread)
  if self.graph.get_state(config).values:raise ContractError('Investigation already exists; resume its checkpoint')
  return self.graph.invoke({'goal':goal,'dossier':copy.deepcopy(dossier),'trace':[],'steps':0,'status':'investigating','mode':mode},config)
 def resume(self,thread,review,current_dossier):
  config=self.config(thread);state=self.graph.get_state(config)
  if not state.values or state.values['status']!='awaiting_review':raise ContractError('No review checkpoint to resume')
  if digest(current_dossier)!=digest(state.values['dossier']):raise ContractError('Workspace changed; investigate the new revision')
  return self.graph.invoke(Command(resume=review),config)
 def state(self,thread):return self.graph.get_state(self.config(thread)).values
