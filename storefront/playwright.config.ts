import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Browser evidence is deliberately kept separate from Vitest: these tests
 * exercise the built storefront in Chromium, including its client controls.
 * Baselines are generated only in the digest-pinned image documented in the
 * repository README.
 */
export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001 } },
  // Never let transient traces or Playwright's `.last-run.json` dirty the
  // repository; CI may override this with an artifact-collection directory.
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? join(tmpdir(), "plepic-playwright-results"),
  snapshotPathTemplate: "{testDir}/../screenshots/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        // Device emulation is Chromium too: the pinned CI image and every
        // baseline therefore use one browser engine and one font stack.
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: { ANALYTICS_MEASUREMENT_ID: "G-PLAYWRIGHTTEST" },
    timeout: 120_000,
  },
});
