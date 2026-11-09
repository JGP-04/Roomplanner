ALTER TABLE catalog_items
  DROP CONSTRAINT IF EXISTS catalog_items_kind_check;

ALTER TABLE catalog_items
  ADD CONSTRAINT catalog_items_kind_check
  CHECK (kind IN ('box', 'table', 'chair', 'armchair', 'shelf'));
