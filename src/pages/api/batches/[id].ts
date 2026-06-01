import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateBatchSchema } from "@/lib/schemas/batch";
import { jsonOk, jsonError, jsonValidationError } from "@/lib/api";

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return jsonError("Server configuration error", 500);
  }

  const id = context.params.id;
  if (!id) {
    return jsonError("Batch ID is required", 400);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.from("batches").select("*").eq("id", id).single();

  if (error || !data) {
    return jsonError("Batch not found", 404);
  }

  return jsonOk(data);
};

export const PUT: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return jsonError("Server configuration error", 500);
  }

  const id = context.params.id;
  if (!id) {
    return jsonError("Batch ID is required", 400);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const result = updateBatchSchema.safeParse(body);
  if (!result.success) {
    return jsonValidationError(result.error);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.from("batches").update(result.data).eq("id", id).select().single();

  if (error || !data) {
    return jsonError("Batch not found", 404);
  }

  return jsonOk(data);
};
