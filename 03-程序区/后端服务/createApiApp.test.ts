import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApiApp } from './createApiApp';

test('shared API app exposes the local service health endpoint', async () => {
  const app = createApiApp(process.cwd());
  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, service: 'mboard-local' });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
