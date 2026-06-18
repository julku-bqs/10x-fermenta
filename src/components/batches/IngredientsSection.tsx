import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import type { BatchParams, Ingredient } from "@/types";
import { calculateSugar } from "@/lib/services/sugar-calculation";
import { IngredientCard } from "./IngredientCard";
import { batchInputClass } from "./styles";

interface IngredientsSectionProps {
  batchParams: BatchParams;
  onBatchChange: (updates: Partial<BatchParams>) => void;
}

interface SugarCardProps {
  label: string;
  icon: string;
  amountKg: number;
  onChange: (kg: number) => void;
  isEditing: boolean;
  onToggleEdit: () => void;
}

function SugarCard({ label, icon, amountKg, onChange, isEditing, onToggleEdit }: SugarCardProps) {
  if (isEditing) {
    return (
      <div className="border-border bg-card space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-foreground text-sm font-medium">{label}</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">Amount (kg)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountKg}
              onChange={(e) => {
                onChange(parseFloat(e.target.value) || 0);
              }}
              placeholder="0"
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
    <button
      type="button"
      onClick={onToggleEdit}
      className="border-border bg-card hover:bg-muted flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors"
    >
      <span className="text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-foreground text-sm font-medium">{label}</span>
      </div>
      <span className="bg-secondary/50 text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
        {parseFloat(amountKg.toFixed(3))} kg
      </span>
    </button>
  );
}

export function IngredientsSection({ batchParams, onBatchChange }: IngredientsSectionProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingSugar, setEditingSugar] = useState<"fermentation" | "sweetness" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { ingredients, fermentation_sugar_kg: fermentationSugarKg, sweetness_sugar_kg: sweetnessSugarKg } = batchParams;
  const activeIngredient = activeId !== null ? (ingredients[Number(activeId)] ?? null) : null;

  function handleChange(index: number, updates: Partial<Ingredient>) {
    onBatchChange({ ingredients: ingredients.map((ing, i) => (i === index ? { ...ing, ...updates } : ing)) });
  }

  function handleDelete(index: number) {
    onBatchChange({ ingredients: ingredients.filter((_, i) => i !== index) });
    setEditingIndex(null);
  }

  function handleAddIngredient() {
    const newIngredient: Ingredient = {
      name: "",
      amount_liters: 0,
      sugar_content_percent: null,
    };

    const newIngredients = [...ingredients, newIngredient];
    onBatchChange({ ingredients: newIngredients });
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

    onBatchChange({
      fermentation_sugar_kg: result.fermentation_sugar_kg,
      sweetness_sugar_kg: result.sweetness_sugar_kg,
    });
    setEditingSugar(null);
  }

  function handleDragEnd(activeId: string, overId: string | null) {
    if (editingIndex !== null || overId === null || activeId === overId) {
      return;
    }

    const oldIndex = Number(activeId);
    const newIndex = Number(overId);
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex) || oldIndex < 0 || newIndex < 0) {
      return;
    }

    onBatchChange({ ingredients: arrayMove(ingredients, oldIndex, newIndex) });
  }

  const canCalculate = Boolean(batchParams.target_volume_liters && batchParams.target_abv);
  const sortableIds = ingredients.map((_, index) => String(index));
  const isDragDisabled = editingIndex !== null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <SugarCard
          label="Fermentation Sugar"
          icon="🍬"
          amountKg={fermentationSugarKg}
          onChange={(kg) => {
            onBatchChange({ fermentation_sugar_kg: kg });
          }}
          isEditing={editingSugar === "fermentation"}
          onToggleEdit={() => {
            setEditingSugar(editingSugar === "fermentation" ? null : "fermentation");
            setEditingIndex(null);
          }}
        />
        {batchParams.planned_sweetness !== "dry" && (
          <SugarCard
            label="Sweetness Sugar"
            icon="🍯"
            amountKg={sweetnessSugarKg}
            onChange={(kg) => {
              onBatchChange({ sweetness_sugar_kg: kg });
            }}
            isEditing={editingSugar === "sweetness"}
            onToggleEdit={() => {
              setEditingSugar(editingSugar === "sweetness" ? null : "sweetness");
              setEditingIndex(null);
            }}
          />
        )}
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

      {ingredients.length > 0 && (
        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragStart={({ active }) => {
            setActiveId(String(active.id));
          }}
          onDragEnd={({ active, over }) => {
            setActiveId(null);
            handleDragEnd(String(active.id), over ? String(over.id) : null);
          }}
          onDragCancel={() => {
            setActiveId(null);
          }}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {ingredients.map((ingredient, index) => (
                <IngredientCard
                  id={String(index)}
                  key={String(index)}
                  ingredient={ingredient}
                  onChange={(updates) => {
                    handleChange(index, updates);
                  }}
                  onDelete={() => {
                    handleDelete(index);
                  }}
                  isEditing={editingIndex === index}
                  isDragDisabled={isDragDisabled}
                  onToggleEdit={() => {
                    setEditingIndex(editingIndex === index ? null : index);
                    setEditingSugar(null);
                  }}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeIngredient ? (
              <div className="border-border bg-card flex cursor-grabbing items-stretch overflow-hidden rounded-lg border shadow-lg">
                <div className="text-muted-foreground flex shrink-0 items-center px-3">
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="bg-border h-5 w-px self-center" />
                <div className="flex flex-1 items-center gap-3 p-4">
                  <span className="text-base">🌿</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-foreground text-sm font-medium">
                      {activeIngredient.name || "New ingredient"}
                    </span>
                  </div>
                  <span className="bg-secondary/50 text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                    {activeIngredient.amount_liters} L
                    {activeIngredient.sugar_content_percent !== null
                      ? ` · ${activeIngredient.sugar_content_percent}%`
                      : ""}
                  </span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <button type="button" onClick={handleAddIngredient} className="text-primary text-xs font-medium hover:underline">
        + Add ingredient
      </button>
    </div>
  );
}
