---
project: "Fermenta"
context_type: greenfield
created: 2026-05-24
updated: 2026-05-24
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "Workflow friction + data trapped in paper/notes"
    - topic: "insight"
      decision: "No existing tool combines calculation + validation + process diary for home winemakers"
    - topic: "persona scope"
      decision: "Hobbyist niche — home winemakers making small batches"
    - topic: "auth strategy"
      decision: "Login (email+password / OAuth); flat user model — each user sees only own batches"
    - topic: "MVP scope"
      decision: "Batch creation → params → calculation → validation → generated process entries → editable diary. No separate final result."
    - topic: "diary = process steps"
      decision: "Generated process steps and user diary entries are the same structure — one unified list of entries"
    - topic: "final result"
      decision: "Deferred to v2; a diary entry can serve that purpose for now"
    - topic: "product type"
      decision: "Web app"
    - topic: "target scale"
      decision: "Small (just me or a handful)"
    - topic: "timeline"
      decision: "Hard deadline 2026-07-05; after-hours only; MVP ~3 weeks"
  frs_drafted: 11
  quality_check_status: accepted
---

## Vision & Problem Statement

A home winemaker planning a new batch today splits their work between a paper form, mental math, and scattered notes. Information gets lost between sessions — sugar calculations are re-done from scratch, process decisions are forgotten, and there's no single place to check whether the plan is internally consistent before starting fermentation.

Fermenta's insight: no existing tool combines sugar/alcohol calculation, plan validation (e.g., yeast tolerance checks), and a structured process diary in one flow designed specifically for the home winemaker's workflow. Spreadsheets can calculate but don't validate or guide; note apps store text but don't compute. The gap is the integration of these three capabilities into one purpose-built tool.

## User & Persona

**Primary persona**: a hobbyist home winemaker working in small scale (5–30 liters per batch, personal use). They follow their own recipes or adapt ones found online, use a paper form or loose notes to track parameters, and want structured support without being told how to make wine. They value control over their own process and want a tool that helps them stay organized, not one that prescribes a single correct method.

## Access Control

Login-based access (email + password or OAuth). Flat user model — every authenticated user is equal. Each user sees only their own batches. No admin role, no sharing, no public content in MVP. Unauthenticated users cannot access any data or functionality beyond the login/registration page.

## Success Criteria

### Primary
- A user can create a batch, enter parameters and ingredients, see a correct sugar calculation, receive validation warnings, and get a generated process plan they can edit.

### Secondary
- The generated process draft is useful enough that users keep at least some of the suggested steps (rather than deleting all and writing from scratch).

### Guardrails
- Sugar calculation must be mathematically correct — wrong math destroys user trust immediately.
- Validation warnings are soft (inform, not block) — the user always retains control to proceed despite warnings.

### Timeline
- MVP target: ~3 weeks of after-hours work.
- Scope: batch creation through editable process plan. Diary entries and generated process steps share one unified structure. "Final result" recording deferred to v2.

## Functional Requirements

### Authentication
- FR-001: User can create an account (email + password or OAuth). Priority: must-have
  > Socrates: Counter-argument considered: "Account creation is friction for a solo hobby tool; local-first skips it entirely." Resolution: kept; multi-user community + device independence justify auth.
- FR-002: User can log in and access their own batches. Priority: must-have
  > Socrates: Same as FR-001. Resolution: kept; device-independent access required.

### Batch management
- FR-003: User can create a new batch (name, date, process type). Priority: must-have
  > Socrates: Counter-argument considered: "Process type is premature classification upfront." Resolution: kept; users know type upfront because it's defined by ingredient type (pulp vs. must).
- FR-004: User can set batch parameters (target volume, target ABV, planned sweetness). Priority: must-have
  > Socrates: Counter-argument considered: "Planned sweetness is ambiguous for beginners." Resolution: kept; sweetness is required (dry to sweet with semi- stages), default preset to dry.
- FR-005: User can optionally add yeast to a batch (name + alcohol tolerance). Priority: must-have
  > Socrates: Counter-argument considered: "Wild fermenters can't use the app if yeast is mandatory." Resolution: revised — yeast is optional; tolerance validation is skipped when yeast is not set.
- FR-006: User can add ingredients to a batch (name + amount + sugar content per unit). Priority: must-have
  > Socrates: Counter-argument considered: "Sugar content per unit is expert knowledge; beginners may not know it." Resolution: kept; manual input for MVP, reference database deferred to v2.
