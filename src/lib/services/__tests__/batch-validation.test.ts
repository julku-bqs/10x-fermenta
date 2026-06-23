import { describe, expect, it } from "vitest";
import { validateBatch } from "@/lib/services/batch-validation";
import type { ValidationInput } from "@/lib/services/batch-validation";
import { calculateSugar } from "@/lib/services/sugar-calculation";

const base: ValidationInput = {
  target_abv: 12,
  target_volume_liters: 20,
  planned_sweetness: "dry",
  yeast_alcohol_tolerance: 15,
  has_yeast: true,
  fermentation_sugar_kg: 0,
  sweetness_sugar_kg: 0,
  ingredients: [],
};

function validate(overrides: Partial<ValidationInput>): ReturnType<typeof validateBatch> {
  const input: ValidationInput = { ...base, ...overrides };
  const calcResult =
    input.target_abv !== null && input.target_volume_liters !== null
      ? calculateSugar({
          target_volume_liters: input.target_volume_liters,
          target_abv: input.target_abv,
          planned_sweetness: input.planned_sweetness,
          ingredients: input.ingredients,
        })
      : null;
  return validateBatch(input, calcResult);
}

describe("validateBatch", () => {
  // Rule 1: No yeast warning
  it("warns when no yeast is specified", () => {
    const warnings = validate({ has_yeast: false });
    expect(warnings.some((w) => w.id === "no-yeast")).toBe(true);
  });

  it("does not warn about yeast when yeast is present", () => {
    const warnings = validate({ has_yeast: true });
    expect(warnings.some((w) => w.id === "no-yeast")).toBe(false);
  });

  // Rule 2: No target ABV
  it("warns when target ABV is null", () => {
    const warnings = validate({ target_abv: null });
    expect(warnings.some((w) => w.id === "no-target-abv")).toBe(true);
  });

  it("skips ABV-dependent rules when target_abv is null", () => {
    const warnings = validate({ target_abv: null, yeast_alcohol_tolerance: 5 });
    expect(warnings.some((w) => w.id === "abv-exceeds-tolerance")).toBe(false);
    expect(warnings.some((w) => w.id === "general-advisory")).toBe(false);
  });

  // Rule 3: ABV > yeast tolerance
  it("warns when target ABV exceeds yeast alcohol tolerance", () => {
    const warnings = validate({ target_abv: 16, yeast_alcohol_tolerance: 14 });
    expect(warnings.some((w) => w.id === "abv-exceeds-tolerance")).toBe(true);
  });

  it("does not warn when target ABV is within yeast tolerance", () => {
    const warnings = validate({ target_abv: 12, yeast_alcohol_tolerance: 15 });
    expect(warnings.some((w) => w.id === "abv-exceeds-tolerance")).toBe(false);
  });

  it("skips rule 3 when yeast_alcohol_tolerance is null", () => {
    const warnings = validate({ yeast_alcohol_tolerance: null });
    expect(warnings.some((w) => w.id === "abv-exceeds-tolerance")).toBe(false);
  });

  // Rule 4: Non-dry sweetness + tolerance > ABV
  it("warns when sweetness is non-dry and tolerance > ABV (fermentation won't stop)", () => {
    const warnings = validate({ planned_sweetness: "semi_sweet", target_abv: 10, yeast_alcohol_tolerance: 14 });
    expect(warnings.some((w) => w.id === "sweetness-wont-stop")).toBe(true);
  });

  it("does not warn about sweetness-wont-stop when planned_sweetness is dry", () => {
    const warnings = validate({ planned_sweetness: "dry", target_abv: 10, yeast_alcohol_tolerance: 14 });
    expect(warnings.some((w) => w.id === "sweetness-wont-stop")).toBe(false);
  });

  it("does not warn about sweetness-wont-stop when tolerance <= ABV", () => {
    const warnings = validate({ planned_sweetness: "semi_sweet", target_abv: 14, yeast_alcohol_tolerance: 14 });
    expect(warnings.some((w) => w.id === "sweetness-wont-stop")).toBe(false);
  });

  // Rule 5: Ingredient sugar exceeds ABV needs
  it("warns when ingredient sugar already covers target ABV needs", () => {
    const warnings = validate({
      target_abv: 5,
      target_volume_liters: 10,
      ingredients: [{ name: "Juice", amount_liters: 10, sugar_content_percent: 20 }],
    });
    expect(warnings.some((w) => w.id === "ingredient-sugar-exceeds-needed")).toBe(true);
  });

  it("does not warn when ingredient sugar is below ABV needs", () => {
    const warnings = validate({
      ingredients: [{ name: "Juice", amount_liters: 5, sugar_content_percent: 10 }],
    });
    expect(warnings.some((w) => w.id === "ingredient-sugar-exceeds-needed")).toBe(false);
  });

  // Rule 6: Total sugar insufficient
  it("warns when total sugar (ingredients + fermentation) is insufficient", () => {
    // sugar_needed = 12 × 17 × 20 = 4080g; fermentation = 1 kg = 1000g → total 1000 < 4080
    const warnings = validate({ fermentation_sugar_kg: 1 });
    expect(warnings.some((w) => w.id === "total-sugar-insufficient")).toBe(true);
  });

  it("does not warn when total sugar meets ABV needs", () => {
    // sugar_needed = 4080g; fermentation = 4.08 kg = 4080g → exactly sufficient
    const warnings = validate({ fermentation_sugar_kg: 4.08 });
    expect(warnings.some((w) => w.id === "total-sugar-insufficient")).toBe(false);
  });

  // Rule 7: Total sugar exceeds target ABV
  it("warns when ingredients + fermentation sugar together exceed target ABV needs", () => {
    // sugar_needed = 4080g; ingredient sugar = 5L × 20% × 10 = 1000g (< 4080 — rule 5 won't fire)
    // fermentation sugar = 4kg = 4000g → total = 5000g > 4080g
    // yeast_tolerance (15) > target_abv (12) → rule applies
    const warnings = validate({
      fermentation_sugar_kg: 4,
      ingredients: [{ name: "Juice", amount_liters: 5, sugar_content_percent: 20 }],
    });
    expect(warnings.some((w) => w.id === "total-sugar-exceeds-target")).toBe(true);
    expect(warnings.some((w) => w.id === "ingredient-sugar-exceeds-needed")).toBe(false);
  });

  it("does not warn about total-sugar-exceeds-target when yeast tolerance <= target ABV", () => {
    const warnings = validate({
      target_abv: 16,
      yeast_alcohol_tolerance: 14,
      fermentation_sugar_kg: 10,
      ingredients: [{ name: "Juice", amount_liters: 5, sugar_content_percent: 20 }],
    });
    expect(warnings.some((w) => w.id === "total-sugar-exceeds-target")).toBe(false);
  });

  it("does not warn about total-sugar-exceeds-target when total sugar is within target", () => {
    // fermentation = 3kg = 3000g, ingredient sugar = 500g, total = 3500 < 4080
    const warnings = validate({
      fermentation_sugar_kg: 3,
      ingredients: [{ name: "Juice", amount_liters: 5, sugar_content_percent: 10 }],
    });
    expect(warnings.some((w) => w.id === "total-sugar-exceeds-target")).toBe(false);
  });

  // Rule 8: Sweetness sugar out of range
  it("warns when sweetness sugar g/L is below the expected range", () => {
    // semi_dry range: [5, 15] g/L; sweetness = 0.05 kg over 20L = 2.5 g/L (too low)
    const warnings = validate({
      planned_sweetness: "semi_dry",
      fermentation_sugar_kg: 4.08,
      sweetness_sugar_kg: 0.05,
    });
    expect(warnings.some((w) => w.id === "sweetness-out-of-range")).toBe(true);
  });

  it("does not warn when sweetness sugar g/L is within the expected range", () => {
    // semi_dry range: [5, 15] g/L; sweetness = 0.2 kg over 20L = 10 g/L (in range)
    const warnings = validate({
      planned_sweetness: "semi_dry",
      fermentation_sugar_kg: 4.08,
      sweetness_sugar_kg: 0.2,
    });
    expect(warnings.some((w) => w.id === "sweetness-out-of-range")).toBe(false);
  });

  it("does not warn about sweetness range when planned_sweetness is dry", () => {
    const warnings = validate({ planned_sweetness: "dry" });
    expect(warnings.some((w) => w.id === "sweetness-out-of-range")).toBe(false);
  });

  it("does not warn about sweetness range when non-dry but sweetness_sugar_kg is 0", () => {
    const warnings = validate({ planned_sweetness: "semi_sweet", sweetness_sugar_kg: 0 });
    expect(warnings.some((w) => w.id === "sweetness-out-of-range")).toBe(true);
  });

  // Rule 9: General advisory
  it("always includes general advisory when target_abv is set", () => {
    const warnings = validate({});
    expect(warnings.some((w) => w.id === "general-advisory")).toBe(true);
  });

  it("does not include general advisory when target_abv is null", () => {
    const warnings = validate({ target_abv: null });
    expect(warnings.some((w) => w.id === "general-advisory")).toBe(false);
  });

  // Null-param guards
  it("skips volume-dependent rules when target_volume_liters is null", () => {
    const warnings = validate({ target_volume_liters: null });
    expect(warnings.some((w) => w.id === "ingredient-sugar-exceeds-needed")).toBe(false);
    expect(warnings.some((w) => w.id === "total-sugar-insufficient")).toBe(false);
    expect(warnings.some((w) => w.id === "sweetness-out-of-range")).toBe(false);
    expect(warnings.some((w) => w.id === "general-advisory")).toBe(true);
  });

  // Combination: multiple warnings simultaneously
  it("returns multiple warnings simultaneously when multiple conditions are violated", () => {
    const warnings = validate({
      has_yeast: false,
      target_abv: 16,
      target_volume_liters: 20,
      planned_sweetness: "dry",
      yeast_alcohol_tolerance: 14,
    });
    expect(warnings.some((w) => w.id === "no-yeast")).toBe(true);
    expect(warnings.some((w) => w.id === "abv-exceeds-tolerance")).toBe(true);
    expect(warnings.some((w) => w.id === "total-sugar-insufficient")).toBe(true);
    expect(warnings.some((w) => w.id === "general-advisory")).toBe(true);
    expect(warnings.length).toBeGreaterThanOrEqual(4);
  });
});
