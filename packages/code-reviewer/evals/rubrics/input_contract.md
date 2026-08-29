# Rubric — input_contract

The `<Output>` above is a JSON `ReviewResult` produced by a code-review agent
that reviewed one deliberately-flawed PR. Judge **only** the **input_contract**
criterion: whether the review's `findings` correctly identify the seeded
request-validation gap below.

Seeded input_contract flaw the review should surface:

1. `src/pages/api/batches/quick-export.ts` never validates the request body —
   it does no zod parsing and instead casts the raw payload with
   `as ExportRequest`, so untrusted/malformed input flows straight into the
   handler (violating the project rule that API route handlers validate input
   with zod schemas).

Scoring — return a `score` in `[0, 1]`:

- **1.0** — the missing zod validation / unsafe `as ExportRequest` cast is
  clearly identified as an input-contract problem.
- **partial** — the review gestures at input handling but does not pin the
  missing validation / unchecked cast.
- **0.0** — not identified.

Only credit findings that address the input contract. Do not reward generic or
speculative comments, and do not penalize the review for issues that belong to
other criteria (they are scored separately).
