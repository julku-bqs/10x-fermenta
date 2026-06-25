import { describe, expect, it } from "vitest";
import { validateBatch } from "@/lib/services/batch-validation";
import type { ValidationInput } from "@/lib/services/batch-validation";
import { calculateSugar } from "@/lib/services/sugar-calculation";
import type { CalculationResult } from "@/lib/services/sugar-calculation";

// Domain constants — local to test file, never imported from production
const SWEETNESS_RANGE_SEMI_DRY: [number, number] = [5, 15];
const SWEETNESS_RANGE_SEMI_SWEET: [number, number] = [15, 45];
const SWEETNESS_RANGE_SWEET: [number, number] = [45, 80];

/** Factory: sensible defaults that produce ONLY the general-advisory warning */
function makeInput(overrides: Partial<ValidationInput> = {}): ValidationInput {
  return {
    target_abv: 12,
    target_volume_liters: 20,
    planned_sweetness: "dry",
    yeast_alcohol_tolerance: 15,
    has_yeast: true,
    fermentation_sugar_kg: 4.08, // exactly 12 * 17 * 20 / 1000 — matches needed
    sweetness_sugar_kg: 0,
    ingredients: [],
    ...overrides,
  };
}

/** Compute calcResult via the real calculateSugar, or null when ABV/volume missing */
function calcResultFor(input: ValidationInput): CalculationResult | null {
  if (input.target_abv === null || input.target_volume_liters === null) return null;
  return calculateSugar({
    target_volume_liters: input.target_volume_liters,
    target_abv: input.target_abv,
    planned_sweetness: input.planned_sweetness,
    ingredients: input.ingredients,
  });
}

/** Shortcut: build input, compute calcResult, run validation */
function validate(overrides: Partial<ValidationInput> = {}) {
  const input = makeInput(overrides);
  return validateBatch(input, calcResultFor(input));
}

function hasWarning(warnings: { id: string }[], id: string): boolean {
  return warnings.some((w) => w.id === id);
}

// ─── Rule 1: no-yeast ──────────────────────────────────────────────────────────

describe("no-yeast", () => {
  it.each([
    ["fires when has_yeast is false", { has_yeast: false }, true],
    ["does NOT fire when has_yeast is true", { has_yeast: true }, false],
  ])("%s", (_name, overrides, shouldFire) => {
    const warnings = validate(overrides);
    expect(hasWarning(warnings, "no-yeast")).toBe(shouldFire);
  });
});

// ─── Rule 2: no-target-abv ─────────────────────────────────────────────────────

describe("no-target-abv", () => {
  it.each([
    ["fires when target_abv is null", { target_abv: null }, true],
    ["does NOT fire when target_abv is set", { target_abv: 12 }, false],
    // V11: target_abv = 0 is falsy but not null — must NOT fire
    ["V11 — does NOT fire when target_abv is 0 (falsy but not null)", { target_abv: 0 }, false],
  ])("%s", (_name, overrides, shouldFire) => {
    const warnings = validate(overrides);
    expect(hasWarning(warnings, "no-target-abv")).toBe(shouldFire);
  });
});

// ─── Rule 3: abv-exceeds-tolerance ─────────────────────────────────────────────

describe("abv-exceeds-tolerance", () => {
  it.each([
    ["fires when ABV > tolerance", { target_abv: 16, yeast_alcohol_tolerance: 14 }, true],
    ["does NOT fire when ABV < tolerance", { target_abv: 12, yeast_alcohol_tolerance: 15 }, false],
    // V1: exact boundary — strict > means equality must NOT fire
    ["V1 — does NOT fire when ABV === tolerance (strict >)", { target_abv: 14, yeast_alcohol_tolerance: 14 }, false],
    ["does NOT fire when tolerance is null", { target_abv: 12, yeast_alcohol_tolerance: null }, false],
    ["does NOT fire when ABV is null", { target_abv: null, yeast_alcohol_tolerance: 15 }, false],
  ])("%s", (_name, overrides, shouldFire) => {
    const warnings = validate(overrides);
    expect(hasWarning(warnings, "abv-exceeds-tolerance")).toBe(shouldFire);
  });
});

// ─── Rule 4: sweetness-wont-stop ────────────────────────────────────────────────

