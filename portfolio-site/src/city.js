import './city.css';
import { createCatalog, assignBuildings, DISTRICTS, findProjects } from './city-model.js';
import {environmentState,formatHoustonTime} from './island-environment.js';

const $=id=>document.getElementById(id), esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isMobile=matchMedia('(max-width:700px)').matches;
let catalog=[],world=null,selected=null,page=0,hovered=null,weather=null,weatherFailed=false;
const pageSize=10,labels=new Map();let minimapLast=0,returnFocus=null,tourIndex=-1;
function message(text){$('city-access-status').textContent=text;}
function setDirectory(open){$('directory-body').hidden=!open;$('city-directory').classList.toggle('collapsed',!open);document.body.classList.toggle('directory-expanded',open);$('directory-toggle').setAttribute('aria-expanded',String(open));$('directory-toggle').setAttribute('aria-label',open?'Collapse project directory':'Expand project directory');$('directory-toggle').textContent=open?'−':'+';}
function setPip(open){$('pip-city-content').hidden=!open;$('city-pip').classList.toggle('collapsed',!open);document.body.classList.toggle('pip-collapsed',!open);$('pip-city-toggle').setAttribute('aria-expanded',String(open));$('pip-city-toggle').querySelector('.pip-collapse').textContent=open?'−':'+';}
$('directory-toggle').onclick=()=>setDirectory($('directory-body').hidden);
$('pip-city-toggle').onclick=()=>setPip($('pip-city-content').hidden);
if(isMobile)setDirectory(false);
function filtered(){const q=$('city-search').value.trim().toLowerCase(),district=$('city-district').value,month=$('city-month').value;return catalog.filter(p=>(district==='all'||p.district===district)&&(month==='all'||p.month===month)&&(!q||[p.title,p.domain,p.description,...p.stack].join(' ').toLowerCase().includes(q)));}
function renderDirectory(){
  const list=filtered(),pages=Math.max(1,Math.ceil(list.length/pageSize));page=Math.min(page,pages-1);
  const districtCount=new Set(list.map(p=>p.district)).size;
  $('city-count').textContent=`${list.length} ${list.length===1?'project':'projects'} · ${districtCount} ${districtCount===1?'district':'districts'}`;
  $('city-project-list').innerHTML=list.slice(page*pageSize,(page+1)*pageSize).map(p=>`<button class="atlas-project-button" data-city-project="${esc(p.slug)}" style="--district:${p.color}" aria-pressed="${p.slug===selected}"><i aria-hidden="true"></i><span><strong>${esc(p.title)}</strong><small>${esc(DISTRICTS.find(d=>d.id===p.district).name)}${p.historical?' · historical':p.delivery_mode==='github_only'?' · code-only':''}</small></span></button>`).join('')||'<p class="atlas-empty">No buildings match. Try another project, district or technology.</p>';
  $('city-pagination').hidden=pages===1;$('city-page').textContent=`${page+1} / ${pages}`;$('city-prev').disabled=page===0;$('city-next').disabled=page===pages-1;
  document.querySelectorAll('[data-city-project]').forEach(b=>b.onclick=()=>selectProject(b.dataset.cityProject));
  const slugs=list.map(p=>p.slug);world?.setVisible(slugs);for(const [slug,el]of labels)el.hidden=!slugs.includes(slug);
}
$('city-search').oninput=$('city-month').onchange=()=>{page=0;renderDirectory()};
$('city-district').onchange=()=>{page=0;renderDirectory();const d=DISTRICTS.find(d=>d.id===$('city-district').value);if(d)world?.panTo(d.x,d.z);};
$('city-prev').onclick=()=>{page--;renderDirectory()};$('city-next').onclick=()=>{page++;renderDirectory()};
function selectProject(slug,{fromPip=false}={}){
  const p=catalog.find(p=>p.slug===slug);if(!p)return;
  returnFocus=document.activeElement;selected=slug;world?.focus(slug);
  if(!filtered().some(x=>x.slug===slug)){$('city-search').value='';$('city-district').value='all';$('city-month').value='all';}
  if(isMobile)setDirectory(false);if(!fromPip)setPip(false);
  renderDirectory();for(const [id,l]of labels)l.classList.toggle('selected',id===slug);
  const d=DISTRICTS.find(d=>d.id===p.district);
  $('city-detail-content').innerHTML=`<p class="atlas-eyebrow">${p.featured?'SELECTED WORK':p.historical?'HISTORICAL DEMONSTRATION':esc(p.date||'ENGINEERING LAB')}</p><div class="atlas-district" style="--district:${p.color}"><i></i>${esc(d.name)}</div><h2 id="city-detail-title">${esc(p.title)}</h2><p>${esc(p.description)}</p>${p.cover?`<img src="${esc(p.cover)}" alt="${esc(p.title)} project visual" loading="lazy"/>`:''}<div class="atlas-stack">${p.stack.map(s=>`<span>${esc(s)}</span>`).join('')}</div><p class="detail-evidence">${esc(p.details)}</p><div class="atlas-detail-actions">${p.embed&&p.live?'<button class="primary" id="city-step-inside">Step inside</button>':p.live?`<a class="primary" href="${esc(p.live)}" target="_blank" rel="noopener">Open live project</a>`:''}${p.source?`<a href="${esc(p.source)}" target="_blank" rel="noopener">Source & verification</a>`:''}${p.walkthrough?`<a href="${esc(p.walkthrough)}">Project walkthrough</a>`:''}${p.delivery_mode==='github_only'?'<span class="atlas-count">Complete code-only project</span>':''}<button id="city-approach">Approach building</button></div>`;
  $('city-detail').hidden=isMobile&&fromPip;$('city-step-inside')?.addEventListener('click',()=>openPreview(p));$('city-approach').onclick=()=>world?.focus(p.slug,{guide:false});
  $('city-location').textContent=d.name.toUpperCase();message(`Selected ${p.title}. ${p.description}`);
  const url=new URL(location.href);url.searchParams.set('project',p.slug);history.replaceState(null,'',url);
}
$('detail-close').onclick=()=>{$('city-detail').hidden=true;selected=null;for(const l of labels.values())l.classList.remove('selected');renderDirectory();returnFocus?.focus();const u=new URL(location.href);u.searchParams.delete('project');history.replaceState(null,'',u);};
function openPreview(p){
  const dialog=$('city-preview');returnFocus=document.activeElement;$('city-preview-title').textContent=p.title;$('city-preview-external').href=p.live;
  const iframe=document.createElement('iframe');iframe.src=p.live;iframe.title=p.title+' live workspace';iframe.loading='eager';iframe.referrerPolicy='no-referrer';iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-downloads');iframe.setAttribute('allow','clipboard-write; fullscreen');
  $('city-preview-frame').replaceChildren(iframe);dialog.showModal();$('preview-close').focus();
}
$('preview-close').onclick=()=>$('city-preview').close();$('city-preview').addEventListener('close',()=>{$('city-preview-frame').replaceChildren();returnFocus?.focus()});
$('city-preview').addEventListener('click',e=>{if(e.target===$('city-preview')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
$('city-overview').onclick=()=>{world?.overview();$('city-detail').hidden=true;selected=null;renderDirectory();};$('city-top').onclick=()=>world?.overview(true);
$('city-zoom-in').onclick=()=>world?.zoom(.77);$('city-zoom-out').onclick=()=>world?.zoom(1.3);$('city-north').onclick=()=>world?.north();
$('city-viewport').addEventListener('keydown',e=>{if(e.target!==$('city-viewport'))return;if(e.key==='Home'){world?.overview();}else if(e.key==='+'||e.key==='='){world?.zoom(.8)}else if(e.key==='-'){world?.zoom(1.25)}else if(e.key==='ArrowLeft'){world?.rotate(.1,0)}else if(e.key==='ArrowRight'){world?.rotate(-.1,0)}else if(e.key==='ArrowUp'){world?.rotate(0,-.08)}else if(e.key==='ArrowDown'){world?.rotate(0,.08)}else return;e.preventDefault();});
const mini=$('city-minimap'),miniCtx=mini.getContext('2d');let miniBase=null;
function drawMinimap(position,target){
  if(!miniBase)return;miniCtx.putImageData(miniBase,0,0);const px=x=>(x+225)/450*230,pz=z=>(z+185)/370*155;
  for(const p of catalog){miniCtx.beginPath();miniCtx.arc(px(p.x),pz(p.z),p.slug===selected?4:2.1,0,Math.PI*2);miniCtx.fillStyle=p.slug===selected?'#fff':p.color;miniCtx.fill();}
  miniCtx.strokeStyle='#effcfd';miniCtx.lineWidth=1;miniCtx.beginPath();miniCtx.arc(px(target.x),pz(target.z),8,0,Math.PI*2);miniCtx.stroke();
  const dx=position.x-target.x,dz=position.z-target.z,len=Math.hypot(dx,dz)||1;miniCtx.beginPath();miniCtx.moveTo(px(target.x),pz(target.z));miniCtx.lineTo(px(target.x)+dx/len*17,pz(target.z)+dz/len*17);miniCtx.stroke();
}
mini.addEventListener('click',e=>{const r=mini.getBoundingClientRect();world?.panTo((e.clientX-r.left)/r.width*450-225,(e.clientY-r.top)/r.height*370-185);});
function renderLabels(positions){
  const occupied=[],left=$('city-directory').getBoundingClientRect(),right=$('city-detail').hidden?null:$('city-detail').getBoundingClientRect(),viewport=$('city-viewport').getBoundingClientRect();
  for(const point of positions){const el=labels.get(point.slug);if(!el)continue;const x=point.x,y=point.y,w=Math.min(200,el.offsetWidth||140),h=34,rect={x:x-w/2,y:y-h,w,h};
    const covered=(x>left.left-viewport.left-10&&x<left.right-viewport.left+8&&y<left.bottom-viewport.top+18)||(right&&x>right.left-viewport.left-8&&y>right.top-viewport.top&&y<right.bottom-viewport.top);
    const overlap=occupied.some(a=>Math.abs(a.x-rect.x)<(a.w+rect.w)/2&&Math.abs(a.y-rect.y)<34);
    el.hidden=!point.visible||covered||(overlap&&point.slug!==selected)||occupied.length>18;
    if(!el.hidden){el.style.left=x+'px';el.style.top=y+'px';occupied.push(rect);}
  }
}
function pipSay(text,options=[]){setPip(true);$('pip-city-answer').textContent=text;$('pip-city-options').replaceChildren();for(const option of options){const b=document.createElement('button');b.textContent=option.label;b.onclick=option.action;$('pip-city-options').append(b);}}
function tour(){
  const stops=['craftsmanai','permitweave','deltalens','kiln','reconciliation-engine','jmcrm-ai','workorder-triage'].map(id=>catalog.find(p=>p.slug===id)).filter(Boolean);
  if(!stops.length)return;tourIndex=(tourIndex+1)%stops.length;const p=stops[tourIndex];selectProject(p.slug,{fromPip:true});
  pipSay(`Stop ${tourIndex+1} of ${stops.length}: ${p.title}, in ${DISTRICTS.find(d=>d.id===p.district).name}. ${p.description}`, [{label:tourIndex===stops.length-1?'Tour again':'Next stop',action:tour},{label:'Project details',action:()=>selectProject(p.slug)},{label:'End tour',action:()=>{tourIndex=-1;pipSay('Where would you like to go next? Ask me for a project, purpose, or technology.')}}]);
}
function askPip(query){
  const q=query.trim();if(!q)return;const text=q.toLowerCase();
  if(/weather|sunrise|sunset|\bnight\b|\bdaylight\b|houston time|central time/.test(text)){const state=environmentState(new Date(),weather);pipSay(`The island follows Houston: ${state.localTime}, ${state.phase.toLowerCase()}. Sunrise is ${formatHoustonTime(state.sunrise)} and sunset is ${formatHoustonTime(state.sunset)}. ${state.weather?`${state.weather.description}, reported at ${formatHoustonTime(state.weather.observedAt)} (${state.weather.station}).`:'The latest weather observation is unavailable; the solar clock still works.'} Open the atmosphere readout for its update status.`,[{label:'View atmosphere',action:()=>{$('island-atmosphere').open=true;$('island-atmosphere').querySelector('summary').focus();}}]);return;}
  if(/contact|email|resume|résumé|\bcv\b|who is pranav/.test(text)){pipSay('Pranav is the engineer behind this country and Founder & Lead Product Architect at CraftsmanAI. His portfolio has the full experience, résumé and contact details.',[{label:'Visit the portfolio',action:()=>location.assign('/#about')},{label:'Contact Pranav',action:()=>location.assign('/#contact')}]);return;}
  if(/all projects|every project|how many|what.*district/.test(text)){pipSay(`There are ${catalog.length} projects across ${new Set(catalog.map(p=>p.district)).size} occupied districts. Care Gardens holds healthcare work, Exchange District holds finance and CRM, Foundry Reach holds industrial systems, and Signal Harbor holds infrastructure. Choose a building or use the directory.`,[{label:'Browse projects',action:()=>{setDirectory(true);$('city-search').value='';$('city-district').value='all';$('city-month').value='all';renderDirectory();setPip(false);world?.overview();}}]);return;}
  if(/tour|show me around|show the city/.test(text)){tourIndex=-1;tour();return;}
  if(/zoom|rotate|control|how.*(move|navigate)|top down|overhead|country view|whole (map|country)/.test(text)){
    if(/top down|overhead/.test(text))world?.overview(true);else if(/country|whole/.test(text))world?.overview();
    pipSay('Drag with one finger or the mouse to orbit. Scroll or pinch to zoom; right-drag or use two fingers to pan. Country view returns to the whole terrain. The project list works with the keyboard too.',[{label:'Country view',action:()=>world?.overview()},{label:'Top down',action:()=>world?.overview(true)}]);return;
  }
  let matches;
  if(/new technolog|new skill|non.?resume/.test(text))matches=catalog.filter(p=>p.classification==='new'||p.slug==='kiln');
  else matches=findProjects(q,catalog);
  if(!matches.length){pipSay('I can guide you through the projects in this country, explain their workflows and stacks, or help you move around. Try “take me to healthcare”, “show Python projects”, or a project name.',[{label:'Take a tour',action:tour},{label:'Show every project',action:()=>{setDirectory(true);$('city-search').value='';$('city-district').value='all';$('city-month').value='all';renderDirectory();}}]);return;}
  const p=matches[0],d=DISTRICTS.find(d=>d.id===p.district),compare=/compare|difference|versus|\bvs\b/.test(text);
  if(compare&&matches.length>1){const a=matches[0],b=matches[1];pipSay(`${a.title}: ${a.description} Built with ${a.stack.join(', ')}. ${b.title}: ${b.description} Built with ${b.stack.join(', ')}.`,[a,b].map(x=>({label:'Visit '+x.title,action:()=>selectProject(x.slug,{fromPip:true})})));return;}
  selectProject(p.slug,{fromPip:true});pipSay(`${p.title} is in ${d.name}. ${p.description} Its stack includes ${p.stack.join(', ')}.${p.live?' Open the live workspace from its building.':' The project walkthrough is linked in the details.'}`,matches.slice(0,3).map(x=>({label:'Explore '+x.title,action:()=>selectProject(x.slug)})));
}
$('pip-city-form').onsubmit=e=>{e.preventDefault();const input=$('pip-city-input');askPip(input.value);input.value='';};
document.querySelectorAll('[data-pip]').forEach(b=>b.onclick=()=>askPip(b.dataset.pip));
function updateEnvironment(){
  const state=environmentState(new Date(),weather),dark=state.night>.45,phase=state.phase;
  $('island-phase').textContent=`${dark?'NIGHT':'DAY'}${phase!=='Day'&&phase!=='Night'?' · '+phase.toUpperCase():''}`;
  $('island-phase-icon').textContent=dark?'☾':'☀';$('island-clock').textContent=`Houston · ${state.localDate} · ${state.localTime}`;
  $('island-sun-times').textContent=`Sunrise ${formatHoustonTime(state.sunrise)} · Sunset ${formatHoustonTime(state.sunset)} · Central Time`;
  const status=weatherFailed&&state.weather?'stale':state.weatherStatus;
  if(state.weather){const temp=state.weather.temperatureC===null?'':` · ${Math.round(state.weather.temperatureC*9/5+32)}°F`; $('island-weather-short').textContent=`${status==='stale'?'Last report · ':''}${state.weather.description}${temp}`;
    $('island-weather-detail').textContent=`${status==='stale'?'Last available':'Latest'} NWS report · ${state.weather.station} · ${formatHoustonTime(state.weather.observedAt)} · wind ${Math.round(state.weather.windKmh)} km/h.${status==='stale'?' Updates delayed; scenery uses the last reported conditions.':''}`;
  }else{$('island-weather-short').textContent=weatherFailed||weather?'Weather unavailable':'Weather loading';$('island-weather-detail').textContent=weatherFailed||weather?'Houston weather is temporarily unavailable. Sun position remains synchronized; no current weather is assumed.':'Loading the latest Houston-area observation.';}
  $('island-atmosphere').dataset.phase=dark?'night':'day';$('island-atmosphere').dataset.weather=status;world?.setEnvironment(state);
}
async function refreshWeather(){
  if(document.hidden)return;
  try{const response=await fetch('/api/island-weather',{signal:AbortSignal.timeout(11000)});if(!response.ok)throw new Error('Weather unavailable');const data=await response.json();if(!['fresh','stale'].includes(data.status)||typeof data.observedAt!=='string'||!Number.isFinite(data.cloudCover))throw new Error('Invalid weather report');weather=data;weatherFailed=false;}
  catch{weatherFailed=true;}updateEnvironment();
}
updateEnvironment();refreshWeather();setInterval(updateEnvironment,15000);setInterval(refreshWeather,300000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateEnvironment();refreshWeather();}});
try{
  const data=await Promise.all(['/projects.json','/featured-projects.json'].map(async path=>{const r=await fetch(path);if(!r.ok)throw new Error('The project directory could not load. Please reload.');return r.json();}));
  catalog=assignBuildings(createCatalog(data[0],data[1]));
  $('city-district').innerHTML='<option value="all">All districts</option>'+DISTRICTS.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('city-month').innerHTML='<option value="all">All months</option>'+[...new Set(catalog.map(p=>p.month).filter(Boolean))].sort().reverse().map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');
  renderDirectory();
  for(const p of catalog){const el=document.createElement('button');el.className='city-label';el.style.setProperty('--district',p.color);el.setAttribute('aria-label','Explore '+p.title);el.innerHTML=`<span>${esc(p.title)}</span>`;el.onclick=()=>selectProject(p.slug);$('city-labels').append(el);labels.set(p.slug,el);}
  const {buildWorld,landHeight}=await import('./city-world.js');
  world=buildWorld($('city-canvas'),catalog,{
    select:selectProject,hover:slug=>{hovered=slug;for(const [id,el]of labels)el.classList.toggle('hovered',id===slug);},
    view:name=>$('city-location').textContent=name.toUpperCase(),travel:text=>$('city-flight-status').textContent=text,
    contextLost:()=>{$('city-render-message').hidden=false;$('city-render-message').textContent='The 3D view paused. You can still browse every project in the directory; reload to restore the map.';setDirectory(true);},
    frame:(positions,camera,target)=>{renderLabels(positions);if(performance.now()-minimapLast>180){drawMinimap(camera,target);minimapLast=performance.now();}}
  });
  updateEnvironment();
  const image=miniCtx.createImageData(230,155);for(let y=0;y<155;y++)for(let x=0;x<230;x++){const h=landHeight(x/230*450-225,y/155*370-185),i=(y*230+x)*4;const color=h<.5?[21,48,62]:h>25?[123,145,139]:[70+h,99+h,94+h];image.data.set([...color,255],i);}miniBase=image;
  $('city-loading').hidden=true;renderDirectory();message('The project country is ready. Choose a building or ask Pip.');
  const requested=new URLSearchParams(location.search).get('project');if(requested&&catalog.some(p=>p.slug===requested))selectProject(requested);else if(isMobile)setPip(false);
}catch(error){
  console.error('Project atlas:',error);document.body.classList.add('is-fallback');$('city-loading').hidden=true;$('city-render-message').hidden=false;$('city-render-message').textContent=catalog.length?'This device could not start the 3D view. Every project is still available in the directory.':'The project directory could not load. Please reload or return to the portfolio.';
  setDirectory(true);for(const l of labels.values())l.hidden=true;renderDirectory();
}
