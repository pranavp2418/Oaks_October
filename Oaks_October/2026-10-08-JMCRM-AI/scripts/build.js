import {spawnSync} from 'node:child_process';
import {mkdir,cp,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const sdk=process.env.JMCRM_SDK_PATH||join(tmpdir(),'jmcrm-dotnet-10.0.401');
try {await access(join(sdk,'dotnet'));} catch {
  await mkdir(sdk,{recursive:true});
  const archive=join(tmpdir(),'jmcrm-sdk.tar.gz');
  const response=await fetch('https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.401/dotnet-sdk-10.0.401-linux-x64.tar.gz');
  if(!response.ok)throw Error('Official .NET SDK download failed: '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  const digest=createHash('sha512').update(bytes).digest('hex');
  if(digest!=='51c8b999af9e8dd9998c9edc5944e19a90788862068acd38694e098889054ce8c23d4f0c5cccfa16bf187d044562359e5ee69a9f8ad0bbe913ba90311fbce25b')throw Error('Official SDK SHA512 mismatch');
  await writeFile(archive,bytes);
  const extract=spawnSync('tar',['--no-same-owner','-xzf',archive,'-C',sdk],{stdio:'inherit'});
  if(extract.status!==0)throw Error('SDK extraction failed');
}
const args=['publish','core/JMCRM.Core.csproj','-c','Release','-r','linux-x64','--self-contained','true','-o','runtime','-p:PublishSingleFile=false'];
args.push('-p:RestoreLockedMode=true');
const build=spawnSync(join(sdk,'dotnet'),args,{stdio:'inherit',env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1'}});
if(build.status!==0)process.exit(build.status||1);
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
console.log('Published actual C#/EF Core/SQLite core and frontend.');
