import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function percentile(a,q){const sorted=[...a].sort((x,y)=>x-y);return sorted[Math.max(0,Math.ceil(q*sorted.length)-1)]||0}
function stats(a){const mean=a.reduce((s,x)=>s+x,0)/a.length;const variance=a.length>1?a.reduce((s,x)=>s+(x-mean)**2,0)/(a.length-1):0;return {n:a.length,mean,variance,p95:percentile(a,.95)}}
export function analyze(body){
 if(!body||typeof body!=='object'||!Array.isArray(body.samples)||!Array.isArray(body.changes))throw Error('Expected samples and changes arrays');
 if(body.samples.length>10000||body.changes.length>100)throw Error('Maximum 10000 samples and 100 changes');
 const window=body.window??15;if(!Number.isInteger(window)||window<3||window>120)throw Error('Window must be 3–120 minutes');
 const seen=new Map();let duplicates=0;const samples=[];
 for(const s of body.samples){
  if(!s||typeof s.id!=='string'||!s.id||s.id.length>80||typeof s.service!=='string'||!s.service||s.service.length>80||!Number.isFinite(s.minute)||!Number.isFinite(s.latency)||s.latency<0||s.latency>1e6||typeof s.error!=='boolean')throw Error('Invalid telemetry sample');
  const digest=hash(s);if(seen.has(s.id)){if(seen.get(s.id)!==digest)throw Error('Duplicate ID has conflicting payload');duplicates++;continue}seen.set(s.id,digest);samples.push(s)
 }
 samples.sort((a,b)=>a.minute-b.minute||a.id.localeCompare(b.id));const ids=new Set();const results=[];
 for(const c of body.changes){
  if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||typeof c.service!=='string'||!c.service||typeof c.label!=='string'||c.label.length>100||!Number.isFinite(c.minute))throw Error('Invalid or duplicate change');ids.add(c.id);
  const own=samples.filter(s=>s.service===c.service);const before=own.filter(s=>s.minute>=c.minute-window&&s.minute<c.minute);const after=own.filter(s=>s.minute>=c.minute&&s.minute<c.minute+window);
  if(before.length<5||after.length<5){results.push({...c,status:'insufficient_data',before:before.length,after:after.length});continue}
  const b=stats(before.map(s=>s.latency)),a=stats(after.map(s=>s.latency));
  const controls=samples.filter(s=>s.service!==c.service);const cb=controls.filter(s=>s.minute>=c.minute-window&&s.minute<c.minute),ca=controls.filter(s=>s.minute>=c.minute&&s.minute<c.minute+window);
  const controlAvailable=cb.length>=5&&ca.length>=5;const bc=controlAvailable?stats(cb.map(s=>s.latency)):null,ac=controlAvailable?stats(ca.map(s=>s.latency)):null;
  const rawDelta=a.mean-b.mean;const adjusted=rawDelta-(controlAvailable?ac.mean-bc.mean:0);
  const se=Math.sqrt(a.variance/a.n+b.variance/b.n+(controlAvailable?ac.variance/ac.n+bc.variance/bc.n:0));
  const ci=[adjusted-1.96*se,adjusted+1.96*se];
  const nearby=body.changes.filter(x=>x.id!==c.id&&Math.abs(x.minute-c.minute)<window).map(x=>x.id);
  const errorBefore=before.filter(s=>s.error).length/before.length,errorAfter=after.filter(s=>s.error).length/after.length;
  results.push({...c,status:'analyzed',before:b,after:a,rawDelta,adjustedDelta:adjusted,confidenceInterval:ci,controlAvailable,errorBefore,errorAfter,nearbyChanges:nearby,signal:ci[0]>0?'regression':ci[1]<0?'improvement':'inconclusive',caveat:'Correlation only; normal approximation assumes independent samples. Autocorrelation and service mix can invalidate interval coverage.'})
 }
 results.sort((a,b)=>(b.adjustedDelta??-Infinity)-(a.adjustedDelta??-Infinity));
 const buckets=new Map();for(const s of samples){const key=s.service+'|'+Math.floor(s.minute);if(!buckets.has(key))buckets.set(key,{service:s.service,minute:Math.floor(s.minute),values:[],errors:0});const b=buckets.get(key);b.values.push(s.latency);b.errors+=Number(s.error)}
 return {results,series:[...buckets.values()].map(b=>({service:b.service,minute:b.minute,mean:stats(b.values).mean,p95:percentile(b.values,.95),errorRate:b.errors/b.values.length})),ingestion:{accepted:samples.length,duplicates},fingerprint:hash({samples,changes:body.changes,window}),method:'Difference in means with optional pooled control difference; exploratory normal interval'}
}
