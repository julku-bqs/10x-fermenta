import type { IngredientType, SweetnessLevel } from "@/types";

export const SUGAR_PER_ABV_GRAM_PER_LITER = 17;

export const SWEETNESS_MIDPOINTS: Record<SweetnessLevel, number> = {
  dry: 0,
  semi_dry: 10,
  semi_sweet: 30,
  sweet: 60,
};

export const SWEETNESS_RANGES: Record<SweetnessLevel, [number, number]> = {
  dry: [0, 0],
  semi_dry: [5, 15],
  semi_sweet: [15, 45],
  sweet: [45, 80],
};

export interface CalculationInput {
  target_volume_liters: number;
  target_abv: number;
  planned_sweetness: SweetnessLevel;
  ingredients: {
    amount_liters: number;
    sugar_content_percent: number | null;
    type: IngredientType;
  }[];
}

export interface CalculationResult {
  fermentation_sugar_kg: number;
  sweetness_sugar_kg: number;
  total_ingredient_sugar_grams: number;
  sugar_needed_for_abv_grams: number;
}

export function calculateSugar(input: CalculationInput): CalculationResult {
  const { target_volume_liters, target_abv, planned_sweetness, ingredients } = input;

  // Sum sugar from user_input ingredients only (1% of 1L = 10g)
  const total_ingredient_sugar_grams = ingredients
    .filter((i) => i.type === "user_input")
    .reduce((sum, i) => sum + i.amount_liters * (i.sugar_content_percent ?? 0) * 10, 0);

  const sugar_needed_for_abv_grams = target_abv * SUGAR_PER_ABV_GRAM_PER_LITER * target_volume_liters;

  const fermentation_sugar_grams = Math.max(0, sugar_needed_for_abv_grams - total_ingredient_sugar_grams);
  const fermentation_sugar_kg = fermentation_sugar_grams / 1000;

  const sweetness_sugar_grams = SWEETNESS_MIDPOINTS[planned_sweetness] * target_volume_liters;
  const sweetness_sugar_kg = sweetness_sugar_grams / 1000;

  return {
    fermentation_sugar_kg,
    sweetness_sugar_kg,
    total_ingredient_sugar_grams,
    sugar_needed_for_abv_grams,
  };
}
