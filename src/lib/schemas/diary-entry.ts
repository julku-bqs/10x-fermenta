import { z } from "zod";

export const diaryEntryBaseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  entry_date: z
    .union([z.iso.date(), z.literal("")])
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
  notes: z.string().nullable().optional(),
  completed: z.boolean().optional(),
});

export const createDiaryEntrySchema = diaryEntryBaseSchema;

export const updateDiaryEntrySchema = diaryEntryBaseSchema.partial();

export type CreateDiaryEntryInput = z.infer<typeof createDiaryEntrySchema>;
export type UpdateDiaryEntryInput = z.infer<typeof updateDiaryEntrySchema>;
