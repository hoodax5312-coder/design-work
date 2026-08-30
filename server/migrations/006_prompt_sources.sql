CREATE TABLE prompt_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manifest_url TEXT NOT NULL,
  homepage_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_attempt_at INTEGER,
  last_success_at INTEGER,
  item_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  cache_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE UNIQUE INDEX prompt_sources_manifest_url_idx ON prompt_sources(manifest_url);
