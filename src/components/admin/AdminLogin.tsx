// Adapted from shadcn-admin src/features/auth/sign-in/index.tsx (MIT).
// Real same-origin authentication replaces upstream demo auth. See THIRD_PARTY_NOTICES.md.
import { useState, type FormEvent } from 'react';
import { ShieldCheck } from '../../lib/remixIconShim';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';

export function AdminLogin({ busy, error, onLogin }: {
  busy: boolean;
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    try { await onLogin(email.trim(), password); } finally { setPassword(''); }
  };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={24} aria-hidden="true" />栗作 LIZUO</div>
      <Card className="w-full max-w-sm" padding="lg">
        <CardHeader className="flex-col items-start border-0 pb-4">
          <CardTitle className="text-lg tracking-tight">登录管理后台</CardTitle>
          <CardDescription>使用已有管理员账户登录。后台不提供注册，请在前台注册并由运维授权。</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <form className="space-y-4" onSubmit={submit} aria-busy={busy}>
            <div className="space-y-2"><label htmlFor="admin-email" className="text-sm font-medium">邮箱</label><Input id="admin-email" type="email" autoComplete="username" required value={email} disabled={busy} aria-describedby={error ? 'admin-login-error' : undefined} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="space-y-2"><label htmlFor="admin-password" className="text-sm font-medium">密码</label><Input id="admin-password" type="password" autoComplete="current-password" required value={password} disabled={busy} aria-describedby={error ? 'admin-login-error' : undefined} onChange={(event) => setPassword(event.target.value)} /></div>
            {error && <p id="admin-login-error" role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>{busy ? '正在验证…' : '登录'}</Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">仅管理员可查看真实统计与系统状态</p>
    </main>
  );
}
