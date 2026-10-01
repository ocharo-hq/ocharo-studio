import { defineConfig } from "vitest/config";
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || "dev") },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
