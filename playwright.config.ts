import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["./utils/sheets-reporter.ts"],
  ],

  globalSetup: "./global-setup.ts",

  timeout: 90_000,

  use: {
    baseURL: process.env.APP_BASE ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Main suite — pre-authenticated, skips OTP UI
    {
      name: "e2e",
      testIgnore: /auth\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user.json",
      },
    },
    // Auth spec — no saved state, exercises the real OTP login UI
    {
      name: "auth",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Only spin up / check a local server when APP_BASE points at localhost.
  // For remote environments (dev.eventreels.com, staging, etc.) skip this block.
  ...((!process.env.APP_BASE || process.env.APP_BASE.includes("localhost")) ? {
    webServer: {
      command: "echo 'Expecting frontend already running on :3000'",
      url: process.env.APP_BASE ?? "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 10_000,
    },
  } : {}),
});
