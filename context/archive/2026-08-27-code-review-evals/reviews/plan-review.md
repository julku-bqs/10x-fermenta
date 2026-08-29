<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Code Review Evals (promptfoo) — Second Pass

- **Plan**: context/changes/code-review-evals/plan.md
- **Mode**: Deep
- **Date**: 2026-08-29
- **Verdict**: SOUND (after 2nd-pass triage — all 3 findings fixed; this pass opened at REVISE)
- **Findings (this pass)**: 1 critical, 2 warnings, 0 observations

## Verdicts (this pass, pre-fix)

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | FAIL    |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

11/11 paths ✓, symbols ✓ (`createReviewAgent`, `deriveVerdict`, `buildReviewPrompt`, `REVIEW_SYSTEM_PROMPT`, `aiCredits = nanoAiu/1e9`), default branch = `main` ✓ (plan's `git diff main...` is correct), fixture = 3 files / 83 insertions ✓ (matches ground-truth ledger), zod v4 ✓ (`z.toJSONSchema` valid), `tsx` devDep present ✓, brief↔plan↔research ✓. Deep verification: promptfoo source (5 runtime behaviors, current main) + a `tsc 6.0.3` `rootDir` reproduction.

## Findings

### F1 — Split-gate is broken: `threshold: 0` can't override a grader `pass: false`

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real correctness stakes; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Critical Implementation Details (split-gate bullet); Phase 3 §1 (grader contract) & §4 (threshold wiring); Desired End State (Key Discoveries); SC 3.4 / 3.7
- **Detail**: Verified against promptfoo source (`src/matchers/rubric.ts`, current main): an `llm-rubric` result is `pass = (grader.pass ?? true) && score >= threshold` — a logical AND. So a grader returning `pass: false` fails the assertion regardless of `threshold: 0`. The plan's grader (Phase 3 §1) had the model emit `pass`, and promptfoo's default rubric prompt asks the judge for a pass boolean → a weak model that misses bugs yields `pass: false` → a RED rubric cell instead of a low score. This conflates "failed a hard bar" with "found fewer bugs" and can flip a model that correctly blocked the PR into an overall FAIL — defeating the core model-comparison purpose. SC 3.4's grep for `threshold: 0` passes while the semantic guarantee is false (false green).
- **Fix A ⭐ Recommended**: Custom grader always returns explicit `pass: true` (score/`weighted_coverage` is the sole signal); parse-failure path also returns `pass: true, score: 0`; keep `threshold: 0` as belt-and-suspenders. Correct the "threshold:0 = non-gating" framing in Critical Impl Details, Phase 3 §1/§4, Key Discoveries, and SC 3.4.
  - Strength: Explicit + self-documenting; robust even if promptfoo changes its `parsed.pass ?? true` default; source-verified (Q1 + Q5).
  - Tradeoff: A hardcoded `pass: true` reads oddly without the comment; the real signal lives only in score/derived metric.
  - Confidence: HIGH — decisive promptfoo source (`pass = (parsed.pass ?? true) && score >= threshold`).
  - Blind spot: Grader's JSON-parse-failure path must also return `pass: true` or a malformed judge reply re-introduces a red.
- **Fix B**: Grader returns only `{ score, reason }` (omit `pass`); rely on promptfoo's `parsed.pass ?? true` default + `threshold: 0`.
  - Strength: Minimal grader output.
  - Tradeoff: Silently depends on the library default — a future change to that default would make rubrics gate again.
  - Confidence: HIGH — source-verified (Q5).
  - Blind spot: Same defensive-parse caveat.
- **Decision**: FIXED via Fix A (grader hardcodes `pass: true` incl. on parse failure; corrected the split-gate framing across Critical Impl Details, Phase 3 §1/§4, Key Discoveries, SC 3.4, Progress 3.4).

### F2 — `evals/tsconfig.json` `rootDir: "."` still fails `TS6059` (review 1's F4 fix is incomplete)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §2 (evals/tsconfig.json contract); typecheck gate SC 1.5 / 2.1 / 3.1 / 4.2
- **Detail**: The provider must `import … from "../../src/index.js"` (outside `evals/`). Reproduced with the package's real `tsc 6.0.3`: `rootDir: "."` → `TS6059: '…/src/index.ts' is not under rootDir '…/evals'` (exit 2); `rootDir: ".."` → exit 0; omitting `rootDir` → `TS6059` (the base's `rootDir: "src"` is inherited via `extends`). So the typecheck gate passes in Phase 1 (no src import yet) and breaks in Phases 2–4 once the provider lands. The plan's parenthetical "(e.g. `"."` or omit it)" offered two options that both fail.
- **Fix**: Set `rootDir: ".."` (package root) so it contains both `evals/` and the imported `src/`. Keep `noEmit` / `declaration: false` / `sourceMap: false`. Update Phase 1 §2 and drop the "or omit it" suggestion.
- **Decision**: FIXED (Phase 1 §2 now specifies `rootDir: ".."` with the empirical rationale and explicitly rules out the two failing alternatives).

