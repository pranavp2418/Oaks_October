const $=id=>document.getElementById(id),key='cutline-v1';let workspace,view,plan,pieces,busy=false;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error)}
function buttons(){for(const id of ['solve','export','audit-export'])$(id).disabled=busy||!view;$('reserve').disabled=busy||!plan?.feasible;document.querySelectorAll('[data-job]').forEach(b=>b.disabled=busy)}
function render(){
 $('revision').textContent='REV '+view.revision;
 $('inventory').innerHTML=view.stocks.map(s=>`<div class="stock-row"><strong>${escape(s.id)}</strong><span>${escape(s.material)} · ${s.length} mm</span><b>${s.status.toUpperCase()}</b></div>`).join('');
 $('jobs').innerHTML=view.jobs.length?view.jobs.map(j=>`<div class="job-row"><strong>${escape(j.id)}</strong> · ${j.status} · ${j.plan.bar_count} bars${j.status==='reserved'?`<div class="actions"><button data-job="${escape(j.id)}" data-kind="complete">Confirm cuts</button><button data-job="${escape(j.id)}" data-kind="cancel">Cancel reservation</button></div>`:''}</div>`).join(''):'<p class="note">No material committed yet.</p>';
 $('audit').innerHTML=view.audit.slice().reverse().map(a=>`<div class="audit-row"><strong>r${a.revision} · ${a.kind}</strong><p>${escape(a.note)}</p><code>${escape(JSON.stringify(a.details))}</code></div>`).join('')||'<p class="note">Decisions will appear here.</p>';
 document.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>mutation(b.dataset.kind,b.dataset.job));buttons();
}
function renderPieces(){
 $('pieces').innerHTML=pieces.map((p,i)=>`<div class="piece"><label for="piece-${i}">${escape(p.id)}<small>${escape(p.material)}</small></label><input id="piece-${i}" data-piece="${i}" type="number" min="1" max="20000" value="${p.length}"></div>`).join('');
 document.querySelectorAll('[data-piece]').forEach(e=>e.oninput=()=>{pieces[Number(e.dataset.piece)].length=Number(e.value);invalidate()});
}
function invalidate(){plan=null;$('proof').textContent='PLAN NEEDS RECOMPUTING';$('bars').innerHTML='<p class="note">Inputs changed. Solve before reserving.</p>';$('metrics').innerHTML='';buttons()}
async function request(action,proposed=workspace){
 busy=true;buttons();status('Checking the Python core…');
 try{
  const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...proposed,action})});const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');
  const saved=JSON.stringify(data.workspace);localStorage.setItem(key,saved);workspace=data.workspace;view=data.view;render();status('Workspace verified · saved in this browser');return data;
 }catch(e){status(e.message,true);throw e}finally{busy=false;buttons()}
}
function showPlan(p){
 plan=p;$('proof').textContent=p.optimal?'OPTIMUM PROVEN':p.infeasible_proven?'INFEASIBLE PROVEN':'SEARCH LIMIT · NOT PROVEN';
 $('metrics').innerHTML=[['Bars',p.bar_count],['Remnant',p.remnant_total+' mm'],['Kerf loss',p.saw_loss+' mm'],['Nodes',p.nodes]].map(([a,b])=>`<div class="metric"><strong>${b}</strong><small>${a.toUpperCase()}</small></div>`).join('');
 $('bars').innerHTML=p.feasible?p.bars.map(b=>`<div class="bar-row"><p><span>${escape(b.stock.id)} · ${b.stock.length} mm</span><span>${b.remnant} mm remaining</span></p><div class="strip" aria-label="${escape(b.stock.id)} cut lengths ${b.pieces.map(p=>p.length).join(', ')}; remnant ${b.remnant}">${b.pieces.map(c=>`<div class="segment" style="width:${100*(c.length+p.kerf)/b.stock.length}%" title="${escape(c.id)}: ${c.length} mm + ${p.kerf} kerf">${escape(c.id)}<br>${c.length}</div>`).join('')}</div></div>`).join(''):'<p class="note">No feasible assignment found. Check material and stock lengths, or raise the search budget if it reached its limit.</p>';buttons();
}
async function locked(fn){if(busy)return;const act=async()=>{const latest=localStorage.getItem(key);if(latest&&latest!==JSON.stringify(workspace))throw Error('Another tab updated this workspace; reload before continuing');await fn()};try{if(navigator.locks)await navigator.locks.request(key,act);else await act()}catch(e){status(e.message,true)}}
$('solve').onclick=()=>locked(async()=>{const r=await request({kind:'solve',pieces,kerf:Number($('kerf').value),budget:Number($('budget').value)});showPlan(r.plan)});
$('kerf').oninput=invalidate;$('budget').oninput=invalidate;
$('reserve').onclick=()=>locked(async()=>{if(!plan)return;await request({kind:'reserve',id:crypto.randomUUID(),job:$('job').value,note:$('note').value,expected_revision:view.revision,pieces,kerf:Number($('kerf').value),budget:Number($('budget').value),plan_hash:plan.plan_hash});invalidate();status('Material reserved. Confirm cuts after reviewing the job.')});
async function mutation(kind,job){await locked(async()=>{await request({kind,id:crypto.randomUUID(),job,note:$('note').value,expected_revision:view.revision});invalidate();status(kind==='complete'?'Cuts recorded; reusable remnants returned to stock.':'Reservation released; stock available again.')})}
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
$('export').onclick=()=>download('cutline-workspace.json',workspace);$('audit-export').onclick=()=>download('cutline-cut-audit.json',view.audit);
$('import').onchange=async e=>{const f=e.target.files[0];if(!f||busy)return;try{if(f.size>250000)throw Error('Recovery file exceeds 250KB');const proposed=JSON.parse(await f.text());await request({kind:'view'},proposed);pieces=structuredClone(workspace.seed.pieces);renderPieces();invalidate();status('Recovered workspace verified; solve before reserving.')}catch(e){status(e.message,true)}finally{$('import').value=''}};
$('reset').onclick=async()=>{if(busy)return;try{const seed=await (await fetch('data/sample.json')).json();await request({kind:'view'},{seed,operations:[]});pieces=structuredClone(seed.pieces);renderPieces();invalidate();$('job').value='Batch-001'}catch(e){status(e.message,true)}};
async function boot(){try{const saved=localStorage.getItem(key);workspace=saved?JSON.parse(saved):{seed:await(await fetch('data/sample.json')).json(),operations:[]};const r=await request({kind:'view'});pieces=structuredClone(r.workspace.seed.pieces);renderPieces();const solved=await request({kind:'solve',pieces,kerf:3,budget:150000});showPlan(solved.plan)}catch(e){status('Unable to load: '+e.message+'. Restore the sample or recover a valid export.',true)}}
boot();
