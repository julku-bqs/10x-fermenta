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
  const result = ReviewSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Model JSON did not match the review schema (${issues}).\nRaw response:\n${raw.slice(0, 800)}`,
    );
  }
  return result.data;
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
