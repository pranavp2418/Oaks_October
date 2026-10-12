import {fresh,run,tick,recover,terminal,type Plan,type Snapshot,type Tool} from './core.js';
const plan:Plan={budget:13,allowedTools:['lookup','score','notify'],steps:[
 {id:'collect',deps:[],tool:'lookup',cost:2,maxAttempts:1,input:'synthetic-case'},
 {id:'evaluate',deps:['collect'],tool:'score',cost:3,maxAttempts:3,input:'case-features'},
 {id:'review',deps:['evaluate'],tool:'score',cost:3,maxAttempts:1,input:'policy-check'},
 {id:'handoff',deps:['review'],tool:'notify',cost:2,maxAttempts:1,input:'review-queue'}]};
let failOnce=true;const tools:Record<string,Tool>={lookup:i=>({ok:true,output:`loaded:${i}`}),score:(i,a)=>i==='case-features'&&failOnce&&a===1?(failOnce=false,{ok:false,retryable:true,output:'transient timeout'}):({ok:true,output:`score:${i}:pass`}),notify:i=>({ok:true,output:`queued:${i}`})};
let state:Snapshot;const $=<T extends HTMLElement>(q:string)=>document.querySelector<T>(q)!;
function reset(){failOnce=true;state=fresh(plan);save();paint('Plan ready.');}
function save(){localStorage.setItem('boundedrun-v1',JSON.stringify(state))}
function paint(message=''){$('#budget').textContent=`${state.spent} / ${state.plan.budget}`;$('#status').textContent=message|| (terminal(state)?'Run reached a terminal state.':'Checkpoint saved.');$('#steps').innerHTML=state.plan.steps.map(s=>`<button class="step ${state.states[s.id]}" data-id="${s.id}"><span>${s.id}</span><small>${s.tool} · ${s.cost} units</small><b>${state.states[s.id]}</b></button>`).join('');$('#trace').innerHTML=state.events.length?state.events.slice().reverse().map(e=>`<li><time>#${e.seq}</time><span><b>${e.step}</b> ${e.type}<small>${e.detail}</small></span><em>${e.spent}</em></li>`).join(''):'<li class="empty">No execution events yet.</li>';}
$('#step').addEventListener('click',()=>{state=tick(state,tools);save();paint('Executed one deterministic transition.');});
$('#run').addEventListener('click',()=>{state=run(state,tools);save();paint('Run completed within its transition bound.');});
$('#reset').addEventListener('click',reset);$('#deny').addEventListener('click',()=>{state.plan.allowedTools=state.plan.allowedTools.filter(x=>x!=='notify');save();paint('Notify capability removed.');});
$('#download').addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='boundedrun-checkpoint.json';a.click();URL.revokeObjectURL(a.href)});
$('#upload').addEventListener('change',async e=>{try{state=recover(await ((e.target as HTMLInputElement).files?.[0]?.text()??''));save();paint('Checkpoint validated and recovered.')}catch(err){paint((err as Error).message)}});
try{state=recover(localStorage.getItem('boundedrun-v1')||'')}catch{state=fresh(plan)}paint();
