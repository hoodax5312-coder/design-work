import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { openLibraryDatabase } from './database';
import type { FilePickerProvider } from './import/FilePickerProvider';
import { ImportService } from './import/ImportService';
import { createImportRouter } from './importGateway';
import { createLibraryPaths } from './libraryPaths';
import type { LibraryRuntime } from './libraryRuntime';
import { TaskRepository } from './repositories/TaskRepository';
import { AssetRepository } from './repositories/AssetRepository';
import { FolderRepository } from './repositories/FolderRepository';
import { TagRepository } from './repositories/TagRepository';
import { SmartCollectionRepository } from './repositories/SmartCollectionRepository';
import { PreviewService } from './previews/PreviewService';
import { TaskRunner } from './tasks/TaskRunner';

test('import API exposes picker, scan review and confirmed import flow', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-import-api-'));
  const file = path.join(directory, 'reference.png');
  await fs.writeFile(file, 'image-data');
  const database = openLibraryDatabase(':memory:');
  const tasks = new TaskRunner(new TaskRepository(database));
  const imports = new ImportService(database);
  tasks.register('import.scan', async (input, context) => imports.scan(input.rootPaths as string[], context));
  tasks.register('import.commit', async (input, context) => imports.commit(String(input.sessionId), context));
  const runtime: LibraryRuntime = {
    database,
    tasks,
    imports,
    paths: createLibraryPaths(directory),
    assets: new AssetRepository(database),
    folders: new FolderRepository(database),
    tags: new TagRepository(database),
    smartCollections: new SmartCollectionRepository(database),
    previews: new PreviewService(database, createLibraryPaths(directory)),
  };
  const picker: FilePickerProvider = {
    pickFiles: async () => [file],
    pickDirectory: async () => directory,
  };
  const app = express();
  app.use(express.json());
  app.use('/api/import', createImportRouter(async () => runtime, picker));
  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const picked = await fetch(`${origin}/api/import/pick-files`, { method: 'POST' });
    assert.deepEqual(await picked.json(), { paths: [file], cancelled: false });

    const dropped = await fetch(`${origin}/api/import/drop-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-Design-Work-File-Name': encodeURIComponent('dropped-image.png'),
      },
      body: new Uint8Array([137, 80, 78, 71]),
    });
    assert.equal(dropped.status, 201);
    const droppedPayload = await dropped.json() as { path: string; originalFileName: string };
    assert.equal(droppedPayload.originalFileName, 'dropped-image.png');
    assert.equal(droppedPayload.path.startsWith(runtime.paths.managedAssets), true);
    assert.deepEqual(await fs.readFile(droppedPayload.path), Buffer.from([137, 80, 78, 71]));

    const scanResponse = await fetch(`${origin}/api/import/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPaths: [file] }),
    });
    assert.equal(scanResponse.status, 202);
    const scan = await scanResponse.json() as { id: string };
    await tasks.waitForIdle();
    const sessionId = (tasks.get(scan.id)?.output as { sessionId: string }).sessionId;
    const sessionResponse = await fetch(`${origin}/api/import/sessions/${sessionId}`);
    const session = await sessionResponse.json() as { status: string; items: Array<{ id: string }> };
    assert.equal(session.status, 'waiting_for_user');

    const decisions = await fetch(`${origin}/api/import/sessions/${sessionId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisions: [{ itemId: session.items[0].id, decision: 'import_new' }] }),
    });
    assert.equal(decisions.status, 200);
    const confirm = await fetch(`${origin}/api/import/sessions/${sessionId}/confirm`, { method: 'POST' });
    assert.equal(confirm.status, 202);
    await tasks.waitForIdle();
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM assets').get()?.count, 1);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    database.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
