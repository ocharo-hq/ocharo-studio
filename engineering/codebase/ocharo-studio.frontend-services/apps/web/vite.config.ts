import { proxyUnavailable } from "./dev/ProxyProblem";
import { Agent } from "node:https";
import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import mkcert from "vite-plugin-mkcert";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { colorModeScript } from "@wow-two-beta/fe/foundation/primitives";
import { ThemeMigrationScript, ThemeStorageKey } from "./src/bootstrap/theme";

/**
 * Serves and emits `/theme.js`: Studio's legacy-choice prelude, then the SDK's pre-paint colour script, so a dark
 * Studio never flashes light first.
 */
function themeScript(): Plugin {
  const source =
    ThemeMigrationScript + colorModeScript({ storageKey: ThemeStorageKey });
  return {
    name: "ocharo-studio-theme-script",
    configureServer(server) {
      server.middlewares.use("/theme.js", (_request, response) => {
        response.setHeader("Content-Type", "text/javascript");
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "theme.js", source });
    },
  };
}

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
    plugins: [
      vue(),
      tailwindcss(),
      themeScript(),
      ...(useHttps && !https ? [mkcert()] : []),
    ],
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
