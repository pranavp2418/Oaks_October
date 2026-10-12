import {cp, mkdir} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const file of ['index.html','style.css','cover.svg']) await cp(`web/${file}`,`public/${file}`);
await cp('dist/core.js','public/core.js');
await cp('dist/app.js','public/app.js');
