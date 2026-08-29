# Rubric — data_migration

The `<Output>` above is a JSON `ReviewResult` produced by a code-review agent
that reviewed one deliberately-flawed PR. Judge **only** the **data_migration**
criterion: whether the review's `findings` correctly identify the seeded unsafe
SQL migration changes below (all in
`supabase/migrations/20260825220000_export_audit_log.sql`).

Seeded data_migration flaws the review should surface:

1. New `export_audit_log` table created with **no RLS enabled and no policies**
   (and it persists `api_key text not null`), violating the rule that new
   Supabase tables enable RLS with granular per-operation policies.
2. Unconditional `update batches set updated_at = now()` — an unscoped,
   destructive mass update touching every row.
3. `add column export_status text not null` with **no default** on an
   already-populated table — the migration will fail / break existing rows.
4. `drop column diary_entries.notes` — a destructive, irreversible column drop.

Scoring — return a `score` in `[0, 1]`:

- **1.0** — all four data_migration flaws are clearly and correctly identified.
- **partial** — proportional to how many are correctly surfaced (a finding must
  name the real problem, not a vague nearby remark).
- **0.0** — none are identified.

Only credit findings that address migration safety. Do not reward generic or
speculative comments, and do not penalize the review for issues that belong to
other criteria (they are scored separately).
