import { useId, useState, type FormEvent } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/Dialog';
import { validateAuthForm } from './authValidation';

interface AuthDialogProps {
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
}

export const AuthDialog = ({ onOpenChange, onCloseAutoFocus }: AuthDialogProps) => {
  const { user, pending, error, login, register, logout, refreshUser, clearError } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const id = useId();
  const busy = pending !== null;
  const message = validationError || error;
  const registering = mode === 'register';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const invalid = validateAuthForm(mode, email, password, confirmation);
    setValidationError(invalid);
    if (invalid) return;
    const succeeded = await (registering ? register : login)({ email, password });
    if (succeeded) {
      setPassword('');
      setConfirmation('');
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{user ? '当前账户' : registering ? '注册栗作' : '登录栗作'}</DialogTitle>
          <DialogDescription>
            {user ? '账户身份由账户服务验证。' : '使用邮箱和密码登录，或注册新账户。'}
          </DialogDescription>
        </DialogHeader>
        {user ? (
          <div className="flex flex-col gap-3" aria-busy={busy}>
            <p className="break-all text-sm">{user.email}</p>
            <p className="text-xs text-muted-foreground">{user.role === 'admin' ? '管理员' : '成员'}</p>
            {message && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{message}</p>}
            <DialogFooter>
              <Button type="button" disabled={busy} onClick={() => void refreshUser()}>
                {pending === 'refresh' ? '正在刷新身份…' : '刷新身份'}
              </Button>
              <Button type="button" variant="primary" disabled={busy} onClick={() => void logout()}>
                {pending === 'logout' ? '正在退出…' : '退出登录'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3" aria-busy={busy}>
            <label htmlFor={`${id}-email`} className="text-sm">邮箱</label>
            <Input
              id={`${id}-email`} name="email" type="email" autoComplete="username"
              placeholder="请输入邮箱" required maxLength={254} disabled={busy}
              value={email} onChange={(event) => setEmail(event.target.value)}
              aria-describedby={message ? `${id}-error` : undefined}
              aria-invalid={validationError ? true : undefined}
            />
            <label htmlFor={`${id}-password`} className="text-sm">密码</label>
            <Input
              id={`${id}-password`} name="password" type="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
              placeholder="8–200 位密码" required minLength={8} maxLength={200} disabled={busy}
              value={password} onChange={(event) => setPassword(event.target.value)}
              aria-describedby={`${id}-password-help${message ? ` ${id}-error` : ''}`}
              aria-invalid={validationError ? true : undefined}
            />
            <p id={`${id}-password-help`} className="text-xs text-muted-foreground">密码需要 8–200 位。</p>
            {registering && (
              <>
                <label htmlFor={`${id}-confirmation`} className="text-sm">确认密码</label>
                <Input
                  id={`${id}-confirmation`} name="confirmPassword" type="password" autoComplete="new-password"
                  placeholder="再次输入密码" required minLength={8} maxLength={200} disabled={busy}
                  value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
                  aria-describedby={message ? `${id}-error` : undefined}
                  aria-invalid={validationError ? true : undefined}
                />
              </>
            )}
            {message && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{message}</p>}
            {pending === 'refresh' && <p role="status" className="text-xs text-muted-foreground">正在刷新身份…</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => {
                setMode(registering ? 'login' : 'register');
                setPassword('');
                setConfirmation('');
                setValidationError(null);
                clearError();
              }}>
                {registering ? '已有账户，去登录' : '没有账户，去注册'}
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {pending === 'register' ? '正在注册…' : pending === 'login' ? '正在登录…' : registering ? '注册' : '登录'}
              </Button>
            </DialogFooter>
            <Button type="button" variant="link" className="self-start text-xs" disabled={busy} onClick={() => {
              setValidationError(null);
              void refreshUser();
            }}>刷新身份</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
