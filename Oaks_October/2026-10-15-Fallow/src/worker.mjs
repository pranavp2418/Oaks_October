import {connectEngine} from './engine.mjs';
const ready=fetch('/fallow-core.wasm').then(r=>{if(!r.ok)throw Error('Rust engine unavailable');return r.arrayBuffer();}).then(b=>WebAssembly.instantiate(b,{})).then(r=>connectEngine(r.instance));
self.onmessage=async e=>{try{const run=await ready;self.postMessage({id:e.data.id,ok:true,result:run(e.data.request)});}catch(error){self.postMessage({id:e.data.id,ok:false,error:error.message});}};
