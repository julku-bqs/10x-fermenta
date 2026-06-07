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
  ingredients: [],
};

/** Helper: compute calcResult from input when both abv and volume are present, then call validateBatch. */
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
    const warnings = validate({
      target_abv: null,
      yeast_alcohol_tolerance: 5,
    });
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
    const warnings = validate({
      planned_sweetness: "semi_sweet",
      target_abv: 10,
      yeast_alcohol_tolerance: 14,
    });
    expect(warnings.some((w) => w.id === "sweetness-wont-stop")).toBe(true);
  });

  it("does not warn about sweetness-wont-stop when planned_sweetness is dry", () => {
    const warnings = validate({
      planned_sweetness: "dry",
      target_abv: 10,
      yeast_alcohol_tolerance: 14,
    });
    expect(warnings.some((w) => w.id === "sweetness-wont-stop")).toBe(false);
  });

  it("does not warn about sweetness-wont-stop when tolerance <= ABV", () => {
    const warnings = validate({
      planned_sweetness: "semi_sweet",
      target_abv: 14,
      yeast_alcohol_tolerance: 14,
    });
    expect(warnings.some((w) => w.id === "sweetness-wont-stop")).toBe(false);
  });

  // Rule 5: Ingredient sugar exceeds ABV needs
  it("warns when ingredient sugar already covers target ABV needs", () => {
    // sugar_needed = 5 × 17 × 10 = 850g; ingredient sugar = 10L × 20% × 10 = 2000g
    const warnings = validate({
      target_abv: 5,
      target_volume_liters: 10,
      ingredients: [{ type: "user_input", name: "Juice", amount_liters: 10, sugar_content_percent: 20, sort_order: 0 }],
    });
    expect(warnings.some((w) => w.id === "ingredient-sugar-exceeds-needed")).toBe(true);
  });

  it("does not warn when ingredient sugar is below ABV needs", () => {
    // sugar_needed = 12 × 17 × 20 = 4080g; ingredient sugar = 5L × 10% × 10 = 500g
    const warnings = validate({
      ingredients: [{ type: "user_input", name: "Juice", amount_liters: 5, sugar_content_percent: 10, sort_order: 0 }],
    });
    expect(warnings.some((w) => w.id === "ingredient-sugar-exceeds-needed")).toBe(false);
  });

  // Rule 6: Total sugar insufficient
  it("warns when total sugar (ingredients + fermentation entry) is insufficient", () => {
    // sugar_needed = 12 × 17 × 20 = 4080g; user_input = 0; fermentation entry = 1 kg = 1000g → total 1000 < 4080
    const warnings = validate({
      ingredients: [
        {
          type: "fermentation_sugar",
          name: "Fermentation sugar",
          amount_liters: 1,
          sugar_content_percent: null,
          sort_order: -2,
        },
      ],
    });
    expect(warnings.some((w) => w.id === "total-sugar-insufficient")).toBe(true);
  });

  it("does not warn when total sugar meets ABV needs", () => {
    // sugar_needed = 12 × 17 × 20 = 4080g; fermentation entry = 4.08 kg = 4080g → exactly sufficient
    const warnings = validate({
      ingredients: [
        {
          type: "fermentation_sugar",
          name: "Fermentation sugar",
          amount_liters: 4.08,
          sugar_content_percent: null,
          sort_order: -2,
        },
      ],
    });
    expect(warnings.some((w) => w.id === "total-sugar-insufficient")).toBe(false);
  });

  // Rule 7 (new): Total sugar exceeds target ABV
  it("warns when ingredients + fermentation sugar together exceed target ABV needs", () => {
    // sugar_needed = 12 × 17 × 20 = 4080g
    // ingredient sugar = 5L × 20% × 10 = 1000g (< 4080 — rule 5 won't fire)
    // fermentation sugar = 4kg = 4000g → total = 5000g > 4080g
    // yeast_tolerance (15) > target_abv (12) → rule applies
    const warnings = validate({
      ingredients: [
        { type: "user_input", name: "Juice", amount_liters: 5, sugar_content_percent: 20, sort_order: 0 },
        { type: "fermentation_sugar", name: "FS", amount_liters: 4, sugar_content_percent: null, sort_order: -2 },
      ],
    });
    expect(warnings.some((w) => w.id === "total-sugar-exceeds-target")).toBe(true);
    expect(warnings.some((w) => w.id === "ingredient-sugar-exceeds-needed")).toBe(false);
  });

  it("does not warn about total-sugar-exceeds-target when yeast tolerance <= target ABV", () => {
    // yeast_tolerance ≤ target_abv → excess sugar cannot push ABV beyond tolerance ceiling
    const warnings = validate({
      target_abv: 16,
      yeast_alcohol_tolerance: 14,
      ingredients: [
        { type: "user_input", name: "Juice", amount_liters: 5, sugar_content_percent: 20, sort_order: 0 },
        { type: "fermentation_sugar", name: "FS", amount_liters: 10, sugar_content_percent: null, sort_order: -2 },
      ],
    });
    expect(warnings.some((w) => w.id === "total-sugar-exceeds-target")).toBe(false);
  });

  it("does not warn about total-sugar-exceeds-target when total sugar is within target", () => {
    // fermentation entry = 3kg = 3000g, ingredient sugar = 500g, total = 3500 < 4080
    const warnings = validate({
      ingredients: [
        { type: "user_input", name: "Juice", amount_liters: 5, sugar_content_percent: 10, sort_order: 0 },
        { type: "fermentation_sugar", name: "FS", amount_liters: 3, sugar_content_percent: null, sort_order: -2 },
      ],
    });
    expect(warnings.some((w) => w.id === "total-sugar-exceeds-target")).toBe(false);
  });

  // Rule 8: Sweetness sugar out of range
  it("warns when sweetness sugar g/L is below the expected range", () => {
    // semi_dry range: [5, 15] g/L; sweetness entry = 0.05 kg over 20L = 2.5 g/L (too low)
    const warnings = validate({
      planned_sweetness: "semi_dry",
      ingredients: [
        {
          type: "fermentation_sugar",
          name: "Fermentation sugar",
          amount_liters: 4.08,
          sugar_content_percent: null,
          sort_order: -2,
        },
        {
          type: "sweetness_sugar",
          name: "Sweetness sugar",
          amount_liters: 0.05,
          sugar_content_percent: null,
          sort_order: -1,
        },
      ],
    });
    expect(warnings.some((w) => w.id === "sweetness-out-of-range")).toBe(true);
  });

  it("does not warn when sweetness sugar g/L is within the expected range", () => {
    // semi_dry range: [5, 15] g/L; sweetness entry = 0.2 kg over 20L = 10 g/L (in range)
    const warnings = validate({
      planned_sweetness: "semi_dry",
      ingredients: [
        {
          type: "fermentation_sugar",
          name: "Fermentation sugar",
          amount_liters: 4.08,
          sugar_content_percent: null,
          sort_order: -2,
        },
        {
          type: "sweetness_sugar",
          name: "Sweetness sugar",
          amount_liters: 0.2,
          sugar_content_percent: null,
          sort_order: -1,
        },
      ],
    });
    expect(warnings.some((w) => w.id === "sweetness-out-of-range")).toBe(false);
  });

  it("does not warn about sweetness range when planned_sweetness is dry (no entry expected)", () => {
    const warnings = validate({ planned_sweetness: "dry" });
    expect(warnings.some((w) => w.id === "sweetness-out-of-range")).toBe(false);
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
    // But general advisory still fires
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
      ingredients: [],
    });
    // no-yeast + abv-exceeds-tolerance + total-sugar-insufficient + general-advisory
    expect(warnings.some((w) => w.id === "no-yeast")).toBe(true);
    expect(warnings.some((w) => w.id === "abv-exceeds-tolerance")).toBe(true);
    expect(warnings.some((w) => w.id === "total-sugar-insufficient")).toBe(true);
    expect(warnings.some((w) => w.id === "general-advisory")).toBe(true);
    expect(warnings.length).toBeGreaterThanOrEqual(4);
  });
});
