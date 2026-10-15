import { defineConfig } from "vite";
export default defineConfig({
  build: { rollupOptions: { input: { app: "index.html", verification: "verify.html" } } },
  server: { proxy: { "/api": "http://127.0.0.1:8081" } },
});