### F3 — `promptfoo validate` on a `.ts` config with a function-valued metric is unverified (still-open blind spot from review 1)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: SC 1.3 / 2.3 / 3.3 (`npx promptfoo validate -c …ts`); Phase 1 §1 / §4
- **Detail**: TS config _loading_ is confirmed sound (promptfoo uses the `tsx` loader — already a devDep — and does not JSON-round-trip JS/TS configs, so the `derivedMetrics[].value` function survives at eval time). But the `validate` subcommand's behavior on a `.ts` config carrying a function value is not confirmed from source (Q4c UNCERTAIN) — Zod validation of a function-typed field may warn or non-zero-exit. `validate` is a hard automated gate in three phases, yet only Phase 1 listed a fallback. Review 1's F1-fix note explicitly flagged this as unresolved.
- **Fix**: In Phase 1, empirically confirm `promptfoo validate -c evals/promptfooconfig.ts` exits 0 on the TS config with the function metric. If it warns/errors, switch the SC 1.3/2.3/3.3 gate to a load-smoke check that exercises the module (`promptfoo eval -c …ts --help`), used uniformly in all three phases.
- **Decision**: FIXED (Phase 1 §4 now defines a single "config-check gate" with the empirical Phase-1 verification and a uniform fallback; SC + Progress 1.3/2.3/3.3 reworded to reference it).

---

## Prior review (first pass) — 2026-08-28, superseded

First pass opened at REVISE and closed SOUND after triage; all 6 findings were fixed and are reflected in the current plan. Compact record:

| ID  | Severity       | Title                                                                        | Decision                                                                        |
| --- | -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| F1  | ❌ CRITICAL    | `derivedMetrics` `file://` won't load `coverage.ts` (headline metric broken) | FIXED via Fix B (YAML→`promptfooconfig.ts`, function-form `derivedMetrics`)     |
| F2  | ❌ CRITICAL    | Progress-format: body Success Criteria used `- [ ]` checkboxes               | FIXED (stripped `[ ]` from all phase-body criteria)                             |
| F3  | ⚠️ WARNING     | Eval unit tests never discovered by `npm test`                               | FIXED (dedicated `evals/vitest.config.ts` + `test:eval` script)                 |
| F4  | ⚠️ WARNING     | `evals/tsconfig.json` fails its own typecheck gate (`rootDir: src`)          | FIXED (override `rootDir`) — **note: refined again this pass, see 2nd-pass F2** |
| F5  | ⚠️ WARNING     | "real USD cost" from a placeholder constant                                  | FIXED (verified `$0.01`/credit is GitHub's official rate; wired as real USD)    |
| F6  | 🟡 OBSERVATION | "statistically meaningful" aggregate over n=1 non-deterministic diff         | FIXED (reworded to "coverage summary" + n=1 caveat)                             |
