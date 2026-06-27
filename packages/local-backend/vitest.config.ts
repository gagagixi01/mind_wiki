import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@mind-wiki/core/content", replacement: resolve(__dirname, "../core/src/content.ts") },
      { find: "@mind-wiki/core/schema", replacement: resolve(__dirname, "../core/src/schema.ts") },
      { find: "@mind-wiki/core", replacement: resolve(__dirname, "../core/src/index.ts") },
      { find: "@mind-wiki/curation/store", replacement: resolve(__dirname, "../curation/src/store.ts") },
      { find: "@mind-wiki/curation", replacement: resolve(__dirname, "../curation/src/index.ts") }
    ]
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/._*"]
  }
});
