import { ReviewSchema, type Review } from "../../schemas/review.js";

/** Extract and validate the model's JSON review from its raw text response. */
export function parseReview(raw: string): Review {
  const candidate = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error(`Model did not return valid JSON.\nRaw response:\n${raw.slice(0, 800)}`);
  }
  return ReviewSchema.parse(parsed);
}

/** Pull the JSON object out of a response that may include fences or prose. */
function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = fenced?.[1] ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}
