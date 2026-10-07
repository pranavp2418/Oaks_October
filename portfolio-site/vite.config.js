import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({build:{rollupOptions:{input:{main:resolve(import.meta.dirname,'index.html'),personal:resolve(import.meta.dirname,'outside-tech.html'),projects:resolve(import.meta.dirname,'projects.html')}}}});
