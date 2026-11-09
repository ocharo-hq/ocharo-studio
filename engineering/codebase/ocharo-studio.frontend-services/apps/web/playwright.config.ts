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
          url: "https://localhost:8260/health/ready",
          timeout: 120000,
          env: {
            // The browser job's PostgreSQL, prepared by OcharoStudio.Tests.Support with Identity's stand-in tables and
            // Studio's sets; inert fixtures, never a real secret.
            ConnectionStrings__Database:
              "Host=localhost;Port=55432;Username=postgres;Password=browser-tests;Database=studio_browser",
            Migrations__OwnerInstance: "ocharo-studio@test",
            // The API needs a configured Identity client to boot; these are inert fixtures, never a real secret.
            Identity__Client__Authority: "https://identity.test",
            Identity__Client__ClientId: "ocharo-studio-e2e",
            Identity__Client__ClientSecret: "e2e-fixture-not-a-secret",
            Identity__Client__CookieName: "ocharo-studio-e2e",
            Identity__Client__PostSignOutRedirectPath: "/",
          },
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
