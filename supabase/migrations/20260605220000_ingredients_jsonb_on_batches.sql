-- Migration: ingredients_jsonb_on_batches
-- Replaces separate ingredients table with a JSONB column on batches.
-- Drops ingredients table, associated trigger, and ingredient_type enum.

ALTER TABLE batches ADD COLUMN ingredients jsonb NOT NULL DEFAULT '[]';

-- Drop ingredients table and all associated objects
DROP TRIGGER IF EXISTS handle_updated_at_ingredients ON ingredients;
DROP TABLE ingredients;
DROP TYPE ingredient_type;
