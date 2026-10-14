import {mkdirSync,writeFileSync,readFileSync,existsSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {build} from 'vite';
mkdirSync('public',{recursive:true});
const zig=process.env.LOADSTONE_ZIG||'/workspace/scratch/28070304952e/zig-runtime/ziglang/zig';
if(existsSync(zig)){
 const p=spawnSync(zig,['c++','-std=c++20','-O3','-target','wasm32-freestanding','-ffreestanding','-fno-exceptions','-fno-rtti','-nostdlib','core/dispatch.cpp','-Wl,--no-entry','-Wl,--export-memory','-Wl,--export=input_ptr','-Wl,--export=output_ptr','-Wl,--export=solve','-Wl,--export=result_cost','-Wl,--export=transitions','-o','public/dispatch.wasm'],{stdio:'inherit'});if(p.status!==0)process.exit(p.status??1);
}else if(existsSync('core/dispatch.wasm.b64'))writeFileSync('public/dispatch.wasm',Buffer.from(readFileSync('core/dispatch.wasm.b64','utf8'),'base64'));
else throw Error('Set LOADSTONE_ZIG to Zig 0.14.1 executable');
writeFileSync('core/dispatch.wasm.b64',readFileSync('public/dispatch.wasm').toString('base64')+'\n');
mkdirSync("public/qa",{recursive:true});copyFileSync("tests/mobile.html","public/qa/mobile.html");
for(const name of ['state.mjs','engine.mjs'])copyFileSync('src/'+name,'public/qa/'+name);
copyFileSync('tests/transactions.html','public/qa/transactions.html');
await build();
