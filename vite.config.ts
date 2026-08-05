import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Backend origin for the Vite dev proxy (server-side only, resolved inside Docker).
// Browser requests use the relative "/api" path, which the proxy forwards here.
const proxyTarget = process.env.PROXY_TARGET ?? "http://localhost:8000/api";
const backendOrigin = proxyTarget.replace(/\/+$/, "").replace(/\/api$/, "");

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: proxyTarget,
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
