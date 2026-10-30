import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  retries: 0,
  outputDir: "/tmp/twitchhive-issue3/test-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "/tmp/twitchhive-issue3/e2e-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    viewport: { width: 1366, height: 768 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", testMatch: "ui.spec.ts" },
    {
      name: "performance",
      testMatch: "performance.spec.ts",
      use: {
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: [
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "PORT=3000 APP_ORIGIN=http://127.0.0.1:3000 npm start",
    url: "http://127.0.0.1:3000/healthz",
    reuseExistingServer: false,
    timeout: 30000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 3000 },
  },
});
