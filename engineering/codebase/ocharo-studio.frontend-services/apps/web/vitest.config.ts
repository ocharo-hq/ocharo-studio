import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";
export default defineConfig({
  // Frame tests mount single-file components in happy-dom; every other suite stays on Node.
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || "dev") },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
