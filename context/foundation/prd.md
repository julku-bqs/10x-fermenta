---
project: "Fermenta"
version: 1
status: draft
created: 2026-05-25
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-07-05
  after_hours_only: true
---

## Vision & Problem Statement

A home winemaker planning a new batch today splits their work between a paper form, mental math, and scattered notes. Information gets lost between sessions — sugar calculations are re-done from scratch, process decisions are forgotten, and there's no single place to check whether the plan is internally consistent before starting fermentation.

No existing tool combines sugar/alcohol calculation, plan validation (e.g., yeast tolerance checks), and a structured process diary in one flow designed for the home winemaker's workflow. The only mature competitor — Fermolog — targets a more technical user with detailed tracking, charts, and social features. Fermenta is intentionally simpler: closer to a structured, validated version of the paper form and hand-written notes than to a community portal. The gap it fills is calculation + validation + process plan in one minimal tool for a less technical hobbyist.

## User & Persona

**Primary persona**: a hobbyist home winemaker working in small scale (personal use). Less technical than a typical Fermolog user — they follow their own recipes or adapt ones found online, use a paper form or loose notes to track parameters, and want structured support without being told how to make wine. They value control over their own process and want a tool that helps them stay organized, not one that prescribes a method or overwhelms with charts and social features.

## Success Criteria

### Primary
- A user can create a batch, enter parameters and ingredients, see a correct sugar calculation, receive validation warnings, and get a generated process plan they can edit.

### Secondary
- The generated process draft is useful enough that users keep at least some of the suggested steps (rather than deleting all and writing from scratch).

### Guardrails
- Sugar calculation must be mathematically correct — wrong math destroys user trust immediately.
- Validation warnings are soft (inform, not block) — the user always retains control to proceed despite warnings.

## User Stories

### US-01: User plans a new wine batch

- **Given** a logged-in user on the batch creation screen
- **When** they enter batch parameters (volume, target ABV, sweetness, process type), add yeast with tolerance, and add ingredients with sugar content
- **Then** the app shows: calculated missing sugar, any validation warnings, and a generated process plan they can edit

#### Acceptance Criteria
- Sugar calculation reflects all entered ingredients' sugar content, with separate amounts for fermentation sugar and sweetness sugar when planned sweetness is not dry
- If target ABV exceeds yeast tolerance, a warning is shown (plan is internally inconsistent)
- If target sweetness is not dry and yeast tolerance exceeds target ABV, a warning is shown (fermentation won't stop on its own)
- Generated process steps include fermentation-control and sweetening steps when applicable
- Generated process steps are editable (add, edit, remove)
- The batch appears in the user's batch list after creation

## Functional Requirements

### Authentication
- FR-001: User can create an account (email + password or OAuth). Priority: must-have
- FR-002: User can log in and access their own batches. Priority: must-have

### Batch management
- FR-003: User can create a new batch (name, date, process type). Priority: must-have
- FR-004: User can set batch parameters (target volume, target ABV, planned sweetness). Priority: must-have
- FR-005: User can optionally add yeast to a batch (name + alcohol tolerance). Priority: must-have
- FR-006: User can add ingredients to a batch (name + amount + sugar content per unit). For non-dry wines the app auto-creates separate entries for sugar_for_fermentation and sugar_for_sweetness, which the user can manually adjust. Priority: must-have
- FR-007: User can view a list of their batches (name + date). Priority: must-have

### Calculation & validation
- FR-008: User can see calculated sugar needs: for dry wines, the missing sugar for fermentation; for non-dry wines, separate amounts for fermentation sugar and sweetness sugar. Results include a disclaimer that accuracy depends on user inputs. Priority: must-have
- FR-009: User can see validation warnings when the plan is inconsistent: (1) warning if target ABV > yeast tolerance, (2) warning if target sweetness is not dry and yeast tolerance > target ABV, (3) general advisory that planned parameters are expected values, not guaranteed outcomes. Priority: must-have

### Process plan
- FR-010: User can receive a generated process plan based on process type (two templates: pulp + juice) with parameter-driven steps. For non-dry wines the draft additionally includes: sugar addition for fermentation, fermentation stop/interruption step, and sugar addition for final sweetness. Priority: must-have
- FR-011: User can edit, add, and remove entries in the process plan. Priority: must-have

## Non-Functional Requirements

- Calculation responds within 1 second of parameter input — no perceptible delay.
- Every field and output is editable or optional — the app never forces the user to commit to a value they did not choose.
- Planned ABV and planned sweetness are communicated as expected values, not guaranteed outcomes; accuracy depends on user-provided inputs.
- One user's batch data is never visible to another user.
- Auto-generated sugar entries and process steps are transparent — always visible on the ingredient list and process plan, always editable.

## Business Logic

Fermenta calculates the sugar plan for target ABV and sweetness, validates plan consistency against yeast tolerance and planned parameters, and generates a process plan that accounts for fermentation control and sweetening — three capabilities a notes file or spreadsheet cannot deliver together.

**Inputs**: target volume, target ABV, planned sweetness, ingredients with sugar content per unit, yeast with alcohol tolerance (optional), and process type (pulp / juice).

**Output**: a calculated sugar plan (for dry wines: missing fermentation sugar; for non-dry wines: separate amounts for fermentation sugar and sweetness sugar, auto-created as editable ingredient entries), validation warnings (ABV exceeds tolerance — plan inconsistent; sweetness is not dry and tolerance exceeds ABV — fermentation won't stop on its own; advisory that planned parameters are expected values), and a generated set of process entries adapted to the batch's type and parameters — including, for non-dry wines, steps for sugar addition, fermentation stop/interruption, and final sweetness correction.

**How the user encounters it**: after entering parameters and ingredients, the calculation and warnings appear immediately. Sugar entries are auto-populated as visible, editable ingredient lines. When the user triggers process generation, the app produces a draft plan of steps they can edit, reorder, or delete. The entire flow is advisory — the user retains full control.

## Access Control

Login-based access (email + password or OAuth). Flat user model — every authenticated user is equal. Each user sees only their own batches. No admin role, no sharing, no public content in MVP. Unauthenticated users cannot access any data or functionality beyond the login/registration page.

## Non-Goals

- No reference database of ingredients or yeast (sugar content lookup) — users provide values manually; a lookup table is a v2 convenience feature, not core value.
- No batch comparison or statistics across multiple batches — MVP serves one batch at a time; cross-batch analysis is future scope.
- No sharing recipes or batches between users — MVP is single-user-focused (each user owns their own data privately); social features are out of scope.
- No "final result" recording — a diary entry can serve that purpose for now; dedicated final-result capture is deferred to v2.
- No offline-first guarantee — the app requires connectivity; offline support is not an MVP target.

## Open Questions

(None — all elements captured and resolved during shaping.)
