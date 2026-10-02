import test from 'node:test';
import assert from 'node:assert/strict';
import {triage} from '../lib/triage.js';
import handler from '../api/triage.js';
const base={title:'Kitchen tap leak',unit:'A-204',category:'plumbing',impact:'routine',ageHours:0};
test('active damage outranks an old routine request',()=>{assert.ok(triage({...base,impact:'active-damage'}).score>triage({...base,ageHours:200}).score);});
test('wait-time points cap and route to correct trade',()=>{const r=triage({...base,category:'hvac',ageHours:200});assert.equal(r.score,35);assert.equal(r.trade,'HVAC');assert.equal(r.reasons.reduce((s,r)=>s+r.points,0),r.score);});
test('service disruption has a 24-hour demo target',()=>assert.equal(triage({...base,impact:'disruption'}).targetHours,24));
test('reject malformed and out-of-range inputs',()=>{for(const x of [null,[],{...base,title:'a'},{...base,category:'unknown'},{...base,ageHours:-1},{...base,ageHours:Infinity},{...base,impact:'invalid'}])assert.throws(()=>triage(x));});
function request(method,body){const r={headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(v){this.body=v;return this}};handler({method,body},r);return r;}
test('API health, valid POST, invalid JSON, unsupported method',()=>{assert.equal(request('GET').body.status,'ok');assert.equal(request('POST',base).code,200);assert.equal(request('POST','{').code,400);assert.equal(request('DELETE').code,405);});
