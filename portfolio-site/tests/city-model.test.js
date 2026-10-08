import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCatalog,assignBuildings,findProjects,DISTRICTS,ROAD_LINKS,routeBetween,safeURL} from '../src/city-model.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url)));
const catalog=assignBuildings(createCatalog(read('projects.json'),read('featured-projects.json')));
test('all existing work is discoverable without duplicate IDs or invented deployments',()=>{
  const expected=new Set([...read('projects.json'),...read('featured-projects.json')].map(p=>p.slug)).size;assert.equal(catalog.length,expected);assert.equal(new Set(catalog.map(p=>p.slug)).size,expected);
  assert.equal(catalog.find(p=>p.slug==='jmcrm-ai').live,'https://jmcrm-ai-copilot.vercel.app/');
  assert.equal(catalog.find(p=>p.slug==='reconciliation-engine').live,'https://reconciliation-engine-pranav.vercel.app/');
  for(const p of catalog)assert.ok(p.live||p.source||p.walkthrough);
  const research=catalog.find(p=>p.slug==='market-news-sentiments');
  assert.equal(research.live,null);assert.equal(research.embed,false);assert.equal(research.existing_project,true);assert.equal(research.counted_daily_project,false);
});
test('Pip finds purpose, language and combined intent',()=>{
  assert.equal(findProjects('take me to the Lua project',catalog)[0].slug,'kiln');
  assert.equal(findProjects('show me the Python healthcare project',catalog)[0].slug,'permitweave');
  assert.equal(findProjects('release latency telemetry',catalog)[0].slug,'deltalens');
  assert.equal(findProjects('sales revenue CRM',catalog)[0].slug,'jmcrm-ai');
  assert.equal(findProjects('news sentiment machine learning',catalog)[0].slug,'market-news-sentiments');
  assert.equal(findProjects('Rust checkpoint',catalog)[0].slug,'tidemark');
  assert.equal(findProjects('BM25 citations',catalog)[0].slug,'foliotrace');
  assert.equal(findProjects('typed packing policies',catalog)[0].slug,'dockproof');
  assert.equal(findProjects('zzzz nonexistent',catalog).length,0);
});
test('every district has a shortest navigable route, checked against exhaustive simple paths',()=>{
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function oracle(start,end){let best=Infinity;function visit(id,seen,length){if(id===end){best=Math.min(best,length);return}for(const [a,b]of ROAD_LINKS){const next=a===id?b:b===id?a:null;if(next&&!seen.has(next)){const s=new Set(seen);s.add(next);visit(next,s,length+distance(DISTRICTS.find(d=>d.id===id),DISTRICTS.find(d=>d.id===next)));}}}visit(start,new Set([start]),0);return best;}
  for(const a of DISTRICTS)for(const b of DISTRICTS){const path=routeBetween(a.id,b.id);assert.equal(path[0].id,a.id);assert.equal(path.at(-1).id,b.id);const length=path.slice(1).reduce((n,d,i)=>n+distance(path[i],d),0);assert.ok(Math.abs(length-oracle(a.id,b.id))<1e-7);}
  assert.throws(()=>routeBetween('missing','creative'),/Unknown district/);
});
test('456 projects in one district have finite unique lots; appending preserves previous locations',()=>{
  const items=Array.from({length:456},(_,i)=>({slug:'project-'+i,title:'System '+i,domain:'Care operations'}));
  const first=assignBuildings(createCatalog(items.slice(0,300))),all=assignBuildings(createCatalog(items));
  assert.equal(new Set(all.map(p=>p.x+','+p.z)).size,456);
  assert.deepEqual(all.slice(0,300).map(p=>[p.x,p.z]),first.map(p=>[p.x,p.z]));
  assert.ok(all.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
});
test('catalog rejects unsafe URLs and suppresses live links for code-only products',()=>{
  assert.equal(safeURL('javascript:alert(1)'),null);assert.equal(safeURL('//untrusted.example'),null);assert.equal(safeURL('http://untrusted.example'),null);
  const [p]=createCatalog([{slug:'safe',title:'Tool',live:'https://example.com',source:'javascript:alert(1)',delivery_mode:'github_only',embed:true}]);assert.equal(p.live,null);assert.equal(p.source,null);assert.equal(p.embed,false);
  assert.throws(()=>createCatalog(null),/array/);
});

test('legacy upgrades follow the existing three cards, preserve city lots and have complete links/covers',()=>{
  const daily=read('projects.json'),featured=read('featured-projects.json');assert.deepEqual(daily.slice(0,6).map(x=>x.slug),['permitweave','deltalens','kiln','jmcrm-ai','reconciliation-engine','market-news-sentiments']);
  for(const p of daily.slice(3,5)){assert.ok(p.live&&p.source&&p.cover&&p.embed);assert.equal(p.counted_daily_project,false);assert.equal(p.legacy_upgrade,true);assert.ok(fs.existsSync(new URL('../public'+p.cover,import.meta.url)));}
  assert.equal(featured.some(p=>['jmcrm-ai','reconciliation-engine'].includes(p.slug)),false);
  assert.equal(featured.find(p=>p.slug==='craftsmanai').cover,'/assets/craftsmanai-island-logo.png');
  const previous=assignBuildings(createCatalog(daily.slice(0,3),[{slug:'craftsmanai',title:'CraftsmanAI',city:{district:'creative',archetype:'gem'}},{slug:'jmcrm-ai',title:'JMCRM',city:{district:'commerce',archetype:'exchange'}},{slug:'reconciliation-engine',title:'Reconciliation',city:{district:'commerce',archetype:'vault'}},featured.find(x=>x.slug==='workorder-triage')]));
  for(const p of previous){const next=catalog.find(x=>x.slug===p.slug);assert.deepEqual([next.x,next.z,next.archetype],[p.x,p.z,p.archetype]);}
});
