export const DISTRICTS = [
  { id:'creative', name:'Maker Quarter', purpose:'Creative products & AI', color:'#b6a0ff', x:-18, z:-5, archetype:'gem' },
  { id:'commerce', name:'Exchange District', purpose:'Finance, CRM & commerce', color:'#e7c278', x:57, z:-6, archetype:'exchange' },
  { id:'care', name:'Care Gardens', purpose:'Healthcare & care operations', color:'#78dfb3', x:-55, z:51, archetype:'care' },
  { id:'industry', name:'Foundry Reach', purpose:'Industry, scheduling & aerospace', color:'#f5a071', x:16, z:79, archetype:'factory' },
  { id:'infrastructure', name:'Signal Harbor', purpose:'Infrastructure & reliable systems', color:'#72d3f2', x:-71, z:-52, archetype:'signal' },
  { id:'learning', name:'Learning Ridge', purpose:'Education & research', color:'#a2cfff', x:62, z:-77, archetype:'campus' },
  { id:'civic', name:'Civic Terrace', purpose:'Property, consumer & city services', color:'#dda3d7', x:91, z:65, archetype:'civic' }
];
export const ROAD_LINKS = [['creative','commerce'],['creative','care'],['creative','infrastructure'],['creative','industry'],['commerce','learning'],['commerce','civic'],['care','industry'],['industry','civic'],['infrastructure','learning']];
export const hash = value => { let h=2166136261; for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)} return h>>>0; };
export function districtFor(project) {
  if(DISTRICTS.some(d=>d.id===project.city?.district)) return project.city.district;
  const text=[project.domain,project.industry,project.title,project.description].join(' ').toLowerCase();
  if(/health|care|rcm|medical|clinical/.test(text)) return 'care';
  if(/finance|quant|bank|reconcil|payment|crm|revenue|sales|commerce/.test(text)) return 'commerce';
  if(/industr|aerospace|schedul|manufactur|factory|logistic/.test(text)) return 'industry';
  if(/infrastruct|telemetry|reliab|network|observab|release|distributed/.test(text)) return 'infrastructure';
  if(/educat|learning|edtech|student|research/.test(text)) return 'learning';
  if(/property|consumer|maintenance|real estate|housing/.test(text)) return 'civic';
  return 'creative';
}
export function safeURL(value,allowRelative=true) {
  if(typeof value!=='string'||!value.trim()) return null;
  if(allowRelative&&value.startsWith('/')&&!value.startsWith('//')) return value;
  try {const u=new URL(value);return u.protocol==='https:'?u.href:null;} catch{return null;}
}
export function createCatalog(daily, featured=[]) {
  if(!Array.isArray(daily)||!Array.isArray(featured)) throw new Error('Project catalog must be an array.');
  const seen=new Set();
  return [...featured,...daily].filter(p=>p&&typeof p.slug==='string'&&typeof p.title==='string'&&!seen.has(p.slug)&&seen.add(p.slug)).map(p=>({
    ...p,stack:Array.isArray(p.stack)?p.stack.filter(s=>typeof s==='string'):[],domain:p.domain||p.industry||'Independent systems',
    description:p.description||'',details:p.details||p.description||'',
    district:districtFor(p),live:p.delivery_mode==='github_only'?null:safeURL(p.live,false),source:safeURL(p.source,false),walkthrough:safeURL(p.walkthrough),cover:safeURL(p.cover),
    embed:p.delivery_mode!=='github_only'&&(p.embed===true||Boolean(p.live&&!p.featured)),
    delivery_mode:p.delivery_mode||(p.live?'web_deployed':p.featured?'portfolio_overview':'github_only')
  }));
}
// Appending daily records preserves occupied lots; resolve hash collisions on a square spiral.
export function assignBuildings(catalog) {
  const taken=new Map(DISTRICTS.map(d=>[d.id,new Set()]));
  return catalog.map(p=>{
    const d=DISTRICTS.find(d=>d.id===p.district), occupied=taken.get(d.id);
    let slot=hash(p.slug)%81;
    while(occupied.has(slot)) slot++;
    occupied.add(slot);
    const ring=Math.ceil((Math.sqrt(slot+1)-1)/2), side=2*ring, last=(2*ring+1)**2-1, offset=last-slot;
    let gx=0,gz=0;
    if(ring){if(offset<side){gx=ring-offset;gz=-ring}else if(offset<2*side){gx=-ring;gz=-ring+offset-side}else if(offset<3*side){gx=-ring+offset-2*side;gz=ring}else{gx=ring;gz=ring-(offset-3*side)}}
    const x=d.x+gx*8.4, z=d.z+gz*8.4;
    return {...p,x,z,lot:slot,color:d.color,archetype:p.city?.archetype||d.archetype};
  });
}
export function routeBetween(fromId,toId) {
  const start=DISTRICTS.find(d=>d.id===fromId), end=DISTRICTS.find(d=>d.id===toId);
  if(!start||!end) throw new Error('Unknown district');
  const dist=new Map(DISTRICTS.map(d=>[d.id,Infinity])), prev=new Map(),pending=new Set(dist.keys());dist.set(start.id,0);
  while(pending.size){
    const u=[...pending].reduce((a,b)=>dist.get(a)<dist.get(b)?a:b);pending.delete(u);if(u===end.id)break;
    for(const [a,b]of ROAD_LINKS){const v=a===u?b:b===u?a:null;if(!v||!pending.has(v))continue;
      const p=DISTRICTS.find(d=>d.id===u),q=DISTRICTS.find(d=>d.id===v),candidate=dist.get(u)+Math.hypot(p.x-q.x,p.z-q.z);
      if(candidate<dist.get(v)){dist.set(v,candidate);prev.set(v,u)}
    }
  }
  const route=[end.id];while(route[0]!==start.id){const p=prev.get(route[0]);if(!p)throw new Error('Unreachable district');route.unshift(p)}
  return route.map(id=>DISTRICTS.find(d=>d.id===id));
}
const aliases={healthcare:['care','health','medical','visit','capacity'],finance:['finance','financial','reconcil','pricing','sql'],education:['education','learning','student','edtech'],lua:['lua','new technology','new skill','non resume','optimization'],infrastructure:['infra','telemetry','latency','release','reliability'],crm:['crm','sales','revenue','customer'],industry:['industry','industrial','factory','scheduling','schedule','manufacturing'],craftsmanai:['craftsman','jewelry','jewellery','gemstone']};
export function findProjects(query,catalog) {
  const q=String(query).toLowerCase().replace(/[?.,!]/g,' ').trim();
  const stop=new Set(['take','me','to','the','a','an','show','find','project','projects','please','about','what','is','which','uses','use','i','want','see','can','you','tell','of','with','and','in']);
  const words=q.split(/\s+/).filter(w=>!stop.has(w)&&w.length>1);
  const family=Object.entries(aliases).filter(([,terms])=>terms.some(t=>q.includes(t))).flatMap(([key,terms])=>[key,...terms]);
  return catalog.map(p=>{
    const title=p.title.toLowerCase(),stack=p.stack.join(' ').toLowerCase(),text=[title,stack,p.domain,p.description,p.details,p.district].join(' ').toLowerCase();
    let score=words.reduce((s,w)=>s+(title.includes(w)?7:stack.includes(w)?5:text.includes(w)?2:0),0);
    score+=family.reduce((s,w)=>s+(text.includes(w)?1:0),0);
    if(q.includes(p.slug)||q.includes(title))score+=30;
    return {project:p,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.project.title.localeCompare(b.project.title)).map(x=>x.project);
}
