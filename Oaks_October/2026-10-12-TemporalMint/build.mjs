import {cp,mkdir} from 'node:fs/promises';await mkdir('public',{recursive:true});for(const f of ['index.html','app.js','style.css','cover.svg'])await cp(`web/${f}`,`public/${f}`);
