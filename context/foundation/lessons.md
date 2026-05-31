# Lessons

Recurring rules and patterns discovered during development. Treat as priors for future plans and reviews.

---

## L-01: Model measured values alongside planned values

**Context**: During F-01 schema planning, we discovered that `measured_sugar_content` (the actual sugar level in must/juice after preparation, before adding sugar or yeast) is essential for accurate sugar calculation but was missing from the original PRD and roadmap.

**Rule**: When a domain involves calculation from user inputs, always consider whether there's a *measured* counterpart to the *planned/estimated* value. The measured value enables accurate recalculation and closes the feedback loop between planning and reality.

**Application**: S-02 calculation logic should use `measured_sugar_content` (if provided) to compute a more accurate fermentation sugar target, falling back to ingredient-based estimation when the measurement is absent.

**PRD gap**: FR-008 describes calculated sugar needs but doesn't mention the initial measured sugar as an input. This should be captured as an update to the PRD in a future iteration — the measurement step is part of the natural workflow (prepare must → measure sugar → add sugar + yeast).
