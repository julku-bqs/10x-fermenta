import { useEffect, useRef, useState } from "react";
import type { Batch, Ingredient, SweetnessLevel } from "@/types";
import { createBatchSchema, updateBatchSchema } from "@/lib/schemas/batch";
import { calculateSugar } from "@/lib/services/sugar-calculation";
import type { CalculationResult } from "@/lib/services/sugar-calculation";
import { validateBatch } from "@/lib/services/batch-validation";
import type { ValidationWarning } from "@/lib/services/batch-validation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IngredientsList } from "./IngredientsList";
import { IngredientsSection } from "./IngredientsSection";
import { ValidationWarnings } from "./ValidationWarnings";

interface BatchFormProps {
  mode: "create" | "edit";
  title: string;
  initialData?: Batch;
  onSuccess?: (batch: Batch) => void;
}

interface FormState {
  name: string;
  batch_date: string;
  process_type: "pulp" | "juice" | "";
  target_volume_liters: string;
  target_abv: string;
  planned_sweetness: "dry" | "semi_dry" | "semi_sweet" | "sweet";
  yeast_name: string;
  yeast_alcohol_tolerance: string;
}

const labelClass = "block text-sm font-medium text-foreground mb-1";
const inputClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const inputErrorClass = "border-red-400 focus:border-red-500 focus:ring-red-400/30";
const errorMsgClass = "mt-1 text-xs text-red-600";

