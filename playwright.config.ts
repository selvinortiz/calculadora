import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "desktop",
      testIgnore: /.*\.setup\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/owner.json" },
    },
    {
      name: "mobile",
      testIgnore: /.*\.setup\.ts/,
      dependencies: ["setup"],
      use: { ...devices["iPhone 13"], browserName: "chromium", storageState: "playwright/.auth/owner.json" },
    },
  ],
  webServer: {
    command: "node scripts/start-e2e.mjs",
    url: "http://127.0.0.1:3000/acceso",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
