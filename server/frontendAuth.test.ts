import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, test } from 'node:test';
import { authService, type AuthUser } from '../src/services/authService';
import { useAuthStore } from '../src/stores/useAuthStore';
import { validateAuthForm } from '../src/components/auth/authValidation';

const user: AuthUser = { id: 'member-1', email: 'member@example.com', role: 'member', createdAt: 1234 };
const credentials = { email: ' member@example.com ', password: ' unchanged password ' };
const resetStore = () => useAuthStore.setState({ user: null, pending: null, error: null });
beforeEach(resetStore);
afterEach(resetStore);

test('auth requests use same-origin cookies, exact endpoints and uncached identity', async (t) => {
  const calls: Array<{ path: unknown; options: RequestInit | undefined }> = [];
  t.mock.method(globalThis, 'fetch', async (path: unknown, options?: RequestInit) => {
    calls.push({ path, options });
    return Response.json(path === '/api/auth/logout' ? { ok: true } : { user });
  });
  assert.deepEqual(await authService.me(), user);
  assert.deepEqual(await authService.login(credentials), user);
  assert.deepEqual(await authService.register(credentials), user);
  await authService.logout();
  assert.deepEqual(calls.map((call) => call.path), [
    '/api/auth/me', '/api/auth/login', '/api/auth/register', '/api/auth/logout',
  ]);
  assert.deepEqual(calls.map((call) => call.options?.method), ['GET', 'POST', 'POST', 'POST']);
  for (const call of calls) {
    assert.equal(call.options?.credentials, 'same-origin');
    assert.equal(call.options?.cache, 'no-store');
  }
  for (const call of calls.slice(1, 3)) {
    assert.deepEqual(call.options?.headers, { 'Content-Type': 'application/json' });
    assert.deepEqual(JSON.parse(String(call.options?.body)), {
      email: 'member@example.com', password: credentials.password,
    });
  }
  assert.equal(calls[0].options?.body, undefined);
  assert.equal(calls[3].options?.body, undefined);
});

test('identity refresh accepts a real signed-out response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ user: null }));
  useAuthStore.setState({ user });
  assert.equal(await useAuthStore.getState().refreshUser(), true);
  assert.equal(useAuthStore.getState().user, null);
});

test('login and registration update identity only after server confirmation', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ user }));
  assert.equal(await useAuthStore.getState().login(credentials), true);
  assert.deepEqual(useAuthStore.getState().user, user);
  resetStore();
  assert.equal(await useAuthStore.getState().register(credentials), true);
  assert.deepEqual(useAuthStore.getState().user, user);
  assert.equal(useAuthStore.getState().pending, null);
  assert.equal(useAuthStore.getState().error, null);
});

test('backend errors remain visible and do not create an identity', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: '邮箱或密码不正确' }, { status: 401 }));
  assert.equal(await useAuthStore.getState().login(credentials), false);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().error, '邮箱或密码不正确');
  assert.equal(useAuthStore.getState().pending, null);
});

test('registration conflict surfaces the backend message without fake success', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: '该邮箱已注册，请直接登录' }, { status: 409 }));
  assert.equal(await useAuthStore.getState().register(credentials), false);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().error, '该邮箱已注册，请直接登录');
});

test('offline backend is an actionable error, not a local login fallback', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(await useAuthStore.getState().login(credentials), false);
  assert.equal(useAuthStore.getState().user, null);
  assert.match(useAuthStore.getState().error || '', /无法连接账户服务/);
});

test('a static HTML fallback or malformed identity cannot count as authenticated', async (t) => {
  const responses = [
    new Response('<html>SPA fallback</html>'),
    Response.json({}),
    Response.json({ user: null }),
    Response.json({ user: { ...user, role: 'owner' } }),
    Response.json({ user: { ...user, createdAt: '1234' } }),
    Response.json({ user: { ...user, id: '' } }),
  ];
  t.mock.method(globalThis, 'fetch', async () => responses.shift()!);
  for (let index = 0; index < 6; index += 1) {
    assert.equal(await useAuthStore.getState().login(credentials), false);
    assert.equal(useAuthStore.getState().user, null);
    assert.match(useAuthStore.getState().error || '', /无效/);
  }
});

test('non-JSON failure preserves an actionable service error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('not found', { status: 404 }));
  await assert.rejects(authService.me(), /账户服务暂时不可用/);
});

test('failed identity refresh clears stale user and can recover', async (t) => {
  let unavailable = true;
  t.mock.method(globalThis, 'fetch', async () => unavailable
    ? Response.json({ error: '账户服务暂时不可用' }, { status: 503 })
    : Response.json({ user }));
  useAuthStore.setState({ user });
  assert.equal(await useAuthStore.getState().refreshUser(), false);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().error, '账户服务暂时不可用');
  unavailable = false;
  assert.equal(await useAuthStore.getState().refreshUser(), true);
  assert.deepEqual(useAuthStore.getState().user, user);
  assert.equal(useAuthStore.getState().error, null);
});

