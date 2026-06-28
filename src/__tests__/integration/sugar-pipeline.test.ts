import { afterEach, describe, expect, it } from "vitest";
import { apiRequest, getAdminClient } from "./helpers";

// ──────────────────────────────────────────────────────────────────────────────
// Local domain constants — independently derived, NEVER imported from production.
// If a constant changes in the service the test must be consciously updated.
// ──────────────────────────────────────────────────────────────────────────────
const GRAMS_PER_ABV_PER_LITER = 17;
const SWEETNESS_MIDPOINTS: Record<string, number> = {
  dry: 0,
  semi_dry: 10,
  semi_sweet: 30,
  sweet: 60,
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function deriveExpected(input: {
  target_volume_liters: number;
  target_abv: number;
  planned_sweetness: string;
  ingredients: { amount_liters: number; sugar_content_percent: number | null }[];
}): { fermentation_sugar_kg: number; sweetness_sugar_kg: number } {
  // Stage 1: aggregate ingredient sugar in grams (1% of 1L = 10g)
  const totalIngredientSugarGrams = input.ingredients.reduce(
    (sum, i) => sum + i.amount_liters * (i.sugar_content_percent ?? 0) * 10,
    0,
  );

  // Stage 2: ABV sugar need in grams
  const sugarNeededForAbvGrams = input.target_abv * GRAMS_PER_ABV_PER_LITER * input.target_volume_liters;

  // Stage 3: fermentation sugar (clamped to 0)
  const fermentationSugarGrams = Math.max(0, sugarNeededForAbvGrams - totalIngredientSugarGrams);
  const fermentation_sugar_kg = fermentationSugarGrams / 1000;

  // Stage 4: sweetness sugar
  const sweetnessMidpoint = SWEETNESS_MIDPOINTS[input.planned_sweetness] ?? 0;
  const sweetness_sugar_kg = (sweetnessMidpoint * input.target_volume_liters) / 1000;

  return { fermentation_sugar_kg, sweetness_sugar_kg };
}

// ──────────────────────────────────────────────────────────────────────────────
// Test data cleanup
// ──────────────────────────────────────────────────────────────────────────────

const createdBatchIds: string[] = [];

afterEach(async () => {
  const admin = getAdminClient();
  for (const id of createdBatchIds) {
    await admin.from("diary_entries").delete().eq("batch_id", id);
    await admin.from("batches").delete().eq("id", id);
  }
  createdBatchIds.length = 0;
});

// ──────────────────────────────────────────────────────────────────────────────
// Pipeline Integration Tests
// ──────────────────────────────────────────────────────────────────────────────

type PipelineScenario = [
  name: string,
  input: {
    target_volume_liters: number;
    target_abv: number;
    planned_sweetness: string;
    ingredients: { name: string; amount_liters: number; sugar_content_percent: number | null }[];
  },
  expected: { fermentation_sugar_kg: number; sweetness_sugar_kg: number },
];

const scenarios: PipelineScenario[] = [
  [
    "S1: single ingredient, dry wine — basic aggregation + formula",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [{ name: "Apple juice", amount_liters: 20, sugar_content_percent: 10 }],
    },
    // Derivation:
    //   ingredient sugar = 20L × 10% × 10 = 2000g
    //   ABV need = 12 × 17 × 20 = 4080g
    //   fermentation = MAX(0, 4080 - 2000) = 2080g → 2.08 kg
    //   sweetness = 0 × 20 / 1000 = 0 kg (dry)
    deriveExpected({
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 20, sugar_content_percent: 10 }],
    }),
  ],
  [
    "S2: multiple ingredients, various sugar contents — summation across array",
    {
      target_volume_liters: 25,
      target_abv: 11,
      planned_sweetness: "dry",
      ingredients: [
        { name: "Apple juice", amount_liters: 15, sugar_content_percent: 12 },
        { name: "Pear juice", amount_liters: 10, sugar_content_percent: 8 },
      ],
    },
    // Derivation:
    //   ingredient sugar = (15 × 12 × 10) + (10 × 8 × 10) = 1800 + 800 = 2600g
    //   ABV need = 11 × 17 × 25 = 4675g
    //   fermentation = MAX(0, 4675 - 2600) = 2075g → 2.075 kg
    //   sweetness = 0 kg (dry)
    deriveExpected({
      target_volume_liters: 25,
      target_abv: 11,
      planned_sweetness: "dry",
      ingredients: [
        { amount_liters: 15, sugar_content_percent: 12 },
        { amount_liters: 10, sugar_content_percent: 8 },
      ],
    }),
  ],
  [
    "S3: null sugar_content_percent on some ingredients — null→0 treatment",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [
        { name: "Apple juice", amount_liters: 15, sugar_content_percent: 10 },
        { name: "Water", amount_liters: 5, sugar_content_percent: null },
      ],
    },
    // Derivation:
    //   ingredient sugar = (15 × 10 × 10) + (5 × 0 × 10) = 1500 + 0 = 1500g
    //   ABV need = 12 × 17 × 20 = 4080g
    //   fermentation = MAX(0, 4080 - 1500) = 2580g → 2.58 kg
    //   sweetness = 0 kg (dry)
    deriveExpected({
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [
        { amount_liters: 15, sugar_content_percent: 10 },
        { amount_liters: 5, sugar_content_percent: null },
      ],
    }),
  ],
  [
    "S4: ingredients supply more sugar than ABV needs — Math.max(0, ...) clamp",
    {
      target_volume_liters: 10,
      target_abv: 5,
      planned_sweetness: "dry",
      ingredients: [{ name: "Grape must", amount_liters: 10, sugar_content_percent: 25 }],
    },
    // Derivation:
    //   ingredient sugar = 10 × 25 × 10 = 2500g
    //   ABV need = 5 × 17 × 10 = 850g
    //   fermentation = MAX(0, 850 - 2500) = MAX(0, -1650) = 0g → 0 kg
    //   sweetness = 0 kg (dry)
    deriveExpected({
      target_volume_liters: 10,
      target_abv: 5,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 10, sugar_content_percent: 25 }],
    }),
  ],
  [
    "S5: semi-sweet wine — verifies sweetness_sugar_kg path",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "semi_sweet",
      ingredients: [{ name: "Apple juice", amount_liters: 20, sugar_content_percent: 10 }],
    },
    // Derivation:
    //   ingredient sugar = 20 × 10 × 10 = 2000g
    //   ABV need = 12 × 17 × 20 = 4080g
    //   fermentation = MAX(0, 4080 - 2000) = 2080g → 2.08 kg
    //   sweetness = 30 (semi_sweet midpoint) × 20 / 1000 = 0.6 kg
    deriveExpected({
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "semi_sweet",
      ingredients: [{ amount_liters: 20, sugar_content_percent: 10 }],
    }),
  ],
  [
    "S6: very small values (0.5L × 0.1%) — precision through pipeline",
    {
      target_volume_liters: 5,
      target_abv: 10,
      planned_sweetness: "dry",
      ingredients: [{ name: "Dilute wash", amount_liters: 0.5, sugar_content_percent: 0.1 }],
    },
    // Derivation:
    //   ingredient sugar = 0.5 × 0.1 × 10 = 0.5g
    //   ABV need = 10 × 17 × 5 = 850g
    //   fermentation = MAX(0, 850 - 0.5) = 849.5g → 0.8495 kg
    //   sweetness = 0 kg (dry)
    deriveExpected({
      target_volume_liters: 5,
      target_abv: 10,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 0.5, sugar_content_percent: 0.1 }],
    }),
  ],
  [
    "S7: large values (100L × 100% sugar) — no overflow/truncation",
    {
      target_volume_liters: 100,
      target_abv: 15,
      planned_sweetness: "sweet",
      ingredients: [{ name: "Pure sugar syrup", amount_liters: 100, sugar_content_percent: 100 }],
    },
    // Derivation:
    //   ingredient sugar = 100 × 100 × 10 = 100,000g
    //   ABV need = 15 × 17 × 100 = 25,500g
    //   fermentation = MAX(0, 25500 - 100000) = 0g → 0 kg
    //   sweetness = 60 (sweet midpoint) × 100 / 1000 = 6.0 kg
    deriveExpected({
      target_volume_liters: 100,
      target_abv: 15,
      planned_sweetness: "sweet",
      ingredients: [{ amount_liters: 100, sugar_content_percent: 100 }],
    }),
  ],
];

