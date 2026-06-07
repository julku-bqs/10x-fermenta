# Implementation Review — Batch Management

## Functional

### 1. Dirty State Behaviour

**Context:** Not part of the original plan, but acceptable once implemented. However it doesn't always behave correctly.

**Issue:** The "leave page" warning fires after clicking **Create Batch**, which is wrong. Creating a batch is a commit action — it persists a new entry, so it should clear dirty state, not trigger a warning.

**Expected behaviour:**
- Warning should fire on: cancel, browser back, navigation away
- Warning should **not** fire on: clicking "Create Batch" (treat as a save/commit that resolves dirty state)

---

### 2. Yeast Remove / Reset

**Issue 1:** Yeast has no remove option, unlike other ingredient cards.

**Issue 2:** The remove button, once added, should **not** remove the card entirely — it should reset yeast to its initial "add yeast" state. Removing a card is inconsistent with how other ingredient resets work.

**Issue 3:** Clearing all yeast field values causes the Update button to disappear. The Update button visibility should not depend on yeast values being present.

---

### 3. Fermentation Sugar Visibility

**Plan requirement:** Fermentation sugar should always be visible.

**Issue:** Sugar ingredients are only injected after the Calculate button is clicked. Calculate is a compute action — it should not be responsible for adding UI elements.

**Expected behaviour:**
- **Fermentation sugar** — always present in the form
- **Sweetness sugar** — present only for non-dry wines
- **Calculate** — computes values only; it does not add or remove ingredient rows

---

### 4. Validation Warnings — Trigger Timing

**Current behaviour:** Warnings appear only on `onBlur`. This matches the plan.

**Gap:** Warnings are not shown when opening an existing batch view. A batch that was previously saved with invalid or borderline values should surface relevant warnings immediately on load, without requiring the user to focus and blur a field.

---

### 5. Missing Validation Rule — Sugar / ABV Ceiling

**Rule:** If ingredient sugar + fermentation sugar combined would push ABV above the target, a warning must fire.

**Edge case:** If yeast tolerance is ≤ target ABV, excess sugar cannot push ABV beyond the tolerance ceiling — so the "exceeds target ABV" warning would not apply. However, other warnings still may apply (e.g. sugar level inappropriate for the selected sweetness profile). The rule must correctly distinguish these two scenarios and not suppress unrelated warnings.

---

## Non-Functional

### 1. Critical — No Single Calculation Source of Truth

**Issue:** Validation rules recalculate primitives independently. For example, `sugarNeededForAbvGrams` is computed inline within validation logic rather than consumed from a shared calculation result. This creates drift risk: validation may operate on values inconsistent with what the UI presents.

**Required approach:**

1. Calculation runs once over the full batch (all parameters + ingredients)
2. The result object is passed into validation
3. Validation consumes calculation output — it never re-derives primitives itself

**Edge case to handle:** The user may not have clicked Calculate yet (e.g. they typed values but skipped it). Validation must still operate on *some* calculated result. The solution is to run calculation eagerly as an internal step before validation — not to inline calculation logic inside individual rules.

**Constraint:** Validation must never own calculation. It receives output; it does not produce it.

---

### 2. `validateBatch` Design — Replace with Rule Objects

**Issue:** `validateBatch` is a long, condition-branching method. Control flow is implicit, maintenance is high, and adding or removing rules requires modifying a central function. This is not acceptable for a domain with growing validation complexity.

**Required design:**

Each validation rule is its own domain object implementing a common interface, roughly:

```
interface ValidationRule {
  isApplicable(batch: Batch, calc: CalcResult): boolean
  validate(batch: Batch, calc: CalcResult): Warning | null
}
```

`validateBatch` becomes an orchestrator only:

```
function validateBatch(batch, calc):
  return rules
    .filter(rule => rule.isApplicable(batch, calc))
    .map(rule => rule.validate(batch, calc))
    .filter(warning => warning !== null)
```

Each rule is responsible for:
- Determining whether it applies to the given batch state
- Returning a warning if the condition is violated, or null if not

Rules that are not applicable produce no output and are skipped silently.

**Design pattern confirmation request:** Before implementing, the model should name the design pattern this describes and either accept it or propose a better-suited alternative with justification.
