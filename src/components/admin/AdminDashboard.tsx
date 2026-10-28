// Adapted from shadcn-admin src/features/dashboard/index.tsx (MIT).
// Preserves its heading, metric grid and lower content grid; no demo data or charts.
// Source commit and complete license: THIRD_PARTY_NOTICES.md.
import { Database, ShieldCheck, User } from '../../lib/remixIconShim';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Separator } from '../ui/Separator';
import { AdminMain } from './AdminMain';
import type { AdminSummary } from './adminApi';

export function AdminDashboard({ summary, onRefresh, busy }: {
  summary: AdminSummary;
  onRefresh: () => void;
  busy: boolean;
}) {
  const metrics = [
    { label: '用户总数', value: summary.metrics.users, detail: '已登记的账户数量', icon: User },
    { label: '有效会话', value: summary.metrics.activeSessions, detail: '尚未过期的会话，非在线人数', icon: ShieldCheck },
    { label: '有效资产', value: summary.metrics.assets, detail: '当前标记为有效的资产数量', icon: Database },
  ];
  return (
    <AdminMain>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">管理总览</h1><p className="mt-2 text-sm text-muted-foreground">当前数据库返回的账户、会话与资产统计。</p></div>
        <Button variant="outline" disabled={busy} onClick={onRefresh}>{busy ? '正在刷新…' : '刷新数据'}</Button>
      </div>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(({ label, value, detail, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-0 pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon size={16} className="text-muted-foreground" aria-hidden="true" /></CardHeader>
              <CardContent><div className="text-2xl font-bold tabular-nums">{value.toLocaleString('zh-CN')}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
          <Card className="col-span-1 lg:col-span-4">
            <CardHeader className="flex-col items-start border-0"><CardTitle>服务状态</CardTitle><CardDescription>仅显示本次统计接口返回的状态。</CardDescription></CardHeader>
            <CardContent>
              <dl className="text-sm">
                <div className="flex items-center justify-between gap-4 py-3"><dt>数据库</dt><dd className="break-words text-right">{summary.status.database}</dd></div>
                <Separator />
                <div className="flex items-center justify-between gap-4 py-3"><dt>账户服务</dt><dd className="break-words text-right">{summary.status.auth}</dd></div>
              </dl>
            </CardContent>
          </Card>
          <Card className="col-span-1 lg:col-span-3">
            <CardHeader className="flex-col items-start border-0"><CardTitle>当前账户</CardTitle><CardDescription>本次统计请求已通过管理员权限校验。</CardDescription></CardHeader>
            <CardContent><p className="break-all text-sm">{summary.user.email}</p><p className="mt-2 text-xs text-muted-foreground">角色：管理员</p></CardContent>
          </Card>
        </div>
      </div>
    </AdminMain>
  );
}
