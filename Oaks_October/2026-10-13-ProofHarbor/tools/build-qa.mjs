import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
mkdirSync('public/qa',{recursive:true});
const result=ts.transpileModule(readFileSync('src/storage.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
writeFileSync('public/qa/storage.js',result.outputText);
