import {validate,seed}from './engine.mjs';
export const initial=()=>({schema:1,revision:0,profile:structuredClone(seed),plan:null,audit:[],receipts:{}});
export function reduce(state,op){
 if(!op||typeof op.id!=='string'||!op.id||op.id.length>100)throw Error('Operation ID required.');
 const payload=JSON.stringify(op);if(state.receipts[op.id]){if(state.receipts[op.id]!==payload)throw Error('Conflicting operation ID.');return state;}
 if(op.expected!==state.revision)throw Error('Workspace changed in another tab. Reload before retrying.');
 const next=structuredClone(state),plan=next.plan;
 if(op.type==='import'){next.profile=validate(op.profile);next.plan=null;}
 else if(op.type==='plan'){
  if(!op.result||!Array.isArray(op.result.slots)||op.result.slots.length!==next.profile.slots.length)throw Error('Solver result missing.');
  next.plan={...op.result,status:'draft',index:0,spent:0,note:'',version:state.revision,hash:op.hash};
 }else if(op.type==='review'){if(!plan||plan.status!=='draft'||!op.note?.trim())throw Error('A draft and review note are required.');plan.status='reviewed';plan.note=op.note.trim().slice(0,500);}
 else if(op.type==='approve'){if(!plan||plan.status!=='reviewed')throw Error('Review the draft before approval.');plan.status='approved';}
 else if(op.type==='step'){
  if(!plan||!['approved','running'].includes(plan.status))throw Error('Approve or resume before dispatch.');
  if(op.fail){plan.status='interrupted';}
  else {plan.spent+=plan.slots[plan.index].cost;plan.index++;plan.status=plan.index===plan.slots.length?'complete':'running';}
 }else if(op.type==='resume'){if(!plan||plan.status!=='interrupted')throw Error('No interrupted dispatch.');plan.status='running';}
 else throw Error('Unknown operation.');
 next.revision++;next.receipts[op.id]=payload;next.audit.push({revision:next.revision,type:op.type,id:op.id,status:next.plan?.status??'unplanned',slot:next.plan?.index??0});return next;
}
export function openStore(name='loadstone-workspace'){return new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});}
export async function read(db){return new Promise((resolve,reject)=>{const tx=db.transaction('state');const r=tx.objectStore('state').get('workspace');r.onsuccess=()=>resolve(r.result??initial());r.onerror=()=>reject(r.error);});}
export async function apply(db,op){return new Promise((resolve,reject)=>{
 const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),r=store.get('workspace');let next;
 r.onsuccess=()=>{try{next=reduce(r.result??initial(),op);store.put(next,'workspace');}catch(e){reject(e);tx.abort();}};
 tx.oncomplete=()=>resolve(next);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??Error('Transaction cancelled.'));
 });}
