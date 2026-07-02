import { defineConfig } from "@playwright/test";

/**
 * Visual regression for the renderer: serve the committed demo map through
 * the real viewer, screenshot canonical states, compare against committed
 * baselines. Run with `pnpm test:visual` (add --update-snapshots after an
 * intentional visual change).
 *
 * Baselines are platform-suffixed (font rendering differs per OS). Only
 * darwin baselines are committed — this suite is a LOCAL gate for renderer
 * work, not a CI job, until linux baselines are generated.
 */
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  expect: {
    toHaveScreenshot: {
      // Hand-drawn strokes + text AA need a little slack; layout drift fails.
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    viewport: { width: 1600, height: 1000 },
    baseURL: "http://127.0.0.1:4499",
  },
  webServer: {
    command:
      "node apps/viewer/bin/view.js examples/shopwave-web-journey.map.json --port 4499 --no-open",
    url: "http://127.0.0.1:4499",
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
