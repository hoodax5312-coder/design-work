CREATE TABLE prompt_catalog_sources (
  id TEXT PRIMARY KEY,
  prompt_source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  homepage_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE INDEX prompt_catalog_sources_parent_idx ON prompt_catalog_sources(prompt_source_id);
