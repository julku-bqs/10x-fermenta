import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRequest, getAdminClient, getTestUserId } from "./helpers";

// ──────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ──────────────────────────────────────────────────────────────────────────────

const createdBatchIds: string[] = [];

async function createTestBatch(overrides: Record<string, unknown> = {}): Promise<string> {
  const admin = getAdminClient();
  const userId = getTestUserId();
  const { data } = await admin
    .from("batches")
    .insert({
      name: `Lifecycle test ${Date.now()}`,
      process_type: "juice",
      user_id: userId,
      fermentation_sugar_kg: 0,
      sweetness_sugar_kg: 0,
      ...overrides,
    })
    .select("id")
    .single();
  const id = (data as { id: string }).id;
  createdBatchIds.push(id);
  return id;
}

beforeAll(() => {
  // Batch creation happens per-test
});

afterAll(async () => {
  const admin = getAdminClient();
  for (const id of createdBatchIds) {
    await admin.from("diary_entries").delete().eq("batch_id", id);
    await admin.from("batches").delete().eq("id", id);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function putBatch(batchId: string, body: Record<string, unknown>) {
  return apiRequest(`/api/batches/${batchId}`, { method: "PUT", body });
}

async function getBatchFromDb(batchId: string) {
  const admin = getAdminClient();
  const result = await admin.from("batches").select("*").eq("id", batchId).single();
  expect(result.error).toBeNull();
  return result.data as { fermentation_sugar_kg: number; sweetness_sugar_kg: number };
}

// ──────────────────────────────────────────────────────────────────────────────
// Roundtrip Scenarios (PUT then DB query, assert values match)
// ──────────────────────────────────────────────────────────────────────────────

type LifecycleScenario = [name: string, sugarValues: { fermentation_sugar_kg: number; sweetness_sugar_kg: number }];

const roundtripScenarios: LifecycleScenario[] = [
  ["L1: standard calculated values", { fermentation_sugar_kg: 2.55, sweetness_sugar_kg: 0.3 }],
  ["L2: zero values (falsy but valid)", { fermentation_sugar_kg: 0, sweetness_sugar_kg: 0 }],
  ["L3: very small values (precision)", { fermentation_sugar_kg: 0.001, sweetness_sugar_kg: 0.0005 }],
  ["L4: large values (no truncation)", { fermentation_sugar_kg: 999.999, sweetness_sugar_kg: 50.123 }],
  ["L5: manually-typed-style values", { fermentation_sugar_kg: 1.5, sweetness_sugar_kg: 0 }],
];

describe("Sugar field save/reload lifecycle (Risk #7)", () => {
  describe("Roundtrip: PUT → DB verify", () => {
    it.each(roundtripScenarios)("%s", async (_name, sugarValues) => {
      const batchId = await createTestBatch();

      // PUT sugar values via API
      const res = await putBatch(batchId, sugarValues);
      expect(res.status).toBe(200);

      // Verify stored values match what was sent
      const stored = await getBatchFromDb(batchId);
      expect(stored.fermentation_sugar_kg).toBeCloseTo(sugarValues.fermentation_sugar_kg, 6);
      expect(stored.sweetness_sugar_kg).toBeCloseTo(sugarValues.sweetness_sugar_kg, 6);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Partial update protection (Zod v4 .default() concern)
  // ──────────────────────────────────────────────────────────────────────────

  describe("Partial update protection", () => {
    it("L6: PUT without sugar fields does NOT zero them", async () => {
      // Create batch with known sugar values
      const batchId = await createTestBatch({
        fermentation_sugar_kg: 2.5,
        sweetness_sugar_kg: 0.3,
      });

      // PUT only the name (no sugar fields in payload)
      const res = await putBatch(batchId, { name: "Updated name only" });
      expect(res.status).toBe(200);

      // Sugar values must be unchanged
      const stored = await getBatchFromDb(batchId);
      expect(stored.fermentation_sugar_kg).toBeCloseTo(2.5, 6);
      expect(stored.sweetness_sugar_kg).toBeCloseTo(0.3, 6);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Sequential save (simulates cancel semantic)
  // ──────────────────────────────────────────────────────────────────────────

  describe("Sequential save (cancel semantic)", () => {
    it("L7: two PUTs → last save wins", async () => {
      const batchId = await createTestBatch();

      // First save
      const res1 = await putBatch(batchId, {
        fermentation_sugar_kg: 1.0,
        sweetness_sugar_kg: 0.5,
      });
      expect(res1.status).toBe(200);

      // Second save (overwrites)
      const res2 = await putBatch(batchId, {
        fermentation_sugar_kg: 2.0,
        sweetness_sugar_kg: 1.0,
      });
      expect(res2.status).toBe(200);

      // DB reflects second save only
      const stored = await getBatchFromDb(batchId);
      expect(stored.fermentation_sugar_kg).toBeCloseTo(2.0, 6);
      expect(stored.sweetness_sugar_kg).toBeCloseTo(1.0, 6);
    });

    it("L8: single PUT then no second PUT → values unchanged (cancel = no-op)", async () => {
      const batchId = await createTestBatch();

      // Save once
      const res = await putBatch(batchId, {
        fermentation_sugar_kg: 1.0,
        sweetness_sugar_kg: 0.5,
      });
      expect(res.status).toBe(200);

      // No second PUT (simulates user clicking Cancel → navigating away)
      // DB should still have the first save's values
      const stored = await getBatchFromDb(batchId);
      expect(stored.fermentation_sugar_kg).toBeCloseTo(1.0, 6);
      expect(stored.sweetness_sugar_kg).toBeCloseTo(0.5, 6);
    });
  });
});
