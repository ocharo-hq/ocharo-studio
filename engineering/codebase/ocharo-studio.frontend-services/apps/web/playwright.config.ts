import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  use: {
    baseURL: process.env.STUDIO_URL ?? "https://127.0.0.1:8262",
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 },
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: "list",
  webServer: process.env.CI
    ? [
        {
          command:
            "dotnet run --project ../../../ocharo-studio.backend-services/OcharoStudio.Api --no-launch-profile -p:BuildSpa=false --urls http://127.0.0.1:8261",
          url: "http://127.0.0.1:8261/health",
          timeout: 120000,
          env: { DB_CONNECTION: "Data Source=appdata/studio-browser-tests.db" },
        },
        {
          command: "pnpm dev-http --host 127.0.0.1",
          env: { STUDIO_API_URL: "http://127.0.0.1:8261" },
          url: "http://127.0.0.1:8262",
          timeout: 30000,
        },
      ]
    : undefined,
});
