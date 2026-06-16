import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateDiaryEntrySchema } from "@/lib/schemas/diary-entry";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PUT: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return jsonError("Server configuration error", 500);
  }

  const batchId = context.params.id;
  const entryId = context.params.entryId;
  if (!batchId || !UUID_REGEX.test(batchId) || !entryId || !UUID_REGEX.test(entryId)) {
    return jsonError("Invalid ID", 400);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const result = updateDiaryEntrySchema.safeParse(body);
  if (!result.success) {
    return jsonValidationError(result.error);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase
    .from("diary_entries")
    .update(result.data)
    .eq("id", entryId)
    .eq("batch_id", batchId)
    .select()
    .single();

  if (error || !data) {
    return jsonError("Diary entry not found", 404);
  }

  return jsonOk(data);
};

export const DELETE: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return jsonError("Server configuration error", 500);
  }

  const batchId = context.params.id;
  const entryId = context.params.entryId;
  if (!batchId || !UUID_REGEX.test(batchId) || !entryId || !UUID_REGEX.test(entryId)) {
    return jsonError("Invalid ID", 400);
  }

  const { error } = await supabase.from("diary_entries").delete().eq("id", entryId).eq("batch_id", batchId);

  if (error) {
    return jsonError("Failed to delete diary entry", 500);
  }

  return new Response(null, { status: 204 });
};