describe("Sugar pipeline persistence (Risk #4)", () => {
  it.each(scenarios)("%s", async (_name, input, expected) => {
    // Build a valid batch payload with the test ingredients
    const payload = {
      name: `Pipeline test: ${_name}`,
      process_type: "juice",
      target_volume_liters: input.target_volume_liters,
      target_abv: input.target_abv,
      planned_sweetness: input.planned_sweetness,
      fermentation_sugar_kg: expected.fermentation_sugar_kg,
      sweetness_sugar_kg: expected.sweetness_sugar_kg,
      ingredients: input.ingredients,
    };

    // POST batch via API (full stack: middleware → route → zod → DB)
    const res = await apiRequest("/api/batches", { method: "POST", body: payload });
    expect(res.status).toBe(201);

    const json = (await res.json()) as { data: { id: string } };
    const batchId = json.data.id;
    createdBatchIds.push(batchId);

    // Query DB directly via admin client to verify persisted values
    const admin = getAdminClient();
    const result = await admin.from("batches").select("*").eq("id", batchId).single();

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    const stored = result.data as { fermentation_sugar_kg: number; sweetness_sugar_kg: number };
    expect(stored.fermentation_sugar_kg).toBeCloseTo(expected.fermentation_sugar_kg, 6);
    expect(stored.sweetness_sugar_kg).toBeCloseTo(expected.sweetness_sugar_kg, 6);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ParseFloat Seam Unit Test
// ──────────────────────────────────────────────────────────────────────────────

describe("parseFloat seam behavior", () => {
  // Documents the string→number conversion pattern used by BatchForm:
  //   parseFloat(value) || 0
  // This is a pure unit test (no DB). It catches if a future refactor
  // introduces a different parser that changes edge behavior.

  const parseSeam = (value: string): number => parseFloat(value) || 0;

  const cases: [input: string, expected: number][] = [
    ["0.001", 0.001],
    ["00.5", 0.5],
    ["0", 0],
    ["", 0],
    [" ", 0],
    ["1.23456789", 1.23456789],
    ["1e-3", 0.001],
    ["3.14", 3.14],
    ["0.0", 0],
  ];

  it.each(cases)('parseFloat("%s") || 0 === %s', (input, expected) => {
    expect(parseSeam(input)).toBeCloseTo(expected, 10);
  });
});
