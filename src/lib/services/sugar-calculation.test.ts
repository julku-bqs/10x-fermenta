import { describe, expect, it } from "vitest";
import { SWEETNESS_MIDPOINTS, SWEETNESS_RANGES, calculateSugar } from "@/lib/services/sugar-calculation";

describe("calculateSugar", () => {
  it("dry wine with no ingredients requires full fermentation sugar", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [],
    });
    expect(result.sugar_needed_for_abv_grams).toBe(4080);
    expect(result.total_ingredient_sugar_grams).toBe(0);
    expect(result.fermentation_sugar_kg).toBe(4.08);
    expect(result.sweetness_sugar_kg).toBe(0);
  });

  it("dry wine with partial ingredient sugar computes correct fermentation sugar deficit", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 10, sugar_content_percent: 20 }],
    });
    expect(result.total_ingredient_sugar_grams).toBe(2000);
    expect(result.fermentation_sugar_kg).toBeCloseTo(2.08);
    expect(result.sweetness_sugar_kg).toBe(0);
  });

  it("dry wine where ingredient sugar exceeds ABV needs returns fermentation_sugar_kg = 0", () => {
    const result = calculateSugar({
      target_volume_liters: 10,
      target_abv: 5,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 10, sugar_content_percent: 20 }],
    });
    expect(result.sugar_needed_for_abv_grams).toBe(850);
    expect(result.total_ingredient_sugar_grams).toBe(2000);
    expect(result.fermentation_sugar_kg).toBe(0);
  });

  it("semi_dry wine produces correct fermentation and sweetness sugar", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 10,
      planned_sweetness: "semi_dry",
      ingredients: [],
    });
    expect(result.fermentation_sugar_kg).toBe(3.4);
    expect(result.sweetness_sugar_kg).toBe((SWEETNESS_MIDPOINTS.semi_dry * 20) / 1000);
    expect(result.sweetness_sugar_kg).toBe(0.2);
  });

  it("semi_sweet wine computes correct sweetness sugar from midpoint", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 10,
      planned_sweetness: "semi_sweet",
      ingredients: [],
    });
    expect(result.sweetness_sugar_kg).toBe(0.6);
  });

  it("sweet wine computes correct sweetness sugar from midpoint", () => {
    const result = calculateSugar({
      target_volume_liters: 20,
      target_abv: 10,
      planned_sweetness: "sweet",
      ingredients: [],
    });
    expect(result.sweetness_sugar_kg).toBe(1.2);
  });

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

  it("ingredient with null sugar_content_percent contributes zero sugar", () => {
    const result = calculateSugar({
      target_volume_liters: 10,
      target_abv: 10,
      planned_sweetness: "dry",
      ingredients: [{ amount_liters: 5, sugar_content_percent: null }],
    });
    expect(result.total_ingredient_sugar_grams).toBe(0);
    expect(result.fermentation_sugar_kg).toBe(1.7);
  });

  it("large batch values compute correctly without precision loss", () => {
    const result = calculateSugar({
      target_volume_liters: 100,
      target_abv: 14,
      planned_sweetness: "dry",
      ingredients: [],
    });
    expect(result.sugar_needed_for_abv_grams).toBe(23800);
    expect(result.fermentation_sugar_kg).toBe(23.8);
  });

  it("sums sugar from multiple ingredients", () => {
    const result = calculateSugar({
      target_volume_liters: 30,
      target_abv: 12,
      planned_sweetness: "dry",
      ingredients: [
        { amount_liters: 10, sugar_content_percent: 15 },
        { amount_liters: 5, sugar_content_percent: 24 },
      ],
    });
    expect(result.total_ingredient_sugar_grams).toBe(2700);
  });

  it("sweetness midpoints fall within their respective ranges", () => {
    (["semi_dry", "semi_sweet", "sweet"] as const).forEach((level) => {
      const [min, max] = SWEETNESS_RANGES[level];
      const midpoint = SWEETNESS_MIDPOINTS[level];
      expect(midpoint).toBeGreaterThanOrEqual(min);
      expect(midpoint).toBeLessThanOrEqual(max);
    });
  });
});
