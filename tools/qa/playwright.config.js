// Playwright: real-browser checks with traces + video on failure and pixel
// snapshots of the landing sequence. Server: SITE_URL (default local build).
const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 0,
  workers: 1, // parallel browsers contend for the CPU and skew playback numbers
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.SITE_URL || "http://127.0.0.1:8797",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    launchOptions: { args: ["--no-proxy-server", "--autoplay-policy=no-user-gesture-required"] },
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },
  // Serves the local build unless SITE_URL points at a deployed site
  webServer: process.env.SITE_URL ? undefined : {
    command: "python3 -m http.server 8797 --bind 127.0.0.1",
    cwd: "../../_site",
    url: "http://127.0.0.1:8797/",
    reuseExistingServer: true,
    timeout: 15_000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  ],
});
