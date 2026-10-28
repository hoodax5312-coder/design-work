import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { AdminDashboard } from './AdminDashboard';
import { AdminLayout } from './AdminLayout';
import { AdminLogin } from './AdminLogin';
import { adminRequest, AdminRequestError, readSession, readSummary, type AdminSummary, type AdminUser } from './adminApi';

type SessionState =
  | { kind: 'checking' }
  | { kind: 'guest' }
  | { kind: 'member'; user: AdminUser }
  | { kind: 'admin'; user: AdminUser; summary: AdminSummary }
  | { kind: 'error' };

const errorMessage = (error: unknown) => error instanceof Error ? error.message : '请求失败，请稍后重试。';

export async function fetchAdminSession(signal?: AbortSignal): Promise<SessionState> {
  let user: AdminUser | null;
  try { user = readSession(await adminRequest('/api/auth/me', { signal })); }
  catch (error) {
    if (error instanceof AdminRequestError && error.status === 401) return { kind: 'guest' };
    throw error;
  }
  if (!user) return { kind: 'guest' };
  if (user.role !== 'admin') return { kind: 'member', user };
  try {
    const summary = readSummary(await adminRequest('/api/admin/summary', { signal }));
    if (summary.user.id !== user.id) throw new Error('登录账户已变更，请重新验证。');
    return { kind: 'admin', user: summary.user, summary };
  } catch (error) {
    if (error instanceof AdminRequestError && error.status === 401) return { kind: 'guest' };
    if (error instanceof AdminRequestError && error.status === 403) {
      // Recheck the role after a server-side permission change; never retain stale admin data.
      const current = readSession(await adminRequest('/api/auth/me', { signal }));
      if (!current) return { kind: 'guest' };
      if (current.role === 'member') return { kind: 'member', user: current };
    }
    throw error;
  }
}

export function AdminApp() {
  const [session, setSession] = useState<SessionState>({ kind: 'checking' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetchAdminSession(controller.signal).then((next) => {
      if (!controller.signal.aborted) setSession(next);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(errorMessage(cause));
      setSession({ kind: 'error' });
    });
    return () => controller.abort();
  }, []);

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSession({ kind: 'checking' });
    try { setSession(await fetchAdminSession()); }
    catch (cause) { setError(errorMessage(cause)); setSession({ kind: 'error' }); }
    finally { setBusy(false); }
  };
  const login = async (email: string, password: string) => {
    setBusy(true);
    setError('');
    try {
      await adminRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      const next = await fetchAdminSession();
      if (next.kind === 'guest') throw new Error('登录后未建立有效会话，请重试。');
      setSession(next);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await adminRequest('/api/auth/logout', { method: 'POST' });
      const user = readSession(await adminRequest('/api/auth/me'));
      if (user) throw new Error('服务端会话仍有效，退出未完成，请重试。');
      setSession({ kind: 'guest' });
    } catch (cause) { setError(`退出未确认：${errorMessage(cause)}`); }
    finally { setBusy(false); }
  };

  if (session.kind === 'guest') return <AdminLogin busy={busy} error={error} onLogin={login} />;
  if (session.kind === 'admin') return (
    <AdminLayout user={session.user} busy={busy} onLogout={logout}>
      {error && <p role="alert" className="px-6 pt-4 text-sm text-destructive">{error}</p>}
      <AdminDashboard summary={session.summary} onRefresh={refresh} busy={busy} />
    </AdminLayout>
  );
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">{session.kind === 'checking' ? '正在验证账户…' : session.kind === 'member' ? '暂无管理权限' : '后台暂时无法加载'}</h1>
        {session.kind === 'checking' && <p role="status" className="text-sm text-muted-foreground">正在获取账户与实时统计，请稍候。</p>}
        {session.kind === 'member' && <><p className="break-all text-sm text-muted-foreground">{session.user.email} 是普通成员，无法访问管理数据。请退出后使用管理员账户登录。</p><Button disabled={busy} onClick={logout}>{busy ? '正在退出…' : '退出登录'}</Button></>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {session.kind === 'error' && <Button onClick={refresh} disabled={busy}>重新验证</Button>}
      </div>
    </main>
  );
}
