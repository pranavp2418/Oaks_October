export type Job={id:string;tenant:string;endpoint:string;payload:string;status:'queued'|'leased'|'delivered'|'dead';attempts:number;due:number;token:number;expires:number;worker:string;outcomes:number[]};
export type State={now:number;revision:number;jobs:Job[];circuits:Record<string,{failures:number;until:number}>;events:any[];seen:Record<string,string>;trace:any[]};
export const initial=():State=>({now:0,revision:0,jobs:[],circuits:{},events:[],seen:{},trace:[]});
const id=(v:any)=>{if(typeof v!=='string'||! /^[a-zA-Z0-9_-]{1,48}$/.test(v))throw Error('Invalid identifier');if(['__proto__','prototype','constructor'].includes(v))throw Error('Reserved identifier');return v};
const num=(v:any,min=0,max=10000)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error('Invalid bounded integer');return v};
export function apply(prior:State, raw:any):State {
 if(!raw||typeof raw!=='object')throw Error('Operation required');
 const e=JSON.parse(JSON.stringify(raw));id(e.id);const key=JSON.stringify(e);
 if(Object.hasOwn(prior.seen,e.id)){if(prior.seen[e.id]!==key)throw Error('Conflicting operation id');return prior;}
 if(e.revision!==prior.revision)throw Error('Stale revision');
 const s:State=structuredClone(prior); const log=(kind:string,detail:any)=>s.trace.push({at:s.now,kind,...detail});
 if(s.events.length>=1000)throw Error('Journal budget exhausted');
 if(e.kind==='enqueue'){
  id(e.job);id(e.tenant);id(e.endpoint);if(s.jobs.some(j=>j.id===e.job))throw Error('Job id already exists');
  if(s.jobs.length>=100)throw Error('Job budget exhausted');
  if(typeof e.payload!=='string'||e.payload.length>1024)throw Error('Payload exceeds budget');
  if(!Array.isArray(e.outcomes)||!e.outcomes.length||e.outcomes.length>10||e.outcomes.some((x:any)=>!Number.isInteger(x)||x<100||x>599))throw Error('HTTP fixture invalid');
  s.jobs.push({id:e.job,tenant:e.tenant,endpoint:e.endpoint,payload:e.payload,status:'queued',attempts:0,due:s.now,token:0,expires:0,worker:'',outcomes:e.outcomes});log('enqueue',{job:e.job});
 }else if(e.kind==='tick'){
  s.now+=num(e.delta,1,1000);for(const j of s.jobs)if(j.status==='leased'&&j.expires<=s.now){j.status=j.attempts>=4?'dead':'queued';j.due=s.now;log('lease-expired',{job:j.id,token:j.token});}
 }else if(e.kind==='claim'){
  id(e.worker);id(e.tenant);
  if(s.jobs.some(j=>j.tenant===e.tenant&&j.status==='leased'))throw Error('Tenant concurrency cap reached');
  const candidates=s.jobs.filter(j=>j.tenant===e.tenant&&j.status==='queued'&&j.due<=s.now&&(s.circuits[j.endpoint]?.until??0)<=s.now).sort((a,b)=>a.due-b.due||a.id.localeCompare(b.id));
  const j=candidates[0];if(!j)throw Error('No ready delivery');
  j.status='leased';j.worker=e.worker;j.token++;j.expires=s.now+5;j.attempts++;log('claimed',{job:j.id,worker:e.worker,token:j.token});
 }else if(e.kind==='complete'){
  const j=s.jobs.find(j=>j.id===e.job);if(!j||j.status!=='leased'||j.token!==e.token||j.worker!==e.worker||j.expires<=s.now)throw Error('Stale worker fenced');
  const code=j.outcomes[Math.min(j.attempts-1,j.outcomes.length-1)];
  const c=s.circuits[j.endpoint]??{failures:0,until:0};s.circuits[j.endpoint]=c;
  if(code>=200&&code<300){j.status='delivered';c.failures=0;c.until=0;}
  else if(code===429||code>=500){c.failures++;if(c.failures>=2)c.until=s.now+8;j.status=j.attempts>=4?'dead':'queued';j.due=s.now+2**j.attempts;}
  else j.status='dead';
  log('response',{job:j.id,code,status:j.status,due:j.due,circuitUntil:c.until});
 }else if(e.kind==='redrive'){
  const j=s.jobs.find(j=>j.id===e.job);if(!j||j.status!=='dead')throw Error('Only dead letters may be redriven');
  if(typeof e.note!=='string'||e.note.trim().length<3)throw Error('Review note required');
  j.status='queued';j.attempts=0;j.due=s.now;j.token++;log('reviewed-redrive',{job:j.id,note:e.note});
 }else throw Error('Unknown operation');
 s.events.push(e);s.seen[e.id]=key;s.revision++;return s;
}
export function replay(events:any[]):State {if(!Array.isArray(events)||events.length>1000)throw Error('Journal budget exceeded');return events.reduce(apply,initial());}
export function tenantView(s:State,tenant:string){return s.jobs.filter(j=>j.tenant===tenant)}
