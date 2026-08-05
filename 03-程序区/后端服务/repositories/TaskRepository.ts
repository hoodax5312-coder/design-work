import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { withTransaction } from '../database';

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_user'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskRecord {
  id: string;
  type: string;
  status: TaskStatus;
  input: Record<string, unknown>;
  output: unknown;
  error: unknown;
  progress: number;
  currentStep: string | null;
  retryCount: number;
  dedupeKey: string | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

export interface CreateTaskResult {
  id: string;
  created: boolean;
}

const parseJson = (value: unknown, fallback: unknown) => {
  if (value == null || value === '') return fallback;
  return JSON.parse(String(value)) as unknown;
};

const mapTask = (row: Record<string, unknown>): TaskRecord => ({
  id: String(row.id),
  type: String(row.type),
  status: String(row.status) as TaskStatus,
  input: parseJson(row.input_json, {}) as Record<string, unknown>,
  output: parseJson(row.output_json, null),
  error: parseJson(row.error_json, null),
  progress: Number(row.progress),
  currentStep: row.current_step == null ? null : String(row.current_step),
  retryCount: Number(row.retry_count),
  dedupeKey: row.dedupe_key == null ? null : String(row.dedupe_key),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  startedAt: row.started_at == null ? null : Number(row.started_at),
  completedAt: row.completed_at == null ? null : Number(row.completed_at),
});

export class TaskRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(type: string, input: Record<string, unknown> = {}, now = Date.now()) {
    return this.createUnique(type, input, null, now).id;
  }

  createUnique(
    type: string,
    input: Record<string, unknown> = {},
    dedupeKey: string | null = null,
    now = Date.now(),
  ): CreateTaskResult {
    return withTransaction(this.database, () => {
      if (dedupeKey) {
        const existing = this.database
          .prepare(
            `
          SELECT id FROM tasks
          WHERE type = ? AND dedupe_key = ?
            AND status IN ('queued', 'running', 'waiting_for_user')
          ORDER BY created_at DESC LIMIT 1
        `,
          )
          .get(type, dedupeKey);
        if (existing) return { id: String(existing.id), created: false };
      }

      const id = randomUUID();
      this.database
        .prepare(
          `
        INSERT INTO tasks(id, type, status, input_json, dedupe_key, created_at, updated_at)
        VALUES (?, ?, 'queued', ?, ?, ?, ?)
      `,
        )
        .run(id, type, JSON.stringify(input), dedupeKey, now, now);
      return { id, created: true };
    });
  }

  get(id: string): TaskRecord | null {
    const row = this.database.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return row ? mapTask(row) : null;
  }

  list(options: { status?: TaskStatus; type?: string; limit?: number } = {}): TaskRecord[] {
    const conditions: string[] = [];
    const parameters: SQLInputValue[] = [];
    if (options.status) {
      conditions.push('status = ?');
      parameters.push(options.status);
    }
    if (options.type) {
      conditions.push('type = ?');
      parameters.push(options.type);
    }
    const limit = Math.min(Math.max(options.limit || 100, 1), 500);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.database
      .prepare(
        `
      SELECT * FROM tasks ${where} ORDER BY created_at DESC, id LIMIT ?
    `,
      )
      .all(...parameters, limit)
      .map(mapTask);
  }

  recoverRunning(now = Date.now()): string[] {
    const rows = this.database.prepare("SELECT id FROM tasks WHERE status = 'running'").all();
    this.database
      .prepare(
        `
      UPDATE tasks SET status = 'queued', current_step = '等待恢复', updated_at = ?,
        started_at = NULL
      WHERE status = 'running'
    `,
      )
      .run(now);
    return rows.map((row) => String(row.id));
  }

  markRunning(id: string, now = Date.now()) {
    const result = this.database
      .prepare(
        `
      UPDATE tasks SET status = 'running', started_at = COALESCE(started_at, ?),
        completed_at = NULL, updated_at = ?
      WHERE id = ? AND status = 'queued'
    `,
      )
      .run(now, now, id);
    return result.changes === 1;
  }

  updateProgress(id: string, progress: number, currentStep?: string, now = Date.now()) {
    this.database
      .prepare(
        `
      UPDATE tasks SET progress = ?, current_step = COALESCE(?, current_step), updated_at = ?
      WHERE id = ? AND status = 'running'
    `,
      )
      .run(Math.min(Math.max(progress, 0), 1), currentStep ?? null, now, id);
  }

  setStatus(
    id: string,
    status: TaskStatus,
    options: { progress?: number; currentStep?: string; output?: unknown; error?: unknown } = {},
    now = Date.now(),
  ) {
    this.database
      .prepare(
        `
      UPDATE tasks SET
        status = ?, progress = COALESCE(?, progress),
        current_step = COALESCE(?, current_step),
        output_json = CASE WHEN ? THEN ? ELSE output_json END,
        error_json = CASE WHEN ? THEN ? ELSE error_json END,
        updated_at = ?,
        started_at = CASE WHEN ? = 'running' THEN COALESCE(started_at, ?) ELSE started_at END,
        completed_at = CASE WHEN ? IN ('completed', 'failed', 'cancelled') THEN ? ELSE completed_at END
      WHERE id = ?
    `,
      )
      .run(
        status,
        options.progress ?? null,
        options.currentStep ?? null,
        options.output !== undefined ? 1 : 0,
        options.output === undefined ? null : JSON.stringify(options.output),
        options.error !== undefined ? 1 : 0,
        options.error === undefined ? null : JSON.stringify(options.error),
        now,
        status,
        now,
        status,
        now,
        id,
      );
  }

  prepareRetry(id: string, now = Date.now()) {
    const result = this.database
      .prepare(
        `
      UPDATE tasks SET status = 'queued', progress = 0, current_step = '等待重试',
        output_json = NULL, error_json = NULL, retry_count = retry_count + 1,
        started_at = NULL, completed_at = NULL, updated_at = ?
      WHERE id = ? AND status IN ('failed', 'cancelled')
    `,
      )
      .run(now, id);
    return result.changes === 1;
  }
}
