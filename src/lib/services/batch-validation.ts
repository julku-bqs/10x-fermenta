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

interface ValidationRule {
  id: string;
  isApplicable(input: ValidationInput, calcResult: CalculationResult | null): boolean;
  validate(input: ValidationInput, calcResult: CalculationResult | null): ValidationWarning;
}

function fermentationSugarGrams(ingredients: Ingredient[]): number {
  const entry = ingredients.find((i) => i.type === "fermentation_sugar");
  return entry ? entry.amount_liters * 1000 : 0;
}

const RULES: ValidationRule[] = [
  // Rule 1: No yeast
  {
    id: "no-yeast",
    isApplicable: (input) => !input.has_yeast,
    validate: () => ({
      id: "no-yeast",
      message: "No yeast specified — using wild yeast can give unpredictable results.",
    }),
  },

  // Rule 2: No target ABV
  {
    id: "no-target-abv",
    isApplicable: (input) => input.target_abv === null,
    validate: () => ({
      id: "no-target-abv",
      message: "No target ABV specified — calculation results may be incomplete.",
    }),
  },

  // Rule 3: ABV > yeast tolerance
  {
    id: "abv-exceeds-tolerance",
    isApplicable: (input) =>
      input.target_abv !== null &&
      input.yeast_alcohol_tolerance !== null &&
      input.target_abv > input.yeast_alcohol_tolerance,
    validate: () => ({
      id: "abv-exceeds-tolerance",
      message: "Target ABV exceeds yeast alcohol tolerance. The plan is inconsistent.",
    }),
  },

  // Rule 4: Non-dry sweetness + tolerance won't stop fermentation
  {
    id: "sweetness-wont-stop",
    isApplicable: (input) =>
      input.planned_sweetness !== "dry" &&
      input.yeast_alcohol_tolerance !== null &&
      input.target_abv !== null &&
      input.yeast_alcohol_tolerance > input.target_abv,
    validate: () => ({
      id: "sweetness-wont-stop",
      message:
        "Planned sweetness requires stopping fermentation. Yeast tolerance exceeds target ABV, so fermentation won't stop on its own.",
    }),
  },

  // Rule 5: Ingredient sugar alone already covers ABV needs
  {
    id: "ingredient-sugar-exceeds-needed",
    isApplicable: (_, calcResult) =>
      calcResult !== null && calcResult.total_ingredient_sugar_grams >= calcResult.sugar_needed_for_abv_grams,
    validate: () => ({
      id: "ingredient-sugar-exceeds-needed",
      message:
        "Sugar from ingredients already exceeds what's needed for target ABV. No additional fermentation sugar is required.",
    }),
  },

  // Rule 6: Total sugar (ingredients + fermentation entry) is insufficient
  {
    id: "total-sugar-insufficient",
    isApplicable: (input, calcResult) => {
      if (calcResult === null) return false;
      const totalGrams = calcResult.total_ingredient_sugar_grams + fermentationSugarGrams(input.ingredients);
      return totalGrams < calcResult.sugar_needed_for_abv_grams;
    },
    validate: () => ({
      id: "total-sugar-insufficient",
      message: "Total sugar (ingredients + added) is insufficient for target ABV.",
    }),
  },

  // Rule 7: Total sugar (ingredients + fermentation entry) exceeds ABV target
  // Only fires when ingredients alone don't exceed (Rule 5 handles that case)
  // Suppressed when yeast tolerance ≤ target ABV (excess sugar can't push ABV past tolerance ceiling)
  {
    id: "total-sugar-exceeds-target",
    isApplicable: (input, calcResult) => {
      if (calcResult === null) return false;
      if (calcResult.total_ingredient_sugar_grams >= calcResult.sugar_needed_for_abv_grams) return false;
      const totalGrams = calcResult.total_ingredient_sugar_grams + fermentationSugarGrams(input.ingredients);
      if (totalGrams <= calcResult.sugar_needed_for_abv_grams) return false;
      if (
        input.yeast_alcohol_tolerance !== null &&
        input.target_abv !== null &&
        input.yeast_alcohol_tolerance <= input.target_abv
      )
        return false;
      return true;
    },
    validate: () => ({
      id: "total-sugar-exceeds-target",
      message:
        "Combined sugar (ingredients + fermentation) exceeds what's needed for target ABV. Consider reducing the fermentation sugar amount.",
    }),
  },

  // Rule 8: Sweetness sugar amount outside expected range
  {
    id: "sweetness-out-of-range",
    isApplicable: (input, calcResult) => {
      if (calcResult === null || input.planned_sweetness === "dry" || input.target_volume_liters === null) return false;
      const sweetnessEntry = input.ingredients.find((i) => i.type === "sweetness_sugar");
      if (!sweetnessEntry) return false;
      const sweetnessSugarGPerL = (sweetnessEntry.amount_liters * 1000) / input.target_volume_liters;
      const [min, max] = SWEETNESS_RANGES[input.planned_sweetness];
      return sweetnessSugarGPerL < min || sweetnessSugarGPerL > max;
    },
    validate: () => ({
      id: "sweetness-out-of-range",
      message: "Sweetness sugar amount falls outside the expected range for the selected sweetness level.",
    }),
  },

  // Rule 9: General advisory — fires whenever target ABV is set
  {
    id: "general-advisory",
    isApplicable: (input) => input.target_abv !== null,
    validate: () => ({
      id: "general-advisory",
      message: "Planned parameters are expected values, not guaranteed outcomes. Accuracy depends on your inputs.",
    }),
  },
];

export function validateBatch(
  input: ValidationInput,
  calcResult: CalculationResult | null = null,
): ValidationWarning[] {
  return RULES.filter((rule) => rule.isApplicable(input, calcResult)).map((rule) => rule.validate(input, calcResult));
}