describe("sweetness-wont-stop", () => {
  it.each([
    // V3: all 3 non-dry levels fire when tolerance > ABV
    [
      "V3a — fires for semi_dry when tolerance > ABV",
      { planned_sweetness: "semi_dry" as const, target_abv: 10, yeast_alcohol_tolerance: 14 },
      true,
    ],
    [
      "V3b — fires for semi_sweet when tolerance > ABV",
      { planned_sweetness: "semi_sweet" as const, target_abv: 10, yeast_alcohol_tolerance: 14 },
      true,
    ],
    [
      "V3c — fires for sweet when tolerance > ABV",
      { planned_sweetness: "sweet" as const, target_abv: 10, yeast_alcohol_tolerance: 14 },
      true,
    ],
    [
      "does NOT fire when planned_sweetness is dry",
      { planned_sweetness: "dry" as const, target_abv: 10, yeast_alcohol_tolerance: 14 },
      false,
    ],
    // V2: exact boundary — strict > means equality must NOT fire
    [
      "V2 — does NOT fire when tolerance === ABV (strict >)",
      { planned_sweetness: "semi_sweet" as const, target_abv: 14, yeast_alcohol_tolerance: 14 },
      false,
    ],
    [
      "does NOT fire when tolerance is null",
      { planned_sweetness: "semi_sweet" as const, target_abv: 10, yeast_alcohol_tolerance: null },
      false,
    ],
    [
      "does NOT fire when ABV is null",
      { planned_sweetness: "semi_sweet" as const, target_abv: null, yeast_alcohol_tolerance: 14 },
      false,
    ],
  ])("%s", (_name, overrides, shouldFire) => {
    const warnings = validate(overrides);
    expect(hasWarning(warnings, "sweetness-wont-stop")).toBe(shouldFire);
  });
});

// ─── Rule 5: ingredient-sugar-exceeds-needed ────────────────────────────────────

describe("ingredient-sugar-exceeds-needed", () => {
  it.each([
    [
      "fires when ingredient sugar > needed",
      // needed = 5 * 17 * 10 = 850g; ingredient = 10 * 20 * 10 = 2000g > 850g
      {
        target_abv: 5,
        target_volume_liters: 10,
        ingredients: [{ name: "Juice", amount_liters: 10, sugar_content_percent: 20 }],
      },
      true,
    ],
    [
      // V4: exact boundary — >= means equality DOES fire
      "V4 — fires when ingredient sugar === needed (>= comparison)",
      // needed = 10 * 17 * 10 = 1700g; ingredient = 10 * 17 * 10 = 1700g
      {
        target_abv: 10,
        target_volume_liters: 10,
        ingredients: [{ name: "Juice", amount_liters: 10, sugar_content_percent: 17 }],
      },
      true,
    ],
    [
      "does NOT fire when ingredient sugar < needed",
      // needed = 12 * 17 * 20 = 4080g; ingredient = 5 * 10 * 10 = 500g < 4080g
      { ingredients: [{ name: "Juice", amount_liters: 5, sugar_content_percent: 10 }] },
      false,
    ],
    ["does NOT fire when no ingredients", { ingredients: [] }, false],
  ])("%s", (_name, overrides, shouldFire) => {
    const warnings = validate(overrides);
    expect(hasWarning(warnings, "ingredient-sugar-exceeds-needed")).toBe(shouldFire);
  });
});

// ─── Rule 6: total-sugar-insufficient ───────────────────────────────────────────

describe("total-sugar-insufficient", () => {
  it.each([
    [
      "fires when total sugar < needed",
      // needed = 12 * 17 * 20 = 4080g; total = 0 + 1000 = 1000g < 4080g
      { fermentation_sugar_kg: 1 },
      true,
    ],
    [
      "does NOT fire when total sugar === needed",
      // needed = 4080g; total = 0 + 4080 = 4080g
      { fermentation_sugar_kg: 4.08 },
      false,
    ],
    ["does NOT fire when total sugar > needed", { fermentation_sugar_kg: 5 }, false],
  ])("%s", (_name, overrides, shouldFire) => {
    const warnings = validate(overrides);
    expect(hasWarning(warnings, "total-sugar-insufficient")).toBe(shouldFire);
  });
});

