import './archive.css';
import {archiveCard,archiveDetails,livePreviewURL,esc} from './archive-view.js';

const $=id=>document.getElementById(id);
let items=[],page=0,previous;
const pageSize=6;
function filtered(){
  const month=$('archive-month').value,q=$('archive-search').value.toLowerCase();
  return items.filter(x=>(month==='all'||x.month===month)&&[x.title,x.domain,...x.stack].join(' ').toLowerCase().includes(q));
}
function render(){
  const list=filtered(),pages=Math.max(1,Math.ceil(list.length/pageSize));
  page=Math.min(page,pages-1);
  $('archive-count').textContent=`${list.length} ${list.length===1?'project':'projects'}`;
  $('archive-page').textContent=`${page+1} / ${pages}`;
  $('archive-prev').disabled=page===0;
  $('archive-next').disabled=page===pages-1;
  $('archive-grid').innerHTML=list.slice(page*pageSize,(page+1)*pageSize).map(archiveCard).join('')||'<p>No projects match this filter.</p>';
  document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>open(b.dataset.preview,b));
}
function open(slug,button){
  const project=items.find(x=>x.slug===slug);
  if(!project)return;
  previous=button;
  $('archive-dialog-content').innerHTML=archiveDetails(project);
  $('archive-dialog').setAttribute('aria-labelledby','archive-dialog-title');
  $('archive-dialog').showModal();
  $('archive-dialog').querySelector('.dialog-close').focus();
  const previewButton=$('load-live-preview'),live=livePreviewURL(project);
  if(previewButton&&live)previewButton.onclick=()=>{
    const frame=document.createElement('iframe');
    frame.src=live;frame.title=`${project.title} live workspace`;frame.loading='lazy';
    $('live-preview').replaceChildren(frame);
    previewButton.hidden=true;
  };
}
$('archive-dialog').querySelector('.dialog-close').onclick=()=>$('archive-dialog').close();
$('archive-dialog').addEventListener('close',()=>{$('live-preview')?.replaceChildren();previous?.focus();});
$('archive-month').onchange=$('archive-search').oninput=()=>{page=0;render();};
$('archive-prev').onclick=()=>{page--;render();};
$('archive-next').onclick=()=>{page++;render();};
try{
  const response=await fetch('/projects.json');
  if(!response.ok)throw Error('Archive unavailable');
  items=await response.json();
  $('archive-month').innerHTML='<option value="all">All months</option>'+[...new Set(items.map(x=>x.month))].sort().reverse().map(month=>`<option value="${esc(month)}">${esc(month)}</option>`).join('');
  render();
}catch(error){$('archive-count').textContent=error.message;}
// Keep bookmarked project routes pointed at their linked archive cards.
const route=new URLSearchParams(location.search).get('project');
const slug={crm:'jmcrm-ai',recon:'reconciliation-engine'}[route]||route;
if(slug&&items.some(x=>x.slug===slug)){
  const index=items.findIndex(x=>x.slug===slug);
  page=Math.floor(index/pageSize);render();
  const button=[...document.querySelectorAll('[data-preview]')].find(x=>x.dataset.preview===slug);
  if(button){button.scrollIntoView({block:'center'});open(slug,button);}
}
