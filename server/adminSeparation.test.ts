import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminApp, fetchAdminSession } from '../src/components/admin/AdminApp';
import { AdminDashboard } from '../src/components/admin/AdminDashboard';
import { AdminLogin } from '../src/components/admin/AdminLogin';
import { adminRequest, AdminRequestError, readSession, readSummary } from '../src/components/admin/adminApi';
const read = (name: string) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('public entry and navigation do not import or expose admin', async () => {
  for (const file of ['src/App.tsx', 'src/components/layout/ProjectSidebar.tsx']) {
    const source = await read(file);
    assert.doesNotMatch(source, /import.*(?:AdminDashboard|AdminApp|components\/admin)|module: 'admin'|<AdminDashboard/);
  }
  assert.doesNotMatch(await read('src/stores/useUIStore.ts'), /\| 'admin'/);
});

test('admin has a separate local-only build without the privileged API gateway', async () => {
  const config = await read('vite.admin.config.ts');
  assert.match(config, /127\.0\.0\.1/);
  assert.match(config, /5180/);
  assert.match(config, /strictPort: true/);
  assert.match(config, /dist-admin/);
  assert.doesNotMatch(config, /createApiApp/);
  assert.match(await read('admin/index.html'), /noindex,nofollow/);
  assert.match(await read('src/admin-main.tsx'), /AdminApp/);
});

test('admin initializes the existing root dark theme before rendering', async () => {
  const source = await read('src/admin-main.tsx');
  const dark = "document.documentElement.classList.add('dark');";
  const theme = "document.documentElement.dataset.theme = 'default';";
  const render = source.indexOf('ReactDOM.createRoot');
  assert.ok(source.includes(dark) && source.indexOf(dark) < render);
  assert.ok(source.includes(theme) && source.indexOf(theme) < render);
  assert.doesNotMatch(source, /localStorage|useUIStore/);
});

test('dashboard removes sample activities and keeps any separators in normal flow', async () => {
  const source = await read('src/components/admin/AdminDashboard.tsx');
  assert.doesNotMatch(source, /recentActivity|2 分钟前|完成率 92%|1,284/);
  assert.doesNotMatch(source, /<Separator[^>]*absolute/);
  const separator = await read('src/components/ui/Separator.tsx');
  assert.doesNotMatch(separator, /\babsolute\b/);
});

const user = { id: 'test-admin', email: 'admin@example.test', role: 'admin' as const, createdAt: 1 };
const summary = { user, metrics: { users: 7, activeSessions: 3, assets: 19 }, status: { database: '检查中', auth: '可用' } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('guest and member sessions never request privileged summary', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (path: string, options: RequestInit) => {
    assert.equal(path, '/api/auth/me');
    assert.equal(options.credentials, 'same-origin');
    calls++;
    return json({ user: calls === 1 ? null : { ...user, role: 'member' } });
  });
  assert.deepEqual(await fetchAdminSession(), { kind: 'guest' });
  assert.equal((await fetchAdminSession()).kind, 'member');
  assert.equal(calls, 2);
});

test('admin loads only validated real summary and forwards cancellation', async (t) => {
  const controller = new AbortController();
  const paths: string[] = [];
  t.mock.method(globalThis, 'fetch', async (path: string, options: RequestInit) => {
    paths.push(path);
    assert.equal(options.signal, controller.signal);
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    return json(path === '/api/auth/me' ? { user } : summary);
  });
  const result = await fetchAdminSession(controller.signal);
  assert.equal(result.kind, 'admin');
  if (result.kind === 'admin') assert.deepEqual(result.summary, summary);
  assert.deepEqual(paths, ['/api/auth/me', '/api/admin/summary']);
});

test('expired session and revoked role cannot retain the dashboard', async (t) => {
  let summaryStatus = 401;
  let meCalls = 0;
  t.mock.method(globalThis, 'fetch', async (path: string) => {
    if (path === '/api/admin/summary') return json({ error: '无权访问' }, summaryStatus);
    meCalls++;
    return json({ user: { ...user, role: meCalls === 3 ? 'member' : 'admin' } });
  });
  assert.equal((await fetchAdminSession()).kind, 'guest');
  summaryStatus = 403;
  assert.equal((await fetchAdminSession()).kind, 'member');
});

test('request failures surface the server error instead of sample data', async (t) => {
  t.mock.method(globalThis, 'fetch', async (path: string) => json(path === '/api/auth/me' ? { user } : { error: '数据库暂不可用' }, path === '/api/auth/me' ? 200 : 503));
  await assert.rejects(fetchAdminSession(), (error: unknown) => error instanceof AdminRequestError && error.status === 503 && error.message === '数据库暂不可用');
});

test('HTML fallback and invalid summary cannot be interpreted as successful auth or zero data', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Vite fallback</html>'));
  await assert.rejects(fetchAdminSession(), /账户服务返回格式异常/);
  assert.throws(() => readSession({ user: { role: 'admin' } }), /格式异常/);
  for (const value of [-1, '7', null, 1.5]) {
    assert.throws(() => readSummary({ ...summary, metrics: { ...summary.metrics, users: value } }), /格式异常/);
  }
  assert.equal(readSummary({ ...summary, metrics: { users: 0, activeSessions: 0, assets: 0 } }).metrics.assets, 0);
});

test('login and logout requests use same-origin cookies and preserve failed status', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_path: string, options: RequestInit) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    return json({ error: '请求未完成' }, 403);
  });
  await assert.rejects(adminRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: user.email, password: 'test-only-password' }) }), /请求未完成/);
  await assert.rejects(adminRequest('/api/auth/logout', { method: 'POST' }), /请求未完成/);
});

test('rendered dashboard uses supplied status and metrics without mock actions', () => {
  const html = renderToStaticMarkup(createElement(AdminDashboard, { summary, busy: false, onRefresh: () => {} }));
  assert.match(html, /检查中/);
  assert.match(html, /可用/);
  assert.match(html, />19</);
  assert.match(html, />7</);
  assert.match(html, />3</);
  assert.match(html, /刷新数据/);
  assert.doesNotMatch(html, /导出报告|最近活动|正常|Download/);
  const login = renderToStaticMarkup(createElement(AdminLogin, { busy: false, error: '登录失败', onLogin: async () => {} }));
  assert.match(login, /登录失败/);
  assert.match(login, /autocomplete="current-password"/i);
  assert.doesNotMatch(login, /GitHub|Facebook|忘记密码/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(AdminApp)), /有效资产|当前数据库返回/);
});

test('upstream attribution is pinned and preserves the full MIT notice', async () => {
  const notices = await read('THIRD_PARTY_NOTICES.md');
  assert.match(notices, /e16c87f213a5ba5e45964e9b67c792105ec74d26/);
  assert.match(notices, /Copyright \(c\) 2024 Sat Naing/);
  assert.match(notices, /THE SOFTWARE IS PROVIDED "AS IS"/);
});
