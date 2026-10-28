// Adapted from shadcn-admin authenticated-layout.tsx, app-sidebar.tsx and header.tsx.
// MIT, Copyright (c) 2024 Sat Naing. Pinned source: THIRD_PARTY_NOTICES.md.
import { useState, type ReactNode } from 'react';
import { LayoutGrid, PanelLeft, Power, ShieldCheck } from '../../lib/remixIconShim';
import { Button } from '../ui/Button';
import { Separator } from '../ui/Separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '../ui/Sheet';
import { cn } from '../../lib/utils';
import type { AdminUser } from './adminApi';

interface AdminLayoutProps {
  user: AdminUser;
  busy: boolean;
  onLogout: () => void;
  children: ReactNode;
}

export function AdminLayout({ user, busy, onLogout, children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigation = (compact = false) => (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 px-4">
        <ShieldCheck size={24} aria-hidden="true" />
        {!compact && <div><p className="font-semibold">栗作 LIZUO</p><p className="text-xs text-muted-foreground">私有管理后台</p></div>}
      </div>
      <nav aria-label="后台导航" className="flex-1 px-3 py-4">
        {!compact && <p className="mb-3 px-2 text-xs text-muted-foreground">管理</p>}
        <a href="#admin-main" aria-current="page" title="总览" onClick={() => setMobileOpen(false)} className={cn('flex h-10 items-center gap-3 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring', compact && 'justify-center px-0')}>
          <LayoutGrid size={18} aria-hidden="true" /><span className={compact ? 'sr-only' : undefined}>总览</span>
        </a>
      </nav>
      <div className="space-y-3 border-t border-border p-3">
        {!compact && <div className="px-2"><p className="truncate text-sm" title={user.email}>{user.email}</p><p className="mt-1 text-xs text-muted-foreground">管理员 · 受限访问</p></div>}
        <Button variant="ghost" className={cn('w-full justify-start', compact && 'justify-center px-0')} title="退出登录" aria-label="退出登录" disabled={busy} onClick={onLogout}>
          <Power size={16} aria-hidden="true" />{!compact && (busy ? '正在退出…' : '退出登录')}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <a href="#admin-main" className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">跳转到主内容</a>
      <aside className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-muted/30 md:flex', collapsed ? 'w-16' : 'w-60')}>
        {navigation(collapsed)}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background">
          <div className="relative flex h-full items-center gap-3 p-4 sm:gap-4">
            <Button variant="outline" size="iconSm" className="hidden md:inline-flex" aria-label={collapsed ? '展开侧栏' : '收起侧栏'} title={collapsed ? '展开侧栏' : '收起侧栏'} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><PanelLeft size={18} aria-hidden="true" /></Button>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild><Button variant="outline" size="iconSm" className="md:hidden" aria-label="打开导航" title="打开导航"><PanelLeft size={18} aria-hidden="true" /></Button></SheetTrigger>
              <SheetContent side="left" className="dark flex w-72 flex-col bg-background text-foreground">
                <SheetTitle className="sr-only">后台导航</SheetTitle>
                <SheetDescription className="sr-only">管理总览及当前账户</SheetDescription>
                {navigation()}
              </SheetContent>
            </Sheet>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm font-medium">总览</span>
            <span className="ml-auto truncate text-xs text-muted-foreground" title={user.email}>{user.email}</span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
