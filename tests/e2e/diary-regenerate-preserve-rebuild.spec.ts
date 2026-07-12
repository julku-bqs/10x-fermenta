import { test, expect } from "@playwright/test";

/**
 * E2E — test-plan.md risk #3: the browser Regenerate wiring preserves user data
 * and rebuilds only the auto plan. Four DOM oracles, each a distinct facet:
 *   (a) a user-ADDED entry survives Regenerate,
 *   (b) a user-PROMOTED (edited auto→user) entry survives Regenerate,
 *   (c) untouched auto entries are wiped and rebuilt with completed=false,
 *   (d) a user entry dated before batch_date renders first (ordering honored).
 *
 * Seed: tests/e2e/seed.spec.ts. Real boundaries: auth/routing/API/DB — seed via
 * POST/PUT, act in the browser, clean up via DELETE. The oracle is DOM-observable
 * only (marker text + toggle accessible-name count + first-listitem), never a DB
 * or entry_type assertion — unit still owns which steps a plan generates.
 */

test("regenerate preserves user entries, rebuilds auto entries, and honors ordering", async ({ page }) => {
  // Unique per-run markers so parallel runs and re-runs never collide. Both
  // user-owned markers share the `user-` prefix so the completion step can
  // exclude them via hasNotText: /user-/.
  const ts = Date.now();
  const userAddedMarker = `user-added: E2E ${ts}`;
  const userPromotedMarker = `user-promoted: E2E ${ts}`;

  // A pinned batch_date (not the today-default): auto entries land at
  // batch_date + offset (offset ≥ 0), so a user entry strictly before it is
  // unambiguously first regardless of the created_at tiebreak.
  const batchDate = "2025-06-15";
  const userEntryDate = "2025-06-01"; // strictly before batch_date → sorts first

  // Setup 1: seed a batch via the real API. A juice batch auto-generates its
  // diary plan on POST, so the batch already carries auto entries.
  const createResponse = await page.request.post("/api/batches", {
    data: {
      name: `E2E Diary Regenerate ${ts}`,
      process_type: "juice",
      batch_date: batchDate,
    },
  });
  expect(createResponse.status()).toBe(201);
  const { data: batch } = (await createResponse.json()) as { data: { id: string } };
  const batchId = batch.id;

  try {
    // Setup 2: authoring guard — the plan must have generated auto entries.
    // Capture the list and pick one concrete auto entry (a middle one, never the
    // earliest) to promote, so it differs from the completion target below.
    const diaryResponse = await page.request.get(`/api/batches/${batchId}/diary`);
    expect(diaryResponse.status()).toBe(200);
    const { data: autoEntries } = (await diaryResponse.json()) as { data: { id: string; description: string }[] };
    expect(autoEntries.length).toBeGreaterThan(2);
    const entryToPromote = autoEntries[Math.floor(autoEntries.length / 2)];

    // Setup 3: add a USER entry dated strictly before batch_date (deterministic
    // ordering signal for oracle (d)).
    const addResponse = await page.request.post(`/api/batches/${batchId}/diary`, {
      data: { description: userAddedMarker, entry_date: userEntryDate },
    });
    expect(addResponse.status()).toBe(201);

    // Setup 4: PUT the captured auto entry's description → fires the promotion
    // trigger, converting it auto→user. It must survive Regenerate.
    const promoteResponse = await page.request.put(`/api/batches/${batchId}/diary/${entryToPromote.id}`, {
      data: { description: userPromotedMarker },
    });
    expect(promoteResponse.status()).toBe(200);

    // Action: open the batch detail page (renders BatchForm mode="edit" directly).
    await page.goto(`/batches/${batchId}`);

    // Two-stage readiness gate. (1) Save Changes enabled = form island hydrated.
    await expect(page.getByRole("button", { name: "Save Changes" }).first()).toBeEnabled();
    // (2) The diary list loads on a SEPARATE async fetch (not SSR'd), so wait for
    // the seeded user-added marker to paint as a rendered list entry. Targeting
    // the description text (not a form-control value) means an input can't satisfy
    // the gate prematurely — getByText ignores control values.
    await expect(page.getByText(userAddedMarker)).toBeVisible();

    const diaryList = page.getByRole("list", { name: /diary/i });

    // Complete exactly one UNTOUCHED auto entry. The list-scoped, user-excluding
    // locator skips the unrelated ValidationWarnings <li>s AND both user- rows
    // (which survive Regenerate and would otherwise leave a stray completed entry).
    const completeToggle = diaryList
      .getByRole("listitem")
      .filter({ hasNotText: /user-/ })
      .first()
      .getByRole("button", { name: "Mark as complete" });
    await expect(completeToggle).toBeVisible();
    await completeToggle.click();
    // Optimistic update flips the toggle's accessible name: exactly one entry
    // is now completed.
    await expect(page.getByRole("button", { name: "Mark as incomplete" })).toHaveCount(1);

    // Click Regenerate and wait for the real regenerate round-trip to settle.
    const regenerateResponsePromise = page.waitForResponse(
      (r) => r.url().includes(`/api/batches/${batchId}/diary/regenerate`) && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Regenerate|Generate Plan/i }).click();
    const regenerateResponse = await regenerateResponsePromise;
    expect(regenerateResponse.status()).toBe(200);

    // Oracle (a): the user-added entry survived Regenerate.
    await expect(page.getByText(userAddedMarker)).toBeVisible();
    // Oracle (b): the user-promoted (edited auto→user) entry survived Regenerate.
    await expect(page.getByText(userPromotedMarker)).toBeVisible();
    // Oracle (c): every auto entry was rebuilt with completed=false — the one
    // untouched auto entry we completed was wiped, and the surviving user rows
    // were never completed, so ZERO entries show as complete.
    await expect(page.getByRole("button", { name: "Mark as incomplete" })).toHaveCount(0);
    // Oracle (d): the strictly-earlier user-added entry is the FIRST list item —
    // its entry_date was persisted/honored and the entry wasn't dropped/reordered
    // (not merely that the list is monotonically sorted, which the client always is).
    await expect(diaryList.getByRole("listitem").first()).toContainText(userAddedMarker);
  } finally {
    // Cleanup: remove the seeded batch (cascades to diary_entries) so the test
    // leaves no residue.
    await page.request.delete(`/api/batches/${batchId}`);
  }
});
