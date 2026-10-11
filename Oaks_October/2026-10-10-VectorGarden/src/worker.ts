import {train,evaluate,gradientCheck,Checkpoint} from './engine';
self.onmessage=async(event:MessageEvent)=>{const {id,kind,checkpoint,steps}=event.data;
 try{
  if(kind==='check'){self.postMessage({id,kind:'checked',result:gradientCheck(checkpoint)});return}
  let c:Checkpoint=checkpoint;let left=steps;
  while(left>0){const chunk=Math.min(10,left);c=train(c,chunk);left-=chunk;self.postMessage({id,kind:'progress',checkpoint:c,evaluation:evaluate(c),done:left===0});await new Promise(r=>setTimeout(r,0))}
 }catch(e){self.postMessage({id,kind:'error',error:e instanceof Error?e.message:String(e)})}
};
