import { defineConfig, devices } from "@playwright/test";

/**
 * FieldRunner — Playwright config.
 *
 * Defaults: single worker, Chromium, **headed** so you can observe the
 * gameplay. slowMo gives the cursor / clicks enough pacing to follow
 * what's happening on screen.
 *
 * The dev server (Vite :5173 + API :3001) is expected to already be
 * running (e.g. `npm run dev`). If you want Playwright to start the
 * server itself, add a `webServer` block.
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    headless: false,
    launchOptions: {
      // 250 ms between each mouse / keyboard step. Smooth enough to
      // watch, fast enough not to bore.
      slowMo: 250,
      // Push the window to the top-left so it isn't hidden behind
      // a maximized IDE on dual-monitor setups.
      args: ["--window-position=80,80", "--disable-blink-features=AutomationControlled"]
    },
    viewport: { width: 1280, height: 820 },
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
