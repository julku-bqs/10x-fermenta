import { cn } from "@/lib/utils";
import type { Ingredient } from "@/types";
import { batchInputClass } from "./styles";

interface IngredientCardProps {
  ingredient: Ingredient;
  onChange: (updates: Partial<Ingredient>) => void;
  onDelete?: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
}

const SUGAR_ICONS: Record<string, string> = {
  fermentation_sugar: "🍬",
  sweetness_sugar: "🍯",
};

const SUGAR_DISPLAY_NAMES: Record<string, string> = {
  fermentation_sugar: "Fermentation Sugar",
  sweetness_sugar: "Sweetness Sugar",
};

function formatAmount(ingredient: Ingredient): string {
  if (ingredient.type === "user_input") {
    return `${ingredient.amount_liters} L`;
  }
  return `${parseFloat(ingredient.amount_liters.toFixed(3))} kg`;
}

export function IngredientCard({ ingredient, onChange, onDelete, isEditing, onToggleEdit }: IngredientCardProps) {
  const isSugar = ingredient.type !== "user_input";
  const displayName = isSugar ? SUGAR_DISPLAY_NAMES[ingredient.type] : ingredient.name || "New ingredient";
  const icon = isSugar ? SUGAR_ICONS[ingredient.type] : "🌿";
  const amountLabel = isSugar ? "kg" : "L";

  if (isEditing) {
    return (
      <div className="border-border bg-card space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-foreground text-sm font-medium">{displayName}</span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-muted-foreground ml-auto text-xs transition-colors hover:text-red-600"
              aria-label="Remove ingredient"
            >
              ✕ Remove
            </button>
          )}
        </div>

        <div className={cn("grid gap-3", isSugar ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3")}>
          {!isSugar && (
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">Name</label>
              <input
                type="text"
                value={ingredient.name}
                onChange={(e) => {
                  onChange({ name: e.target.value });
                }}
                placeholder="e.g. Apple juice"
                className={batchInputClass}
              />
            </div>
          )}

          <div>
            <label className="text-muted-foreground mb-1 block text-xs">Amount ({amountLabel})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={ingredient.amount_liters}
              onChange={(e) => {
                onChange({ amount_liters: parseFloat(e.target.value) || 0 });
              }}
              placeholder="0"
              className={batchInputClass}
            />
          </div>

          {!isSugar && (
            <div>
              <label className="text-muted-foreground mb-1 block text-xs">Sugar content (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={ingredient.sugar_content_percent ?? ""}
                onChange={(e) => {
                  onChange({
                    sugar_content_percent: e.target.value === "" ? null : parseFloat(e.target.value),
                  });
                }}
                placeholder="e.g. 15"
                className={batchInputClass}
              />
            </div>
          )}
        </div>

        <button type="button" onClick={onToggleEdit} className="text-primary text-xs font-medium hover:underline">
          Done
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggleEdit}
      className="border-border bg-card hover:bg-muted flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors"
    >
      <span className="text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-foreground text-sm font-medium">{displayName}</span>
      </div>
      <span className="bg-secondary/50 text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
        {formatAmount(ingredient)}
        {ingredient.type === "user_input" && ingredient.sugar_content_percent !== null
          ? ` · ${ingredient.sugar_content_percent}%`
          : ""}
      </span>
    </button>
  );
}
