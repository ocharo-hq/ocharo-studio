import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  // Software rendering makes multi-step browser flows slower on hosted Linux runners.
  // The default five-second behavior assertion budget is unchanged.
  timeout: process.env.CI ? 120_000 : 45_000,
  fullyParallel: false,
  use: {
    baseURL: process.env.STUDIO_URL ?? "https://localhost:8262",
    ignoreHTTPSErrors: false,
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
            "dotnet run --project ../../../ocharo-studio.backend-services/OcharoStudio.Api --no-launch-profile -p:BuildSpa=false --urls https://localhost:8260",
          url: "https://localhost:8260/health",
          timeout: 120000,
          env: { DB_CONNECTION: "Data Source=appdata/studio-browser-tests.db" },
        },
        {
          command: "pnpm preview --host localhost --port 8262 --strictPort",
          env: { STUDIO_API_URL: "https://localhost:8260" },
          url: "https://localhost:8262",
          timeout: 30000,
        },
      ]
    : undefined,
});
