# Test-Plan Refresh — Add Playwright E2E Coverage (Risks #2, #3, #7) Implementation Plan

## Overview

Refresh `context/foundation/test-plan.md` to reverse the "e2e deliberately excluded"
decision and register a narrow Playwright E2E layer for three risks' browser-level UI
wiring (#2 validation-warning display/dismiss, #3 diary-plan regenerate semantics,
#7 save/cancel/reload round-trip incl. ingredient drag-reorder). This edits the
**strategy document only** — actual specs are authored later, one risk at a time, via
`/10x-e2e`. The already-on-disk Playwright scaffolding is committed first (standalone)
so the refreshed doc's references resolve in git history from day 0.

## Current State Analysis

- `test-plan.md` currently encodes the exclusion in three coordinated places: §4 stack
  row `e2e | none — deliberately excluded`, §5 has no e2e gate, and §7 lists an
  "e2e browser tests — not justified" negative-space bullet. Un-excluding requires all
  three to move together or the doc self-contradicts.
- §3 Phased Rollout has 4 phases; Phase 3 is `change opened` (an unrelated in-flight
  change, `testing-access-control`) and Phase 4 `not started`.
- §4 lists Vitest `3.2`, but `package.json` pins `vitest ^4.1.10` — a stale value in a
  section this refresh already touches.
- The E2E groundwork exists **uncommitted** on branch `e2e`: `playwright.config.ts`,
  `tests/e2e/{AGENTS.md, auth.setup.ts, seed.spec.ts}`, `package.json` (`@playwright/test`
  `^1.61.1` + `test:e2e`/`test:e2e:ui` scripts), `package-lock.json`, plus e2e-supporting
  config in `.gitignore`, `.env.example`, `.vscode/settings.json`.
- `test-plan.md` is **already dirty** with two unrelated hunks from `testing-access-control`
  (the Phase 3 row → `change opened`, and the header `Last updated` → 2026-07-11). These
  must survive this refresh untouched.
- `.github/copilot-instructions.md` is separately modified (a ~112-line tooling refactor)
  and is **not** part of this change.

## Desired End State

`test-plan.md` reads coherently as "e2e is included for a narrow set of behavioral UI-wiring
assertions" across §2–§8, obeys every schema/parser constraint, and its §6 cookbook + §4
stack row point at scaffolding that already exists in git history. Two clean commits exist on
`e2e`: (1) the Playwright scaffolding, then (2) the docs refresh. No E2E spec code is added —
specs remain a `/10x-e2e` follow-up.

### Key Discoveries:

- test-plan **Risk #3 ("process plan generation produces wrong/missing steps")** is the risk
  the regenerate-diary E2E exercises _from the UI_ — it asserts regenerate **wiring** (preserve
  `user` entries, delete+rebuild `auto` entries with `completed` reset), never _which_ steps
  generate (unit's job). No risk renumbering needed. Grounded in
  `supabase/migrations/20260614130000_diary_entries_process_plan.sql:47-61` (RPC) and the
  promotion trigger (lines 29-44). See `research.md`.
- Risk #3 oracle is **DOM-only** (unique description markers + `completed` line-through styling);
  `entry_type` is not rendered (`DiarySection.tsx:226-238`). No DB assertions; seeding runs as
  the logged-in user. (research.md "Decisions".)
- Risk #7a Cancel guard is the **native browser `beforeunload`** (`BatchForm.tsx:120-137`), not a
  React modal — the doc guidance must frame #7 around the persistence _consequence_, not a dialog.
- The §3 Status column is a **fixed parser vocabulary** (`not started`, `change opened`,
  `researched`, `planned`, `implementing`, `complete`) — the new Phase 5 must use a legal value.
- §2 risk rows forbid file:line anchors / code / emoji; §6 cookbook rows may reference file paths
  (existing 6.1/6.2 do) but still no test-code blocks.

## What We're NOT Doing

- **Not** authoring any E2E specs or oracles — that is `/10x-e2e`, one risk at a time. This change
  edits the document only.
- **Not** writing or changing any test/config code beyond committing what already exists on disk.
- **Not** touching the `testing-access-control` Phase 3 hunk (or the header-date hunk), and **not**
  committing `.github/copilot-instructions.md`.
- **Not** claiming e2e covers "which warnings fire" (#2) or "which steps generate" (#3) — those stay
  unit's job; the guidance must say so.
- **Not** adding DB-level assertions, a service-role/admin seed path, pixel/visual-regression, or
  accessibility coverage (all remain out of scope / negative space).
- **Not** reordering sections, inventing §3 Status values, or auditing stack versions beyond the one
  known-stale Vitest cell.

## Implementation Approach

Two phases matching the requested commit ordering. Phase 1 is a pure git operation (files already
authored) that lands the scaffolding as its own commit. Phase 2 applies seven surgical, coordinated
edits to `test-plan.md`, then commits the docs. Every edit is a prose/table change grounded in
`research.md`; the document carries only plan-level guidance (1–2 lines per risk), never the detailed
oracles (those live in research.md and, later, the specs).

## Critical Implementation Details

- **Parser-load-bearing constraints:** keep §1→§8 order; keep every table's column structure; §3
  Status must be a value from the fixed vocabulary (use `not started` for Phase 5); no code fences,
  emoji, or file:line anchors inside §2 rows.
- **Shared-file WIP isolation:** `test-plan.md` already carries the `testing-access-control` Phase 3
  hunk + header-date hunk. Phase 2's edits are additive and must leave those bytes intact. The docs
  commit will also capture the Phase 3 hunk (both statements are true and it is "landing soon"); if
  strict isolation is wanted, stage the refresh hunks with `git add -p`.
- **Pre-commit reflow:** husky + lint-staged runs `prettier --write` on `*.md`. Run
  `npx prettier --write` on the edited docs and review the table reflow **before** committing so the
  hook does not produce a surprise reformat at commit time.
- **Coordinated flip:** §4 e2e row, §5 gate, and §7 bullet must all move in the same phase — a partial
  edit leaves the doc self-contradictory (one section says excluded, another included).

## Phase 1: Commit the E2E scaffolding

### Overview

Land the already-authored Playwright groundwork as a single standalone commit so Phase 2's doc
references resolve against committed files.

### Changes Required:

#### 1. Playwright scaffolding commit

**Files**: `playwright.config.ts`, `tests/` (`tests/e2e/AGENTS.md`, `tests/e2e/auth.setup.ts`,
`tests/e2e/seed.spec.ts`), `package.json`, `package-lock.json`, `.gitignore`, `.env.example`,
`.vscode/settings.json`

**Intent**: Commit the inert Playwright config, seed/auth specs, dependency + scripts, and
e2e-supporting ignores/env/settings as one commit, so the refreshed test-plan doc points at files
that already exist in git history.

**Contract**: Exactly those paths staged into one commit (e.g. message
`chore(test): add Playwright e2e scaffolding`). `.github/copilot-instructions.md` and
`context/foundation/test-plan.md` (and any other unrelated dirty files) are **excluded** from this
commit. The `@playwright/test` dep, `dotenv` dep, and `test:e2e`/`test:e2e:ui` scripts land here.

### Success Criteria:

#### Automated Verification:

- Commit contains exactly the intended paths and nothing else: `git show --stat HEAD` lists the 8
  scaffolding paths and does **not** include `.github/copilot-instructions.md` or `test-plan.md`.
- Playwright config resolves and specs enumerate: `npx playwright test --list`.
- The npm script is wired: `npm run test:e2e -- --list`.

#### Manual Verification:

- Human confirms this is the intended first commit and the message reads well.

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding to Phase 2.

---

## Phase 2: Refresh test-plan.md + advance change.md

### Overview

Apply the seven coordinated section edits that un-exclude e2e and register the rollout phase, then
commit the docs (`test-plan.md` + `change.md` + `research.md`) as the second commit.

### Changes Required:

#### 1. §2 Risk Map + Risk Response Guidance

**File**: `context/foundation/test-plan.md`

**Intent**: Broaden risk #7 to include ingredient order, and add the e2e layer + what-it-proves to
guidance rows #2/#3/#7 without disturbing the unit/integration guidance those rows already carry.

**Contract**: Risk-map row **#7** text generalized from sugar-field-only to also cover ingredient
**order** (drag-reorder) round-trip; keep the number, do not renumber any risk. Guidance row **#2**:
note e2e proves the warning **is displayed** when the plan is inconsistent, **Dismiss** closes it, and
it **reappears after reload** (non-persistence) — unit still owns which/threshold. Guidance row **#3**:
note e2e proves regenerate **wiring** (user entries preserved; auto entries deleted+rebuilt with
`completed` reset; correct `entry_date` order) — unit still owns which steps generate. Guidance row
**#7**: extend to cover sugar Calculate→save→reload persistence **and** ingredient drag-reorder
(preserved-after-save / reverted-after-cancel) — integration still owns the field lifecycle. No
file:line anchors, code, or emoji in any cell.

#### 2. §3 Phased Rollout — add Phase 5

**File**: `context/foundation/test-plan.md`

**Intent**: Register the E2E UI-wiring rollout phase.

**Contract**: Append one row keeping the 7-column structure — `5 | E2E UI-wiring coverage |
<one-line goal: prove browser-level UI wiring for validation-warning display/dismiss, diary regenerate
preserve/rebuild, and save-cancel-reload round-trip incl. ingredient order> | #2, #3, #7 | e2e |
not started | —`. Leave the Phase 3 row and its `testing-access-control` folder exactly as-is. Status
uses the fixed vocabulary value `not started`.

#### 3. §4 Stack — flip e2e row, fix Vitest, refresh browser grounding

**File**: `context/foundation/test-plan.md`

**Intent**: Record Playwright as the e2e tool, correct the stale Vitest version, and re-date the
browser-grounding line.

**Contract**: e2e row `none — deliberately excluded | —` → `Playwright | 1.61.1`, Notes describing the
narrow scope (behavioral UI wiring for §3 Phase 5; config in `playwright.config.ts`; run
`npm run test:e2e`). Unit+integration row Version `3.2` → `4.1.10`. Grounding "Runtime/browser" line →
note the Playwright test runner is now in the stack (browser automation via `@playwright/test`);
`checked: 2026-07-11`. Leave Docs/Search/Provider grounding lines at `2026-06-20`. Lightly soften the
§4 preamble so "risks fully addressable at unit/integration" acknowledges the narrow e2e layer while
keeping the true "no AI-native tools" statement.

#### 4. §5 Quality Gates — add e2e gate

**File**: `context/foundation/test-plan.md`

**Intent**: Enforce e2e on critical flows once Phase 5 lands.

**Contract**: Append one row keeping the 4-column structure — `e2e on critical flows | CI on PR |
required after §3 Phase 5 | <catches: broken critical user paths — validation-warning display, diary
regenerate, save/cancel round-trip>`, matching the existing "required after §3 Phase N" convention.

#### 5. §6 Cookbook — insert 6.4 e2e recipe, renumber notes to 6.5

**File**: `context/foundation/test-plan.md`

**Intent**: Give contributors a concrete recipe for adding an e2e test, pointing at the now-committed
scaffolding.

**Contract**: Insert `### 6.4 Adding an e2e test` after existing 6.3 — prose + bullets (no test code):
location `tests/e2e/`, naming `<feature>.spec.ts`, reference `tests/e2e/AGENTS.md` (conventions),
`tests/e2e/auth.setup.ts` (storageState auth), `tests/e2e/seed.spec.ts` (create→reload→delete example);
locators `getByRole`/`getByLabel` first; Run command `npm run test:e2e` (+ `npm run test:e2e:ui`).
Renumber current `### 6.4 Per-rollout-phase notes` → `### 6.5 Per-rollout-phase notes`, body unchanged.
(Filling 6.4 now — ahead of Phase 5 shipping — is deliberate because the scaffolding is real and
committed in Phase 1.)

#### 6. §7 Negative space — reframe the e2e bullet

**File**: `context/foundation/test-plan.md`

**Intent**: e2e is no longer categorically excluded; only pixel/visual regression and accessibility
remain negative space.

**Contract**: Rewrite the `**e2e browser tests**` bullet → e2e is now included for a narrow set of
behavioral UI-wiring assertions (§3 Phase 5; risks #2/#3/#7); what stays out is pixel/visual regression
(use deterministic snapshot tools if ever needed) and broad browser coverage of non-risk flows. Nuance
the `**UI presentation layer**` bullet so rendering/pixels stay excluded while behavioral wiring is now
covered — no contradiction with §4/§5. Accessibility exclusion unchanged.

#### 7. §8 Freshness Ledger — bump dates

**File**: `context/foundation/test-plan.md`

**Intent**: Record that strategy + stack were re-reviewed for the e2e inclusion.

**Contract**: `Strategy (§1–§5) last reviewed: 2026-06-20 → 2026-07-11`; `Stack versions last verified:
2026-06-20 → 2026-07-11`. Leave "AI-native tool references: n/a" (Playwright is not AI-native). Header
`Last updated` is already 2026-07-11 — leave it.

#### 8. Advance change.md + docs commit

**Files**: `context/changes/test-plan-refresh-2026-07-11/change.md`, `research.md`, `test-plan.md`

**Intent**: Reflect implementation status and commit the documentation change.

**Contract**: `change.md` status advances per the implement flow (`planned` → `implementing` →
`complete`) with `updated: 2026-07-11`. Second commit contains `test-plan.md` + `change.md` +
`research.md` (docs only); it must not include the Phase 1 scaffolding or `copilot-instructions.md`.

### Success Criteria:

#### Automated Verification:

- e2e is un-excluded coherently: no `test-plan.md` row reads `deliberately excluded` for the **e2e**
  layer; the §4 e2e row reads `Playwright` `1.61.1`; §5 contains an `e2e on critical flows` gate;
  §7's e2e bullet no longer says "not justified/excluded".
- §3 has a Phase 5 `E2E UI-wiring coverage` row whose Status is exactly `not started` and Change folder
  is `—`; the Phase 3 row still reads `change opened` + `context/changes/testing-access-control/`.
- Vitest reads `4.1.10`; §8 shows `2026-07-11` for Strategy + Stack lines.
- §6 has `6.4 Adding an e2e test` and `6.5 Per-rollout-phase notes` (old 6.4 renumbered).
- Schema/format holds: sections still ordered §1→§8; no code fence, emoji, or file:line anchor added
  inside §2; markdown is prettier-clean: `npx prettier --check context/foundation/test-plan.md`.
- Docs commit scope is correct: `git show --stat HEAD` lists only `test-plan.md`, `change.md`,
  `research.md`.

#### Manual Verification:

- A human reads the refreshed §2–§8 and confirms the e2e framing is coherent (behavioral wiring in;
  pixel/visual + a11y out), the risk-#3 guidance states the true preserve/rebuild semantics, and #7
  reflects the persistence-consequence (not a native dialog).
- The Phase 3 WIP hunk is untouched and `copilot-instructions.md` is not in either commit.

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation.

---

## Testing Strategy

### Verification (doc change — no unit/integration tests):

- Grep/inspection assertions per the Success Criteria above (e2e row, Phase 5 row + status, Vitest
  version, §8 dates, §6 renumber, §5 gate, §7 reframe).
- `npx prettier --check context/foundation/test-plan.md` for markdown formatting.
- `git show --stat HEAD` on each commit to confirm exact file scope.
- `npx playwright test --list` (Phase 1) to confirm the committed config resolves.

### Manual Testing Steps:

1. Read the refreshed §4/§5/§7 together — confirm no "excluded vs included" contradiction remains.
2. Read the §2 guidance rows #2/#3/#7 — confirm each names what e2e proves vs what stays unit/integration.
3. Diff `test-plan.md` against HEAD — confirm the only non-refresh hunk is the pre-existing Phase 3 line.

## References

- Research (grounding + Decisions): `context/changes/test-plan-refresh-2026-07-11/research.md`
- Change identity + edit intent: `context/changes/test-plan-refresh-2026-07-11/change.md`
- Schema + fixed constraints: `.github/skills/10x-test-plan/references/test-plan-schema.md`
- Risk #3 ground truth: `supabase/migrations/20260614130000_diary_entries_process_plan.sql:29-61`
- Edit target: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Commit the E2E scaffolding

#### Automated

- [x] 1.1 Commit contains exactly the scaffolding paths (`git show --stat HEAD`), excludes copilot-instructions.md + test-plan.md — 51382e2
- [x] 1.2 Playwright config resolves + specs enumerate (`npx playwright test --list`) — 51382e2
- [x] 1.3 npm script wired (`npm run test:e2e -- --list`) — 51382e2

#### Manual

- [x] 1.4 Human confirms intended first commit + message — 51382e2

### Phase 2: Refresh test-plan.md + advance change.md

#### Automated

- [x] 2.1 e2e un-excluded coherently across §4 row / §5 gate / §7 bullet
- [x] 2.2 §3 Phase 5 row present with Status `not started` + `—`; Phase 3 hunk untouched
- [x] 2.3 Vitest `4.1.10`; §8 Strategy + Stack dates `2026-07-11`
- [x] 2.4 §6 has `6.4 Adding an e2e test` + `6.5 Per-rollout-phase notes`
- [x] 2.5 Schema/format holds (section order; no code/emoji/anchor in §2); `npx prettier --check` clean
- [ ] 2.6 Docs commit scope correct (`git show --stat HEAD` = test-plan.md + change.md + research.md)

#### Manual

- [x] 2.7 Human confirms coherent e2e framing + true risk-#3 semantics + #7 persistence-consequence
- [x] 2.8 Phase 3 WIP hunk untouched; copilot-instructions.md in neither commit
