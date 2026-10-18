import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
const {instance}=await WebAssembly.instantiate(readFileSync(new URL('../public/fallow-core.wasm',import.meta.url)),{});const w=instance.exports;
let seed=151027;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
for(let i=0;i<100;i++){
 const r={sites:Array.from({length:1+rand(5)},(_,j)=>({id:'s'+j,region:rand(3),cost:1+rand(8),successes:rand(20),failures:rand(20),max_samples:1+rand(4)})),budget:rand(40),capacity:rand(10),minimum_regions:rand(4)};
 const bytes=new TextEncoder().encode(JSON.stringify(r));const pointer=w.allocate(bytes.length);new Uint8Array(w.memory.buffer,pointer,bytes.length).set(bytes);const packed=BigInt.asUintN(64,w.evaluate(pointer,bytes.length));const outputPointer=Number(packed>>32n),length=Number(packed&0xffffffffn);const output=JSON.parse(new TextDecoder().decode(new Uint8Array(w.memory.buffer,outputPointer,length)));w.release(outputPointer,length);w.release(pointer,bytes.length);
 const native=spawnSync(new URL('../engine/target/release/fallow-core',import.meta.url),{input:JSON.stringify(r),encoding:'utf8'});assert.equal(native.status,0);assert.deepEqual(output,JSON.parse(native.stdout));
}
console.log('100 actual native/WASM parity cases passed, including infeasible plans');
