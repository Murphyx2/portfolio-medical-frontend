import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Backend origin, e.g. "http://localhost:8000/api" (host) or "http://backend:8000/api" (docker).
const apiBase = process.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
const backendOrigin = apiBase.replace(/\/+$/, "").replace(/\/api$/, "");

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: apiBase,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/media": {
        target: backendOrigin,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
