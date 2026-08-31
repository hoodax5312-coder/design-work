ALTER TABLE prompt_catalog_sources ADD COLUMN deleted_at INTEGER;

CREATE INDEX prompt_catalog_sources_visible_idx
  ON prompt_catalog_sources(deleted_at, sort_order);
