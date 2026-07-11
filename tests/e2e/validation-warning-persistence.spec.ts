import { test, expect } from "@playwright/test";

/**
 * SPEC — inconsistent-plan validation warning: display, dismiss, reappear.
 *
 * Provenance
 * ----------
 * Risk: context/foundation/test-plan.md risk #2 (§3 Phase 5, e2e slice) —
 *   "In the browser, e2e proves the wiring: when a saved plan is inconsistent
 *    the warning bar is displayed, Dismiss closes it, and it reappears after
 *    reload (the dismissal is not persisted)."
 *   Unit tests own WHICH rule fires and at what threshold; this spec asserts
 *   only the browser-level warning-bar wiring, never a specific message.
 * Seed: modeled on tests/e2e/seed.spec.ts (role-based locators, unique per-run
 *   data, wait-for-state, self-contained setup/action/assertion/cleanup).
 *
 * Real vs mocked
 * --------------
 * Auth + routing + API + database stay REAL — that is where the integration
 * risk lives. The inconsistent batch is seeded through the real authenticated
 * POST /api/batches (storageState cookies) and removed through DELETE afterward,
 * so the browser drives only the risk under test: the detail page's
 * warning-bar display / dismiss / reappear wiring.
 *
 * Presence signal
 * ---------------
 * The warning bar is identified by its role-based "Dismiss warnings" button
 * (ValidationWarnings.tsx renders it only while the bar is shown). Its
 * visibility is therefore a faithful proxy for the bar itself and keeps the
 * test decoupled from any specific warning message, which is unit-owned.
 *
 * The inconsistency
 * -----------------
 * target_abv (18) exceeds yeast_alcohol_tolerance (12), so the saved plan is
 * inconsistent and the bar is shown. The dismissal lives only in client state
 * (BatchForm's `warningsDismissed`, initialized to false), so a real reload
 * must bring the bar back.
 */

test("inconsistent-plan warning is dismissable but reappears after reload", async ({ page }) => {
  // Setup: seed a SAVED, inconsistent batch through the real authenticated API.
  // Unique name (timestamp suffix) so parallel runs and re-runs never collide.
  const batchName = `E2E Warning Persistence ${Date.now()}`;
  const createResponse = await page.request.post("/api/batches", {
    data: {
      name: batchName,
      process_type: "juice",
      target_abv: 18, // exceeds the yeast tolerance below → the plan is inconsistent
      yeast_name: "E2E Test Yeast",
      yeast_alcohol_tolerance: 12,
    },
  });
  expect(createResponse.status()).toBe(201);
  const { data: batch } = (await createResponse.json()) as { data: { id: string } };

  // Presence of the warning bar == presence of its "Dismiss warnings" button.
  const dismissWarnings = page.getByRole("button", { name: "Dismiss warnings" });

  try {
    // The saved plan is inconsistent → its detail page shows the warning bar.
    await page.goto(`/batches/${batch.id}`);
    await expect(dismissWarnings).toBeVisible();

    // Dismiss closes the bar — the dismissal lives only in client state.
    await dismissWarnings.click();
    await expect(dismissWarnings).toHaveCount(0);

    // The risk: the dismissal is NOT persisted. After a real reload the saved
    // plan is still inconsistent, so the warning bar must reappear.
    await page.reload();
    await expect(dismissWarnings).toBeVisible();
  } finally {
    // Cleanup: remove the seeded batch so the test leaves no residue.
    await page.request.delete(`/api/batches/${batch.id}`);
  }
});
