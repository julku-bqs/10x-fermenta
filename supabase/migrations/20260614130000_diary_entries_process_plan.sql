-- Phase 1: Evolve diary_entries for process plan generation
-- Adds entry_date, completed, entry_type, notes; drops sort_order
-- Creates ownership promotion trigger and regenerate RPC function
-- Enforces batch_date NOT NULL with backfill

-- 1. Add new columns to diary_entries
ALTER TABLE diary_entries
  ADD COLUMN entry_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN completed boolean NOT NULL DEFAULT false,
  ADD COLUMN entry_type text NOT NULL DEFAULT 'user' CHECK (entry_type IN ('auto', 'user')),
  ADD COLUMN notes text DEFAULT NULL;

-- 2. Drop sort_order (unused, no production data)
ALTER TABLE diary_entries DROP COLUMN sort_order;

-- 3. Backfill existing batches with NULL batch_date
UPDATE batches SET batch_date = created_at::date WHERE batch_date IS NULL;

-- 4. Enforce batch_date NOT NULL with default
ALTER TABLE batches
  ALTER COLUMN batch_date SET NOT NULL,
  ALTER COLUMN batch_date SET DEFAULT CURRENT_DATE;

-- 5. Ownership promotion trigger
-- Promotion trigger: only description/notes edits promote auto → user.
-- Intentionally excludes entry_date and completed so that:
--   - completed toggles remain progress-tracking (regenerate can reset them)
--   - entry_date changes on auto entries are rare and non-destructive
CREATE OR REPLACE FUNCTION promote_diary_entry_type()
RETURNS trigger AS $$
BEGIN
  IF OLD.entry_type = 'auto' AND (
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.notes IS DISTINCT FROM OLD.notes
  ) THEN
    NEW.entry_type := 'user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_promote_diary_entry_type
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION promote_diary_entry_type();

-- 6. Atomic regenerate function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION regenerate_diary_entries(
  p_batch_id uuid,
  p_entries jsonb
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM batches WHERE id = p_batch_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM diary_entries WHERE batch_id = p_batch_id AND entry_type = 'auto';
  INSERT INTO diary_entries (batch_id, description, entry_date, entry_type, completed, notes)
  SELECT p_batch_id, e->>'description', (e->>'entry_date')::date, 'auto', false, e->>'notes'
  FROM jsonb_array_elements(p_entries) AS e;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
