import test from 'node:test';
import assert from 'node:assert/strict';
import {solarState,environmentState,houstonUtcOffset} from '../src/island-environment.js';
import {normalizeObservation,weatherFreshness,OBSERVATION_URL} from '../lib/houston-weather.js';
import {createWeatherHandler} from '../api/island-weather.js';
import {shoreline,curvedTowerGeometry,scannedTreePlacements,marineState,isletHeight,OFFSHORE_ISLETS,addOcean} from '../src/island-scenery.js';
import {DISTRICTS,assignBuildings,createCatalog} from '../src/city-model.js';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import * as THREE from 'three';
import {landHeight} from '../src/city-world.js';
const stamp=Date.parse('2026-10-07T23:05:00Z');
const observation=(text='Clear')=>({properties:{timestamp:new Date(stamp).toISOString(),textDescription:text,cloudLayers:[{amount:'CLR'}],presentWeather:[],temperature:{value:25,unitCode:'wmoUnit:degC'},windSpeed:{value:3,unitCode:'wmoUnit:m_s-1'},windDirection:{value:120},windGust:{value:6,unitCode:'wmoUnit:m_s-1'}}});
const call=async(handler,method='GET')=>{const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.body=value;}};await handler({method},r);return r;};

test('Central Time includes DST and chooses the Houston calendar day at UTC rollover',()=>{
  assert.equal(houstonUtcOffset(new Date('2026-10-07T23:00:00Z')),-300);
  assert.equal(houstonUtcOffset(new Date('2026-11-01T07:30:00Z')),-360);
  const late=solarState(new Date('2026-10-08T02:00:00Z'));assert.equal(late.localDate,'Oct 7');assert.match(late.localTime,/9:00 PM CDT/);assert.match(late.sunrise,/2026-10-07/);
  assert.equal(solarState(new Date('2026-10-08T05:30:00Z')).localDate,'Oct 8');
});
test('Sunrise/sunset boundaries, noon and night produce different physical light states',()=>{
  const base=solarState(new Date('2026-10-07T18:00:00Z')),rise=Date.parse(base.sunrise),set=Date.parse(base.sunset);
  assert.equal(solarState(new Date(rise-30000)).phase,'Dawn');assert.equal(solarState(new Date(rise+30000)).phase,'Sunrise');
  assert.equal(solarState(new Date(set+30000)).phase,'Sunset');assert.equal(base.phase,'Day');assert.equal(base.daylight,1);
  const night=solarState(new Date('2026-10-08T04:00:00Z'));assert.equal(night.phase,'Night');assert.equal(night.daylight,0);assert.equal(night.night,1);
  assert.ok(Math.abs(Math.hypot(...Object.values(base.sunDirection))-1)<1e-10);
  assert.throws(()=>solarState(new Date('invalid')));
});
test('Observed storm/rain/cloud/fog/snow conditions control scene effects and invalid data fails',()=>{
  const clear=normalizeObservation(observation(),stamp+60000);assert.equal(clear.kind,'clear');assert.equal(clear.precipitation,0);assert.equal(clear.windKmh,10.8);
  for(const [text,kind]of [['Heavy Thunderstorm Rain','storm'],['Light Rain','rain'],['Mostly Cloudy','cloudy'],['Fog','fog'],['Light Snow','snow']]){
    const report=normalizeObservation(observation(text),stamp+60000);assert.equal(report.kind,kind);const e=environmentState(new Date(stamp+60000),report);assert.equal(e.storm,kind==='storm');assert.equal(e.fog,kind==='fog');if(kind==='snow')assert.ok(e.snow>0&&e.rain===0);if(['rain','storm'].includes(kind))assert.ok(e.rain>0);
  }
  assert.throws(()=>normalizeObservation({properties:{timestamp:'bad'}},stamp));assert.throws(()=>normalizeObservation({properties:{timestamp:new Date(stamp+600000).toISOString(),textDescription:'Clear'}},stamp));
});
test('Delayed or missing observations are labeled, without stopping the solar clock',()=>{
  const report=normalizeObservation(observation('Light Rain'),stamp);assert.equal(weatherFreshness(report,stamp+91*60000),'stale');
  const state=environmentState(new Date(stamp+91*60000),report);assert.equal(state.weatherStatus,'stale');assert.ok(state.rain>0);assert.ok(state.sunset);
  const missing=environmentState(new Date(stamp),null);assert.equal(missing.weatherStatus,'unavailable');assert.equal(missing.rain,0);assert.equal(missing.storm,false);
  const expired=environmentState(new Date(stamp+181*60000),report);assert.equal(expired.weatherStatus,'unavailable');assert.equal(expired.rain,0);assert.equal(expired.storm,false);
});
test('Weather API coalesces concurrent requests, caches, and preserves honest stale data on upstream failure',async()=>{
  let n=0,clock=stamp+60000,fail=false,release;const waiting=new Promise(r=>release=r);
  const handler=createWeatherHandler({now:()=>clock,fetchImpl:async(url,options)=>{n++;assert.equal(url,OBSERVATION_URL);assert.match(options.headers['User-Agent'],/PranavPortfolio/);await waiting;if(fail)throw new Error('upstream timeout');return {ok:true,json:async()=>observation()};}});
  const first=call(handler),second=call(handler);release();const [a,b]=await Promise.all([first,second]);assert.equal(n,1);assert.equal(a.code,200);assert.deepEqual(a.body,b.body);
  await call(handler);assert.equal(n,1);clock+=301000;fail=true;const stale=await call(handler);assert.equal(stale.code,200);assert.equal(stale.body.status,'stale');assert.equal(stale.body.reason,'upstream_unavailable');assert.equal(stale.headers['Cache-Control'],'no-store');
  const invalid=await call(handler,'POST');assert.equal(invalid.code,405);assert.equal(n,2);
});
test('Weather API returns an unavailable response for cold failures and corrupt reports',async()=>{
  for(const fetchImpl of [async()=>{throw new Error('offline');},async()=>({ok:false}),async()=>({ok:true,json:async()=>({})})]){const response=await call(createWeatherHandler({fetchImpl,now:()=>stamp}));assert.equal(response.code,502);assert.equal(response.body.status,'unavailable');}
});
test('Coastal surf follows terrain contours and curved tower geometry preserves dimensions',()=>{
  for(const p of shoreline(landHeight,100)){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));assert.ok(Math.abs(landHeight(p.x,p.z)-.45)<.01);}
  for(const software of [false,true]){const g=curvedTowerGeometry(5,32,4,{software});g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox.max.y-g.boundingBox.min.y-32)<.01);assert.ok(g.boundingBox.max.x-g.boundingBox.min.x>3);assert.equal(g.type,'BufferGeometry');g.dispose();}
});
test('Scanned coastal tree decodes with the shipped mesh optimizer and safe deterministic placements',async()=>{
  const assets=new URL('../public/assets/island/',import.meta.url),binary=await readFile(new URL('coastal-tree.glb',assets)),manifest=JSON.parse(await readFile(new URL('tree-manifest.json',assets),'utf8'));
  assert.equal(createHash('sha256').update(binary).digest('hex'),manifest.sha256);
  assert.equal(binary.readUInt32LE(0),0x46546c67);assert.equal(binary.readUInt32LE(8),binary.length);
  const size=binary.readUInt32LE(12),gltf=JSON.parse(binary.subarray(20,20+size).toString()),bin=binary.subarray(28+size);
  await MeshoptDecoder.ready;let decoded=0;
  for(const view of gltf.bufferViews){const e=view.extensions?.EXT_meshopt_compression;if(!e)continue;const target=new Uint8Array(e.count*e.byteStride);MeshoptDecoder.decodeGltfBuffer(target,e.count,e.byteStride,bin.subarray(e.byteOffset||0,(e.byteOffset||0)+e.byteLength),e.mode,e.filter);assert.equal(target.byteLength,view.byteLength);decoded++;}
  assert.ok(decoded>=4);assert.equal(gltf.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0),manifest.triangles);
  const daily=JSON.parse(await readFile(new URL('../public/projects.json',import.meta.url),'utf8')),featured=JSON.parse(await readFile(new URL('../public/featured-projects.json',import.meta.url),'utf8')),buildings=assignBuildings(createCatalog(daily,featured));
  for(const mobile of [false,true]){const options={mobile,landHeight,districts:DISTRICTS,buildings},positions=scannedTreePlacements(options);assert.equal(positions.length,mobile?12:42);assert.deepEqual(positions,scannedTreePlacements(options));for(const p of positions){assert.ok(p.y>=4&&p.y<=34);assert.ok(buildings.every(b=>Math.hypot(b.x-p.x,b.z-p.z)>=12));}}
});

