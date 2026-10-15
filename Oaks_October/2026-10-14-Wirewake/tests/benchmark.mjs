import {execFileSync} from 'node:child_process';
if(!process.env.WIREWAKE_GO) throw Error('Set WIREWAKE_GO to pinned Go1.27.2');
process.stdout.write(execFileSync(process.env.WIREWAKE_GO,['run','-trimpath','./cmd/bench'],{encoding:'utf8'}));
