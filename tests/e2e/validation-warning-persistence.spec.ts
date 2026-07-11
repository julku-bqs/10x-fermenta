import { test, expect } from "@playwright/test";

/**
 * E2E — test-plan.md risk #2: a saved inconsistent plan shows a warning bar,
 * Dismiss closes it, and it reappears after reload (the dismissal is not persisted).
 * Seed: tests/e2e/seed.spec.ts. Real boundaries: auth/routing/API/DB — seed via POST,
 * clean up via DELETE. Signal: the "Dismiss warnings" button is a faithful proxy for the bar.
 */

test("inconsistent-plan warning is dismissable but reappears after reload", async ({ page }) => {
  // Seed a saved, inconsistent batch via the real API; unique name avoids collisions.
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

    // Retry until the island hydrates — an SSR-painted button can drop a pre-hydration click.
    await expect(async () => {
      await dismissWarnings.click();
      await expect(dismissWarnings).toHaveCount(0, { timeout: 1000 });
    }).toPass({ timeout: 10_000 });

    // The dismissal is not persisted, so after a real reload the bar must reappear.
    await page.reload();

    // Gate on hydration (submit button enabled) so a client-side persist can't flash-pass.
    await expect(page.getByRole("button", { name: "Save Changes" }).first()).toBeEnabled();
    await expect(dismissWarnings).toBeVisible();
  } finally {
    // Cleanup: remove the seeded batch so the test leaves no residue.
    await page.request.delete(`/api/batches/${batch.id}`);
  }
});
