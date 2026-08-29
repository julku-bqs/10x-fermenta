# Ground-truth ledger — `quick-export-multiflaw.diff`

Captured from branch **`test/ai-cr-live-flaws`** (commit `14d639b`) via
`git diff main...test/ai-cr-live-flaws`. That branch is **testing-only — DO NOT
MERGE**; this committed fixture is the reproducible snapshot the eval runs
against, independent of the branch.

One dense multi-flaw PR — _"feat(batches): add quick-export endpoint with export
metrics"_ (3 new files / 83 insertions) — seeding flaws across **all five review
criteria**. Each seeded flaw below is mapped to the criterion the per-criterion
rubrics (Phase 3) and manual review key off.

| File                                                      | Seeded flaw → criterion                                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/lib/services/export-metrics.ts`                      | `computeTotalSugar` = `kg × volume` (dimensionally wrong; no kg→g) → **domain_integrity**                        |
| `src/lib/services/export-metrics.ts`                      | `estimateAbv` bogus `sugarPerLiter / 10` → **domain_integrity**                                                  |
| `src/lib/services/export-metrics.ts`                      | `classifyDryness` **inverted** (`>45 ? "dry" : "sweet"`) → **domain_integrity**                                  |
| `src/lib/services/export-metrics.ts`                      | `sumSugarReadings` off-by-one `i <= length` (reads `undefined` → NaN) → **correctness**                          |
| `src/pages/api/batches/quick-export.ts`                   | hardcoded `EXPORT_API_KEY` + `console.log` leaking it → **security_isolation**                                   |
| `src/pages/api/batches/quick-export.ts`                   | no zod validation, `as ExportRequest` cast → **input_contract**                                                  |
| `src/pages/api/batches/quick-export.ts`                   | `.or(\`id.eq.${body.batchId}\`)` string-interpolated + no owner filter → **security_isolation** (IDOR/injection) |
| `src/pages/api/batches/quick-export.ts`                   | `classifyDryness(sugarKg / volume)` unit bug at call site → **domain_integrity**                                 |
| `src/pages/api/batches/quick-export.ts`                   | unguarded divide-by-zero → **correctness**                                                                       |
| `supabase/migrations/20260825220000_export_audit_log.sql` | new table with **no RLS/policies**, persists `api_key text not null` → **data_migration** (+ security)           |
| `supabase/migrations/20260825220000_export_audit_log.sql` | unconditional `update batches set updated_at = now()` → **data_migration** (destructive)                         |
| `supabase/migrations/20260825220000_export_audit_log.sql` | `add column export_status text not null` (no default on a populated table) → **data_migration**                  |
| `supabase/migrations/20260825220000_export_audit_log.sql` | `drop column diary_entries.notes` → **data_migration** (destructive)                                             |

**Expected verdict**: the diff contains blocker/high issues, so a competent
review yields `verdict.decision === "blocked"`, `verdict.pass === false` — the
deterministic hard gate every model under test must clear.
