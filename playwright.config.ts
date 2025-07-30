import {defineConfig, devices} from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    video: "on-first-retry",
    launchOptions: {
      args: ["--enable-precise-memory-info"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Set fixed date to 2023-01-03 so tests can see seeded events (which go until 2023-01-02)
        // contextOptions: {
        //   timezoneId: "UTC",
        //   clock: {
        //     now: new Date("2023-01-03T00:00:00Z").getTime(),
        //   },
        // },
      },
    },
  ],
  webServer: {
    command: "VITE_USE_TEST_RELAY=true yarn dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_USE_TEST_RELAY: "true",
    },
  },
})
