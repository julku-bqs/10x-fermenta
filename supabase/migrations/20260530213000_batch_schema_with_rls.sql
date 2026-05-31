-- Migration: batch_schema_with_rls
-- Creates the foundational schema for Fermenta batch planning:
-- enums, tables (batches, ingredients, diary_entries), RLS policies, indexes, and moddatetime triggers.

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE process_type AS ENUM ('pulp', 'juice');
CREATE TYPE sweetness_level AS ENUM ('dry', 'semi_dry', 'semi_sweet', 'sweet');
CREATE TYPE ingredient_type AS ENUM ('user_input', 'fermentation_sugar', 'sweetness_sugar');

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  batch_date date,
  process_type process_type NOT NULL,
  target_volume_liters numeric,
  target_abv numeric,
  planned_sweetness sweetness_level NOT NULL DEFAULT 'dry',
  yeast_name text,
  yeast_alcohol_tolerance numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  type ingredient_type NOT NULL DEFAULT 'user_input',
  name text NOT NULL,
  amount numeric,
  unit text,
  sugar_content_percent numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own batches"
  ON batches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage ingredients of their own batches"
  ON ingredients FOR ALL
  USING (EXISTS (SELECT 1 FROM batches b WHERE b.id = ingredients.batch_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM batches b WHERE b.id = ingredients.batch_id AND b.user_id = auth.uid()));

CREATE POLICY "Users can manage diary entries of their own batches"
  ON diary_entries FOR ALL
  USING (EXISTS (SELECT 1 FROM batches b WHERE b.id = diary_entries.batch_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM batches b WHERE b.id = diary_entries.batch_id AND b.user_id = auth.uid()));

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_batches_user_id ON batches(user_id);
CREATE INDEX idx_ingredients_batch_id ON ingredients(batch_id);
CREATE INDEX idx_diary_entries_batch_id ON diary_entries(batch_id);

-- =============================================================================
-- MODDATETIME TRIGGERS
-- =============================================================================

CREATE TRIGGER handle_updated_at_batches
  BEFORE UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_ingredients
  BEFORE UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_diary_entries
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);
