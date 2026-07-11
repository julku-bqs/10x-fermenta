import { test, expect } from "@playwright/test";

/**
 * SEED TEST — the exemplar every generated E2E test is modeled on.
 *
 * This is a quality lever, not a risk-protecting test: "what you show is what
 * you get." It demonstrates the four patterns every generated test must inherit:
 *
 *   1. Role-based locators   — getByRole / getByLabel, never CSS/XPath.
 *   2. Test independence     — own setup, action, assertion, and cleanup in one test.
 *   3. Wait for state        — toBeVisible / waitForURL, never waitForTimeout.
 *   4. Risk-tied assertion   — the name binds the test to a concrete risk, and the
 *                              assertion fails if that risk materializes.
 *
 * Authentication is handled once by tests/e2e/auth.setup.ts via storageState —
 * this test starts already signed in and never logs in through the UI.
 *
 * Provenance: seed exemplar (10x-e2e Setup). Not tied to a test-plan.md risk;
 * copy its shape, not its purpose.
 */
test("created batch persists after page reload", async ({ page }) => {
  // Unique per-run identifier so parallel runs and re-runs never collide.
  const batchName = `E2E Seed Batch ${Date.now()}`;

  // Setup + action: create a batch through the real create flow.
  await page.goto("/batches");
  await page.getByRole("link", { name: "New Batch" }).first().click();
  await page.waitForURL("**/batches/new");

  await page.getByLabel("Name").fill(batchName);
  await page.getByLabel("Target Volume (liters)").fill("20");
  await page.getByLabel("Target ABV (%)").fill("12");
  await page.getByRole("button", { name: "Create Batch" }).click();

  // A successful create redirects to the new batch's detail page.
  await page.waitForURL(/\/batches\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: batchName })).toBeVisible();

  // The risk this shape protects: data must survive a real SSR reload.
  await page.reload();
  await expect(page.getByRole("heading", { name: batchName })).toBeVisible();

  // Cleanup: remove the batch so the test leaves no residue.
  // Delete is a two-step confirmation: the trigger opens an alert dialog whose
  // confirm button shares the "Delete Batch" name, so scope it to the dialog.
  await page.getByRole("button", { name: "Delete Batch" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete Batch" }).click();
  await page.waitForURL("**/batches");
  await expect(page.getByText(batchName)).toHaveCount(0);
});
