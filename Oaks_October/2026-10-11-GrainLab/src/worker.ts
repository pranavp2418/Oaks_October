import {Cube,seed} from './core.js';
let cube:Cube;
self.onmessage=(e)=>{try {const a=e.data;if(a.kind==='init')cube=Cube.restore(a.checkpoint||seed());else if(a.kind==='apply')cube.apply(a.event,a.expected);else if(a.kind==='restore')cube=Cube.restore(a.checkpoint);else if(a.kind!=='query')throw Error('Unknown action');self.postMessage({ok:true,checkpoint:cube.checkpoint(),rows:[...cube.rows.values()],cells:cube.query(a.group||['service','region'],a.filters||{},a.minimum||1)});}catch(error){self.postMessage({ok:false,error:(error as Error).message});}};
