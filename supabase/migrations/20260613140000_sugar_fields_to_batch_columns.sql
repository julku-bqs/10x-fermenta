-- Migration: sugar_fields_to_batch_columns
-- Moves fermentation_sugar_kg and sweetness_sugar_kg from pseudo-ingredient
-- entries in the JSONB ingredients array to dedicated batch-level columns.
-- Strips sugar entries and type/sort_order keys from remaining ingredients.

ALTER TABLE batches ADD COLUMN fermentation_sugar_kg NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE batches ADD COLUMN sweetness_sugar_kg NUMERIC NOT NULL DEFAULT 0;

-- Backfill fermentation sugar from JSONB
UPDATE batches SET fermentation_sugar_kg = COALESCE(
  (SELECT (elem->>'amount_liters')::numeric
   FROM jsonb_array_elements(ingredients) AS elem
   WHERE elem->>'type' = 'fermentation_sugar'
   LIMIT 1),
  0
);

-- Backfill sweetness sugar from JSONB
UPDATE batches SET sweetness_sugar_kg = COALESCE(
  (SELECT (elem->>'amount_liters')::numeric
   FROM jsonb_array_elements(ingredients) AS elem
   WHERE elem->>'type' = 'sweetness_sugar'
   LIMIT 1),
  0
);

-- Strip sugar entries and remove type/sort_order keys from remaining
UPDATE batches SET ingredients = (
  SELECT COALESCE(jsonb_agg(
    elem - 'type' - 'sort_order'
  ), '[]'::jsonb)
  FROM jsonb_array_elements(ingredients) AS elem
  WHERE elem->>'type' = 'user_input'
);
