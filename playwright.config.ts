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
        baseURL: "http://127.0.0.1:3000/workbench"
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
      command: "pnpm dev:backend",
      url: "http://127.0.0.1:8001/api/pipeline/status",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
