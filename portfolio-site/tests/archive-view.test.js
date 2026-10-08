import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {archiveCard,archiveDetails,livePreviewURL} from '../src/archive-view.js';

const projects=JSON.parse(fs.readFileSync(new URL('../public/projects.json',import.meta.url)));
test('existing market research has useful links in the card and dialog without fake live controls',()=>{
  const project=projects.find(x=>x.slug==='market-news-sentiments');
  assert.ok(project);
  for(const html of [archiveCard(project),archiveDetails(project)]){
    assert.match(html,/Research notebooks/);
    assert.match(html,/href="https:\/\/github.com\/pranavp2418\/Market-Analysis-on-News-Sentiments/);
    assert.doesNotMatch(html,/href="(?:undefined|null)"|Open live|Open working demo|load-live-preview|<iframe/);
  }
  assert.equal(livePreviewURL({...project,live:'https://example.com'}),null);
});
test('verified web projects retain their live actions and opt-in preview',()=>{
  for(const project of projects.filter(x=>x.delivery_mode==='web_deployed')){
    assert.ok(livePreviewURL(project));
    assert.match(archiveCard(project),/Open live project/);
    assert.match(archiveDetails(project),/load-live-preview/);
  }
});
test('archive ignores unsafe links and escapes repository-derived text',()=>{
  const project={title:'<script>alert(1)</script>',slug:'safe',domain:'Research',stack:['<img>'],description:'<b>text</b>',live:'javascript:alert(1)',source:'http://example.com',cover:'//example.com/image',walkthrough:'javascript:alert(1)'};
  const html=archiveCard(project)+archiveDetails(project);
  assert.doesNotMatch(html,/href=|src=|load-live-preview|<script>|<img>/);
  assert.match(html,/&lt;script&gt;/);
});
