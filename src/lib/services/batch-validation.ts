import type { Ingredient, SweetnessLevel } from "@/types";
import { SUGAR_PER_ABV_GRAM_PER_LITER, SWEETNESS_RANGES } from "@/lib/services/sugar-calculation";

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

export function validateBatch(input: ValidationInput): ValidationWarning[] {
  const { target_abv, target_volume_liters, planned_sweetness, yeast_alcohol_tolerance, has_yeast, ingredients } =
    input;

  const warnings: ValidationWarning[] = [];

  // Rule 1: No yeast
  if (!has_yeast) {
    warnings.push({
      id: "no-yeast",
      message: "No yeast specified — using wild yeast can give unpredictable results.",
    });
  }

  // Rule 2: No target ABV — skip all ABV-dependent rules
  if (target_abv === null) {
    warnings.push({
      id: "no-target-abv",
      message: "No target ABV specified — calculation results may be incomplete.",
    });
    return warnings;
  }

  // Rule 3: ABV > yeast tolerance
  if (yeast_alcohol_tolerance !== null && target_abv > yeast_alcohol_tolerance) {
    warnings.push({
      id: "abv-exceeds-tolerance",
      message: "Target ABV exceeds yeast alcohol tolerance. The plan is inconsistent.",
    });
  }

  // Rule 4: Non-dry sweetness + yeast tolerance won't stop fermentation
  if (planned_sweetness !== "dry" && yeast_alcohol_tolerance !== null && yeast_alcohol_tolerance > target_abv) {
    warnings.push({
      id: "sweetness-wont-stop",
      message:
        "Planned sweetness requires stopping fermentation. Yeast tolerance exceeds target ABV, so fermentation won't stop on its own.",
    });
  }

  // Rules 5–7 require volume to be calculable
  if (target_volume_liters !== null) {
    const userInputSugarGrams = ingredients
      .filter((i) => i.type === "user_input")
      .reduce((sum, i) => sum + i.amount_liters * (i.sugar_content_percent ?? 0) * 10, 0);

    const sugarNeededForAbvGrams = target_abv * SUGAR_PER_ABV_GRAM_PER_LITER * target_volume_liters;

    // Rule 5: Ingredient sugar alone already covers ABV needs
    if (userInputSugarGrams >= sugarNeededForAbvGrams) {
      warnings.push({
        id: "ingredient-sugar-exceeds-needed",
        message:
          "Sugar from ingredients already exceeds what's needed for target ABV. No additional fermentation sugar is required.",
      });
    }

    // Rule 6: Total sugar (ingredients + fermentation sugar entry) still insufficient
    const fermentationEntry = ingredients.find((i) => i.type === "fermentation_sugar");
    const fermentationSugarGrams = fermentationEntry ? fermentationEntry.amount_liters * 1000 : 0;
    const totalSugarGrams = userInputSugarGrams + fermentationSugarGrams;
    if (totalSugarGrams < sugarNeededForAbvGrams) {
      warnings.push({
        id: "total-sugar-insufficient",
        message: "Total sugar (ingredients + added) is insufficient for target ABV.",
      });
    }

    // Rule 7: Sweetness sugar amount outside expected range for selected level
    if (planned_sweetness !== "dry") {
      const sweetnessEntry = ingredients.find((i) => i.type === "sweetness_sugar");
      if (sweetnessEntry) {
        const sweetnessSugarGPerL = (sweetnessEntry.amount_liters * 1000) / target_volume_liters;
        const [min, max] = SWEETNESS_RANGES[planned_sweetness];
        if (sweetnessSugarGPerL < min || sweetnessSugarGPerL > max) {
          warnings.push({
            id: "sweetness-out-of-range",
            message: "Sweetness sugar amount falls outside the expected range for the selected sweetness level.",
          });
        }
      }
    }
  }

  // Rule 8: General advisory fires whenever target_abv is set
  warnings.push({
    id: "general-advisory",
    message: "Planned parameters are expected values, not guaranteed outcomes. Accuracy depends on your inputs.",
  });

  return warnings;
}
