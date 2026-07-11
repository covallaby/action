import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  outputDir: ".generated/results",
  reporter: [
    ["json", { outputFile: ".generated/results.json" }],
    ["html", { outputFolder: ".generated/html-report", open: "never" }],
  ],
  use: {
    browserName: "chromium",
    headless: true,
    screenshot: "on",
    trace: "on",
    video: { mode: "on", size: { width: 480, height: 320 } },
    viewport: { width: 480, height: 320 },
  },
});
