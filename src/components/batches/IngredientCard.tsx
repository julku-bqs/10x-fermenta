import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Ingredient } from "@/types";
import { batchInputClass } from "./styles";

interface IngredientCardProps {
  id: string;
  ingredient: Ingredient;
  onChange: (updates: Partial<Ingredient>) => void;
  onDelete?: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
}

export function IngredientCard({ id, ingredient, onChange, onDelete, isEditing, onToggleEdit }: IngredientCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const displayName = ingredient.name || "New ingredient";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isEditing) {
    return (
      <div className="border-border bg-card space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🌿</span>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

          <div>
            <label className="text-muted-foreground mb-1 block text-xs">Amount (L)</label>
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
        </div>

        <button type="button" onClick={onToggleEdit} className="text-primary text-xs font-medium hover:underline">
          Done
        </button>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="flex w-full gap-2 rounded-lg transition-all">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="border-border bg-card hover:bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-lg border p-4 transition-colors"
        aria-label="Drag handle for reordering ingredient"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleEdit}
        className="border-border bg-card hover:bg-muted flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors"
      >
        <span className="text-base">🌿</span>
        <div className="min-w-0 flex-1">
          <span className="text-foreground text-sm font-medium">{displayName}</span>
        </div>
        <span className="bg-secondary/50 text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
          {ingredient.amount_liters} L
          {ingredient.sugar_content_percent !== null ? ` · ${ingredient.sugar_content_percent}%` : ""}
        </span>
      </button>
    </div>
  );
}
