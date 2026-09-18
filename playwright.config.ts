import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const observerMode = process.env.PLAYWRIGHT_OBSERVER === "1";
const productionKqa = process.env.KQA_PRODUCTION === "1";
const kqaStorageState = process.env.KQA_STORAGE_STATE ?? "/tmp/khonsera-kqa-auth.json";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: productionKqa ? "./tests/e2e/kqa-global-setup.ts" : undefined,
  fullyParallel: !observerMode,
  forbidOnly: Boolean(process.env.CI),
  retries: observerMode ? 0 : process.env.CI ? 1 : 0,
  workers: observerMode ? 1 : process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL,
    trace: observerMode && !productionKqa ? "on" : productionKqa ? "off" : "retain-on-failure",
    screenshot: observerMode ? "on" : "only-on-failure",
    storageState: productionKqa ? kqaStorageState : undefined,
    video: observerMode
      ? {
          mode: "on",
          show: {
            actions: {
              duration: 650,
              position: "bottom-right",
              cursor: "pointer",
            },
            test: {
              level: "step",
              position: "top-left",
              fontSize: 14,
            },
          },
        }
      : "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      // Khonsera's documented mobile acceptance width.
      name: "mobile-390",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: useExternalServer
    ? undefined
    : {
        command: process.env.CI ? "npm run start" : "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