test('visible ocean geometry, glints and shore foam keep moving; islets remain offshore',()=>{
  const scene=new THREE.Scene(),ocean=addOcean(scene,{software:true,mobile:false,landHeight,maps:{}}),e=environmentState(new Date('2026-10-08T18:00:00Z'),null);ocean.setEnvironment(e);ocean.update(0);
  const first=Array.from(ocean.water.geometry.attributes.position.array),colors=Array.from(ocean.water.geometry.attributes.color.array),surf=Array.from(ocean.foam[0].geom.attributes.position.array);ocean.update(3.5);
  assert.notDeepEqual(Array.from(ocean.water.geometry.attributes.position.array),first);assert.notDeepEqual(Array.from(ocean.water.geometry.attributes.color.array),colors);assert.notDeepEqual(Array.from(ocean.foam[0].geom.attributes.position.array),surf);assert.equal(ocean.foam.length,6);
  for(const obj of scene.children){const p=obj.geometry?.attributes.position;if(p)assert.ok(Array.from(p.array).every(Number.isFinite));}
  assert.notEqual(marineState(260,90,0).height,marineState(260,90,5).height);assert.ok(Math.abs(marineState(0,0,30).tide)<=.2);
  for(const [x,z,r,h] of OFFSHORE_ISLETS){assert.ok(landHeight(x,z)<0);assert.ok(isletHeight(0,0,r,h)>1);assert.ok(isletHeight(r*2,0,r,h)<0);}
  const rough=marineState(50,80,2,{wind:70,storm:true}),calm=marineState(50,80,2,{wind:1});assert.ok(Math.abs(rough.height-.4-rough.tide)>Math.abs(calm.height-.4-calm.tide));
});
