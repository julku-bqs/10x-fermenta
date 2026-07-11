# E2E Testing Rules

These rules govern every Playwright test generated in `tests/e2e/`. They exist so
generated tests are **stable by default** — agents apply known patterns far more
reliably than they invent new ones. `seed.spec.ts` is the paired lever: model
every new test on its shape.

## The rules block

- Use `getByRole`, `getByLabel`, `getByText` as primary locators.
  Fall back to `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared state between tests.
- Never use `page.waitForTimeout()`. Wait for specific conditions:
  `toBeVisible()`, `waitForURL()`, `waitForResponse()`.
- Assert the business outcome, not implementation details.
- Use unique identifiers (e.g. `Date.now()` suffix) for test data to avoid
  collisions in parallel runs. Clean up what the test created (delete it, or use
  `afterEach`).
- Use `storageState` for authentication — never log in through the UI in
  individual tests. Auth happens once in `auth.setup.ts`.

## Governing principles

- **Don't generate tests from scratch.** Start from a risk in
  `context/foundation/test-plan.md`: a risk needs E2E only when it crosses several
  system boundaries (auth, routing, API, DB) or exists only in the rendered UI. If
  an isolated function or integration test can prove it, use `/10x-tdd` instead.
- **E2E ≠ zero mocking.** Internal boundaries (auth, routing, Supabase/DB) stay
  real — that is where integration risk hides. Mock only expensive or
  non-deterministic **external** APIs at the network layer. Note: this app calls
  Supabase and any AI provider **server-side**, so browser-level `page.route()`
  will NOT intercept those — mock them where the server actually calls out.
- **Name the test after the risk:** `test('created batch persists after page
reload', ...)`, not `test('test 1', ...)`.
- **The assertion must fail if the risk materializes.** Control question for every
  assertion: would this fail if the `test-plan.md` risk came true? If not, it is
  decorative. Confirm with a deliberate break before trusting the test.

## App-specific anchors

- **Auth:** sign-in form at `/auth/signin` (labels `Email` / `Password`, button
  `Sign in`) posts to `/api/auth/signin` and redirects to `/batches`. Handled once
  by `auth.setup.ts` + `storageState`; specs start already signed in.
- **Protected routes:** `/batches`, `/api/batches` (see `src/middleware.ts`).
- **Create a batch:** `/batches` → `New Batch` link → `/batches/new`; fill `Name`
  (required), `Target Volume (liters)`, `Target ABV (%)`; submit `Create Batch` →
  redirects to `/batches/{id}`.
- **Delete a batch:** on the detail page, click `Delete Batch`, then confirm inside
  the alert dialog (scope with `getByRole('alertdialog')`).

## File placement

One test per file: `tests/e2e/<feature>.spec.ts`. Keep a short provenance header
linking the spec to its `test-plan.md` risk and to `seed.spec.ts`. Put each plan
step's text as a comment before the actions that implement it.
