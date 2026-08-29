import { writeFileSync } from "node:fs";

import { z } from "zod";

import { ReviewResultSchema } from "../src/schemas/review.js";

/**
 * Regenerates `fixtures/review-result.schema.json`, the structural JSON Schema
 * the `is-json` hard assertion validates provider output against.
 *
 * Run from the package root whenever `ReviewResultSchema` changes:
 *   npx tsx evals/gen-schema.ts
 *
 * The options are load-bearing:
 * - `target: "draft-7"` — promptfoo validates `is-json` with the DEFAULT Ajv
 *   build, which only knows draft-07; a draft-2020-12 `$schema` makes Ajv throw
 *   "no schema with key or ref .../2020-12/schema".
 * - `io: "output"` — describe the SERIALIZED result the provider emits
 *   (post-coerce), not the agent's input shape.
 * - `unrepresentable: "any"` — tolerate zod constructs (e.g. `.catch()`) that
 *   have no JSON Schema equivalent instead of throwing.
 */
const schema = z.toJSONSchema(ReviewResultSchema, {
  target: "draft-7",
  io: "output",
  unrepresentable: "any",
});

const outUrl = new URL("./fixtures/review-result.schema.json", import.meta.url);
writeFileSync(outUrl, JSON.stringify(schema, null, 2) + "\n");
console.log(`Wrote ${outUrl.pathname}`);
