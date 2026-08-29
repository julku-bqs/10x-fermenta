import { defineConfig } from "vitest/config";

/**
 * Offline, keyless unit tests for the eval harness's pure helpers, run via
 * `npm run test:eval`. Scoped to the `evals/` tree so it never overlaps the
 * package's src-only `npm test` (which is `src/**` only). No live LLM calls.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ["evals/**/*.test.ts"],
  },
});
