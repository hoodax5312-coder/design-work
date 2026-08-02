ALTER TABLE preview_artifacts ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';
CREATE INDEX preview_artifacts_status_idx ON preview_artifacts(status, updated_at DESC);
