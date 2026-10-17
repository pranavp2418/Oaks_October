import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCatalog,assignBuildings,findProjects} from '../src/city-model.js';
import {archiveCard,archiveDetails,livePreviewURL} from '../src/archive-view.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/'+name,import.meta.url)));
const daily=read('projects.json'),featured=read('featured-projects.json');
const old=daily.filter(p=>!['morrowstock','clearspan','wirewake'].includes(p.slug));
const before=assignBuildings(createCatalog(old,featured)),after=assignBuildings(createCatalog(daily,featured));
test('trio appended once with full covers and accurate delivery actions',()=>{
 for(const slug of ['morrowstock','clearspan','wirewake']){
  const items=daily.filter(p=>p.slug===slug);assert.equal(items.length,1);const p=items[0];
  assert.ok(fs.existsSync(new URL('../public'+p.cover,import.meta.url)));
  assert.equal(findProjects(p.title,after)[0].slug,slug);
  for(const html of [archiveCard(p),archiveDetails(p)]){
   assert.ok(html.includes(p.source));
   assert.doesNotMatch(html.replace(/<[^>]+>/g,''),/2026-10-14|October|\b2026\b/);
  }
 }
 for(const slug of ['morrowstock','clearspan','wirewake']){ const p=daily.find(p=>p.slug===slug);assert.equal(p.delivery_mode,'web_deployed');assert.equal(livePreviewURL(p),p.live);assert.ok(archiveDetails(p).includes('load-live-preview')); }
 const cli=daily.find(p=>p.slug==='patchbay');assert.equal(cli.delivery_mode,'github_only');
 assert.equal(livePreviewURL(cli),null);assert.ok(cli.walkthrough);
 assert.doesNotMatch(archiveDetails(cli),/load-live-preview|<iframe|Open working demo/);
});
test('all existing island placements and flagship entries remain unchanged',()=>{
 for(const p of before){const next=after.find(q=>q.slug===p.slug);assert.ok(next);assert.deepEqual([next.x,next.z,next.archetype],[p.x,p.z,p.archetype]);}
 for(const slug of ['craftsmanai','market-news-sentiments','workorder-triage'])assert.equal(after.filter(p=>p.slug===slug).length,1);
});
