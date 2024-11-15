import { defineConfig } from "@playwright/test";

export default defineConfig({
  globalSetup: require.resolve("./tests/setup"),
  globalTeardown: require.resolve("./tests/teardown"),
  testDir: "./tests/playwright",
  use: {
    browserName: "chromium",
    headless: true,
  },
});