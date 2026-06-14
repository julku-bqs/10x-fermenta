import { z } from "zod";

export const ingredientSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  amount_liters: z.number().min(0, "Amount must be 0 or greater"),
  sugar_content_percent: z.number().min(0).max(100).nullable().default(null),
});

export const createBatchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  batch_date: z.iso.date().nullable().default(null),
  process_type: z.enum(["pulp", "juice"]),
  target_volume_liters: z.number().positive("Volume must be positive").nullable().default(null),
  target_abv: z.number().min(0).max(100, "ABV must be between 0 and 100").nullable().default(null),
  planned_sweetness: z.enum(["dry", "semi_dry", "semi_sweet", "sweet"]).default("dry"),
  yeast_name: z.string().nullable().default(null),
  yeast_alcohol_tolerance: z.number().min(0).max(100, "Tolerance must be between 0 and 100").nullable().default(null),
  fermentation_sugar_kg: z.number().min(0).default(0),
  sweetness_sugar_kg: z.number().min(0).default(0),
  ingredients: z.array(ingredientSchema).default([]),
  diary_entries: z
    .array(
      z.object({
        description: z.string().min(1),
        entry_date: z.iso.date(),
        notes: z.string().nullable().optional(),
        completed: z.boolean().optional(),
      }),
    )
    .optional(),
});

// Explicitly override fields with .default() to have no default in partial updates.
// Zod v4 applies .default() even in .partial() schemas, which would overwrite
// columns on any PUT that omits these fields.
export const updateBatchSchema = createBatchSchema.partial().extend({
  batch_date: z.iso.date().nullable().optional(),
  target_volume_liters: z.number().positive("Volume must be positive").nullable().optional(),
  target_abv: z.number().min(0).max(100, "ABV must be between 0 and 100").nullable().optional(),
  planned_sweetness: z.enum(["dry", "semi_dry", "semi_sweet", "sweet"]).optional(),
  yeast_name: z.string().nullable().optional(),
  yeast_alcohol_tolerance: z.number().min(0).max(100, "Tolerance must be between 0 and 100").nullable().optional(),
  fermentation_sugar_kg: z.number().min(0).optional(),
  sweetness_sugar_kg: z.number().min(0).optional(),
  ingredients: z.array(ingredientSchema).optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type IngredientInput = z.infer<typeof ingredientSchema>;
