export function validate(p){
 if(!p||p.schema!==1||typeof p.name!=='string'||!p.name.trim()||p.name.length>100)throw Error('Profile schema 1 and a name are required.');
 const fields={capacity:[1,32],initial:[0,p.capacity],reserve:[0,p.capacity],power:[0,16],generator:[0,12],ramp:[0,12],fuel:[0,1000],wear:[0,1000]};
 for(const [k,[min,max]]of Object.entries(fields))if(!Number.isInteger(p[k])||p[k]<min||p[k]>max)throw Error(`Invalid ${k}.`);
 if(!Array.isArray(p.slots)||p.slots.length<1||p.slots.length>48)throw Error('Use 1–48 slots.');
 for(const s of p.slots)for(const k of ['demand','solar','price','gridLimit'])if(!Number.isInteger(s[k])||s[k]<0||s[k]>1000)throw Error(`Invalid slot ${k}.`);
 return structuredClone(p);
}
export async function solve(p,bytes){
 validate(p);const {instance}=await WebAssembly.instantiate(bytes,{});const e=instance.exports;
 const v=new Int32Array(e.memory.buffer,e.input_ptr(),16+p.slots.length*4);v.fill(0);
 v.set([p.slots.length,p.capacity,p.initial,p.reserve,p.power,p.generator,p.ramp,p.fuel,p.wear]);
 p.slots.forEach((s,i)=>v.set([s.demand,s.solar,s.price,s.gridLimit],16+i*4));
 const result=e.solve();if(result<0)throw Error(result===-2?'No schedule satisfies terminal reserve.':'The core rejected the profile.');
 const raw=new Int32Array(e.memory.buffer,e.output_ptr(),result*7);
 const slots=Array.from({length:result},(_,t)=>({slot:t+1,generator:raw[t*7],battery:raw[t*7+1],grid:raw[t*7+2],spill:raw[t*7+3],soc:raw[t*7+4],shed:raw[t*7+5],cost:raw[t*7+6]}));
 return {cost:Number(e.result_cost()),transitions:e.transitions(),slots,shed:slots.reduce((a,s)=>a+s.shed,0)};
}
export function greedy(p){let soc=p.initial,prev=0,cost=0;const slots=[];
 for(const [t,s]of p.slots.entries()){const g=Math.min(p.generator,prev+p.ramp,Math.max(0,s.demand-s.solar));prev=g;const net=s.demand-s.solar-g;const grid=Math.min(s.gridLimit,Math.max(0,net)),shed=Math.max(0,net-grid),step=grid*s.price+g*p.fuel+shed*10000;cost+=step;slots.push({slot:t+1,generator:g,battery:0,grid,spill:Math.max(0,-net),soc,shed,cost:step});}
 return {cost,slots,feasible:soc>=p.reserve};}
export const seed={schema:1,name:'Harbor microgrid · synthetic seed 13102026',capacity:12,initial:6,reserve:4,power:3,generator:4,ramp:2,fuel:28,wear:2,slots:Array.from({length:12},(_,i)=>({demand:[6,5,5,7,8,9,8,7,9,7,6,5][i],solar:[0,0,1,3,5,7,6,3,1,0,0,0][i],price:[12,11,9,10,14,18,22,38,45,39,20,14][i],gridLimit:9}))};
