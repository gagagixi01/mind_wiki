import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "../..",
  test: {
    environment: "node",
    include: ["packages/core/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/._*"]
  }
});
