import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createBatchSchema } from "@/lib/schemas/batch";
import { jsonOk, jsonCreated, jsonError, jsonValidationError } from "@/lib/api";

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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase
    .from("batches")
    .insert({ ...result.data, user_id: context.locals.user.id })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 500);
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
    return jsonError(error.message, 500);
  }

  return jsonOk(data);
};
