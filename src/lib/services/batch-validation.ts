import type { Ingredient, SweetnessLevel } from "@/types";
import type { CalculationResult } from "@/lib/services/sugar-calculation";
import { SWEETNESS_RANGES } from "@/lib/services/sugar-calculation";

export interface ValidationWarning {
  id: string;
  message: string;
}

export interface ValidationInput {
  target_abv: number | null;
  target_volume_liters: number | null;
  planned_sweetness: SweetnessLevel;
  yeast_alcohol_tolerance: number | null;
  has_yeast: boolean;
  ingredients: Ingredient[];
}

/** A validation rule is a pure function: return a warning when the condition fires, null otherwise. */
type ValidationRule = (input: ValidationInput, calcResult: CalculationResult | null) => ValidationWarning | null;

function fermentationSugarGrams(ingredients: Ingredient[]): number {
  const entry = ingredients.find((i) => i.type === "fermentation_sugar");
  return entry ? entry.amount_liters * 1000 : 0;
}

// Rule 1: No yeast
const noYeast: ValidationRule = (input) =>
  !input.has_yeast
    ? { id: "no-yeast", message: "No yeast specified — using wild yeast can give unpredictable results." }
    : null;

// Rule 2: No target ABV
const noTargetAbv: ValidationRule = (input) =>
  input.target_abv === null
    ? { id: "no-target-abv", message: "No target ABV specified — calculation results may be incomplete." }
    : null;

// Rule 3: ABV > yeast tolerance
// Guard: both values must exist. Domain: target ABV exceeds tolerance.
const abvExceedsTolerance: ValidationRule = (input) => {
  if (input.target_abv === null || input.yeast_alcohol_tolerance === null) return null;
  return input.target_abv > input.yeast_alcohol_tolerance
    ? { id: "abv-exceeds-tolerance", message: "Target ABV exceeds yeast alcohol tolerance. The plan is inconsistent." }
    : null;
};

// Rule 4: Non-dry sweetness + tolerance won't stop fermentation
// Guard: non-dry wine with both tolerance and target ABV. Domain: tolerance > target ABV.
const sweetnessWontStop: ValidationRule = (input) => {
  if (input.planned_sweetness === "dry" || input.yeast_alcohol_tolerance === null || input.target_abv === null)
    return null;
  return input.yeast_alcohol_tolerance > input.target_abv
    ? {
        id: "sweetness-wont-stop",
        message:
          "Planned sweetness requires stopping fermentation. Yeast tolerance exceeds target ABV, so fermentation won't stop on its own.",
      }
    : null;
};

// Rule 5: Ingredient sugar alone already covers ABV needs
// Guard: calcResult must exist. Domain: ingredient sugar >= needed for ABV.
const ingredientSugarExceedsNeeded: ValidationRule = (_input, calcResult) => {
  if (calcResult === null) return null;
  return calcResult.total_ingredient_sugar_grams >= calcResult.sugar_needed_for_abv_grams
    ? {
        id: "ingredient-sugar-exceeds-needed",
        message:
          "Sugar from ingredients already exceeds what's needed for target ABV. No additional fermentation sugar is required.",
      }
    : null;
};

// Rule 6: Total sugar (ingredients + fermentation entry) is insufficient
// Guard: calcResult must exist. Domain: total sugar < needed for ABV.
const totalSugarInsufficient: ValidationRule = (input, calcResult) => {
  if (calcResult === null) return null;
  const totalGrams = calcResult.total_ingredient_sugar_grams + fermentationSugarGrams(input.ingredients);
  return totalGrams < calcResult.sugar_needed_for_abv_grams
    ? { id: "total-sugar-insufficient", message: "Total sugar (ingredients + added) is insufficient for target ABV." }
    : null;
};

// Rule 7: Total sugar (ingredients + fermentation entry) exceeds ABV target
// Guard: calcResult exists AND ingredient sugar alone does not already exceed needed (Rule 5 handles that).
// Domain: total > needed, unless yeast tolerance ceiling prevents the ABV overshoot.
const totalSugarExceedsTarget: ValidationRule = (input, calcResult) => {
  if (calcResult === null) return null;
  if (calcResult.total_ingredient_sugar_grams >= calcResult.sugar_needed_for_abv_grams) return null;
  const totalGrams = calcResult.total_ingredient_sugar_grams + fermentationSugarGrams(input.ingredients);
  if (totalGrams <= calcResult.sugar_needed_for_abv_grams) return null;
  if (
    input.yeast_alcohol_tolerance !== null &&
    input.target_abv !== null &&
    input.yeast_alcohol_tolerance <= input.target_abv
  )
    return null;
  return {
    id: "total-sugar-exceeds-target",
    message:
      "Combined sugar (ingredients + fermentation) exceeds what's needed for target ABV. Consider reducing the fermentation sugar amount.",
  };
};

// Rule 8: Sweetness sugar amount outside expected range
// Guard: calcResult exists, non-dry wine, volume known, sweetness entry present.
// Domain: sugar g/L ratio falls outside the sweetness band.
const sweetnessOutOfRange: ValidationRule = (input, calcResult) => {
  if (calcResult === null || input.planned_sweetness === "dry" || !input.target_volume_liters) return null;
  const sweetnessEntry = input.ingredients.find((i) => i.type === "sweetness_sugar");
  if (!sweetnessEntry) return null;
  const sweetnessSugarGPerL = (sweetnessEntry.amount_liters * 1000) / input.target_volume_liters;
  const [min, max] = SWEETNESS_RANGES[input.planned_sweetness];
  return sweetnessSugarGPerL < min || sweetnessSugarGPerL > max
    ? {
        id: "sweetness-out-of-range",
        message: "Sweetness sugar amount falls outside the expected range for the selected sweetness level.",
      }
    : null;
};

// Rule 9: General advisory
const generalAdvisory: ValidationRule = (input) =>
  input.target_abv !== null
    ? {
        id: "general-advisory",
        message: "Planned parameters are expected values, not guaranteed outcomes. Accuracy depends on your inputs.",
      }
    : null;

const RULES: ValidationRule[] = [
  noYeast,
  noTargetAbv,
  abvExceedsTolerance,
  sweetnessWontStop,
  ingredientSugarExceedsNeeded,
  totalSugarInsufficient,
  totalSugarExceedsTarget,
  sweetnessOutOfRange,
  generalAdvisory,
];

export function validateBatch(
  input: ValidationInput,
  calcResult: CalculationResult | null = null,
): ValidationWarning[] {
  return RULES.map((rule) => rule(input, calcResult)).filter((w): w is ValidationWarning => w !== null);
}
