import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({server:{allowedHosts:['terminal.local']},build:{rollupOptions:{input:{main:resolve(import.meta.dirname,'index.html'),classic:resolve(import.meta.dirname,'classic.html'),films:resolve(import.meta.dirname,'films.html'),personal:resolve(import.meta.dirname,'outside-tech.html'),projects:resolve(import.meta.dirname,'projects.html')}}}});
