import {defineConfig} from 'vite';
export default defineConfig({server:{proxy:{'/api/workspace':'http://127.0.0.1:8015'}}});
