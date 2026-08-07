ALTER TABLE tasks ADD COLUMN dedupe_key TEXT;

CREATE UNIQUE INDEX tasks_active_dedupe_idx
ON tasks(type, dedupe_key)
WHERE dedupe_key IS NOT NULL
  AND status IN ('queued', 'running', 'waiting_for_user');
