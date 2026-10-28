import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { openLibraryDatabase } from './database';
import { createAdminRouter } from './adminGateway';
import { createAuthRouter } from './authGateway';

const createApp = () => {
  const database = openLibraryDatabase(':memory:');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(async () => database));
  const runtime = { database } as never;
  app.use('/api/admin', createAdminRouter(async () => runtime));
  return { app, database };
};

const listen = async (app: express.Express) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('测试服务未监听');
  return { server, origin: `http://127.0.0.1:${address.port}` };
};

test('注册、登录、会话、退出和管理员摘要走真实数据库', async () => {
  const { app, database } = createApp();
  const { server, origin } = await listen(app);
  try {
    const invalid = await fetch(`${origin}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bad', password: 'short' }),
    });
    assert.equal(invalid.status, 400);

    const registered = await fetch(`${origin}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'Owner@LIZUO.work', password: 'correct-horse' }),
    });
    assert.equal(registered.status, 201);
    const setCookie = registered.headers.get('set-cookie');
    assert.match(setCookie || '', /lizu_session=/);
    const user = await registered.json() as { user: { role: string; email: string } };
    assert.equal(user.user.role, 'member');
    assert.equal(user.user.email, 'owner@lizuo.work');
    database.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(user.user.email);

    const duplicate = await fetch(`${origin}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@lizuo.work', password: 'correct-horse' }),
    });
    assert.equal(duplicate.status, 409);

    const me = await fetch(`${origin}/api/auth/me`, { headers: { cookie: setCookie! } });
    assert.equal((await me.json() as { user: { email: string } }).user.email, 'owner@lizuo.work');
    const summary = await fetch(`${origin}/api/admin/summary`, { headers: { cookie: setCookie! } });
    assert.deepEqual((await summary.json() as { metrics: unknown }).metrics, { users: 1, activeSessions: 1, assets: 0 });

    const wrong = await fetch(`${origin}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@lizuo.work', password: 'wrong-pass' }),
    });
    assert.equal(wrong.status, 401);

    const loggedOut = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { cookie: setCookie! } });
    assert.equal(loggedOut.status, 200);
    const afterLogout = await fetch(`${origin}/api/auth/me`, { headers: { cookie: setCookie! } });
    assert.deepEqual((await afterLogout.json() as { user: unknown }).user, null);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});

test('未登录和普通成员不能读取管理后台摘要', async () => {
  const { app, database } = createApp();
  const { server, origin } = await listen(app);
  try {
    assert.equal((await fetch(`${origin}/api/admin/summary`)).status, 401);
    const registered = await fetch(`${origin}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'first@example.com', password: 'correct-horse' }),
    });
    const firstCookie = registered.headers.get('set-cookie')!;
    database.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run('first@example.com');
    const second = await fetch(`${origin}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'member@example.com', password: 'correct-horse' }),
    });
    const memberCookie = second.headers.get('set-cookie')!;
    assert.equal((await fetch(`${origin}/api/admin/summary`, { headers: { cookie: memberCookie } })).status, 403);
    assert.equal((await fetch(`${origin}/api/admin/summary`, { headers: { cookie: firstCookie } })).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
  }
});
