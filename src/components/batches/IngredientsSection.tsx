import { useState } from "react";
import type { Ingredient, SweetnessLevel } from "@/types";
import { calculateSugar } from "@/lib/services/sugar-calculation";
import { IngredientCard } from "./IngredientCard";

interface BatchParams {
  target_volume_liters: number | null;
  target_abv: number | null;
  planned_sweetness: SweetnessLevel;
}

interface IngredientsSectionProps {
  ingredients: Ingredient[];
  onChange: (ingredients: Ingredient[]) => void;
  batchParams: BatchParams;
}

export function IngredientsSection({ ingredients, onChange, batchParams }: IngredientsSectionProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const sorted = [...ingredients].sort((a, b) => a.sort_order - b.sort_order);
  const sortedWithIndices = sorted.map((ing) => ({
    ingredient: ing,
    originalIndex: ingredients.indexOf(ing),
  }));

  function handleChange(originalIndex: number, updates: Partial<Ingredient>) {
    onChange(ingredients.map((ing, i) => (i === originalIndex ? { ...ing, ...updates } : ing)));
  }

  function handleDelete(originalIndex: number) {
    onChange(ingredients.filter((_, i) => i !== originalIndex));
    setEditingIndex(null);
  }

  function handleAddIngredient() {
    const maxSortOrder = ingredients
      .filter((i) => i.type === "user_input")
      .reduce((max, i) => Math.max(max, i.sort_order), -1);

    const newIngredient: Ingredient = {
      type: "user_input",
      name: "",
      amount_liters: 0,
      sugar_content_percent: null,
      sort_order: maxSortOrder + 1,
    };

    const newIngredients = [...ingredients, newIngredient];
    onChange(newIngredients);
    setEditingIndex(newIngredients.length - 1);
  }

  function handleCalculate() {
    const { target_volume_liters, target_abv, planned_sweetness } = batchParams;
    if (!target_volume_liters || !target_abv) return;

    const result = calculateSugar({
      target_volume_liters,
      target_abv,
      planned_sweetness,
      ingredients,
    });

    const updated = [...ingredients];

    const fermIdx = updated.findIndex((i) => i.type === "fermentation_sugar");
    if (fermIdx >= 0) {
      updated[fermIdx] = { ...updated[fermIdx], amount_liters: result.fermentation_sugar_kg };
    } else {
      updated.unshift({
        type: "fermentation_sugar",
        name: "Fermentation Sugar",
        amount_liters: result.fermentation_sugar_kg,
        sugar_content_percent: null,
        sort_order: -2,
      });
    }

    if (planned_sweetness !== "dry") {
      const sweetIdx = updated.findIndex((i) => i.type === "sweetness_sugar");
      if (sweetIdx >= 0) {
        updated[sweetIdx] = { ...updated[sweetIdx], amount_liters: result.sweetness_sugar_kg };
      } else {
        updated.push({
          type: "sweetness_sugar",
          name: "Sweetness Sugar",
          amount_liters: result.sweetness_sugar_kg,
          sugar_content_percent: null,
          sort_order: -1,
        });
      }
    }

    onChange(updated);
    setEditingIndex(null);
  }

  const canCalculate = Boolean(batchParams.target_volume_liters && batchParams.target_abv);

  const sugarEntries = sortedWithIndices.filter(({ ingredient }) => ingredient.type !== "user_input");
  const userEntries = sortedWithIndices.filter(({ ingredient }) => ingredient.type === "user_input");

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {sugarEntries.map(({ ingredient, originalIndex }) => (
          <IngredientCard
            key={ingredient.type}
            ingredient={ingredient}
            onChange={(updates) => {
              handleChange(originalIndex, updates);
            }}
            isEditing={editingIndex === originalIndex}
            onToggleEdit={() => {
              setEditingIndex(editingIndex === originalIndex ? null : originalIndex);
            }}
          />
        ))}
        <button
          type="button"
          onClick={handleCalculate}
          disabled={!canCalculate}
          title={canCalculate ? "Calculate sugar amounts" : "Fill in target volume and ABV first"}
          className="bg-secondary/70 text-secondary-foreground hover:bg-secondary flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          🧮 Calculate
        </button>
      </div>

      {userEntries.length > 0 && (
        <div className="space-y-2">
          {userEntries.map(({ ingredient, originalIndex }) => (
            <IngredientCard
              key={`user-${originalIndex}`}
              ingredient={ingredient}
              onChange={(updates) => {
                handleChange(originalIndex, updates);
              }}
              onDelete={() => {
                handleDelete(originalIndex);
              }}
              isEditing={editingIndex === originalIndex}
              onToggleEdit={() => {
                setEditingIndex(editingIndex === originalIndex ? null : originalIndex);
              }}
            />
          ))}
        </div>
      )}

      <button type="button" onClick={handleAddIngredient} className="text-primary text-xs font-medium hover:underline">
        + Add ingredient
      </button>
    </div>
  );
}
