import { test as setup, expect } from "@playwright/test";

const STORAGE_STATE = "tests/e2e/.auth/user.json";

/**
 * Authentication setup — runs once before the test projects (see playwright.config.ts).
 *
 * Logs in through the real sign-in form a single time and persists the resulting
 * Supabase cookie session to storageState. Individual specs then start already
 * authenticated and must NEVER log in through the UI themselves.
 *
 * Requires a real user for the target Supabase instance:
 *   E2E_USERNAME / E2E_PASSWORD (see .env.example).
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_USERNAME and E2E_PASSWORD must be set to run E2E tests. See .env.example.");
  }

  await page.goto("/auth/signin");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // A successful sign-in redirects to the protected batches list.
  await page.waitForURL("**/batches");
  await expect(page.getByRole("heading", { name: "My Batches" })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
