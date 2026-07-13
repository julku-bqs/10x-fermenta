<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Test-Plan Refresh — Add Playwright E2E Coverage (Risks #2, #3, #7)

- **Plan**: context/changes/test-plan-refresh-2026-07-11/plan.md
- **Scope**: Phase 1 + Phase 2 of 2 (full plan — all Progress boxes `[x]`)
- **Date**: 2026-07-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

All 7 coordinated edits to `test-plan.md` match their contracts, verified against the current file:

- §2 risk-map row #7 generalized to ingredient order (L51) + Source cites `ingredients-drag-reorder`; guidance rows #2/#3/#7 each carry a consequence-focused e2e clause (L58/L59/L63). Risk #3 states the true preserve/rebuild semantics ("user-added entries survive, auto entries deleted and rebuilt, list stays in date order"); #7 asserts the persistence consequence with **no** native-dialog claim — matching the corrected research.
- §3 Phase 5 `E2E UI-wiring coverage` present with Status exactly `not started` + `—` (L77); Phase 3 `testing-access-control` hunk untouched (L75).
- §4 e2e row → `Playwright | 1.61.1` (L90); Vitest → `4.1.10` (L88); browser grounding re-dated `2026-07-11` (L97), other grounding lines left at `2026-06-20`; preamble keeps the true "No AI-native tools" statement (L81-84).
- §5 gate `e2e on critical flows | CI on PR | required after §3 Phase 5` (L112).
- §6 `6.4 Adding an e2e test` is prose-only, no test-code block (L230-240); old notes renumbered to `6.5` (L242).
- §7 reframed (L251 nuanced, L254 pixel/visual-regression stays out); §8 Strategy + Stack dates `2026-07-11` (L258-259).

Automated success criteria all pass: `npx prettier --check` clean; `deliberately excluded` now only on the Accessibility row; section order §1→§8 intact; no code/emoji/anchor added inside §2. Guardrails held: no specs authored, Phase 3 WIP hunk untouched, and `.github/copilot-instructions.md` is in **none** of the three commits (it landed later as its own commit `5aefcfd`).

## Findings

### F1 — Docs-commit scope claim understates the actual (correct) scope

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/test-plan-refresh-2026-07-11/plan.md:262, 326 (Contract #8 + Progress 2.6)
- **Detail**: Plan Contract #8 (L246-247) and Automated Verification 2.6 (L326) both assert the docs commit scope is exactly `test-plan.md` + `change.md` + `research.md` (3 files), and 2.6 is checked `[x]`. The actual docs commit `5c77361` contains **5 files** — it also includes `plan.md` and `plan-brief.md`. Nothing planned is missing (the 3 stated files are all present); the two extra files are legitimate change-folder artifacts that _should_ be version-controlled, so the actual scope is arguably better than the plan's literal criterion. The gap is that the checkbox/contract text is stale, not that the commit is wrong — a letter-vs-spirit mismatch (the spirit "excludes scaffolding + copilot-instructions.md" was fully satisfied).
- **Fix**: Correct the plan record — reword Contract #8 and criterion 2.6 to "the change folder docs (test-plan.md + change.md + research.md + plan.md + plan-brief.md), excluding scaffolding and copilot-instructions.md". Do not rewrite git history; the commit is correct as-is.
- **Decision**: FIXED — reworded Contract #8 (L247), Automated Verification bullet (L262-263), and Progress 2.6 (L326) to name the full change-folder doc set and the exclusion spirit.

### F2 — `vitest.config.ts` (and the epilogue commit) are extra vs. the plan's Phase 1 file list

- **Severity**: 🔷 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: commit 51382e2 (scaffolding); commit 368f267 (epilogue)
- **Detail**: The Phase 1 scaffolding commit `51382e2` contains **10 files**, including `vitest.config.ts` — which is not in Contract #1's enumerated paths (criterion 1.1 references "the 8 scaffolding paths"). The edit narrows Vitest's collection to exclude `tests/e2e/**` so `npx vitest run` doesn't try to execute Playwright specs — a necessary, correct change without which the two runners would collide. Separately, the epilogue commit `368f267` (SHA write-back into Progress rows + `change.md` status flip) is an extra commit the plan's two-commit narrative didn't enumerate; it is mandated by the 10x-implement closeout ritual. Both extras are benign and justified.
- **Fix**: No code change needed. Optionally note in Contract #1 that `vitest.config.ts` rides along to de-conflict the two runners, and that a closeout/epilogue commit follows Phase 2.
- **Decision**: SKIPPED — benign and justified; plan record left as-is.

## Notes (no finding)

- **change.md terminal status**: Contract #8 (L245) describes the flow as `planned → implementing → complete`, but the actual terminal value is `implemented` — which is what the 10x-implement skill mandates for this repo; "complete" was loose wording in the plan. No action (this review advances it to `impl_reviewed`).
- **Risk #3 guidance is intentionally simplified**: the strategy-doc row (L59) says "auto entries deleted and rebuilt" without the auto→user promotion nuance (a user-edited auto entry is promoted and survives). Per the plan's explicit design (guidance = 1-2 lines; oracles deferred to research.md), the full nuance correctly lives in `change.md`/`research.md`, not the strategy doc.