// ─── Rule 7: total-sugar-exceeds-target ─────────────────────────────────────────

describe("total-sugar-exceeds-target", () => {
  it.each([
    [
      "fires when total > needed AND ingredient < needed AND tolerance > ABV",
      // needed = 12 * 17 * 20 = 4080g; ingredient = 5 * 20 * 10 = 1000g (< 4080)
      // total = 1000 + 4000 = 5000g > 4080g; tolerance(15) > ABV(12)
      { fermentation_sugar_kg: 4, ingredients: [{ name: "Juice", amount_liters: 5, sugar_content_percent: 20 }] },
      true,
    ],
    [
      // V5: guard path — ingredient sugar >= needed means rule 7 early-returns
      "V5 — does NOT fire when ingredient sugar >= needed (rule 5 covers it)",
      // needed = 5 * 17 * 10 = 850g; ingredient = 10 * 20 * 10 = 2000g >= 850g → early return
      {
        target_abv: 5,
        target_volume_liters: 10,
        fermentation_sugar_kg: 1,
        ingredients: [{ name: "Juice", amount_liters: 10, sugar_content_percent: 20 }],
      },
      false,
    ],
    [
      // V6: guard path — tolerance <= ABV means rule 7 skips
      "V6 — does NOT fire when tolerance <= ABV",
      // needed = 16 * 17 * 20 = 5440g; ingredient = 0; total = 10000 > 5440
      // tolerance(14) <= ABV(16) → early return
      { target_abv: 16, yeast_alcohol_tolerance: 14, fermentation_sugar_kg: 10 },
      false,
    ],
    [
      // V7: exact boundary — total === needed does NOT fire (uses strict >)
      "V7 — does NOT fire when total sugar === needed (totalGrams <= needed guard)",
      // needed = 4080g; total = 0 + 4080 = 4080 <= 4080 → returns null
      { fermentation_sugar_kg: 4.08, ingredients: [] },
      false,
    ],
    [
      "does NOT fire when total sugar < needed",
      { fermentation_sugar_kg: 3, ingredients: [{ name: "Juice", amount_liters: 5, sugar_content_percent: 10 }] },
      false,
    ],
    [
      "fires when tolerance is null (tolerance guard skipped)",
      // tolerance null → guard `tolerance !== null && ...` is skipped → rule can fire
      { fermentation_sugar_kg: 5, yeast_alcohol_tolerance: null },
      true,
    ],
  ])("%s", (_name, overrides, shouldFire) => {
    const warnings = validate(overrides);
    expect(hasWarning(warnings, "total-sugar-exceeds-target")).toBe(shouldFire);
  });
});

// ─── Rule 8: sweetness-out-of-range ─────────────────────────────────────────────

