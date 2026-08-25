## Overall concept

- GHA workflow run for every new pull request to main
- composite action for the review itself so that main workflow is easy to reason about

## Input parameters

- pull request title
- pull request description (?? cost tradeoff)
- git diff

## Code Review Criteria

> The review runs on the unified diff (read-only, tools disabled). Criteria are
> chosen so the agent spends its budget on what **ESLint (type-checked) +
> Prettier + `tsc` in CI cannot catch** — the winemaking math, the data
> contracts, and tenant isolation. Convention/idiom nits and architectural fit
> are deliberately left to lint/tsc (idioms) and to a future context-aware pass
> (architecture — still parked below).

### Scoring scale

Drop the 1–10 scale — it is false precision (no anchored rubric, drifts between
runs, hard to gate) and re-encodes what the existing per-finding `severity`
(`blocker | high | medium | low`) already carries.

Keep `severity` as-is and **add a single `criterion` tag to each finding** (which
of the five criteria it belongs to). That is the only new thing asked of the
model. There is no per-criterion status object and no criteria array on the root:
the overall verdict is derived deterministically in code straight from the
findings' severities (see [Scoring & gating](#scoring--gating-proposed-schema-change--draft-to-iterate)).

### The five criteria (each finding is tagged with exactly one)

| Key                  | Criterion                              | One-line scope                                                                                                                                                                                 |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `correctness`        | Correctness & robustness               | Logic errors, broken edge cases, and missing/incorrect error handling in the changed code and its direct impact.                                                                               |
| `domain_integrity`   | Domain calculation & rule integrity    | Winemaking math is right — sugar aggregation and kg↔g unit conversion, residual-sugar handling, ABV/yeast-tolerance & sweetness validation thresholds, and dry vs non-dry plan-step selection. |
| `input_contract`     | Input validation & API contract safety | API handlers validate request input with zod before any DB write, reject out-of-range/malformed data, and keep DTO/API contracts backward-compatible.                                          |
| `security_isolation` | Security & per-user data isolation     | Ownership/authz checks and RLS keep one user's batches invisible to another (no IDOR), input is handled safely, and no secrets leak into code or logs.                                         |
| `data_migration`     | Data & migration safety                | Supabase migrations are non-destructive and correctly ordered, new tables ship with granular RLS policies, and schema/enum changes don't corrupt existing rows or persisted batch state.       |

**How these relate to the original four:** `correctness` keeps #1 and folds in
#4 (error handling/edge cases); the original #2 (security) is sharpened into
`security_isolation` with the project's real threat — IDOR/RLS tenant leakage;
the original #3 (data-loss/breaking-change) becomes `data_migration`. The two
**new** criteria — `domain_integrity` and `input_contract` — are the project's
top-ranked risks (sugar math, unit conversion, zod-at-the-API) that the generic
prompt didn't name.

The criteria and their one-line descriptions belong in the **system prompt** so
the model classifies each finding into exactly one. The prompt should also grow
the `summary` guidance from "1–2 sentences on overall risk" to **3–4 sentences**:
the overall risk plus a short rationale referencing the criteria that drove the
findings.

## Scoring & gating (proposed schema change — draft to iterate)

Goal: from the findings the model returns, derive **one overall verdict** the
workflow gates on (labels `ai-cr:passed` / `ai-cr:failed`).

**Split of responsibility:** the _model_ only emits findings — each now tagged
with a `criterion` — plus the richer `summary`. The _code_ derives the verdict
deterministically from the findings' severities. Nothing beyond the `criterion`
tag is asked of the model.

Proposed additions to [`review.ts`](../../../packages/code-reviewer/src/schemas/review.ts):

```ts
// 1. New: the criterion vocabulary (model classifies each finding into one)
export const CriterionKeySchema = z.enum([
  "correctness",
  "domain_integrity",
  "input_contract",
  "security_isolation",
  "data_migration",
]);

// 2. Change: each finding gains a `criterion` — everything else pre-existing
export const FindingSchema = z.object({
  criterion: CriterionKeySchema, // NEW
  severity: SeveritySchema, // pre-existing
  filePath: z.string(), // pre-existing
  lineNumber: z.string().nullable(), // pre-existing
  message: z.string(), // pre-existing
});

// 3. New: the gateable verdict — derived in code, NOT emitted by the model
export const VerdictSchema = z.object({
  decision: z.enum(["approved", "flagged", "blocked"]),
  pass: z.boolean(), // the single boolean the GHA job keys off
});

// ReviewSchema keeps its shape (summary, findings[], nitpicks[]); findings now
// carry `criterion`. The verdict is attached in post-processing, not by the model.
```

**Deterministic derivation (code, not model).** Map each finding's severity to a
verdict and keep the worst seen:

- `blocker`, `high` → `blocked`
- `medium` → `flagged`
- `low` → `approved`

Algorithm: start at `approved` (also the result for an empty findings list);
iterate the findings; short-circuit to `blocked` on the first `blocker`/`high`;
otherwise upgrade to `flagged` if any `medium` is seen; else stay
`approved`. Then `pass = decision !== "blocked"`.

**Where this runs — needs its own layer.** Today each `ReviewAgent` returns the
model's parsed JSON straight to the caller. The severity→verdict scoring is
cross-cutting and must NOT live inside each reviewer implementation (that would
duplicate it across every backend). It belongs in a **shared, backend-agnostic
post-processing seam** applied to every reviewer's raw result — e.g. a base class
using the template-method pattern, a decorator, or a pipeline wrapping
`review()`. The exact mechanism is intentionally deferred to
research/planning/implementation; this doc only records that the seam must exist.

## Parked for later

- business alignment (require broader context)
- architectural fit (require broader context)
- convention/idiom adherence — already enforced by ESLint (type-checked) +
  Prettier + `tsc` in CI; revisit only if lint gaps appear
- configurable gate policy — make `flagged` (medium-severity) blocking vs.
  non-blocking a config knob; default today is **non-blocking**

## Expected side-effects

- PR comment with summary
- labels: `ai-cr:failed` (red) OR `ai-cr:passed` (green)

## Expected behavior

- on-demand retry when label `ai-cr:review` is added
