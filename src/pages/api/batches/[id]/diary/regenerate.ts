import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { generateProcessPlan } from "@/lib/services/process-plan-generation";
import { jsonOk, jsonError } from "@/lib/api";
import type { Batch } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase || !context.locals.user) {
    return jsonError("Server configuration error", 500);
  }

  const batchId = context.params.id;
  if (!batchId || !UUID_REGEX.test(batchId)) {
    return jsonError("Invalid batch ID", 400);
  }

  // Fetch current batch parameters
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data: batch, error: batchError } = await supabase.from("batches").select("*").eq("id", batchId).single();

  if (batchError || !batch) {
    return jsonError("Batch not found", 404);
  }

  const typedBatch = batch as Batch;
  const entries = generateProcessPlan({ batch: typedBatch });

  // Call the atomic regenerate function
  const { error: rpcError } = await supabase.rpc("regenerate_diary_entries", {
    p_batch_id: batchId,
    p_entries: entries,
  });

  if (rpcError) {
    return jsonError("Failed to regenerate diary entries", 500);
  }

  // Return the updated list
  const { data: allEntries, error: fetchError } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("batch_id", batchId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (fetchError) {
    return jsonError("Failed to fetch diary entries after regeneration", 500);
  }

  return jsonOk(allEntries);
};
