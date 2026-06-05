import { describe, expect, it } from "vitest";
import { SWEETNESS_MIDPOINTS, SWEETNESS_RANGES, calculateSugar } from "@/lib/services/sugar-calculation";

describe("calculateSugar", () => {
  // Test 1: Dry wine, no ingredients → full fermentation sugar needed
  it("dry wine with no ingredients requires full fermentation sugar", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [],
    });
    // sugar_needed = 12 × 17 × 20 = 4080g
    expect(result.sugar_needed_for_abv_grams).toBe(4080);
    expect(result.total_ingredient_sugar_grams).toBe(0);
    expect(result.fermentation_sugar_kg).toBe(4.08);
    expect(result.sweetness_sugar_kg).toBe(0);
  });

  // Test 2: Dry wine, partial ingredient sugar → correct deficit
  it("dry wine with partial ingredient sugar computes correct fermentation sugar deficit", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [{ type: "user_input", amount_liters: 10, sugar_content_percent: 20, sort_order: 0 }],
    });
    // user_input sugar = 10 × 20 × 10 = 2000g
    // fermentation_sugar = (4080 - 2000) / 1000 = 2.080 kg
    expect(result.total_ingredient_sugar_grams).toBe(2000);
    expect(result.fermentation_sugar_kg).toBeCloseTo(2.08);
    expect(result.sweetness_sugar_kg).toBe(0);
  });

  // Test 3: Dry wine, ingredient sugar exceeds target → fermentation_sugar_kg = 0
  it("dry wine where ingredient sugar exceeds ABV needs returns fermentation_sugar_kg = 0", () => {
    const result = calculateSugar({
      target_volume_liters: 10,
      target_abv: 5,
      planned_sweetness: "dry",
      ingredients: [{ type: "user_input", amount_liters: 10, sugar_content_percent: 20, sort_order: 0 }],
    });
    // sugar_needed = 5 × 17 × 10 = 850g; ingredient sugar = 2000g
    expect(result.sugar_needed_for_abv_grams).toBe(850);
    expect(result.total_ingredient_sugar_grams).toBe(2000);
    expect(result.fermentation_sugar_kg).toBe(0);
  });

  // Test 4: Semi-dry wine → correct fermentation + sweetness amounts
  it("semi_dry wine produces correct fermentation and sweetness sugar", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 10,
      planned_sweetness: "semi_dry",
      ingredients: [],
    });
    // fermentation = 10 × 17 × 20 = 3400g = 3.400 kg
    // sweetness = SWEETNESS_MIDPOINTS.semi_dry × 20 = 10 × 20 / 1000 = 0.200 kg
    expect(result.fermentation_sugar_kg).toBe(3.4);
    expect(result.sweetness_sugar_kg).toBe((SWEETNESS_MIDPOINTS.semi_dry * 20) / 1000);
    expect(result.sweetness_sugar_kg).toBe(0.2);
  });

  // Test 5: Semi-sweet wine
  it("semi_sweet wine computes correct sweetness sugar from midpoint", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 10,
      planned_sweetness: "semi_sweet",
      ingredients: [],
    });
    // sweetness = 30 × 20 / 1000 = 0.600 kg
    expect(result.sweetness_sugar_kg).toBe(0.6);
  });

  // Test 6: Sweet wine
  it("sweet wine computes correct sweetness sugar from midpoint", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 10,
      planned_sweetness: "sweet",
      ingredients: [],
    });
    // sweetness = 60 × 20 / 1000 = 1.200 kg
    expect(result.sweetness_sugar_kg).toBe(1.2);
  });

  // Test 7: Zero volume → all zeros
  it("zero target volume returns zero sugar amounts", () => {
    const result = calculateSugar({
      target_volume_liters: 0,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [],
    });
    expect(result.sugar_needed_for_abv_grams).toBe(0);
    expect(result.fermentation_sugar_kg).toBe(0);
    expect(result.sweetness_sugar_kg).toBe(0);
  });

  // Test 8: Zero ABV → zero fermentation sugar
  it("zero target ABV requires no fermentation sugar", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 0,
      planned_sweetness: "dry",
      ingredients: [],
    });
    expect(result.sugar_needed_for_abv_grams).toBe(0);
    expect(result.fermentation_sugar_kg).toBe(0);
  });

  // Test 9: Null sugar_content_percent → treated as 0
  it("ingredient with null sugar_content_percent contributes zero sugar", () => {
    const result = calculateSugar({
      target_volume_liters: 10,
      target_abv: 10,
      planned_sweetness: "dry",
      ingredients: [{ type: "user_input", amount_liters: 5, sugar_content_percent: null, sort_order: 0 }],
    });
    expect(result.total_ingredient_sugar_grams).toBe(0);
    // fermentation = 10 × 17 × 10 = 1700g = 1.7 kg
    expect(result.fermentation_sugar_kg).toBe(1.7);
  });

  // Test 10: Large values precision verification
  it("large batch values compute correctly without precision loss", () => {
    const result = calculateSugar({
      target_volume_liters: 100,
      target_abv: 14,
      planned_sweetness: "dry",
      ingredients: [],
    });
    // sugar_needed = 14 × 17 × 100 = 23800g = 23.8 kg
    expect(result.sugar_needed_for_abv_grams).toBe(23800);
    expect(result.fermentation_sugar_kg).toBe(23.8);
  });

  // Test 11: Multiple user_input ingredients combined
  it("sums sugar from multiple user_input ingredients", () => {
    const result = calculateSugar({
      target_volume_liters: 30,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [
        { type: "user_input", amount_liters: 10, sugar_content_percent: 15, sort_order: 0 },
        { type: "user_input", amount_liters: 5, sugar_content_percent: 24, sort_order: 1 },
      ],
    });
    // sugar1 = 10 × 15 × 10 = 1500g; sugar2 = 5 × 24 × 10 = 1200g; total = 2700g
    expect(result.total_ingredient_sugar_grams).toBe(2700);
  });

  // Test 12: Non-user_input ingredient types don't count toward ingredient sugar
  it("fermentation_sugar and sweetness_sugar type ingredients don't count toward user_input sugar sum", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [
        { type: "fermentation_sugar", amount_liters: 4.08, sugar_content_percent: 100, sort_order: -2 },
        { type: "sweetness_sugar", amount_liters: 1, sugar_content_percent: 100, sort_order: -1 },
        { type: "user_input", amount_liters: 5, sugar_content_percent: 10, sort_order: 0 },
      ],
    });
    // Only user_input sugar counts: 5 × 10 × 10 = 500g
    expect(result.total_ingredient_sugar_grams).toBe(500);
  });

  // Test 13: SWEETNESS_RANGES sanity — midpoints should fall within their own ranges
  it("sweetness midpoints fall within their respective ranges", () => {
    (["semi_dry", "semi_sweet", "sweet"] as const).forEach((level) => {
      const [min, max] = SWEETNESS_RANGES[level];
      const midpoint = SWEETNESS_MIDPOINTS[level];
      expect(midpoint).toBeGreaterThanOrEqual(min);
      expect(midpoint).toBeLessThanOrEqual(max);
    });
  });
});
