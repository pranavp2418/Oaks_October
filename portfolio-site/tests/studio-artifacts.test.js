import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {cases} from '../src/studio-data.js';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
test('published design inventory has twenty unique, self-contained and honestly labeled artifacts',async()=>{
 const studies=JSON.parse(await read('public/design-studies/manifest.json'));
 assert.equal(studies.length,20);assert.equal(new Set(studies.map(d=>d.slug)).size,20);
 const files=await readdir(new URL('public/design-studies/',root));
 for(const d of studies){
  assert.ok(files.includes(d.file.split('/').at(-1)),d.file);
  assert.equal(d.status,'Concept study');assert.ok(d.decisions.length>=3);assert.ok(d.problem&&d.nextTest&&d.interaction);
  const svg=await read('public'+d.file);
  assert.match(svg,/viewBox="0 0 1200 800"/);assert.match(svg,/CONCEPT STUDY/);assert.match(svg,/SAMPLE DATA/);
  assert.doesNotMatch(svg,/<script|<foreignObject|(?:href|src)=["']https?:/i);
 }
});
test('case-study visuals resolve to declared concepts; care source stays private',async()=>{
 const studies=JSON.parse(await read('public/design-studies/manifest.json'));
 for(const c of Object.values(cases)){
  assert.ok(c.problem&&c.constraint&&c.outcome&&c.next&&c.boundary);
  for(const slug of c.studies)assert.ok(studies.some(d=>d.slug===slug),slug);
 }
 assert.equal(cases.carethread.secondary,undefined);
 assert.doesNotMatch(JSON.stringify(cases.carethread),/github\.com/);
 assert.match(cases.reconciliation.implementation,/integer cents|Integer cents/);
});
test('original homepage remains a built recovery entry rather than an inaccessible file',async()=>{
 const config=await read('vite.config.js');assert.match(config,/classic:resolve\(import.meta.dirname,'classic.html'\)/);
 const classic=await read('classic.html');assert.match(classic,/id="craft-explorer"/);assert.match(classic,/id="archive-grid"/);
 const home=await read('index.html');assert.match(home,/href="\/classic.html"/);assert.match(home,/href="\/projects.html"/);
});
