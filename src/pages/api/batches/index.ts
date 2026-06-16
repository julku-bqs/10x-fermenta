import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createBatchSchema } from "@/lib/schemas/batch";
import { generateProcessPlan } from "@/lib/services/process-plan-generation";
import { jsonOk, jsonCreated, jsonError, jsonValidationError } from "@/lib/api";
import type { Batch } from "@/types";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return jsonError("Server configuration error", 500);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const result = createBatchSchema.safeParse(body);
  if (!result.success) {
    return jsonValidationError(result.error);
  }

  const { diary_entries: userDiaryEntries, ...batchData } = result.data;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase
    .from("batches")
    .insert({ ...batchData, user_id: context.locals.user.id })
    .select()
    .single();

  if (error) {
    console.error("Failed to create batch:", error.message);
    return jsonError("Failed to create batch", 500);
  }

  const batch = data as Batch;

  // Auto-generate diary entries (non-blocking — batch still returned on failure)
  try {
    const generatedEntries = generateProcessPlan({ batch });
    if (generatedEntries.length > 0) {
      const { error: diaryError } = await supabase.from("diary_entries").insert(
        generatedEntries.map((entry) => ({
          batch_id: batch.id,
          description: entry.description,
          entry_date: entry.entry_date,
          entry_type: "auto" as const,
        })),
      );
      if (diaryError) {
        console.error("Failed to generate diary entries:", diaryError.message);
      }
    }

    // Insert user-added diary entries from create mode
    if (userDiaryEntries && userDiaryEntries.length > 0) {
      const { error: userDiaryError } = await supabase.from("diary_entries").insert(
        userDiaryEntries.map((entry) => ({
          batch_id: batch.id,
          description: entry.description,
          entry_date: entry.entry_date ?? new Date().toISOString().slice(0, 10),
          notes: entry.notes ?? null,
          completed: entry.completed ?? false,
          entry_type: "user" as const,
        })),
      );
      if (userDiaryError) {
        console.error("Failed to save user diary entries:", userDiaryError.message);
      }
    }
  } catch (e) {
    console.error("Diary generation error:", e);
  }

  return jsonCreated(data);
};

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return jsonError("Server configuration error", 500);
  }

  const { data, error } = await supabase.from("batches").select("*").order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch batches:", error.message);
    return jsonError("Failed to fetch batches", 500);
  }

  return jsonOk(data);
};
