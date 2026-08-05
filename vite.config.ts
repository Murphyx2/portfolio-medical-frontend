import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiBase = process.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

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
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
