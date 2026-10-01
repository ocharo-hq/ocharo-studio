import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import mkcert from "vite-plugin-mkcert";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";

// The SPA is served from the .NET host's wwwroot in production, so asset paths are
// root-relative (base: '/') and API calls use same-origin "/api/..." URLs.
// Normal development uses HTTPS; the explicit headless profile uses HTTP for previewing.
export default defineConfig(({ command }) => {
  const useHttps = command === "serve" && process.env.VITE_HTTPS !== "false";
  const certFile = process.env.STUDIO_TLS_CERT;
  const keyFile = process.env.STUDIO_TLS_KEY;
  if (useHttps && Boolean(certFile) !== Boolean(keyFile))
    throw new Error("Provide both STUDIO_TLS_CERT and STUDIO_TLS_KEY.");
  // Reuse existing certificates without invoking mkcert or changing system trust.
  const https =
    useHttps && certFile && keyFile
      ? { cert: readFileSync(certFile), key: readFileSync(keyFile) }
      : undefined;
  return {
    define: {
      __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || "dev"),
    },
    base: "/",
    plugins: [vue(), tailwindcss(), ...(useHttps && !https ? [mkcert()] : [])],
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      https,
      port: 8262,
      strictPort: true,
      proxy: {
        "/api": {
          target: process.env.STUDIO_API_URL ?? "https://localhost:8260",
          changeOrigin: false,
          secure: true,
        },
      },
    },
  };
});
