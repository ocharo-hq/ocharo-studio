import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";
import tailwindcss from "@tailwindcss/vite";

// The SPA is served from the .NET host's wwwroot in production, so asset paths are
// root-relative (base: '/') and API calls use same-origin "/api/..." URLs.
// Normal development uses HTTPS; the explicit headless profile uses HTTP for previewing.
export default defineConfig(({ command }) => ({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    ...(command === "serve" && process.env.VITE_HTTPS !== "false"
      ? [mkcert()]
      : []),
  ],
  build: {
    outDir: "../uzbek-studio.backend-services/UzbekStudio.Api/wwwroot",
    emptyOutDir: true,
  },
  server: {
    port: 8262,
    strictPort: true,
    proxy: {
      "/api": {
        target: "https://localhost:8260",
        changeOrigin: false,
        secure: false,
      },
    },
  },
}));
