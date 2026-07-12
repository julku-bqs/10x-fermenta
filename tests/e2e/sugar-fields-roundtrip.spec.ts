import { test, expect } from "@playwright/test";
import type { Response } from "@playwright/test";

/**
 * E2E — test-plan.md risk #7 (sugar-fields facet, "#7a"): batch-level sugar
 * fields must round-trip through the full save/reload lifecycle from BOTH input
 * paths (Calculate and manual entry) and be reverted by Cancel — not just the
 * Calculate→Save path.
 *
 * Seed: tests/e2e/seed.spec.ts. Real boundaries: auth/routing/API/DB — seed a
 * non-dry batch via POST (so both sugar cards render), drive values in the
 * browser, persist via the real PUT, reload through SSR, and clean up via DELETE.
 * The oracle is the DOM-observable collapsed badge value ("X kg"); the Calculate
 * assertion compares captured-vs-reloaded so a legitimately-zero field cannot
 * spuriously fail.
 */

function requireKg(text: string | null): string {
  const match = text?.match(/[\d.]+ kg/)?.[0];
  if (!match) throw new Error(`Expected an "X kg" sugar badge, got: ${JSON.stringify(text)}`);
  return match;
}

test("sugar fields round-trip through save/reload from Calculate and manual input, and revert on Cancel", async ({
  page,
}) => {
  const ts = Date.now();

  // Setup: seed a non-dry batch via the real API. `semi_sweet` renders the
  // Sweetness Sugar card alongside Fermentation Sugar; target volume + ABV alone
  // enable Calculate; one ingredient makes the computed fermentation sugar
  // meaningful (ingredients feed the formula but don't gate the button). Sugar
  // fields default to 0 on create, so both seeded badges start at "0 kg".
  const createResponse = await page.request.post("/api/batches", {
    data: {
      name: `E2E Sugar Round-Trip ${ts}`,
      process_type: "juice",
      planned_sweetness: "semi_sweet",
      target_volume_liters: 20,
      target_abv: 12,
      ingredients: [{ name: "Apple juice", amount_liters: 5, sugar_content_percent: 10 }],
    },
  });
  expect(createResponse.status()).toBe(201);
  const { data: batch } = (await createResponse.json()) as { data: { id: string } };
  const batchId = batch.id;

  // Collapsed sugar cards are buttons whose accessible name carries the label +
  // the "X kg" badge; each label is unique, so a role-name locator scopes to one
  // card. Once a card is expanded it is no longer this button (it becomes an
  // "Amount (kg)" input + "Done"), so clicking the card toggles it open.
  const fermCard = page.getByRole("button", { name: /Fermentation Sugar/ });
  const sweetCard = page.getByRole("button", { name: /Sweetness Sugar/ });
  const saveButton = page.getByRole("button", { name: "Save Changes" });

  // Only the batch-update PUT lives at exactly /api/batches/{id} (diary PUTs are
  // nested deeper), so this uniquely marks a completed save round-trip.
  const batchSaved = (r: Response) =>
    r.request().method() === "PUT" && new URL(r.url()).pathname === `/api/batches/${batchId}`;

  try {
    // ---- Calculate path: compute both fields, save, reload, assert persisted ----
    await page.goto(`/batches/${batchId}`);
    // Hydration gate: the form island is interactive once Save Changes enables.
    await expect(saveButton.first()).toBeEnabled();

    await page.getByRole("button", { name: /Calculate/ }).click();
    // Calculate moves both fields off the seeded "0 kg"; wait for that before
    // capturing so we never record a pre-recompute value. (Seeded inputs yield
    // 3.58 kg / 0.6 kg — neither contains "0 kg" as a substring.)
    await expect(fermCard).not.toContainText("0 kg");
    await expect(sweetCard).not.toContainText("0 kg");

    const fermCalc = requireKg(await fermCard.textContent());
    const sweetCalc = requireKg(await sweetCard.textContent());

    const calcSaved = page.waitForResponse(batchSaved);
    // Click the BOTTOM Save (seed.spec.ts guidance): submitting recomputes the
    // top validation banner, which can shift the top button out from the pointer.
    await saveButton.last().click();
    expect((await calcSaved).status()).toBe(200);

    await page.reload();
    await expect(saveButton.first()).toBeEnabled();
    // Round-trip oracle: SSR re-initializes the badges from the persisted row;
    // both must still show exactly the captured Calculate values.
    await expect(fermCard).toContainText(fermCalc);
    await expect(sweetCard).toContainText(sweetCalc);

    // ---- Manual-input path: type distinct values into BOTH cards, save, reload ----
    const fermManual = "4.25 kg";
    const sweetManual = "1.75 kg";

    await fermCard.click(); // expand the Fermentation card
    await page.getByLabel("Amount (kg)").fill("4.25");
    await page.getByRole("button", { name: "Done" }).click();

    await sweetCard.click(); // expand the Sweetness card (only one card opens at a time)
    await page.getByLabel("Amount (kg)").fill("1.75");
    await page.getByRole("button", { name: "Done" }).click();

    const manualSaved = page.waitForResponse(batchSaved);
    await saveButton.last().click();
    expect((await manualSaved).status()).toBe(200);

    await page.reload();
    await expect(saveButton.first()).toBeEnabled();
    // Both manually-entered values survived the persist + SSR reload.
    await expect(fermCard).toContainText(fermManual);
    await expect(sweetCard).toContainText(sweetManual);

    // ---- Cancel-discard: an unsaved edit must not survive Cancel + reopen ----
    // Clicking Cancel on a dirty form trips the native beforeunload dialog;
    // accept it so navigation proceeds instead of hanging on the auto-dismiss.
    page.on("dialog", (dialog) => void dialog.accept());

    await sweetCard.click(); // expand and enter an UNSAVED value
    await page.getByLabel("Amount (kg)").fill("9.99");
    await page.getByRole("button", { name: "Done" }).click();

    // Cancel is a top+bottom pair of href="/batches" links; click the bottom one
    // and confirm the navigation actually completed (the discard happened).
    await page.getByRole("link", { name: "Cancel" }).last().click();
    await page.waitForURL("**/batches");

    // Reopen explicitly — Cancel lands on the list, not the detail page.
    await page.goto(`/batches/${batchId}`);
    await expect(saveButton.first()).toBeEnabled();
    // The unsaved 9.99 kg edit was discarded; the badge shows the last saved value.
    await expect(sweetCard).toContainText(sweetManual);
    await expect(sweetCard).not.toContainText("9.99");
  } finally {
    // Cleanup: remove the seeded batch so the test leaves no residue.
    await page.request.delete(`/api/batches/${batchId}`);
  }
});
