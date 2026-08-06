import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openLibraryDatabase } from '../database';
import { TaskRepository } from '../repositories/TaskRepository';
import { TaskRunner } from '../tasks/TaskRunner';
import { ImportService } from './ImportService';

const withTemporaryDirectory = async (run: (directory: string) => Promise<void>) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-import-service-'));
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
};

const createImportRunner = (databasePath = ':memory:') => {
  const database = openLibraryDatabase(databasePath);
  const tasks = new TaskRunner(new TaskRepository(database));
  const imports = new ImportService(database);
  tasks.register('import.scan', async (input, context) =>
    imports.scan(input.rootPaths as string[], context),
  );
  tasks.register('import.commit', async (input, context) =>
    imports.commit(String(input.sessionId), context),
  );
  return { database, tasks, imports };
};

test('persists duplicate conflicts, merges paths and imports in one confirmed session', async () => {
  await withTemporaryDirectory(async (directory) => {
    const first = path.join(directory, 'first.png');
    const second = path.join(directory, 'second.png');
    await fs.writeFile(first, 'identical-content');
    await fs.copyFile(first, second);
    const firstStat = await fs.stat(first);
    await fs.utimes(second, firstStat.atime, firstStat.mtime);
    const { database, tasks, imports } = createImportRunner();
    try {
      const scan = tasks.start('import.scan', { rootPaths: [first, second] });
      await tasks.waitForIdle();
      const waiting = tasks.get(scan.id);
      assert.equal(waiting?.status, 'waiting_for_user');
      const sessionId = (waiting?.output as { sessionId: string }).sessionId;
      const items = imports.sessions.listItems(sessionId);
      assert.equal(items.length, 2);
      const duplicate = items.find((item) => item.duplicateItemId);
      const original = items.find((item) => item.id === duplicate?.duplicateItemId);
      assert.ok(duplicate && original);

      imports.sessions.updateDecisions(sessionId, [
        { itemId: original.id, decision: 'import_new' },
        { itemId: duplicate.id, decision: 'merge_path' },
      ]);
      const commit = tasks.start('import.commit', { sessionId });
      await tasks.waitForIdle();
      assert.equal(tasks.get(commit.id)?.status, 'completed');
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM assets').get()?.count, 1);
      assert.equal(
        database.prepare('SELECT COUNT(*) AS count FROM file_references').get()?.count,
        2,
      );
      assert.equal(imports.sessions.get(sessionId)?.status, 'completed');
    } finally {
      database.close();
    }
  });
});

test('keeps same-name files with different content as independent assets', async () => {
  await withTemporaryDirectory(async (directory) => {
    const left = path.join(directory, 'left');
    const right = path.join(directory, 'right');
    await fs.mkdir(left);
    await fs.mkdir(right);
    await fs.writeFile(path.join(left, 'shot.png'), 'left-content');
    await fs.writeFile(path.join(right, 'shot.png'), 'right-content');
    const { database, tasks, imports } = createImportRunner();
    try {
      const scan = tasks.start('import.scan', { rootPaths: [left, right] });
      await tasks.waitForIdle();
      const sessionId = (tasks.get(scan.id)?.output as { sessionId: string }).sessionId;
      const items = imports.sessions.listItems(sessionId);
      imports.sessions.updateDecisions(
        sessionId,
        items.map((item) => ({
          itemId: item.id,
          decision: 'import_new' as const,
        })),
      );
      tasks.start('import.commit', { sessionId });
      await tasks.waitForIdle();
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM assets').get()?.count, 2);
    } finally {
      database.close();
    }
  });
});

test('fails safely if a file changes after review and writes no asset records', async () => {
  await withTemporaryDirectory(async (directory) => {
    const file = path.join(directory, 'changing.mp4');
    await fs.writeFile(file, 'before');
    const { database, tasks, imports } = createImportRunner();
    try {
      const scan = tasks.start('import.scan', { rootPaths: [file] });
      await tasks.waitForIdle();
      const sessionId = (tasks.get(scan.id)?.output as { sessionId: string }).sessionId;
      const item = imports.sessions.listItems(sessionId)[0];
      imports.sessions.updateDecisions(sessionId, [{ itemId: item.id, decision: 'import_new' }]);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await fs.writeFile(file, 'after-content-is-different');
      const commit = tasks.start('import.commit', { sessionId });
      await tasks.waitForIdle();
      assert.equal(tasks.get(commit.id)?.status, 'failed');
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM assets').get()?.count, 0);
      assert.equal(imports.sessions.get(sessionId)?.status, 'failed');
    } finally {
      database.close();
    }
  });
});

test('retains a waiting import session after the database is reopened', async () => {
  await withTemporaryDirectory(async (directory) => {
    const file = path.join(directory, 'prompt.txt');
    const databasePath = path.join(directory, 'library.sqlite');
    await fs.writeFile(file, 'cinematic prompt');
    const first = createImportRunner(databasePath);
    const scan = first.tasks.start('import.scan', { rootPaths: [file] });
    await first.tasks.waitForIdle();
    const sessionId = (first.tasks.get(scan.id)?.output as { sessionId: string }).sessionId;
    first.database.close();

    const second = createImportRunner(databasePath);
    try {
      assert.equal(second.imports.sessions.get(sessionId)?.status, 'waiting_for_user');
      assert.equal(second.imports.sessions.listItems(sessionId).length, 1);
    } finally {
      second.database.close();
    }
  });
});
