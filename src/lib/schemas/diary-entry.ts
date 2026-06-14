import { z } from "zod";

export const createDiaryEntrySchema = z.object({
  description: z.string().min(1, "Description is required"),
  entry_date: z.iso.date().optional(),
  notes: z.string().nullable().optional(),
  completed: z.boolean().optional(),
});

export const updateDiaryEntrySchema = z.object({
  description: z.string().min(1, "Description is required").optional(),
  entry_date: z.iso.date().optional(),
  notes: z.string().nullable().optional(),
  completed: z.boolean().optional(),
});

export type CreateDiaryEntryInput = z.infer<typeof createDiaryEntrySchema>;
export type UpdateDiaryEntryInput = z.infer<typeof updateDiaryEntrySchema>;
