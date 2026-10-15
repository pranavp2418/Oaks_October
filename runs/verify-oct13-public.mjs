import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=x=>createHash('sha256').update(x).digest('hex');
const report={verified_at:new Date().toISOString(),checks:[]};
for(const [title,base,output] of [
 ['Loadstone','https://loadstone-20261013.vercel.app', 'dist'],
 ['ProofHarbor','https://proofharbor-20261013.vercel.app','dist']
]){
 const dir=path.join(root,'Oaks_October','2026-10-13-'+title,output);
 const index=await fs.readFile(path.join(dir,'index.html'),'utf8');
 const live=await fetch(base+'/'); assert.equal(live.status,200);
 const html=await live.text();
 const urls=[...index.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)].map(x=>x[1]);
 assert.ok(urls.length>=2);
 for(const url of [...urls,...(title==='Loadstone'?['/dispatch.wasm']:[])]){
  const relative=url.replace(/^\//,'');
  const local=await fs.readFile(path.join(dir,relative));
  const response=await fetch(new URL(url,base+'/'));
  assert.equal(response.status,200); const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(sha(bytes),sha(local),title+' '+url+' source mismatch');
  report.checks.push({title,file:url,status:200,sha256:sha(bytes),bytes:bytes.length});
 }
 assert.ok(html.includes(title));
}
const sample=JSON.parse(await fs.readFile(path.join(root,'Oaks_October/2026-10-13-ProofHarbor/data/sample.json')));
const journal=[{id:'public-import',type:'import',expected:0,bundle:sample},
 {id:'public-case',type:'investigate',expected:1,query:'gateway release routing',fail:true},
 {id:'public-retry',type:'retry',expected:2,run:'run-public-case'},
 {id:'public-review',type:'review',expected:3,run:'run-public-case',action:'approve',reviewer:'qa-operator',note:'Exact sources checked; disagreement remains unresolved.',acknowledge:true}];
const endpoint='https://proofharbor-20261013.vercel.app/api/workspace';
const post=async body=>{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
const first=await post({schema:1,journal});const second=await post({schema:1,journal});
assert.equal(first.status,200);
// Runtime duration and generated native checkpoint IDs are intentionally volatile.
const semantic=value=>{const copy=structuredClone(value);delete copy.body.elapsed_ms;for(const run of copy.body.runs??[])delete run.checkpoint;return copy;};
assert.deepEqual(semantic(first),semantic(second));
assert.equal(first.body.runs[0].status,'published');
assert.equal(first.body.runs[0].dossier.sentences.length,6);
const invalid=await post({schema:2,journal:[]});assert.equal(invalid.status,400);
const missingAck=structuredClone(journal);delete missingAck[3].acknowledge;
assert.equal((await post({schema:1,journal:missingAck})).status,400);
report.api={workflow:'import → injected retrieval failure → retry → reviewed publication',revision:first.body.revision,citations:first.body.runs[0].dossier.sentences.length,repeated_request:'identical semantic state excluding elapsed_ms and generated checkpoint IDs',invalid_schema:invalid.status,unacknowledged_conflict:400};
console.log(JSON.stringify(report,null,2));
