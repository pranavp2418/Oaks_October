/** Exact typed repair synthesis for synthetic connectors. No external network execution. */
export type Value=string|number|boolean;
export type Field={name:string;domain:Value[];value:Value;changeCost:number;protected:boolean};
export type Constraint={id:string;kind:'equal'|'implies'|'lessEqual';fields:string[];value?:Value;then?:Value};
export type Case={fields:Field[];constraints:Constraint[]};
export type Violation={id:string;reason:string};
const identifier=(s:unknown):s is string=>typeof s==='string'&&/^[A-Za-z][A-Za-z0-9_.-]{0,47}$/.test(s);
export function validate(input:unknown):Case{
 const r=input as Case;if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['fields','constraints'].includes(k))||!Array.isArray(r.fields)||r.fields.length<1||r.fields.length>10||!Array.isArray(r.constraints)||r.constraints.length>40)throw Error('Invalid bounded connector contract');
 const names=new Set<string>();let combinations=1;
 for(const f of r.fields){if(!f||Object.keys(f).sort().join(',')!=='changeCost,domain,name,protected,value'||!identifier(f.name)||names.has(f.name)||!Array.isArray(f.domain)||!f.domain.length||f.domain.length>6||typeof f.protected!=='boolean'||!Number.isSafeInteger(f.changeCost)||f.changeCost<1||f.changeCost>1000)throw Error('Invalid field');names.add(f.name);
  const typ=typeof f.value;if(!['string','number','boolean'].includes(typ)||f.domain.some(v=>typeof v!==typ||(typeof v==='number'&&!Number.isSafeInteger(v))||(typeof v==='string'&&v.length>100))||!f.domain.includes(f.value)||new Set(f.domain).size!==f.domain.length)throw Error('Invalid typed field domain');combinations*=f.protected?1:f.domain.length;
 }
 if(combinations>100000)throw Error('Exact repair search exceeds 100000 assignments');
 const ids=new Set<string>();for(const c of r.constraints){if(!c||!identifier(c.id)||ids.has(c.id)||!['equal','implies','lessEqual'].includes(c.kind)||!Array.isArray(c.fields)||c.fields.some(f=>!names.has(f)))throw Error('Invalid constraint');ids.add(c.id);
  if(c.kind==='equal'&&(c.fields.length!==1||!('value'in c)))throw Error('Equal requires one field and value');
  if(c.kind==='implies'&&(c.fields.length!==2||!('value'in c)||!('then'in c)))throw Error('Implication requires two fields and typed values');
  if(c.kind==='lessEqual'&&c.fields.length!==2)throw Error('Comparison requires two fields');
  const by=new Map(r.fields.map(f=>[f.name,f]));
  if(c.kind==='equal'&&!by.get(c.fields[0])!.domain.includes(c.value!))throw Error('Constraint value outside domain');
  if(c.kind==='implies'&&(!by.get(c.fields[0])!.domain.includes(c.value!)||!by.get(c.fields[1])!.domain.includes(c.then!)))throw Error('Constraint implication outside domain');
  if(c.kind==='lessEqual'&&c.fields.some(k=>typeof by.get(k)!.value!=='number'))throw Error('Comparison requires numeric fields');
 }
 return structuredClone(r);
}
export function violations(r:Case,values:Record<string,Value>):Violation[]{return r.constraints.filter(c=>c.kind==='equal'?values[c.fields[0]]!==c.value:c.kind==='implies'?values[c.fields[0]]===c.value&&values[c.fields[1]]!==c.then:(values[c.fields[0]] as number)>(values[c.fields[1]] as number)).map(c=>({id:c.id,reason:c.kind==='equal'?`${c.fields[0]} must equal ${String(c.value)}`:c.kind==='implies'?`${c.fields[0]}=${String(c.value)} requires ${c.fields[1]}=${String(c.then)}`:`${c.fields[0]} must not exceed ${c.fields[1]}`}));}
export function repair(input:unknown){const r=validate(input);const initial=Object.fromEntries(r.fields.map(f=>[f.name,f.value]));let checked=0;let best:{values:Record<string,Value>;cost:number;changes:number;signature:string}|null=null;const values:Record<string,Value>={};
 function visit(index:number,cost:number,changes:number){if(best&&cost>best.cost)return;if(index===r.fields.length){checked++;if(violations(r,values).length)return;const signature=JSON.stringify(r.fields.map(f=>values[f.name]));if(!best||cost<best.cost||cost===best.cost&&(changes<best.changes||changes===best.changes&&signature<best.signature))best={values:{...values},cost,changes,signature};return;}
  const f=r.fields[index];for(const v of f.protected?[f.value]:f.domain){values[f.name]=v;visit(index+1,cost+(v===f.value?0:f.changeCost),changes+(v===f.value?0:1));}}
 visit(0,0,0);const result=best as {values:Record<string,Value>;cost:number;changes:number;signature:string}|null;
 return {feasible:!!result,initial_violations:violations(r,initial),cost:result?.cost??null,patch:result?r.fields.filter(f=>result.values[f.name]!==f.value).map(f=>({field:f.name,before:f.value,after:result.values[f.name],change_cost:f.changeCost})):[],repaired:result?.values??null,assignments_checked:checked,limits:'Finite synthetic connector configuration; no external delivery or customer system touched.'};}
export function replay(input:unknown,patch:{field:string;before:Value;after:Value}[]){const r=validate(input);const seen=new Set<string>();for(const p of patch){const f=r.fields.find(f=>f.name===p.field);if(!f||seen.has(p.field)||f.protected||f.value!==p.before||!f.domain.includes(p.after))throw Error('Patch is stale, unauthorized or outside typed domain');seen.add(p.field);f.value=p.after;}const values=Object.fromEntries(r.fields.map(f=>[f.name,f.value]));return {passed:violations(r,values).length===0,violations:violations(r,values),values};}
