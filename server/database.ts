import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

interface Migration {
  version: number;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: fs.readFileSync(new URL('./migrations/001_core.sql', import.meta.url), 'utf8'),
  },
  {
    version: 2,
    sql: fs.readFileSync(new URL('./migrations/002_task_runner.sql', import.meta.url), 'utf8'),
  },
  {
    version: 3,
    sql: fs.readFileSync(new URL('./migrations/003_import_sessions.sql', import.meta.url), 'utf8'),
  },
  {
    version: 4,
    sql: fs.readFileSync(new URL('./migrations/004_preview_metadata.sql', import.meta.url), 'utf8'),
  },
  {
    version: 5,
    sql: fs.readFileSync(new URL('./migrations/005_default_asset_tags.sql', import.meta.url), 'utf8'),
  },
];

export const withTransaction = <T>(database: DatabaseSync, operation: () => T): T => {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
};

const runMigrations = (database: DatabaseSync) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    ) STRICT;
  `);
  const applied = database.prepare('SELECT version FROM schema_migrations').all()
    .map((row) => Number(row.version));
  const insertMigration = database.prepare(
    'INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)',
  );

  for (const migration of migrations) {
    if (applied.includes(migration.version)) continue;
    withTransaction(database, () => {
      database.exec(migration.sql);
      insertMigration.run(migration.version, Date.now());
    });
  }
};

export const openLibraryDatabase = (databasePath: string) => {
  if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA busy_timeout = 5000');
  runMigrations(database);
  return database;
};
