import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import http from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { openLibraryDatabase } from './database';
import { createAuthRouter } from './authGateway';
import { createAccountApp } from './createAccountApp';

const listen = async (app: express.Express) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test listener');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
};

const registerBody = JSON.stringify({ email: 'member@example.com', password: 'correct-horse' });
const post = (origin: string, route: string, body = registerBody, headers: Record<string, string> = {}) => fetch(`${origin}/api/auth/${route}`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body,
});

test('password and session secrets are hashed, persisted, rotated and expired server-side', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lizu-auth-'));
  const databasePath = path.join(directory, 'accounts.sqlite');
  let database = openLibraryDatabase(databasePath);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(async () => database));
  const service = await listen(app);
  try {
    const registered = await post(service.origin, 'register');
    assert.equal(registered.status, 201);
    const firstCookie = registered.headers.get('set-cookie')!.split(';')[0];
    assert.match(registered.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/);
    const row = database.prepare('SELECT * FROM users').get()!;
    assert.notEqual(row.password_hash, 'correct-horse');
    assert.match(String(row.password_hash), /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.notEqual(database.prepare('SELECT id FROM sessions').get()!.id, firstCookie.split('=')[1]);
    database.close();
    database = openLibraryDatabase(databasePath);
    const restored = await fetch(`${service.origin}/api/auth/me`, { headers: { cookie: firstCookie } });
    assert.equal((await restored.json() as { user: { email: string } }).user.email, 'member@example.com');
    const loggedIn = await post(service.origin, 'login', registerBody, { cookie: firstCookie });
    assert.equal(loggedIn.status, 200);
    const nextCookie = loggedIn.headers.get('set-cookie')!.split(';')[0];
    assert.notEqual(firstCookie, nextCookie);
    const stale = await fetch(`${service.origin}/api/auth/me`, { headers: { cookie: firstCookie } });
    assert.equal((await stale.json() as { user: unknown }).user, null);
    database.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1000);
    const expired = await fetch(`${service.origin}/api/auth/me`, { headers: { cookie: nextCookie } });
    assert.equal((await expired.json() as { user: unknown }).user, null);
    const malformed = await fetch(`${service.origin}/api/auth/me`, { headers: { cookie: 'lizu_session=%xx' } });
    assert.equal((await malformed.json() as { user: unknown }).user, null);
  } finally {
    await service.close();
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('local account endpoints reject foreign origins and rate-limit credential guesses', async () => {
  const database = openLibraryDatabase(':memory:');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(async () => database));
  const service = await listen(app);
  try {
    assert.equal((await post(service.origin, 'register', registerBody, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(service.origin, 'register', registerBody, { 'sec-fetch-site': 'cross-site' })).status, 403);
    const invalid = JSON.stringify({ email: 'member@example.com', password: 'x' });
    for (let attempt = 0; attempt < 30; attempt++) assert.equal((await post(service.origin, 'login', invalid)).status, 400);
    const limited = await post(service.origin, 'login', invalid);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await post(service.origin, 'register', invalid)).status, 400);
    assert.equal((await post(service.origin, 'register', invalid)).status, 429);
  } finally {
    await service.close();
    database.close();
  }
});

const requestPublic = (origin: string, route: string, options: { method?: string; body?: string; headers?: Record<string, string> } = {}) => new Promise<{ status: number; body: string; cookie?: string[] }>((resolve, reject) => {
  const request = http.request(`${origin}${route}`, {
    method: options.method || 'GET',
    headers: { host: 'lizuo.work', 'content-type': 'application/json', ...options.headers },
  }, (response) => {
    let body = '';
    response.on('data', (chunk) => { body += chunk; });
    response.on('end', () => resolve({ status: response.statusCode!, body, cookie: response.headers['set-cookie'] }));
  });
  request.on('error', reject);
  request.end(options.body);
});

test('public service uses HTTPS cookies and exposes no local provider, files or workspace APIs', async () => {
  const database = openLibraryDatabase(':memory:');
  const app = createAccountApp({ database, publicOrigin: 'https://lizuo.work', projectRoot: process.cwd() });
  const service = await listen(app);
  try {
    assert.equal((await fetch(`${service.origin}/api/auth/me`)).status, 403);
    const foreign = await requestPublic(service.origin, '/api/auth/register', { method: 'POST', body: registerBody, headers: { origin: 'https://evil.example' } });
    assert.equal(foreign.status, 403);
    const malformed = await requestPublic(service.origin, '/api/auth/register', { method: 'POST', body: '{' });
    assert.equal(malformed.status, 400);
    const oversized = await requestPublic(service.origin, '/api/auth/register', { method: 'POST', body: JSON.stringify({ value: 'a'.repeat(9000) }) });
    assert.equal(oversized.status, 413);
    const registered = await requestPublic(service.origin, '/api/auth/register', { method: 'POST', body: registerBody, headers: { origin: 'https://lizuo.work' } });
    assert.equal(registered.status, 201);
    assert.match(registered.cookie![0], /; Secure;/);
    assert.equal(JSON.parse(registered.body).user.role, 'member');
    const cookie = registered.cookie![0].split(';')[0];
    assert.equal((await requestPublic(service.origin, '/api/admin/summary')).status, 401);
    assert.equal((await requestPublic(service.origin, '/api/admin/summary', { headers: { cookie } })).status, 403);
    for (const route of ['/api/provider/config', '/api/storage', '/api/assets', '/api/import', '/api/workspace', '/api/tasks', '/api/higgsfield']) {
      const response = await requestPublic(service.origin, route, { headers: { cookie } });
      assert.equal(response.status, 404, route);
      assert.match(response.body, /此在线服务不提供/);
    }
    const logout = await requestPublic(service.origin, '/api/auth/logout', { method: 'POST', headers: { cookie } });
    assert.equal(logout.status, 200);
    assert.equal(JSON.parse((await requestPublic(service.origin, '/api/auth/me', { headers: { cookie } })).body).user, null);
  } finally {
    await service.close();
    database.close();
  }
});

test('public origin configuration cannot silently permit HTTP or wildcard origins', () => {
  const database = openLibraryDatabase(':memory:');
  try {
    for (const publicOrigin of ['http://lizuo.work', 'https://lizuo.work/path', 'https://lizuo.work/', '*']) {
      assert.throws(() => createAccountApp({ database, publicOrigin, projectRoot: process.cwd() }));
    }
  } finally { database.close(); }
});

test('admin dev proxy preserves Host so POST origin checks work without allowing foreign origins', async () => {
  const config = await readFile(new URL('../vite.admin.config.ts', import.meta.url), 'utf8');
  for (const route of ['auth', 'admin']) {
    assert.match(config, new RegExp(`'/api/${route}': \\{ target: 'http://127\\.0\\.0\\.1:5173', changeOrigin: false \\}`));
  }
  const database = openLibraryDatabase(':memory:');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(async () => database));
  const service = await listen(app);
  try {
    const send = (origin: string) => new Promise<number>((resolve, reject) => {
      const request = http.request(`${service.origin}/api/auth/logout`, {
        method: 'POST', headers: { host: '127.0.0.1:5180', origin },
      }, (response) => { response.resume(); response.on('end', () => resolve(response.statusCode!)); });
      request.on('error', reject);
      request.end();
    });
    assert.equal(await send('http://127.0.0.1:5180'), 200);
    assert.equal(await send('http://127.0.0.1:5173'), 403);
    assert.equal(await send('https://evil.example'), 403);
  } finally {
    await service.close();
    database.close();
  }
});
