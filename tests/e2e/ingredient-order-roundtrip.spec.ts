import { test, expect } from "@playwright/test";
import type { Response } from "@playwright/test";

/**
 * E2E — test-plan.md risk #7 (ingredient-order facet, "#7b"): a drag-reorder of
 * ingredients must survive save+reload and be reverted by Cancel. Now that each
 * ingredient carries a stable crypto.randomUUID() dnd-kit id (the React-key drift
 * bug is fixed), reorder→save→reload is safe to exercise in a real browser.
 *
 * Seed: tests/e2e/seed.spec.ts. Real boundaries: auth/routing/API/DB — seed two
 * named ingredients via POST, reorder with the deterministic KEYBOARD sensor
 * (all cards collapsed, so the grip buttons are present), persist via the real
 * PUT, reload through SSR, and clean up via DELETE. Order oracle: the grip
 * buttons' `aria-label` ("Reorder {name}") read in DOM order — the grip is
 * icon-only, so its accessible name (not its empty textContent) carries the name.
 */

test("ingredient drag-order round-trips through save/reload and reverts on Cancel", async ({ page }) => {
  const ts = Date.now();

  // Setup: seed a batch with two DISTINCTLY-named ingredients via the real API,
  // so the grip labels ("Reorder Apple juice" / "Reorder Water") are unambiguous.
  const createResponse = await page.request.post("/api/batches", {
    data: {
      name: `E2E Ingredient Order ${ts}`,
      process_type: "juice",
      ingredients: [
        { name: "Apple juice", amount_liters: 5, sugar_content_percent: 10 },
        { name: "Water", amount_liters: 3, sugar_content_percent: null },
      ],
    },
  });
  expect(createResponse.status()).toBe(201);
  const { data: batch } = (await createResponse.json()) as { data: { id: string } };
  const batchId = batch.id;

  const saveButton = page.getByRole("button", { name: "Save Changes" });

  // Only the batch-update PUT lives at exactly /api/batches/{id}, marking a save.
  const batchSaved = (r: Response) =>
    r.request().method() === "PUT" && new URL(r.url()).pathname === `/api/batches/${batchId}`;

  // Order oracle: grip aria-labels in DOM order. Reading the accessible name via
  // getAttribute (not textContent) is correct — the grip holds only an
  // aria-hidden icon, so its textContent is empty.
  const gripOrder = () =>
    page.getByRole("button", { name: /^Reorder / }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));

  // Keyboard reorder: focus a grip, Space to lift, an arrow to move, Space to
  // drop. The keyboard sensor is deterministic (unlike the 8px-activation pointer
  // sensor). Each key waits on real STATE, never a timeout:
  //   - after Space, the lifted card exposes the accessible name "<name> being
  //     dragged" (lift registered);
  //   - after the arrow, dnd-kit's role="status" live region announces a move
  //     over a NEW droppable area — wait for that text to change before dropping,
  //     so the drop never lands before the move applies;
  //   - after the drop, the "being dragged" state clears.
  async function moveByKeyboard(ingredientName: string, direction: "ArrowUp" | "ArrowDown") {
    const dragging = page.getByLabel(`${ingredientName} being dragged`);
    const liveRegion = page.getByRole("status");
    const liveText = async () => (await liveRegion.allTextContents()).join(" | ");

    await page.getByRole("button", { name: `Reorder ${ingredientName}` }).focus();
    await page.keyboard.press("Space");
    await expect(dragging).toBeVisible(); // lift registered
    const afterLift = await liveText();

    await page.keyboard.press(direction);
    await expect.poll(liveText).not.toBe(afterLift); // move over a new area registered
    await page.keyboard.press("Space");
    await expect(dragging).toBeHidden(); // drop settled
  }

  try {
    // ---- Reorder → save → reload: the new order must persist ----
    await page.goto(`/batches/${batchId}`);
    // Hydration gate: the form island is interactive once Save Changes enables.
    await expect(saveButton.first()).toBeEnabled();
    // Seeded order (all cards collapsed, so grips are present).
    await expect.poll(gripOrder).toEqual(["Reorder Apple juice", "Reorder Water"]);

    // Move "Apple juice" down past "Water" → [Water, Apple juice].
    await moveByKeyboard("Apple juice", "ArrowDown");
    await expect.poll(gripOrder).toEqual(["Reorder Water", "Reorder Apple juice"]);

    const reorderSaved = page.waitForResponse(batchSaved);
    // Click the BOTTOM Save (seed.spec.ts guidance): submitting can recompute the
    // top validation banner and shift the top button out from under the pointer.
    await saveButton.last().click();
    expect((await reorderSaved).status()).toBe(200);

    await page.reload();
    await expect(saveButton.first()).toBeEnabled();
    // Round-trip oracle: SSR re-initializes the cards from the persisted row; the
    // reordered sequence must survive the reload.
    await expect.poll(gripOrder).toEqual(["Reorder Water", "Reorder Apple juice"]);

    // ---- Reorder again → Cancel → reopen: the saved order must be restored ----
    // Clicking Cancel on a dirty form trips the native beforeunload dialog; accept
    // it so navigation proceeds instead of hanging on Playwright's auto-dismiss.
    page.on("dialog", (dialog) => void dialog.accept());

    // Move "Water" back down → [Apple juice, Water] (differs from the saved order).
    await moveByKeyboard("Water", "ArrowDown");
    await expect.poll(gripOrder).toEqual(["Reorder Apple juice", "Reorder Water"]);

    // Cancel is a top+bottom pair of href="/batches" links; click the bottom one
    // and confirm the navigation actually completed (the discard happened).
    await page.getByRole("link", { name: "Cancel" }).last().click();
    await page.waitForURL("**/batches");

    // Reopen explicitly — Cancel lands on the list, not the detail page.
    await page.goto(`/batches/${batchId}`);
    await expect(saveButton.first()).toBeEnabled();
    // The unsaved reorder was discarded; the last-saved order is restored.
    await expect.poll(gripOrder).toEqual(["Reorder Water", "Reorder Apple juice"]);
  } finally {
    // Cleanup: remove the seeded batch so the test leaves no residue.
    await page.request.delete(`/api/batches/${batchId}`);
  }
});