- FR-007: User can view a list of their batches (name + date). Priority: must-have
  > Socrates: Counter-argument considered: "A plain list without status is low-value." Resolution: kept; simple list with name + date is sufficient for MVP.

### Calculation & validation
- FR-008: User can see calculated missing sugar needed to reach target ABV, with a disclaimer that results depend on input accuracy. Priority: must-have
  > Socrates: Counter-argument considered: "Calculation is only as good as user inputs — confidently wrong results are dangerous." Resolution: kept with disclaimer; user is responsible for input accuracy.
- FR-009: User can see validation warnings when the plan is inconsistent. Priority: must-have
  > Socrates: Counter-argument considered: "One validation rule feels incomplete and arbitrary." Resolution: enriched — three rules in MVP: (1) warning if target ABV > yeast tolerance, (2) warning if target ABV ≈ yeast tolerance, (3) if sweetness plan is post-fermentation sweetening, auto-add stabilize + sweeten steps to plan draft.

### Process plan
- FR-010: User can receive a generated process plan based on process type (two templates: pulp + juice/must) with parameter-driven steps. Priority: must-have
  > Socrates: Counter-argument considered: "Generic plans get deleted immediately if they don't match practice." Resolution: kept; two specific templates driven by batch parameters should produce relevant starting points.
- FR-011: User can edit, add, and remove entries in the process plan. Priority: must-have
  > Socrates: Counter-argument considered: same as FR-010. Resolution: kept; editability ensures the user can adapt any template to their real practice.

## User Stories

### US-01: User plans a new wine batch

- **Given** a logged-in user on the batch creation screen
- **When** they enter batch parameters (volume, target ABV, sweetness, process type), add yeast with tolerance, and add ingredients with sugar content
- **Then** the app shows: calculated missing sugar, any validation warnings, and a generated process plan they can edit

#### Acceptance Criteria
- Sugar calculation reflects all entered ingredients' sugar content
- If target ABV exceeds yeast tolerance, a warning is shown (not a blocker)
- Generated process steps are editable (add, edit, remove)
- The batch appears in the user's batch list after creation

## Business Logic

Fermenta calculates the missing sugar for target ABV, validates plan consistency against yeast tolerance, and generates a process plan — three capabilities a notes file or spreadsheet cannot deliver together.

**Inputs**: target volume, target ABV, planned sweetness, ingredients with sugar content per unit, yeast with alcohol tolerance (optional), and process type (pulp / juice-must).

**Output**: a calculated sugar deficit (grams of sugar to add), validation warnings (ABV exceeds tolerance; ABV near tolerance — risky; sweetness strategy implies additional process steps), and a generated set of process entries adapted to the specific batch's type and parameters.

**How the user encounters it**: after entering parameters and ingredients, the calculation and warnings appear immediately. When the user triggers process generation, the app produces a draft plan of steps they can edit, reorder, or delete. The entire flow is advisory — the user retains full control and may override or ignore any output.

## Non-Functional Requirements

- Calculation responds to the user within 1 second of parameter input — no perceptible delay.
- Every field and output is editable or optional — the app never forces the user to commit to a value they did not choose.
- The calculation is an estimate based on user-provided inputs; its accuracy is the user's responsibility. The app must communicate this clearly.
- One user's batch data is never visible to another user.

## Non-Goals

- No reference database of ingredients or yeast (sugar content lookup) — users provide values manually; a lookup table is a v2 convenience feature, not core value.
- No batch comparison or statistics across multiple batches — MVP serves one batch at a time; cross-batch analysis is future scope.
- No sharing recipes or batches between users — MVP is single-user-focused (each user owns their own data privately); social features are out of scope.

## Open Questions

(None — all elements captured during shaping.)

## Quality cross-check

All elements present:
- Access Control: ✓
- Business Logic (one-sentence rule): ✓
- Project artifacts: ✓
- Timeline-cost acknowledged: ✓
- Non-Goals: ✓
- Preserved behavior: n/a (greenfield)

Status: accepted (no gaps).

## Forward: product-framing

- product_type: web-app
- target_scale: { users: small }
- timeline_budget: { mvp_weeks: 3, hard_deadline: 2026-07-05, after_hours_only: true }
