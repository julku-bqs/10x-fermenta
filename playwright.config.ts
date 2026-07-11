import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load E2E credentials (E2E_USERNAME / E2E_PASSWORD) and any local overrides.
dotenv.config({ path: ".env" });

/**
 * Playwright E2E configuration for the 10x-fermenta app.
 *
 * - Runs against the Astro dev server (Cloudflare workerd runtime) started via `npm run dev`.
 * - Uses bundled Chromium to stay reproducible with CI.
 * - A `setup` project authenticates once and persists the session as storageState,
 *   so individual specs never log in through the UI (see tests/e2e/auth.setup.ts).
 *
 * Requires E2E_USERNAME / E2E_PASSWORD in the environment (see .env.example) —
 * a real Supabase user for the target instance.
 */

const PORT = Number(process.env.E2E_PORT ?? 4321);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const STORAGE_STATE = "tests/e2e/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: STORAGE_STATE,
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Silence the DEP0040 punycode deprecation emitted by wrangler's bundled
    // whatwg-url@5 / tr46@0 (they `require("punycode")`). Scoped to DEP0040 so
    // other deprecation warnings from the dev server stay visible.
    env: {
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--disable-warning=DEP0040"].filter(Boolean).join(" "),
    },
  },
});
