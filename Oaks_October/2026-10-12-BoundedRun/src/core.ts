export type NodeState='waiting'|'ready'|'running'|'succeeded'|'failed'|'blocked';
export type Step={id:string;deps:string[];tool:string;cost:number;maxAttempts:number;input:string};
export type Plan={steps:Step[];allowedTools:string[];budget:number};
export type Event={seq:number;step:string;type:string;attempt:number;spent:number;detail:string};
export type Snapshot={version:1;plan:Plan;states:Record<string,NodeState>;attempts:Record<string,number>;outputs:Record<string,string>;spent:number;events:Event[];idempotency:Record<string,string>};
export type ToolResult={ok:boolean;output:string;retryable?:boolean};
export type Tool=(input:string,attempt:number)=>ToolResult;

const ID=/^[a-z][a-z0-9-]{0,31}$/;
export function validate(plan:Plan):void{
 if(!Number.isInteger(plan.budget)||plan.budget<0||plan.budget>1000)throw Error('Budget must be an integer from 0 to 1000.');
 if(plan.steps.length<1||plan.steps.length>24)throw Error('Plan must contain 1 to 24 steps.');
 const ids=new Set<string>(); for(const s of plan.steps){if(!ID.test(s.id)||ids.has(s.id))throw Error(`Invalid or duplicate step: ${s.id}`);ids.add(s.id);if(!ID.test(s.tool)||!Number.isInteger(s.cost)||s.cost<0||s.cost>100||!Number.isInteger(s.maxAttempts)||s.maxAttempts<1||s.maxAttempts>5)throw Error(`Invalid bounds for ${s.id}`)}
 for(const s of plan.steps)for(const d of s.deps)if(!ids.has(d)||d===s.id)throw Error(`Invalid dependency ${d} for ${s.id}`);
 const visiting=new Set<string>(),done=new Set<string>(),by=new Map(plan.steps.map(s=>[s.id,s]));
 const visit=(id:string)=>{if(visiting.has(id))throw Error('Plan contains a dependency cycle.');if(done.has(id))return;visiting.add(id);for(const d of by.get(id)!.deps)visit(d);visiting.delete(id);done.add(id)};for(const id of ids)visit(id);
}
export function fresh(plan:Plan):Snapshot{validate(plan);return{version:1,plan:structuredClone(plan),states:Object.fromEntries(plan.steps.map(s=>[s.id,s.deps.length?'waiting':'ready'])),attempts:Object.fromEntries(plan.steps.map(s=>[s.id,0])),outputs:{},spent:0,events:[],idempotency:{}}}
function append(s:Snapshot,step:string,type:string,attempt:number,detail:string){s.events.push({seq:s.events.length+1,step,type,attempt,spent:s.spent,detail})}
export function tick(source:Snapshot,tools:Record<string,Tool>):Snapshot{
 const s=structuredClone(source);validate(s.plan);const by=new Map(s.plan.steps.map(x=>[x.id,x]));
 for(const step of s.plan.steps){if(s.states[step.id]==='waiting'){const deps=step.deps.map(d=>s.states[d]);if(deps.some(x=>x==='failed'||x==='blocked')){s.states[step.id]='blocked';append(s,step.id,'blocked',0,'dependency failed')}else if(deps.every(x=>x==='succeeded'))s.states[step.id]='ready'}}
 const step=s.plan.steps.find(x=>s.states[x.id]==='ready');if(!step)return s;
 if(!s.plan.allowedTools.includes(step.tool)){s.states[step.id]='failed';append(s,step.id,'denied',0,'tool not in capability set');return s}
 if(s.spent+step.cost>s.plan.budget){s.states[step.id]='failed';append(s,step.id,'budget-exhausted',0,`requires ${step.cost}`);return s}
 const tool=tools[step.tool];if(!tool){s.states[step.id]='failed';append(s,step.id,'missing-tool',0,step.tool);return s}
 const key=`${step.id}:${step.tool}:${step.input}`;if(s.idempotency[key]){s.outputs[step.id]=s.idempotency[key];s.states[step.id]='succeeded';append(s,step.id,'replayed',s.attempts[step.id]??0,'cached output');return s}
 s.states[step.id]='running';s.spent+=step.cost;s.attempts[step.id]=(s.attempts[step.id]??0)+1;const attempt=s.attempts[step.id]!;append(s,step.id,'started',attempt,step.tool);const result=tool(step.input,attempt);
 if(result.ok){s.states[step.id]='succeeded';s.outputs[step.id]=result.output;s.idempotency[key]=result.output;append(s,step.id,'succeeded',attempt,result.output)}else if(result.retryable&&attempt<step.maxAttempts){s.states[step.id]='ready';append(s,step.id,'retry-scheduled',attempt,result.output)}else{s.states[step.id]='failed';append(s,step.id,'failed',attempt,result.output)}return s;
}
export function run(source:Snapshot,tools:Record<string,Tool>,limit=100):Snapshot{let s=structuredClone(source);for(let i=0;i<limit;i++){const before=JSON.stringify(s.states);s=tick(s,tools);if(JSON.stringify(s.states)===before&&!Object.values(s.states).includes('ready'))break}return s}
export function recover(raw:string):Snapshot{const value=JSON.parse(raw) as Snapshot;if(value.version!==1||!value.plan||!value.states||!Array.isArray(value.events))throw Error('Unsupported checkpoint.');validate(value.plan);const ids=new Set(value.plan.steps.map(s=>s.id));if(Object.keys(value.states).some(x=>!ids.has(x))||value.spent<0||value.spent>value.plan.budget)throw Error('Checkpoint invariant failed.');return structuredClone(value)}
export function terminal(s:Snapshot){return Object.values(s.states).every(x=>x==='succeeded'||x==='failed'||x==='blocked')}
