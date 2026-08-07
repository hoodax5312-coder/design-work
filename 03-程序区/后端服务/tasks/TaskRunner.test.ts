import assert from 'node:assert/strict';
import test from 'node:test';
import { openLibraryDatabase } from '../database';
import { TaskRepository } from '../repositories/TaskRepository';
import { TaskRunner } from './TaskRunner';

const createRunner = () => {
  const database = openLibraryDatabase(':memory:');
  const repository = new TaskRepository(database);
  const unhandled: unknown[] = [];
  const runner = new TaskRunner(repository, (error) => unhandled.push(error));
  return { database, repository, runner, unhandled };
};

test('persists task progress and completion output', async () => {
  const { database, runner, unhandled } = createRunner();
  try {
    runner.register('preview.image', async (input, context) => {
      context.updateProgress(0.5, '生成缩略图');
      return { assetId: input.assetId, path: 'thumbnails/a.webp' };
    });
    const started = runner.start('preview.image', { assetId: 'asset-1' }, 'asset-1:thumb');
    await runner.waitForIdle();

    const task = runner.get(started.id);
    assert.equal(task?.status, 'completed');
    assert.equal(task?.progress, 1);
    assert.deepEqual(task?.output, { assetId: 'asset-1', path: 'thumbnails/a.webp' });
    assert.deepEqual(unhandled, []);
  } finally {
    database.close();
  }
});

test('deduplicates active work with the same type and key', async () => {
  const { database, runner } = createRunner();
  let release: (() => void) | undefined;
  try {
    runner.register('preview.image', async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { ok: true };
    });
    const first = runner.start('preview.image', { assetId: 'asset-1' }, 'asset-1:thumb');
    const second = runner.start('preview.image', { assetId: 'asset-1' }, 'asset-1:thumb');
    assert.equal(first.created, true);
    assert.deepEqual(second, { id: first.id, created: false });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(release);
    release?.();
    await runner.waitForIdle();
  } finally {
    database.close();
  }
});

test('persists failures and allows a failed task to retry', async () => {
  const { database, runner } = createRunner();
  let attempts = 0;
  try {
    runner.register('unstable', async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary failure');
      return { recovered: true };
    });
    const started = runner.start('unstable');
    await runner.waitForIdle();
    assert.equal(runner.get(started.id)?.status, 'failed');
    assert.deepEqual(runner.get(started.id)?.error, {
      name: 'Error',
      message: 'temporary failure',
    });

    runner.retry(started.id);
    await runner.waitForIdle();
    const retried = runner.get(started.id);
    assert.equal(retried?.status, 'completed');
    assert.equal(retried?.retryCount, 1);
    assert.deepEqual(retried?.output, { recovered: true });
  } finally {
    database.close();
  }
});

test('cancels running work through AbortSignal without later marking it complete', async () => {
  const { database, runner } = createRunner();
  try {
    runner.register('long-task', async (_input, context) => {
      await new Promise<void>((resolve) => {
        if (context.signal.aborted) resolve();
        else context.signal.addEventListener('abort', () => resolve(), { once: true });
      });
      return { shouldNotComplete: true };
    });
    const started = runner.start('long-task');
    await new Promise<void>((resolve) => setImmediate(resolve));
    runner.cancel(started.id);
    await runner.waitForIdle();
    assert.equal(runner.get(started.id)?.status, 'cancelled');
    assert.equal(runner.get(started.id)?.output, null);
  } finally {
    database.close();
  }
});

test('keeps waiting-for-user state durable', async () => {
  const { database, runner } = createRunner();
  try {
    runner.register('import.scan', async (_input, context) => {
      context.waitForUser({ sessionId: 'session-1', conflicts: 2 });
    });
    const started = runner.start('import.scan');
    await runner.waitForIdle();
    const task = runner.get(started.id);
    assert.equal(task?.status, 'waiting_for_user');
    assert.deepEqual(task?.output, { sessionId: 'session-1', conflicts: 2 });
  } finally {
    database.close();
  }
});

test('requeues interrupted running tasks and executes them after restart recovery', async () => {
  const { database, repository, runner } = createRunner();
  try {
    const id = repository.create('recoverable');
    assert.equal(repository.markRunning(id, 2), true);
    runner.register('recoverable', async () => ({ recovered: true }));
    runner.recover();
    await runner.waitForIdle();
    assert.equal(runner.get(id)?.status, 'completed');
    assert.deepEqual(runner.get(id)?.output, { recovered: true });
  } finally {
    database.close();
  }
});
