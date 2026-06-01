import { z } from "zod";

export const createBatchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  batch_date: z.iso.date().nullable().default(null),
  process_type: z.enum(["pulp", "juice"]),
  target_volume_liters: z.number().positive("Volume must be positive").nullable().default(null),
  target_abv: z.number().min(0).max(100, "ABV must be between 0 and 100").nullable().default(null),
  planned_sweetness: z.enum(["dry", "semi_dry", "semi_sweet", "sweet"]).default("dry"),
  yeast_name: z.string().nullable().default(null),
  yeast_alcohol_tolerance: z.number().min(0).max(100, "Tolerance must be between 0 and 100").nullable().default(null),
});

export const updateBatchSchema = createBatchSchema.partial();

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
