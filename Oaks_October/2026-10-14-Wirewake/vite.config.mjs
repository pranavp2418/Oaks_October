import { defineConfig } from "vite";
export default defineConfig({
  server: { proxy: { "/api": "http://127.0.0.1:8789" } },
  build: {
    rollupOptions: {
      input: { app: "index.html", verification: "verify.html" },
    },
  },
});
