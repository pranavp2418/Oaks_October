import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('unmatched live pilot selection fails before any hosted request',()=>{
 const result=spawnSync(process.execPath,['tests/live-pilot.mjs','https://unused.invalid'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,CASE_FILTER:'__no_case_matches__'},encoding:'utf8',timeout:10000});
 assert.notEqual(result.status,0,'An empty selection must never pass');
 assert.match(result.stderr,/No pilot cases selected/);
});
