import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { openLibraryDatabase } from './database';
import { TaskRepository } from './repositories/TaskRepository';
import { createTaskRouter } from './taskGateway';
import { TaskRunner } from './tasks/TaskRunner';

test('task API starts, lists and retrieves durable tasks by id', async () => {
  const database = openLibraryDatabase(':memory:');
  const runner = new TaskRunner(new TaskRepository(database));
  runner.register('test.echo', async (input) => input);
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', createTaskRouter(async () => runner));
  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;
    const startedResponse = await fetch(`${origin}/api/tasks/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test.echo', input: { value: 42 } }),
    });
    assert.equal(startedResponse.status, 202);
    const started = await startedResponse.json() as { id: string };
    await runner.waitForIdle();

    const detailResponse = await fetch(`${origin}/api/tasks/${started.id}`);
    const detail = await detailResponse.json() as { status: string; output: unknown };
    assert.equal(detail.status, 'completed');
    assert.deepEqual(detail.output, { value: 42 });

    const listResponse = await fetch(`${origin}/api/tasks?status=completed&type=test.echo`);
    const list = await listResponse.json() as { items: Array<{ id: string }> };
    assert.deepEqual(list.items.map((task) => task.id), [started.id]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    database.close();
  }
});
