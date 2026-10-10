import {mkdirSync,copyFileSync,cpSync} from 'node:fs';
mkdirSync('public',{recursive:true});for(const f of ['index.html','style.css','app.js','cover.svg','mobile.html'])copyFileSync(f,'public/'+f);cpSync('data','public/data',{recursive:true});
