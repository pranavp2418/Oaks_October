import {cp,mkdir} from 'node:fs/promises';await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});console.log('Frontend copied; real Python API bundled by Vercel.');