describe("sweetness-out-of-range", () => {
  it.each([
    [
      "fires when sweetness g/L < min (semi_dry below 5 g/L)",
      // semi_dry range [5, 15]; sweetness = 0.05 * 1000 / 20 = 2.5 g/L < 5
      { planned_sweetness: "semi_dry" as const, fermentation_sugar_kg: 4.08, sweetness_sugar_kg: 0.05 },
      true,
    ],
    [
      // V8: upper boundary exceeded
      "V8 — fires when sweetness g/L > max (semi_dry above 15 g/L)",
      // semi_dry range [5, 15]; sweetness = 0.4 * 1000 / 20 = 20 g/L > 15
      { planned_sweetness: "semi_dry" as const, fermentation_sugar_kg: 4.08, sweetness_sugar_kg: 0.4 },
      true,
    ],
    [
      "does NOT fire when sweetness g/L is within range",
      // semi_dry range [5, 15]; sweetness = 0.2 * 1000 / 20 = 10 g/L ∈ [5, 15]
      { planned_sweetness: "semi_dry" as const, fermentation_sugar_kg: 4.08, sweetness_sugar_kg: 0.2 },
      false,
    ],
    [
      // V9: exact boundary at min — strict < means min itself does NOT fire
      "V9 — does NOT fire when sweetness g/L === min (semi_dry at 5 g/L)",
      // semi_dry min = 5; sweetness = 5 * 20 / 1000 = 0.1 → g/L = 0.1 * 1000 / 20 = 5
      {
        planned_sweetness: "semi_dry" as const,
        fermentation_sugar_kg: 4.08,
        sweetness_sugar_kg: (SWEETNESS_RANGE_SEMI_DRY[0] * 20) / 1000,
      },
      false,
    ],
    [
      // V10: exact boundary at max — strict > means max itself does NOT fire
      "V10 — does NOT fire when sweetness g/L === max (semi_dry at 15 g/L)",
      // semi_dry max = 15; sweetness = 15 * 20 / 1000 = 0.3 → g/L = 0.3 * 1000 / 20 = 15
      {
        planned_sweetness: "semi_dry" as const,
        fermentation_sugar_kg: 4.08,
        sweetness_sugar_kg: (SWEETNESS_RANGE_SEMI_DRY[1] * 20) / 1000,
      },
      false,
    ],
    [
      "does NOT fire when planned_sweetness is dry",
      { planned_sweetness: "dry" as const, sweetness_sugar_kg: 0 },
      false,
    ],
    [
      "fires for semi_sweet below range",
      // semi_sweet range [15, 45]; sweetness g/L = (min - 1) = 14 < 15
      {
        planned_sweetness: "semi_sweet" as const,
        fermentation_sugar_kg: 4.08,
        sweetness_sugar_kg: ((SWEETNESS_RANGE_SEMI_SWEET[0] - 1) * 20) / 1000,
      },
      true,
    ],
    [
      "fires for sweet above range",
      // sweet range [45, 80]; sweetness g/L = (max + 1) = 81 > 80
      {
        planned_sweetness: "sweet" as const,
        fermentation_sugar_kg: 4.08,
        sweetness_sugar_kg: ((SWEETNESS_RANGE_SWEET[1] + 1) * 20) / 1000,
      },
      true,
    ],
  ])("%s", (_name, overrides, shouldFire) => {
    const warnings = validate(overrides);
    expect(hasWarning(warnings, "sweetness-out-of-range")).toBe(shouldFire);
  });
});

// ─── Rule 9: general-advisory ───────────────────────────────────────────────────

describe("general-advisory", () => {
  it.each([
    ["fires when target_abv is set", { target_abv: 12 }, true],
    ["does NOT fire when target_abv is null", { target_abv: null }, false],
    ["fires when target_abv is 0 (non-null)", { target_abv: 0 }, true],
  ])("%s", (_name, overrides, shouldFire) => {
    const warnings = validate(overrides);
    expect(hasWarning(warnings, "general-advisory")).toBe(shouldFire);
  });
});

// ─── V12: Happy path — valid batch produces only the advisory ────────────────────

describe("happy path (V12)", () => {
  it("valid batch produces only general-advisory warning", () => {
    // Base defaults: 12% ABV, 20L, dry, tolerance 15, yeast present, ferm = 4.08 (exact match)
    const warnings = validate();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe("general-advisory");
  });
});

// ─── Cross-cutting: multiple simultaneous warnings ──────────────────────────────

describe("multiple simultaneous warnings", () => {
  it("fires several rules at once when multiple conditions violated", () => {
    const warnings = validate({
      has_yeast: false,
      target_abv: 16,
      yeast_alcohol_tolerance: 14,
      fermentation_sugar_kg: 0,
    });
    expect(hasWarning(warnings, "no-yeast")).toBe(true);
    expect(hasWarning(warnings, "abv-exceeds-tolerance")).toBe(true);
    expect(hasWarning(warnings, "total-sugar-insufficient")).toBe(true);
    expect(hasWarning(warnings, "general-advisory")).toBe(true);
    expect(warnings.length).toBe(4);
  });

  it("null volume skips calc-dependent rules but keeps input-only rules", () => {
    const warnings = validate({ target_volume_liters: null });
    expect(hasWarning(warnings, "ingredient-sugar-exceeds-needed")).toBe(false);
    expect(hasWarning(warnings, "total-sugar-insufficient")).toBe(false);
    expect(hasWarning(warnings, "sweetness-out-of-range")).toBe(false);
    expect(hasWarning(warnings, "general-advisory")).toBe(true);
  });
});
