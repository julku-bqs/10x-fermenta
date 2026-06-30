import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { apiRequest, apiRequestRaw, assertNoDbWrite, getAdminClient, getTestUserId } from "./helpers";

// ──────────────────────────────────────────────────────────────────────────────
// Shared test state
// ──────────────────────────────────────────────────────────────────────────────

let testBatchId: string;
let testDiaryEntryId: string;

beforeAll(async () => {
  const admin = getAdminClient();
  const userId = getTestUserId();

  // Create a batch for PUT tests
  const { data: batch, error: batchError } = await admin
    .from("batches")
    .insert({
      name: "Validation test batch",
      process_type: "juice",
      user_id: userId,
    })
    .select("id")
    .single();
  if (batchError) {
    throw new Error(`Fixture setup failed (batches insert): ${batchError.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  testBatchId = batch.id;

  // Create a diary entry for PUT diary tests
  const { data: entry, error: entryError } = await admin
    .from("diary_entries")
    .insert({
      batch_id: testBatchId,
      description: "Test diary entry",
      entry_date: "2026-01-01",
      entry_type: "user",
    })
    .select("id")
    .single();
  if (entryError) {
    throw new Error(`Fixture setup failed (diary_entries insert): ${entryError.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  testDiaryEntryId = entry.id;
});

afterEach(async () => {
  // No cleanup needed per test — we only send invalid input
});

// Clean up test fixtures after all tests
import { afterAll } from "vitest";
afterAll(async () => {
  const admin = getAdminClient();
  await admin.from("diary_entries").delete().eq("batch_id", testBatchId);
  await admin.from("batches").delete().eq("id", testBatchId);
});

// ──────────────────────────────────────────────────────────────────────────────
// Helper: assert rejection response shape
// ──────────────────────────────────────────────────────────────────────────────

async function expectRejection(res: Response, expectedDetailPaths: string[]) {
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error: string; details?: Record<string, string[]> };
  expect(body.error).toMatch(/[Vv]alidation failed|Invalid JSON body/);
  if (expectedDetailPaths.length > 0) {
    expect(body.details).toBeDefined();
    for (const path of expectedDetailPaths) {
      expect(body.details).toHaveProperty(path);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/batches — rejection scenarios
// ──────────────────────────────────────────────────────────────────────────────

type RejectionScenario = [name: string, payload: unknown, expectedDetailPaths: string[]];

describe("POST /api/batches — validation rejection", () => {
  const scenarios: RejectionScenario[] = [
    ["missing name (required field)", { process_type: "juice" }, ["name"]],
    ["missing process_type (required enum)", { name: "Test batch" }, ["process_type"]],
    ['invalid process_type value ("sparkling")', { name: "Test batch", process_type: "sparkling" }, ["process_type"]],
    [
      "negative fermentation_sugar_kg (-1)",
      { name: "Test batch", process_type: "juice", fermentation_sugar_kg: -1 },
      ["fermentation_sugar_kg"],
    ],
    ["target_abv above 100", { name: "Test batch", process_type: "juice", target_abv: 101 }, ["target_abv"]],
    [
      "ingredient with empty name (nested array validation)",
      {
        name: "Test batch",
        process_type: "juice",
        ingredients: [{ name: "", amount_liters: 5, sugar_content_percent: 10 }],
      },
      ["ingredients.0.name"],
    ],
    [
      "ingredient with sugar_content_percent above 100",
      {
        name: "Test batch",
        process_type: "juice",
        ingredients: [{ name: "Juice", amount_liters: 5, sugar_content_percent: 101 }],
      },
      ["ingredients.0.sugar_content_percent"],
    ],
    ["empty object {}", {}, ["name", "process_type"]],
  ];

  it.each(scenarios)("%s", async (_name, payload, expectedDetailPaths) => {
    // Use a unique sentinel name per scenario to enable assertNoDbWrite filtering.
    // Scenarios that omit `name` (empty object) won't match anyway.
    const sentinel = `__reject_test_${_name}`;
    const payloadWithSentinel =
      typeof payload === "object" && payload !== null && "name" in payload ? { ...payload, name: sentinel } : payload;

    const res = await assertNoDbWrite([{ table: "batches", filterColumn: "name", filterValue: sentinel }], () =>
      apiRequest("/api/batches", { method: "POST", body: payloadWithSentinel }),
    );
    await expectRejection(res, expectedDetailPaths);
  });

  it("invalid JSON body (not parseable)", async () => {
    const res = await apiRequestRaw("/api/batches", "POST", "not valid json {{{");

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid JSON body");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/batches/[id] — rejection scenarios
// ──────────────────────────────────────────────────────────────────────────────

describe("PUT /api/batches/[id] — validation rejection", () => {
  const scenarios: RejectionScenario[] = [
    ["negative fermentation_sugar_kg", { fermentation_sugar_kg: -1 }, ["fermentation_sugar_kg"]],
    ["invalid planned_sweetness enum", { planned_sweetness: "extra_sweet" }, ["planned_sweetness"]],
    [
      "ingredient with negative amount_liters",
      { ingredients: [{ name: "Juice", amount_liters: -5, sugar_content_percent: 10 }] },
      ["ingredients.0.amount_liters"],
    ],
    ["target_volume_liters of 0 (must be positive)", { target_volume_liters: 0 }, ["target_volume_liters"]],
  ];

  it.each(scenarios)("%s", async (_name, payload, expectedDetailPaths) => {
    const res = await assertNoDbWrite([{ table: "batches", filterColumn: "id", filterValue: testBatchId }], () =>
      apiRequest(`/api/batches/${testBatchId}`, { method: "PUT", body: payload }),
    );
    await expectRejection(res, expectedDetailPaths);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/batches/[id]/diary — rejection scenarios
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/batches/[id]/diary — validation rejection", () => {
  const scenarios: RejectionScenario[] = [
    ["missing description (required)", { entry_date: "2026-01-01" }, ["description"]],
    ["empty string description", { description: "" }, ["description"]],
    [
      'invalid entry_date format ("not-a-date")',
      { description: "Valid description", entry_date: "not-a-date" },
      ["entry_date"],
    ],
  ];

  it.each(scenarios)("%s", async (_name, payload, expectedDetailPaths) => {
    const res = await assertNoDbWrite(
      [{ table: "diary_entries", filterColumn: "batch_id", filterValue: testBatchId }],
      () => apiRequest(`/api/batches/${testBatchId}/diary`, { method: "POST", body: payload }),
    );
    await expectRejection(res, expectedDetailPaths);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/batches/[id]/diary/[entryId] — rejection scenarios
// ──────────────────────────────────────────────────────────────────────────────

describe("PUT /api/batches/[id]/diary/[entryId] — validation rejection", () => {
  const scenarios: RejectionScenario[] = [
    ['invalid entry_date format ("not-a-date")', { entry_date: "not-a-date" }, ["entry_date"]],
    ["empty description when explicitly provided", { description: "" }, ["description"]],
  ];

  it.each(scenarios)("%s", async (_name, payload, expectedDetailPaths) => {
    const res = await assertNoDbWrite(
      [{ table: "diary_entries", filterColumn: "batch_id", filterValue: testBatchId }],
      () =>
        apiRequest(`/api/batches/${testBatchId}/diary/${testDiaryEntryId}`, {
          method: "PUT",
          body: payload,
        }),
    );
    await expectRejection(res, expectedDetailPaths);
  });
});
