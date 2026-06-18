import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ingredient } from "@/types";
import { batchInputClass } from "./styles";

interface IngredientCardProps {
  id: string;
  ingredient: Ingredient;
  onChange: (updates: Partial<Ingredient>) => void;
  onDelete?: () => void;
  isEditing: boolean;
  isDragDisabled: boolean;
  onToggleEdit: () => void;
}

export function IngredientCard({
  id,
  ingredient,
  onChange,
  onDelete,
  isEditing,
  isDragDisabled,
  onToggleEdit,
}: IngredientCardProps) {
  const displayName = ingredient.name || "New ingredient";
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isDragDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transform ? transition : undefined,
  };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="border-border bg-card space-y-3 rounded-lg border p-4">
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
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-border bg-card flex items-stretch overflow-hidden rounded-lg border",
        isDragging && "opacity-30",
      )}
      aria-label={isDragging ? `${displayName} being dragged` : undefined}
    >
      {!isDragDisabled && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="hover:bg-muted text-muted-foreground flex shrink-0 items-center px-3 transition-colors"
          style={{ touchAction: "none" }}
          aria-label={`Reorder ${displayName}`}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {!isDragDisabled && <div className="bg-border h-5 w-px self-center" />}
      <button
        type="button"
        onClick={onToggleEdit}
        className="hover:bg-muted flex flex-1 items-center gap-3 p-4 text-left transition-colors"
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
