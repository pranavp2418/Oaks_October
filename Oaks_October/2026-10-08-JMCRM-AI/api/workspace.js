import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
export function evaluateCore(body,{timeout=15000,binary=resolve(process.cwd(),'runtime/JMCRM.Core')}={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(binary,[],{stdio:['pipe','pipe','pipe'],env:{...process.env,DOTNET_SYSTEM_GLOBALIZATION_INVARIANT:'1',DOTNET_EnableDiagnostics:'0'}});
    let output='',errors='',settled=false;const timer=setTimeout(()=>{p.kill();reject(Error('Core evaluation timed out'));},timeout);
    p.stdout.on('data',d=>{output+=d;if(output.length>2_000_000)p.kill();});p.stderr.on('data',d=>errors=(errors+d).slice(-3000));
    p.on('error',e=>{clearTimeout(timer);settled=true;reject(e);});p.on('close',code=>{clearTimeout(timer);if(settled)return;if(code!==0)return reject(Error('Core process failed: '+errors));try{resolve(JSON.parse(output));}catch{reject(Error('Invalid core response'));}});
    p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify(body));
  });
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'POST required.'});}
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({ok:false,error:'JSON object required.'});
    if(Buffer.byteLength(JSON.stringify(body))>1_000_000)return res.status(413).json({ok:false,error:'Workspace is too large.'});
    const result=await evaluateCore(body);return res.status(result.ok?200:result.status||400).json(result);
  }catch(e){const invalid=e instanceof SyntaxError; if(!invalid)console.error('JMCRM evaluation failed',e.message);return res.status(invalid?400:503).json({ok:false,error:invalid?'Malformed JSON.':'Core is temporarily unavailable; your saved workspace has been kept.'});}
}
