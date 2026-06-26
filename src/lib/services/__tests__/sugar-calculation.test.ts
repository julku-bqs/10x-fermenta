import { describe, expect, it } from "vitest";
import { calculateSugar } from "@/lib/services/sugar-calculation";
import type { CalculationInput } from "@/lib/services/sugar-calculation";

// Local domain constants — never imported from production code.
// If these change in the service, tests must be consciously updated.
const GRAMS_PER_ABV_PER_LITER = 17;
const MIDPOINT_DRY = 0;
const MIDPOINT_SEMI_DRY = 10;
const MIDPOINT_SEMI_SWEET = 30;
const MIDPOINT_SWEET = 60;

interface Expected {
  fermentation_sugar_kg: number;
  sweetness_sugar_kg: number;
  total_ingredient_sugar_grams: number;
  sugar_needed_for_abv_grams: number;
}

type Scenario = [string, CalculationInput, Expected];

const scenarios: Scenario[] = [
  // --- Existing valid scenarios (rebuilt with independent derivation) ---
  [
    "dry baseline — 20L, 12% ABV, no ingredients, full fermentation sugar",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20) / 1000,
      sweetness_sugar_kg: (MIDPOINT_DRY * 20) / 1000,
    },
  ],
  [
    "dry with partial ingredients — deficit remains",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 10, sugar_content_percent: 20 }],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 10 * 20 * 10,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20 - 10 * 20 * 10) / 1000,
      sweetness_sugar_kg: 0,
    },
  ],
  [
    "dry ingredients exceed ABV needs — fermentation clamped to 0",
    {
      target_volume_liters: 10,
      target_abv: 5,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 10, sugar_content_percent: 20 }],
    },
    {
      sugar_needed_for_abv_grams: 5 * GRAMS_PER_ABV_PER_LITER * 10,
      total_ingredient_sugar_grams: 10 * 20 * 10,
      fermentation_sugar_kg: 0,
      sweetness_sugar_kg: 0,
    },
  ],
  [
    "zero volume — all outputs 0",
    {
      target_volume_liters: 0,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [],
    },
    {
      sugar_needed_for_abv_grams: 0,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: 0,
      sweetness_sugar_kg: 0,
    },
  ],
  [
    "zero ABV — no fermentation sugar needed",
    {
      target_volume_liters: 20,
      target_abv: 0,
      planned_sweetness: "dry",
      ingredients: [],
    },
    {
      sugar_needed_for_abv_grams: 0,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: 0,
      sweetness_sugar_kg: 0,
    },
  ],
  [
    "null sugar_content_percent — contributes 0 grams",
    {
      target_volume_liters: 10,
      target_abv: 10,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 5, sugar_content_percent: null }],
    },
    {
      sugar_needed_for_abv_grams: 10 * GRAMS_PER_ABV_PER_LITER * 10,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (10 * GRAMS_PER_ABV_PER_LITER * 10) / 1000,
      sweetness_sugar_kg: 0,
    },
  ],
  [
    "multi-ingredient aggregation — sums correctly",
    {
      target_volume_liters: 30,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [
        { amount_liters: 10, sugar_content_percent: 15 },
        { amount_liters: 5, sugar_content_percent: 24 },
      ],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 30,
      total_ingredient_sugar_grams: 10 * 15 * 10 + 5 * 24 * 10,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 30 - (10 * 15 * 10 + 5 * 24 * 10)) / 1000,
      sweetness_sugar_kg: 0,
    },
  ],

  // --- S1: Non-dry wine where ingredients exceed ABV needs ---
  [
    "S1 — sweet wine, ingredients exceed ABV, sweetness still applied",
    {
      target_volume_liters: 10,
      target_abv: 8,
      planned_sweetness: "sweet",
      ingredients: [{ amount_liters: 10, sugar_content_percent: 20 }],
    },
    {
      sugar_needed_for_abv_grams: 8 * GRAMS_PER_ABV_PER_LITER * 10,
      total_ingredient_sugar_grams: 10 * 20 * 10,
      fermentation_sugar_kg: 0,
      sweetness_sugar_kg: (MIDPOINT_SWEET * 10) / 1000,
    },
  ],

  // --- S2: Non-dry wine with multiple ingredients ---
  [
    "S2 — semi_dry with 3 ingredients, aggregation + sweetness combined",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "semi_dry",
      ingredients: [
        { amount_liters: 10, sugar_content_percent: 15 },
        { amount_liters: 5, sugar_content_percent: 20 },
        { amount_liters: 3, sugar_content_percent: 10 },
      ],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 10 * 15 * 10 + 5 * 20 * 10 + 3 * 10 * 10,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20 - (10 * 15 * 10 + 5 * 20 * 10 + 3 * 10 * 10)) / 1000,
      sweetness_sugar_kg: (MIDPOINT_SEMI_DRY * 20) / 1000,
    },
  ],

  // --- S3: Ingredient with explicit 0% sugar ---
  [
    "S3 — 0% sugar ingredient contributes nothing (same as null)",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 5, sugar_content_percent: 0 }],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20) / 1000,
      sweetness_sugar_kg: 0,
    },
  ],

  // --- S4: Very high ABV (20%) ---
  [
    "S4 — 20% ABV fortified wine, large sugar requirement",
    {
      target_volume_liters: 20,
      target_abv: 20,
      planned_sweetness: "dry",
      ingredients: [],
    },
    {
      sugar_needed_for_abv_grams: 20 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (20 * GRAMS_PER_ABV_PER_LITER * 20) / 1000,
      sweetness_sugar_kg: 0,
    },
  ],

  // --- S5: Very small volume (0.5L) ---
  [
    "S5 — 0.5L micro-batch, precision at small scale",
    {
      target_volume_liters: 0.5,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 0.5,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 0.5) / 1000,
      sweetness_sugar_kg: 0,
    },
  ],

  // --- S6: 10+ ingredients ---
  [
    "S6 — 10 varied ingredients, aggregation at scale",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [
        { amount_liters: 2, sugar_content_percent: 5 },
        { amount_liters: 2, sugar_content_percent: 10 },
        { amount_liters: 2, sugar_content_percent: 15 },
        { amount_liters: 2, sugar_content_percent: 20 },
        { amount_liters: 2, sugar_content_percent: 25 },
        { amount_liters: 1, sugar_content_percent: 5 },
        { amount_liters: 1, sugar_content_percent: 10 },
        { amount_liters: 1, sugar_content_percent: 15 },
        { amount_liters: 1, sugar_content_percent: 20 },
        { amount_liters: 1, sugar_content_percent: 25 },
      ],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      // 2*5*10 + 2*10*10 + 2*15*10 + 2*20*10 + 2*25*10 + 1*5*10 + 1*10*10 + 1*15*10 + 1*20*10 + 1*25*10
      // = 100 + 200 + 300 + 400 + 500 + 50 + 100 + 150 + 200 + 250 = 2250
      total_ingredient_sugar_grams: 2250,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20 - 2250) / 1000,
      sweetness_sugar_kg: 0,
    },
  ],

  // --- S7: All sweetness levels (parameterized, same volume/ABV) ---
  [
    "S7a — dry sweetness level (midpoint 0)",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20) / 1000,
      sweetness_sugar_kg: (MIDPOINT_DRY * 20) / 1000,
    },
  ],
  [
    "S7b — semi_dry sweetness level (midpoint 10 g/L)",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "semi_dry",
      ingredients: [],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20) / 1000,
      sweetness_sugar_kg: (MIDPOINT_SEMI_DRY * 20) / 1000,
    },
  ],
  [
    "S7c — semi_sweet sweetness level (midpoint 30 g/L)",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "semi_sweet",
      ingredients: [],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20) / 1000,
      sweetness_sugar_kg: (MIDPOINT_SEMI_SWEET * 20) / 1000,
    },
  ],
  [
    "S7d — sweet sweetness level (midpoint 60 g/L)",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "sweet",
      ingredients: [],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20) / 1000,
      sweetness_sugar_kg: (MIDPOINT_SWEET * 20) / 1000,
    },
  ],

  // --- S8: Ingredient with amount_liters = 0 ---
  [
    "S8 — 0L ingredient contributes nothing",
    {
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 0, sugar_content_percent: 15 }],
    },
    {
      sugar_needed_for_abv_grams: 12 * GRAMS_PER_ABV_PER_LITER * 20,
      total_ingredient_sugar_grams: 0,
      fermentation_sugar_kg: (12 * GRAMS_PER_ABV_PER_LITER * 20) / 1000,
      sweetness_sugar_kg: 0,
    },
  ],
];

describe("calculateSugar", () => {
  it.each(scenarios)("%s", (_name, input, expected) => {
    const result = calculateSugar(input);

    expect(result.sugar_needed_for_abv_grams).toBe(expected.sugar_needed_for_abv_grams);
    expect(result.total_ingredient_sugar_grams).toBe(expected.total_ingredient_sugar_grams);
    expect(result.fermentation_sugar_kg).toBeCloseTo(expected.fermentation_sugar_kg, 4);
    expect(result.sweetness_sugar_kg).toBeCloseTo(expected.sweetness_sugar_kg, 4);
  });
});
