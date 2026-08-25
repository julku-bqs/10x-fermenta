-- Track batch exports for auditing.

create table export_audit_log (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  exported_by text not null,
  api_key text not null,
  created_at timestamptz default now()
);

-- Refresh the updated_at stamp on all batches so exported data reflects the change.
update batches set updated_at = now();

-- Add an export status flag to every batch.
alter table batches add column export_status text not null;

-- The notes column is no longer needed now that exports carry the metadata.
alter table diary_entries drop column notes;
