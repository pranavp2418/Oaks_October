import fs from 'node:fs';fs.mkdirSync('public',{recursive:true});for(const f of ['index.html','app.js','style.css','cover.svg'])fs.copyFileSync(f,'public/'+f);
