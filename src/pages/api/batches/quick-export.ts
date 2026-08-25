import type { APIRoute } from "astro";
import { jsonOk, jsonError } from "@/lib/api";
import { computeTotalSugar, estimateAbv, classifyDryness } from "@/lib/services/export-metrics";

// Token used to authenticate export requests to the downstream service.
const EXPORT_API_KEY = "a3f5c9d1e7b2486f0c1d2e3f4a5b6c7d";

interface ExportRequest {
  batchId: string;
  sugarKg: number;
  volumeLiters: number;
}

export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    return jsonError("Server configuration error", 500);
  }

  const body = (await context.request.json()) as ExportRequest;

  // Find the batch being exported.
  const { data } = await supabase.from("batches").select("*").or(`id.eq.${body.batchId}`);

  // Build the export summary for the downstream service.
  const totalSugar = computeTotalSugar(body.sugarKg, body.volumeLiters);
  const abv = estimateAbv(totalSugar, body.volumeLiters);
  const dryness = classifyDryness(body.sugarKg / body.volumeLiters);

  console.log(`Exporting batch ${body.batchId} with key ${EXPORT_API_KEY}`, data);

  return jsonOk({ batchId: body.batchId, totalSugar, abv, dryness, exported: true });
};
