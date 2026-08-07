import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2 as LoaderCircle,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { assetService } from '../../services/assetService';
import type { DurableTask } from '../../types/asset.types';
import { Badge, Button, Card, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui';

const statusLabel: Record<DurableTask['status'], string> = {
  queued: '等待中',
  running: '处理中',
  waiting_for_user: '等待确认',
  completed: '已完成',
  failed: '已失败',
  cancelled: '已取消',
};

export const TaskDrawer = ({
  open,
  onClose,
  refreshKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
}) => {
  const [tasks, setTasks] = useState<DurableTask[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = () =>
      assetService
        .tasks()
        .then((items) => active && setTasks(items))
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 1200);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [open, refreshKey]);

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" showOverlay={false} showCloseButton={false} className="flex w-[min(380px,calc(100vw-24px))] max-w-none flex-col border-border p-0">
      <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-4">
        <div><SheetTitle className="text-sm">任务与导入记录</SheetTitle><SheetDescription className="mt-1 text-xs">后台导入与预览处理状态</SheetDescription></div>
        <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="关闭任务抽屉"><X size={15} /></Button>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {tasks.length ? (
          tasks.map((task) => {
            const active = task.status === 'running' || task.status === 'queued';
            const failed = task.status === 'failed';
            return (
              <Card key={task.id} padding="sm">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl',
                      active
                        ? 'bg-primary/15 text-foreground'
                        : failed
                          ? 'bg-red-50 text-red-500 dark:bg-red-500/10'
                          : task.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
                            : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {active ? (
                      <LoaderCircle
                        size={15}
                        className={task.status === 'running' ? 'animate-spin' : ''}
                      />
                    ) : failed ? (
                      <AlertCircle size={15} />
                    ) : task.status === 'completed' ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <Clock3 size={15} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">
                        {task.type.replace('.', ' / ')}
                      </span>
                      <Badge variant={failed ? 'destructive' : active ? 'default' : 'secondary'} className="shrink-0 text-xs">{statusLabel[task.status]}</Badge>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {task.currentStep || '等待处理'}
                    </div>
                    {active && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.max(task.progress * 100, 4)}%` }}
                        />
                      </div>
                    )}
                    {failed && (
                      <div className="mt-2 text-xs leading-4 text-red-500">
                        {task.error?.message || '任务执行失败'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-1">
                  {active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => assetService.cancelTask(task.id)}
                      className="h-7 px-2 text-xs"
                    >
                      <Square size={10} />
                      取消
                    </Button>
                  )}
                  {(failed || task.status === 'cancelled') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => assetService.retryTask(task.id)}
                      className="h-7 px-2 text-xs"
                    >
                      <RotateCcw size={11} />
                      重试
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        ) : (
          <div className="flex h-60 flex-col items-center justify-center text-center text-muted-foreground">
            <Clock3 size={24} />
            <div className="mt-3 text-xs font-semibold">暂无后台任务</div>
            <div className="mt-1 text-xs">导入和预览进度会显示在这里</div>
          </div>
        )}
      </div>
      </SheetContent>
    </Sheet>
  );
};
