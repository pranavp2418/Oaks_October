import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCatalog,assignBuildings,findProjects,DISTRICTS,ROAD_LINKS,routeBetween,safeURL} from '../src/city-model.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url)));
const catalog=assignBuildings(createCatalog(read('projects.json'),read('featured-projects.json')));
test('all existing work is discoverable without duplicate IDs or invented deployments',()=>{
  assert.equal(catalog.length,7);assert.equal(new Set(catalog.map(p=>p.slug)).size,7);
  assert.equal(catalog.find(p=>p.slug==='jmcrm-ai').live,null);
  assert.equal(catalog.find(p=>p.slug==='reconciliation-engine').live,null);
  for(const p of catalog)assert.ok(p.live||p.source||p.walkthrough);
});
test('Pip finds purpose, language and combined intent',()=>{
  assert.equal(findProjects('take me to the Lua project',catalog)[0].slug,'kiln');
  assert.equal(findProjects('show me the Python healthcare project',catalog)[0].slug,'permitweave');
  assert.equal(findProjects('release latency telemetry',catalog)[0].slug,'deltalens');
  assert.equal(findProjects('sales revenue CRM',catalog)[0].slug,'jmcrm-ai');
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
  const [p]=createCatalog([{slug:'safe',title:'Tool',live:'https://example.com',source:'javascript:alert(1)',delivery_mode:'github_only'}]);assert.equal(p.live,null);assert.equal(p.source,null);
  assert.throws(()=>createCatalog(null),/array/);
});
