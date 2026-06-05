import { useState } from "react";
import { cn } from "@/lib/utils";

interface IngredientsListProps {
  yeastName: string;
  yeastTolerance: string;
  onYeastNameChange: (value: string) => void;
  onYeastToleranceChange: (value: string) => void;
  yeastNameError?: string;
  yeastToleranceError?: string;
}

export function IngredientsList({
  yeastName,
  yeastTolerance,
  onYeastNameChange,
  onYeastToleranceChange,
  yeastNameError,
  yeastToleranceError,
}: IngredientsListProps) {
  const hasYeast = yeastName.trim().length > 0 || yeastTolerance.trim().length > 0;
  const [editing, setEditing] = useState(false);

  const inputClass =
    "w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

  if (editing) {
    return (
      <div className="border-border bg-card space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🧪</span>
          <span className="text-foreground text-sm font-medium">Yeast</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="yeast_name" className="text-muted-foreground mb-1 block text-xs">
              Name
            </label>
            <input
              id="yeast_name"
              type="text"
              value={yeastName}
              onChange={(e) => {
                onYeastNameChange(e.target.value);
              }}
              placeholder="e.g. Lalvin EC-1118"
              className={cn(inputClass, yeastNameError && "border-red-400 focus:border-red-500 focus:ring-red-400/30")}
            />
            {yeastNameError && <p className="mt-1 text-xs text-red-600">{yeastNameError}</p>}
          </div>
          <div>
            <label htmlFor="yeast_alcohol_tolerance" className="text-muted-foreground mb-1 block text-xs">
              Alcohol Tolerance (%)
            </label>
            <input
              id="yeast_alcohol_tolerance"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={yeastTolerance}
              onChange={(e) => {
                onYeastToleranceChange(e.target.value);
              }}
              placeholder="e.g. 18"
              className={cn(
                inputClass,
                yeastToleranceError && "border-red-400 focus:border-red-500 focus:ring-red-400/30",
              )}
            />
            {yeastToleranceError && <p className="mt-1 text-xs text-red-600">{yeastToleranceError}</p>}
          </div>
        </div>
        {hasYeast && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
            }}
            className="text-primary text-xs font-medium hover:underline"
          >
            Done
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setEditing(true);
      }}
      className="border-border bg-card hover:bg-muted flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors"
    >
      <span className="text-base">🧪</span>
      <div className="min-w-0 flex-1">
        <span className="text-foreground text-sm font-medium">
          {hasYeast ? yeastName.trim() || "Yeast" : "Add yeast"}
        </span>
      </div>
      {yeastTolerance && (
        <span className="bg-secondary/50 text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
          {yeastTolerance}% tol.
        </span>
      )}
      {!hasYeast && <span className="text-primary text-xs font-medium">tap to add →</span>}
    </button>
  );
}