test('logout clears identity only after ok:true and preserves it on failure', async (t) => {
  const responses = [
    Response.json({ error: '退出失败' }, { status: 500 }),
    Response.json({ ok: false }),
    Response.json({ ok: true }),
  ];
  t.mock.method(globalThis, 'fetch', async () => responses.shift()!);
  useAuthStore.setState({ user });
  assert.equal(await useAuthStore.getState().logout(), false);
  assert.deepEqual(useAuthStore.getState().user, user);
  assert.equal(useAuthStore.getState().error, '退出失败');
  assert.equal(await useAuthStore.getState().logout(), false);
  assert.deepEqual(useAuthStore.getState().user, user);
  assert.equal(await useAuthStore.getState().logout(), true);
  assert.equal(useAuthStore.getState().user, null);
});

test('pending actions block duplicate submits and racing identity refreshes', async (t) => {
  let resolve!: (response: Response) => void;
  const fetchMock = t.mock.method(globalThis, 'fetch', () => new Promise<Response>((done) => { resolve = done; }));
  const login = useAuthStore.getState().login(credentials);
  assert.equal(useAuthStore.getState().pending, 'login');
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(await useAuthStore.getState().login(credentials), false);
  assert.equal(await useAuthStore.getState().refreshUser(), false);
  assert.equal(await useAuthStore.getState().logout(), false);
  assert.equal(fetchMock.mock.callCount(), 1);
  resolve(Response.json({ user }));
  assert.equal(await login, true);
  assert.deepEqual(useAuthStore.getState().user, user);
  assert.equal(useAuthStore.getState().pending, null);
});

test('registration validates confirmation without trimming passwords', () => {
  assert.equal(validateAuthForm('register', 'member@example.com', 'password1', 'password2'), '两次输入的密码不一致');
  assert.equal(validateAuthForm('register', 'member@example.com', ' password1 ', 'password1'), '两次输入的密码不一致');
  assert.equal(validateAuthForm('register', ' member@example.com ', 'password1', 'password1'), null);
  assert.equal(validateAuthForm('login', 'member@example.com', 'password1', ''), null);
  assert.match(validateAuthForm('register', 'bad-email', 'password1', 'password1') || '', /邮箱/);
  assert.match(validateAuthForm('register', 'member@example.com', 'short', 'short') || '', /密码/);
  assert.match(validateAuthForm('register', 'member@example.com', 'x'.repeat(201), 'x'.repeat(201)) || '', /密码/);
});

test('frontend auth uses semantic forms and never imports admin or persists credentials', async () => {
  const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const dialog = await read('src/components/auth/AuthDialog.tsx');
  assert.match(dialog, /<form onSubmit=\{submit\}/);
  assert.match(dialog, /type="submit"/);
  assert.match(dialog, /autoComplete="username"/);
  assert.match(dialog, /'new-password' : 'current-password'/);
  assert.match(dialog, /name="confirmPassword" type="password" autoComplete="new-password"/);
  assert.match(dialog, /role="alert"/);
  assert.match(dialog, /aria-busy=\{busy\}/);
  for (const path of [
    'src/components/layout/ProjectSidebar.tsx',
    'src/components/auth/AuthDialog.tsx',
    'src/components/auth/authValidation.ts',
    'src/services/authService.ts',
    'src/stores/useAuthStore.ts',
  ]) {
    const source = await read(path);
    assert.doesNotMatch(source, /localStorage|sessionStorage|zustand\/middleware|from ['"][^'"]*admin\//);
  }
  assert.doesNotMatch(JSON.stringify(useAuthStore.getState()), /password|session|token/);
});

test('account entry supports top navigation and follows hidden navigation preview', async () => {
  const source = await readFile(new URL('../src/components/layout/ProjectSidebar.tsx', import.meta.url), 'utf8');
  const entry = source.slice(source.indexOf('</nav>'), source.indexOf('{contextMenu && contextProject'));
  assert.match(entry, /\(!sidebarHidden \|\| temporarilyRevealed\) &&/);
  assert.doesNotMatch(entry, /!horizontal &&/);
  assert.match(entry, /horizontal \? 'flex h-full items-center px-2' :/);
  assert.match(entry, /horizontal\s*\? 'h-8 min-w-\[84px\] justify-center gap-2 px-3 text-xs'/);
  assert.match(entry, /'shrink-0', horizontal/);
  assert.match(entry, /'px-2 pb-3', !visuallyExpanded && 'px-1'/);
  assert.match(entry, /'h-10 w-full justify-start gap-3 px-3 text-sm'/);
  assert.match(entry, /'h-12 w-14 flex-col justify-center gap-1 px-0 text-\[10px\] leading-none'/);
  assert.match(entry, /ref=\{loginTriggerRef\}/);
});

test('account identity copy supports local and online account services', async () => {
  const source = await readFile(new URL('../src/components/auth/AuthDialog.tsx', import.meta.url), 'utf8');
  assert.match(source, /账户身份由账户服务验证。/);
  assert.doesNotMatch(source, /账户身份由本地账户服务验证/);
});
