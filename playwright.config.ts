import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/._*",
  reporter: [["list"]],
  outputDir: "test-results",
  projects: [
    {
      name: "public-site",
      testMatch: /public-site\.spec\.ts/,
      use: {
        baseURL: "http://127.0.0.1:3000"
      }
    },
    {
      name: "workbench",
      testMatch: /workbench\.spec\.ts/,
      use: {
        baseURL: "http://127.0.0.1:5173"
      }
    }
  ],
  webServer: [
    {
      command: "pnpm dev:site",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: "pnpm dev:workbench",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
