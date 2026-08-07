CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(parent_id, name)
) STRICT;

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content_hash TEXT UNIQUE,
  primary_folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  source_url TEXT,
  author TEXT,
  license_note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  raw_metadata TEXT NOT NULL DEFAULT '{}',
  normalized_metadata TEXT NOT NULL DEFAULT '{}',
  user_metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  imported_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_accessed_at INTEGER
) STRICT;

CREATE INDEX assets_type_updated_idx ON assets(type, updated_at DESC);
CREATE INDEX assets_folder_updated_idx ON assets(primary_folder_id, updated_at DESC);
CREATE INDEX assets_status_updated_idx ON assets(status, updated_at DESC);
CREATE INDEX assets_favorite_updated_idx ON assets(favorite, updated_at DESC);

CREATE TABLE file_references (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  absolute_path TEXT NOT NULL UNIQUE,
  volume_id TEXT,
  file_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_created_at INTEGER,
  file_modified_at INTEGER,
  content_hash TEXT,
  last_accessible_at INTEGER,
  status TEXT NOT NULL DEFAULT 'online',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX file_references_asset_idx ON file_references(asset_id);
CREATE INDEX file_references_hash_idx ON file_references(content_hash);
CREATE INDEX file_references_volume_status_idx ON file_references(volume_id, status);

CREATE TABLE preview_artifacts (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  cache_path TEXT NOT NULL UNIQUE,
  source_hash TEXT,
  generator_version TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'ready',
  last_accessed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(asset_id, kind, generator_version)
) STRICT;

CREATE INDEX preview_artifacts_asset_idx ON preview_artifacts(asset_id);
CREATE INDEX preview_artifacts_lru_idx ON preview_artifacts(pinned, last_accessed_at);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  color TEXT,
  group_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE asset_tags (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(asset_id, tag_id)
) WITHOUT ROWID, STRICT;

CREATE INDEX asset_tags_tag_idx ON asset_tags(tag_id, asset_id);

CREATE TABLE smart_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  rules_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE asset_relations (
  id TEXT PRIMARY KEY,
  source_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  target_asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  CHECK (source_asset_id <> target_asset_id),
  UNIQUE(source_asset_id, target_asset_id, relation_type)
) STRICT;

CREATE INDEX asset_relations_source_idx ON asset_relations(source_asset_id, relation_type, sort_order);
CREATE INDEX asset_relations_target_idx ON asset_relations(target_asset_id, relation_type, sort_order);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'waiting_for_user', 'completed', 'failed', 'cancelled')),
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_json TEXT,
  progress REAL NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  current_step TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER
) STRICT;

CREATE INDEX tasks_status_created_idx ON tasks(status, created_at);
CREATE INDEX tasks_type_status_idx ON tasks(type, status);

CREATE VIRTUAL TABLE asset_fts USING fts5(
  asset_id UNINDEXED,
  title,
  description,
  extracted_text,
  tokenize = 'unicode61'
);
