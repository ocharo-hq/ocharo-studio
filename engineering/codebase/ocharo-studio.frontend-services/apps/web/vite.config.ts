import { proxyUnavailable } from "./dev/ProxyProblem";
import { Agent } from "node:https";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import mkcert from "vite-plugin-mkcert";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";

// The SPA is served from the .NET host's wwwroot in production, so asset paths are
// root-relative (base: '/') and API calls use same-origin "/api/..." URLs.
/** Keeps development proxy overrides on verified HTTPS endpoints. */
function httpsTarget(value: string): string {
  if (new URL(value).protocol !== "https:")
    throw new Error("The development API target must use HTTPS.");
  return value;
}

export default defineConfig(({ command }) => {
  const useHttps = command === "serve";
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
          target: httpsTarget(
            process.env.STUDIO_API_URL ?? "https://localhost:8260",
          ),
          changeOrigin: false,
          secure: true,
          configure: (proxy) => {
            proxy.on("error", proxyUnavailable);
          },
          ...(command === "serve" && process.env.VITE_API_CA_PATH
            ? {
                agent: new Agent({
                  ca: readFileSync(process.env.VITE_API_CA_PATH),
                }),
              }
            : {}),
        },
      },
    },
  };
});
