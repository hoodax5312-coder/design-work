ALTER TABLE file_references ADD COLUMN quick_fingerprint TEXT;
CREATE INDEX file_references_quick_fingerprint_idx
ON file_references(file_size, quick_fingerprint);

CREATE TABLE import_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('scanning', 'waiting_for_user', 'confirmed', 'importing', 'completed', 'failed', 'cancelled')),
  root_paths_json TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  completed_at INTEGER
) STRICT;

CREATE INDEX import_sessions_status_updated_idx
ON import_sessions(status, updated_at DESC);

CREATE TABLE import_items (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  absolute_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  proposed_mime_type TEXT,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_created_at INTEGER NOT NULL,
  file_modified_at INTEGER NOT NULL,
  volume_id TEXT NOT NULL,
  volume_label TEXT NOT NULL,
  quick_fingerprint TEXT,
  content_hash TEXT,
  duplicate_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  duplicate_item_id TEXT REFERENCES import_items(id) ON DELETE SET NULL,
  suggested_type TEXT NOT NULL,
  suggestions_json TEXT NOT NULL DEFAULT '{}',
  decision TEXT CHECK (decision IS NULL OR decision IN ('import_new', 'merge_path', 'keep_separate', 'skip')),
  user_overrides_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(session_id, absolute_path)
) STRICT;

CREATE INDEX import_items_session_idx ON import_items(session_id, sort_order, id);
CREATE INDEX import_items_quick_idx ON import_items(session_id, file_size, quick_fingerprint);
CREATE INDEX import_items_hash_idx ON import_items(content_hash);
