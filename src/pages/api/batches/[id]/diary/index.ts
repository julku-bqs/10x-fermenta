import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createDiaryEntrySchema } from "@/lib/schemas/diary-entry";
import { jsonOk, jsonCreated, jsonError, jsonValidationError } from "@/lib/api";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return jsonError("Server configuration error", 500);
  }

  const batchId = context.params.id;
  if (!batchId || !UUID_REGEX.test(batchId)) {
    return jsonError("Invalid batch ID", 400);
  }

  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("batch_id", batchId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return jsonError("Failed to fetch diary entries", 500);
  }

  return jsonOk(data);
};

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return jsonError("Server configuration error", 500);
  }

  const batchId = context.params.id;
  if (!batchId || !UUID_REGEX.test(batchId)) {
    return jsonError("Invalid batch ID", 400);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const result = createDiaryEntrySchema.safeParse(body);
  if (!result.success) {
    return jsonValidationError(result.error);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      batch_id: batchId,
      entry_type: "user",
      ...result.data,
      entry_date: result.data.entry_date ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) {
    return jsonError("Failed to create diary entry", 500);
  }

  return jsonCreated(data);
};
