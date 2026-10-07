import './archive.js';
import './style.css';
import './additions.css';
import './guide.js';
import './puzzle.js';
import { initCore } from './core.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let stored;try{stored=localStorage.getItem('portfolio-motion')}catch{}
let motion = stored ? stored === 'on' : !reducedQuery.matches;
const toggle=document.querySelector('#motion-toggle');
let animationContext;
function setupMotion(){
 animationContext?.revert();
 document.documentElement.classList.toggle('no-motion',!motion);
 toggle.setAttribute('aria-pressed',String(!motion));toggle.querySelector('span').textContent=motion?'ON':'OFF';
 if(motion){animationContext=gsap.context(()=>{
 gsap.from('.hero-copy > *',{y:32,opacity:0,duration:1.1,stagger:.12,ease:'power3.out'});
 document.querySelectorAll('.reveal').forEach(el=>gsap.from(el,{y:45,opacity:0,duration:.8,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 94%',once:true}}));
 gsap.to('.statement-text',{scale:1.2,scrollTrigger:{trigger:'.statement',start:'top bottom',end:'bottom top',scrub:1}});
 });}
 ScrollTrigger.refresh();
}
setupMotion();
toggle.addEventListener('click',()=>{motion=!motion;try{localStorage.setItem('portfolio-motion',motion?'on':'off')}catch{}setupMotion()});
reducedQuery.addEventListener('change',e=>{motion=!e.matches;setupMotion()});
const progress=document.querySelector('.scroll-progress');
function updateProgress(){progress.style.transform=`scaleX(${scrollY/(document.documentElement.scrollHeight-innerHeight)||0})`}
addEventListener('scroll',updateProgress,{passive:true});updateProgress();
document.querySelector('#year').textContent=new Date().getFullYear();
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav');
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'Close':'Menu'});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='Menu'}));
const stages=[['Start with the right questions.','Structured customer intake turns a custom-jewelry request into a clear, actionable brief.'],['Make the idea tangible.','AI-assisted design and render management help translate the brief into visual directions. Prompt routing and structured-output guardrails support more reliable results.'],['Bring decisions into one place.','Quotations and customer approvals connect design choices to the next step of the order, keeping the workflow moving.'],['Close the loop.','Approved designs and order details move into manufacturer handoff. Real customer feedback then informs product fixes and improvements.']];
const tabs=[...document.querySelectorAll('[data-step]')];
function setStep(index,focus=false){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1});const panel=document.querySelector('#workflow-panel');panel.setAttribute('aria-labelledby',`step-${index}`);panel.querySelector('.workflow-symbol').textContent=`0${index+1}`;panel.querySelector('h5').textContent=stages[index][0];panel.querySelector('p').textContent=stages[index][1];if(focus)tabs[index].focus()}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>setStep(index));tab.addEventListener('keydown',e=>{let next=index;if(e.key==='ArrowRight')next=(index+1)%4;else if(e.key==='ArrowLeft')next=(index+3)%4;else if(e.key==='Home')next=0;else if(e.key==='End')next=3;else return;e.preventDefault();setStep(next,true)})});
const projectData={crm:{label:'02 / CRM PROTOTYPE · 2026',title:'JMCRM-AI Revenue Copilot',intro:'A functional CRM prototype built to make sales activity easier to prioritize, track, and act on.',heading:'From customer data to a next action',points:['Responsive KPI dashboard and ranked sales opportunities.','Searchable customer workflows, editable outreach, and activity history.','Persistent status changes backed by SQLite and Entity Framework Core.','Duplicate-safe opportunity generation across six scoring types.'],stack:['ASP.NET Core MVC','C#','EF Core','SQLite'],note:'Project status: functional prototype.'},recon:{label:'03 / DATA FRAMEWORK · 2026',title:'Operations Reconciliation & Pricing Analysis Engine',intro:'A schema-first framework for making multi-source operational data consistent, traceable, and easier to investigate.',heading:'Designed for the messy middle',points:['Canonical record matching across different operational sources.','Historical price alignment and FIFO inventory aging.','Configurable transformations with audit trails.','Exception routing to separate unresolved records for review.'],stack:['Python','SQL','Excel / VBA'],note:'Project focus: reconciliation framework and operational data analysis.'}};
const projectDialog=document.querySelector('#project-dialog');
let returnFocus;
function openDialog(dialog){returnFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden';dialog.querySelector('.dialog-close').focus()}
function closeDialog(dialog){dialog.close()}
document.querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=>{const p=projectData[button.dataset.project];const content=document.querySelector('#dialog-content');content.innerHTML=`<p class="eyebrow">${p.label}</p><h2 id="project-title">${p.title}</h2><p>${p.intro}</p><h3>${p.heading}</h3><ul>${p.points.map(x=>`<li>${x}</li>`).join('')}</ul><div class="tags">${p.stack.map(x=>`<span>${x}</span>`).join('')}</div><p style="margin-top:24px;font-size:12px">${p.note}</p>`;projectDialog.setAttribute('aria-labelledby','project-title');openDialog(projectDialog)}));
[projectDialog].forEach(dialog=>{dialog.querySelector('.dialog-close').addEventListener('click',()=>closeDialog(dialog));dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog)}});dialog.addEventListener('close',()=>{document.body.style.overflow='';returnFocus?.focus()})});
document.querySelector('#copy-email').addEventListener('click',async()=>{const status=document.querySelector('#copy-status');try{await navigator.clipboard.writeText('pranavp2418@gmail.com');status.textContent='Email copied.'}catch{status.textContent='pranavp2418@gmail.com'}setTimeout(()=>status.textContent='',6000)});
const requestedProject=new URLSearchParams(location.search).get('project');
if(['crm','recon'].includes(requestedProject))document.querySelector(`[data-project="${requestedProject}"]`)?.click();
initCore(() => motion);
window.dispatchEvent(new Event("portfolio-ready"));
window.addEventListener('load',()=>ScrollTrigger.refresh());
