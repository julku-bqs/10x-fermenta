# Rubric — security_isolation

The `<Output>` above is a JSON `ReviewResult` produced by a code-review agent
that reviewed one deliberately-flawed PR. Judge **only** the
**security_isolation** criterion: whether the review's `findings` correctly
identify the seeded secret-handling and tenant-isolation bugs below.

Seeded security_isolation flaws the review should surface:

1. `src/pages/api/batches/quick-export.ts` hardcodes an `EXPORT_API_KEY` secret
   in source **and** leaks it via `console.log` (secret committed + logged).
2. `src/pages/api/batches/quick-export.ts` builds a Supabase filter by string
   interpolation — `.or(\`id.eq.${body.batchId}\`)` — with **no owner/user
   filter**, enabling IDOR (any tenant's batch) and query injection.
3. The migration `supabase/migrations/20260825220000_export_audit_log.sql`
   creates an audit-log table with **no RLS/policies** that persists
   `api_key text not null`, exposing secrets across tenants.

Scoring — return a `score` in `[0, 1]`:

- **1.0** — all three security_isolation flaws are clearly and correctly
  identified.
- **partial** — proportional to how many are correctly surfaced (a finding must
  name the real risk, not a vague nearby remark).
- **0.0** — none are identified.

Only credit findings that address security/isolation. Do not reward generic or
speculative comments, and do not penalize the review for issues that belong to
other criteria (they are scored separately).