export function BatchForm({ mode, title, initialData, onSuccess }: BatchFormProps) {
  const [form, setForm] = useState<FormState>({
    name: initialData?.name ?? "",
    batch_date: initialData?.batch_date ?? "",
    process_type: initialData?.process_type ?? "",
    target_volume_liters: initialData?.target_volume_liters?.toString() ?? "",
    target_abv: initialData?.target_abv?.toString() ?? "",
    planned_sweetness: initialData?.planned_sweetness ?? "dry",
    yeast_name: initialData?.yeast_name ?? "",
    yeast_alcohol_tolerance: initialData?.yeast_alcohol_tolerance?.toString() ?? "",
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    const base = initialData?.ingredients ?? [];
    const result = [...base];
    const sweetness = initialData?.planned_sweetness ?? "dry";
    if (!result.some((i) => i.type === "fermentation_sugar")) {
      result.unshift({
        type: "fermentation_sugar",
        name: "Fermentation Sugar",
        amount_liters: 0,
        sugar_content_percent: null,
        sort_order: -2,
      });
    }
    if (sweetness !== "dry" && !result.some((i) => i.type === "sweetness_sugar")) {
      result.push({
        type: "sweetness_sugar",
        name: "Sweetness Sugar",
        amount_liters: 0,
        sugar_content_percent: null,
        sort_order: -1,
      });
    }
    return result;
  });
  function computeWarnings(formState: FormState, ingredientList: Ingredient[]): ValidationWarning[] {
    const abv = formState.target_abv ? parseFloat(formState.target_abv) : null;
    const volume = formState.target_volume_liters ? parseFloat(formState.target_volume_liters) : null;
    let calcResult: CalculationResult | null = null;
    if (abv !== null && volume !== null) {
      calcResult = calculateSugar({
        target_volume_liters: volume,
        target_abv: abv,
        planned_sweetness: formState.planned_sweetness,
        ingredients: ingredientList,
      });
    }
    return validateBatch(
      {
        target_abv: abv,
        target_volume_liters: volume,
        planned_sweetness: formState.planned_sweetness,
        yeast_alcohol_tolerance: formState.yeast_alcohol_tolerance
          ? parseFloat(formState.yeast_alcohol_tolerance)
          : null,
        has_yeast: Boolean(formState.yeast_name.trim() || formState.yeast_alcohol_tolerance.trim()),
        ingredients: ingredientList,
      },
      calcResult,
    );
  }

  const [warnings, setWarnings] = useState<ValidationWarning[]>(() => {
    if (mode !== "edit" || !initialData) return [];
    const initialFormState: FormState = {
      name: initialData.name,
      batch_date: initialData.batch_date ?? "",
      process_type: initialData.process_type,
      target_volume_liters: initialData.target_volume_liters?.toString() ?? "",
      target_abv: initialData.target_abv?.toString() ?? "",
      planned_sweetness: initialData.planned_sweetness,
      yeast_name: initialData.yeast_name ?? "",
      yeast_alcohol_tolerance: initialData.yeast_alcohol_tolerance?.toString() ?? "",
    };
    return computeWarnings(initialFormState, initialData.ingredients);
  });
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [initialValues, setInitialValues] = useState(() => ({
    form: {
      name: initialData?.name ?? "",
      batch_date: initialData?.batch_date ?? "",
      process_type: initialData?.process_type ?? "",
      target_volume_liters: initialData?.target_volume_liters?.toString() ?? "",
      target_abv: initialData?.target_abv?.toString() ?? "",
      planned_sweetness: initialData?.planned_sweetness ?? "dry",
      yeast_name: initialData?.yeast_name ?? "",
      yeast_alcohol_tolerance: initialData?.yeast_alcohol_tolerance?.toString() ?? "",
    },
    ingredients: initialData?.ingredients ?? [],
  }));

  const isDirtyRef = useRef(false);
  useEffect(() => {
    isDirtyRef.current =
      JSON.stringify(form) !== JSON.stringify(initialValues.form) ||
      JSON.stringify(ingredients) !== JSON.stringify(initialValues.ingredients);
  });

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function handleSweetnessChange(value: string) {
    const newSweetness = value as SweetnessLevel;
    set("planned_sweetness", newSweetness);
    setIngredients((prev) => {
      if (newSweetness === "dry") {
        return prev.filter((i) => i.type !== "sweetness_sugar");
      }
      const hasSweet = prev.some((i) => i.type === "sweetness_sugar");
      if (!hasSweet) {
        return [
          ...prev,
          {
            type: "sweetness_sugar" as const,
            name: "Sweetness Sugar",
            amount_liters: 0,
            sugar_content_percent: null,
            sort_order: -1,
          },
        ];
      }
      return prev;
    });
  }

  function handleBlur() {
    setWarningsDismissed(false);
    setWarnings(computeWarnings(form, ingredients));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);

    const payload = {
      name: form.name,
      batch_date: form.batch_date || null,
      process_type: form.process_type === "" ? undefined : form.process_type,
      target_volume_liters: form.target_volume_liters ? parseFloat(form.target_volume_liters) : null,
      target_abv: form.target_abv ? parseFloat(form.target_abv) : null,
      planned_sweetness: form.planned_sweetness,
      yeast_name: form.yeast_name || null,
      yeast_alcohol_tolerance: form.yeast_alcohol_tolerance ? parseFloat(form.yeast_alcohol_tolerance) : null,
      ingredients,
    };

    const schema = mode === "create" ? createBatchSchema : updateBatchSchema;
    const result = schema.safeParse(payload);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString() ?? "_";
        errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const url = mode === "create" ? "/api/batches" : `/api/batches/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });

      const json = (await res.json()) as { data?: Batch; error?: string; details?: Record<string, string[]> };

      if (!res.ok) {
        if (json.details) {
          const errors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(json.details)) {
            errors[key] = msgs[0] ?? "Invalid";
          }
          setFieldErrors(errors);
        } else {
          setServerError(json.error ?? "Something went wrong");
        }
        return;
      }

      if (json.data) {
        // Mark form as clean before navigation/callback to prevent spurious beforeunload prompt
        setInitialValues({ form: { ...form }, ingredients: [...ingredients] });
        isDirtyRef.current = false;
        if (onSuccess) {
          onSuccess(json.data);
        } else if (mode === "create") {
          window.location.href = `/batches/${json.data.id}`;
        }
      }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onBlur={handleBlur} className="space-y-6">
      {serverError && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{serverError}</span>
          <button
            type="button"
            onClick={() => {
              setServerError(null);
            }}
            className="ml-auto shrink-0 text-red-500 hover:text-red-700"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {!warningsDismissed && (
        <ValidationWarnings
          warnings={warnings}
          onDismiss={() => {
            setWarningsDismissed(true);
          }}
        />
      )}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{form.name || title}</h1>
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving…" : mode === "create" ? "Create Batch" : "Save Changes"}
          </Button>
          <a href="/batches" className="text-muted-foreground hover:text-foreground text-sm">
            Cancel
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Section 1: Batch Basics */}
        <section className="bg-muted space-y-4 rounded-lg p-5">
          <h2 className="text-base font-semibold">Batch Basics</h2>

          <div>
            <label htmlFor="name" className={labelClass}>
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
              }}
              placeholder="e.g. Apple Cider 2025"
              className={cn(inputClass, fieldErrors.name && inputErrorClass)}
            />
            {fieldErrors.name && <p className={errorMsgClass}>{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="batch_date" className={labelClass}>
              Batch Date
            </label>
            <input
              id="batch_date"
              type="date"
              value={form.batch_date}
              onChange={(e) => {
                set("batch_date", e.target.value);
              }}
              className={cn(inputClass, fieldErrors.batch_date && inputErrorClass)}
            />
            {fieldErrors.batch_date && <p className={errorMsgClass}>{fieldErrors.batch_date}</p>}
          </div>

          <div>
            <label htmlFor="process_type" className={labelClass}>
              Process Type <span className="text-red-500">*</span>
            </label>
            <select
              id="process_type"
              value={form.process_type}
              onChange={(e) => {
                set("process_type", e.target.value);
              }}
              className={cn(inputClass, fieldErrors.process_type && inputErrorClass)}
            >
              {mode === "create" && <option value="">Select process type…</option>}
              <option value="juice">Juice</option>
              <option value="pulp">Pulp</option>
            </select>
            {fieldErrors.process_type && <p className={errorMsgClass}>{fieldErrors.process_type}</p>}
          </div>
        </section>

        {/* Section 2: Parameters */}
        <section className="bg-muted space-y-4 rounded-lg p-5">
          <h2 className="text-base font-semibold">Parameters</h2>

          <div>
            <label htmlFor="target_volume_liters" className={labelClass}>
              Target Volume (liters)
            </label>
            <input
              id="target_volume_liters"
              type="number"
              min="0"
              step="0.1"
              value={form.target_volume_liters}
              onChange={(e) => {
                set("target_volume_liters", e.target.value);
              }}
              placeholder="e.g. 20"
              className={cn(inputClass, fieldErrors.target_volume_liters && inputErrorClass)}
            />
            {fieldErrors.target_volume_liters && <p className={errorMsgClass}>{fieldErrors.target_volume_liters}</p>}
          </div>

          <div>
            <label htmlFor="target_abv" className={labelClass}>
              Target ABV (%)
            </label>
            <input
              id="target_abv"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.target_abv}
              onChange={(e) => {
                set("target_abv", e.target.value);
              }}
              placeholder="e.g. 12"
              className={cn(inputClass, fieldErrors.target_abv && inputErrorClass)}
            />
            {fieldErrors.target_abv && <p className={errorMsgClass}>{fieldErrors.target_abv}</p>}
          </div>

          <div>
            <label htmlFor="planned_sweetness" className={labelClass}>
              Planned Sweetness
            </label>
            <select
              id="planned_sweetness"
              value={form.planned_sweetness}
              onChange={(e) => {
                handleSweetnessChange(e.target.value);
              }}
              className={cn(inputClass, fieldErrors.planned_sweetness && inputErrorClass)}
            >
              <option value="dry">Dry (default)</option>
              <option value="semi_dry">Semi-Dry</option>
              <option value="semi_sweet">Semi-Sweet</option>
              <option value="sweet">Sweet</option>
            </select>
            {fieldErrors.planned_sweetness && <p className={errorMsgClass}>{fieldErrors.planned_sweetness}</p>}
          </div>
        </section>

        {/* Section 3: Ingredients */}
        <section className="bg-muted space-y-4 rounded-lg p-5">
          <h2 className="text-base font-semibold">Ingredients</h2>

          <IngredientsList
            yeastName={form.yeast_name}
            yeastTolerance={form.yeast_alcohol_tolerance}
            onYeastNameChange={(v) => {
              set("yeast_name", v);
            }}
            onYeastToleranceChange={(v) => {
              set("yeast_alcohol_tolerance", v);
            }}
            yeastNameError={fieldErrors.yeast_name}
            yeastToleranceError={fieldErrors.yeast_alcohol_tolerance}
          />

          <IngredientsSection
            ingredients={ingredients}
            onChange={setIngredients}
            batchParams={{
              target_volume_liters: form.target_volume_liters ? parseFloat(form.target_volume_liters) : null,
              target_abv: form.target_abv ? parseFloat(form.target_abv) : null,
              planned_sweetness: form.planned_sweetness,
            }}
          />
        </section>

        {/* Section 4: Diary placeholder */}
        <section className="bg-muted flex items-center justify-center rounded-lg p-5">
          <p className="text-muted-foreground text-sm italic">Process diary — coming soon</p>
        </section>
      </div>

      <div className="flex items-center justify-end gap-4 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving…" : mode === "create" ? "Create Batch" : "Save Changes"}
        </Button>
        <a href="/batches" className="text-muted-foreground hover:text-foreground text-sm">
          Cancel
        </a>
      </div>
    </form>
  );
}
