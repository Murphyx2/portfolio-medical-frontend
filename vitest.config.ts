import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Separate test config so the app's vite.config.ts (dev/build proxy) stays untouched.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
