export const D=8,H=12,E=3,P=D*H+H+H*E+E,COUNT=2*P;
export const DATASET='synthetic-permuted-8class-v1-seed10102026';
export const labels=['Camera','Sensor','Cable','Motor','Switch','Battery','Relay','Panel'];
export type Example={id:string;group:number;x:number[]};
export type Checkpoint={version:1;dataset:string;seed:number;rng:number;step:number;rate:number;temperature:number;weights:number[];m:number[];v:number[];history:{step:number;loss:number}[]};
export function next(state:number):[number,number]{let s=state>>>0;s^=s<<13;s^=s>>>17;s^=s<<5;return[s>>>0,(s>>>0)/4294967296]}
export function dataset(){let rng=10102026;const rand=()=>{const pair=next(rng);rng=pair[0];return pair[1]};
 const items=labels.map((_,g)=>Array.from({length:D},(_,j)=>g===j?1:0));const train:Example[]=[],holdout:Example[]=[];const permutation=[3,0,6,2,7,1,5,4];
 for(let g=0;g<D;g++)for(let n=0;n<12;n++){const x=Array.from({length:D},(_,j)=>(permutation[g]===j?1:0)+(rand()-.5)*.18);const q={id:`q-${g}-${n}`,group:g,x};(n<8?train:holdout).push(q)}
 return{items,train,holdout};
}
export function create(seed=1010,rate=.01,temperature=.2):Checkpoint{
 if(!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('Seed must be 1..4294967295');
 let rng=seed;const weights=Array.from({length:COUNT},()=>{const v=next(rng);rng=v[0];return(v[1]-.5)*.7});
 const c:Checkpoint={version:1,dataset:DATASET,seed,rng,step:0,rate,temperature,weights,m:Array(COUNT).fill(0),v:Array(COUNT).fill(0),history:[]};validate(c);return c;
}
export function validate(c:Checkpoint):void{
 if(!c||c.version!==1||c.dataset!==DATASET)throw Error('Unsupported checkpoint or dataset');
 for(const k of ['seed','rng'] as const)if(!Number.isInteger(c[k])||c[k]<1||c[k]>0xffffffff)throw Error('Invalid RNG state');
 if(!Number.isInteger(c.step)||c.step<0||c.step>5000)throw Error('Step must be 0..5000');
 if(!Number.isFinite(c.rate)||c.rate<.0001||c.rate>.1||!Number.isFinite(c.temperature)||c.temperature<.05||c.temperature>1)throw Error('Rate or temperature out of range');
 for(const key of ['weights','m','v'] as const){if(!Array.isArray(c[key])||c[key].length!==COUNT||c[key].some(v=>!Number.isFinite(v)||Math.abs(v)>1e6))throw Error('Invalid parameter/optimizer shape or nonfinite value')}
 if(c.v.some(v=>v<0))throw Error('Adam variances must be nonnegative');
 if(!Array.isArray(c.history)||c.history.length>5000||c.history.some((h,i)=>!h||h.step!==i+1||!Number.isFinite(h.loss)||h.loss<0||h.loss>100)||c.history.length!==c.step)throw Error('Incomplete or inconsistent loss history');
 if(c.step===0&&(c.m.some(v=>v!==0)||c.v.some(v=>v!==0)))throw Error('Initial optimizer must have zero moments');
}
type Encoded={x:number[];hidden:number[];raw:number[];norm:number;embedding:number[]};
function encode(w:number[],offset:number,x:number[]):Encoded{
 const hidden=Array.from({length:H},(_,h)=>Math.tanh(x.reduce((v,x,d)=>v+x*w[offset+d*H+h],w[offset+D*H+h])));
 const raw=Array.from({length:E},(_,e)=>hidden.reduce((v,h,j)=>v+h*w[offset+D*H+H+j*E+e],w[offset+P-E+e]));
 const norm=Math.sqrt(raw.reduce((v,z)=>v+z*z,0)+1e-8);return{x,hidden,raw,norm,embedding:raw.map(v=>v/norm)};
}
export function embedding(c:Checkpoint,x:number[],tower:'query'|'item'){return encode(c.weights,tower==='query'?0:P,x).embedding}
function back(w:number[],offset:number,s:Encoded,de:number[],grad:number[]){
 const dot=de.reduce((v,g,i)=>v+g*s.embedding[i],0);const dz=de.map((g,i)=>(g-s.embedding[i]*dot)/s.norm);
 const dh=Array(H).fill(0) as number[];
 for(let e=0;e<E;e++){grad[offset+P-E+e]+=dz[e];for(let h=0;h<H;h++){const idx=offset+D*H+H+h*E+e;grad[idx]+=s.hidden[h]*dz[e];dh[h]+=w[idx]*dz[e]}}
 for(let h=0;h<H;h++){const da=dh[h]*(1-s.hidden[h]*s.hidden[h]);grad[offset+D*H+h]+=da;for(let d=0;d<D;d++)grad[offset+d*H+h]+=s.x[d]*da}
}
function softmax(a:number[]){const max=Math.max(...a);const ex=a.map(v=>Math.exp(v-max));const sum=ex.reduce((a,b)=>a+b,0);return{p:ex.map(v=>v/sum),logsum:max+Math.log(sum)}}
export function lossGradient(c:Checkpoint,queries:number[][],items:number[][]){
 if(queries.length!==items.length||queries.length<2||queries.length>16||[...queries,...items].some(x=>x.length!==D||x.some(v=>!Number.isFinite(v))))throw Error('Batch needs 2..16 aligned finite 8D pairs');
 const n=queries.length;const q=queries.map(x=>encode(c.weights,0,x)),v=items.map(x=>encode(c.weights,P,x));
 const scores=q.map(a=>v.map(b=>a.embedding.reduce((s,x,i)=>s+x*b.embedding[i],0)/c.temperature));const ds=scores.map(row=>row.map(()=>0));let loss=0;
 for(let i=0;i<n;i++){const row=softmax(scores[i]);loss+=(row.logsum-scores[i][i])/(2*n);for(let j=0;j<n;j++)ds[i][j]+=(row.p[j]-(i===j?1:0))/(2*n)}
 for(let j=0;j<n;j++){const col=softmax(scores.map(row=>row[j]));loss+=(col.logsum-scores[j][j])/(2*n);for(let i=0;i<n;i++)ds[i][j]+=(col.p[i]-(i===j?1:0))/(2*n)}
 const dq=q.map(()=>Array(E).fill(0) as number[]),dv=v.map(()=>Array(E).fill(0) as number[]);const grad=Array(COUNT).fill(0) as number[];
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let e=0;e<E;e++){dq[i][e]+=ds[i][j]*v[j].embedding[e]/c.temperature;dv[j][e]+=ds[i][j]*q[i].embedding[e]/c.temperature}
 for(let i=0;i<n;i++){back(c.weights,0,q[i],dq[i],grad);back(c.weights,P,v[i],dv[i],grad)}
 return{loss,grad};
}
export function train(input:Checkpoint,steps:number){validate(input);if(!Number.isInteger(steps)||steps<1||steps>500||input.step+steps>5000)throw Error('Train 1..500 steps; maximum5000');
 const c=structuredClone(input),data=dataset();const classes=labels.map((_,g)=>data.train.filter(q=>q.group===g));
 for(let k=0;k<steps;k++){
  const queries=classes.map(rows=>{const r=next(c.rng);c.rng=r[0];return rows[Math.floor(r[1]*rows.length)].x});
  const {loss,grad}=lossGradient(c,queries,data.items);if(!Number.isFinite(loss)||grad.some(v=>!Number.isFinite(v)))throw Error('Nonfinite update rejected');
  const norm=Math.sqrt(grad.reduce((s,v)=>s+v*v,0)),scale=Math.min(1,5/(norm||1));c.step++;
  for(let i=0;i<COUNT;i++){const g=grad[i]*scale;c.m[i]=.9*c.m[i]+.1*g;c.v[i]=.999*c.v[i]+.001*g*g;const m=c.m[i]/(1-Math.pow(.9,c.step)),v=c.v[i]/(1-Math.pow(.999,c.step));c.weights[i]-=c.rate*m/(Math.sqrt(v)+1e-8)}
  c.history.push({step:c.step,loss});
 }
 validate(c);return c;
}
export function rank(c:Checkpoint,query:Example){const data=dataset();const q=embedding(c,query.x,'query');return data.items.map((x,id)=>({id,label:labels[id],score:embedding(c,x,'item').reduce((s,v,i)=>s+v*q[i],0)})).sort((a,b)=>b.score-a.score||a.id-b.id)}
export function evaluate(c:Checkpoint){const data=dataset();let hits=0,rr=0;const results=data.holdout.map(q=>{const ranking=rank(c,q);const at=ranking.findIndex(r=>r.id===q.group)+1;if(at===1)hits++;rr+=1/at;return{id:q.id,expected:labels[q.group],predicted:ranking[0].label,position:at}});return{recall1:hits/data.holdout.length,mrr:rr/data.holdout.length,count:data.holdout.length,results}}
export function gradientCheck(c:Checkpoint){validate(c);const d=dataset(),q=d.train.filter(x=>x.id.endsWith('-0')).map(x=>x.x);const analytical=lossGradient(c,q,d.items).grad;let maxError=0,worst=0;const epsilon=1e-5;
 for(let i=0;i<COUNT;i+=7){const plus=structuredClone(c),minus=structuredClone(c);plus.weights[i]+=epsilon;minus.weights[i]-=epsilon;const numeric=(lossGradient(plus,q,d.items).loss-lossGradient(minus,q,d.items).loss)/(2*epsilon);const error=Math.abs(numeric-analytical[i]);if(error>maxError){maxError=error;worst=i}}
 return{checked:Math.ceil(COUNT/7),maxError,worst,passed:maxError<1e-5,epsilon};
}
