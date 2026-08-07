import { useMemo, useState } from 'react';
import { AlertTriangle, Check, FilePlus2, X } from 'lucide-react';
import { assetService } from '../../services/assetService';
import type { ImportItem, ImportSession } from '../../types/asset.types';
import { Alert, AlertDescription, Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select } from '../ui';

type Decision = NonNullable<ImportItem['decision']>;

export const ImportCenter = ({
  session,
  onClose,
  onCommitted,
}: {
  session: ImportSession;
  onClose: () => void;
  onCommitted: (taskId: string) => void;
}) => {
  const initial = useMemo(
    () =>
      Object.fromEntries(
        session.items.map((item) => [
          item.id,
          item.decision ||
            (item.duplicateAssetId || item.duplicateItemId ? 'merge_path' : 'import_new'),
        ]),
      ) as Record<string, Decision>,
    [session.items],
  );
  const [decisions, setDecisions] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const commit = async () => {
    setSaving(true);
    setError('');
    try {
      await assetService.saveImportDecisions(
        session.id,
        session.items.map((item) => ({
          itemId: item.id,
          decision: decisions[item.id],
        })),
      );
      const task = await assetService.confirmImport(session.id);
      onCommitted(task.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent showCloseButton={false} className="flex max-h-[82vh] max-w-[880px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center justify-between border-b border-border px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-foreground text-background">
              <FilePlus2 size={18} />
            </span>
            <div>
              <DialogTitle className="text-sm">确认导入内容</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {session.items.length} 个文件 · {session.summary.conflicts || 0} 个重复候选
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭导入确认"
          >
            <X size={16} />
          </Button>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[minmax(220px,1fr)_110px_180px] gap-3 border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span>文件</span>
              <span>建议类型</span>
              <span>导入策略</span>
            </div>
            <div className="divide-y divide-border">
              {session.items.map((item) => {
                const conflict = Boolean(item.duplicateAssetId || item.duplicateItemId);
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(220px,1fr)_110px_180px] items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={conflict ? 'text-amber-500' : 'text-[#c8ff00]'}>
                          {conflict ? <AlertTriangle size={14} /> : <Check size={14} />}
                        </span>
                        <span className="truncate text-xs font-semibold">{item.fileName}</span>
                      </div>
                      <div className="mt-1 truncate pl-[22px] font-mono text-xs text-muted-foreground">
                        {item.absolutePath}
                      </div>
                    </div>
                    <Badge variant="secondary" className="w-fit text-xs uppercase">{item.suggestedType}</Badge>
                    <Select
                      value={decisions[item.id]}
                      onChange={(event) =>
                        setDecisions((current) => ({
                          ...current,
                          [item.id]: event.target.value as Decision,
                        }))
                      }
                      selectSize="sm"
                      className="text-xs"
                      options={[
                        { value: 'import_new', label: '作为新资产' },
                        ...(conflict ? [{ value: 'merge_path', label: '合并为同一资产' }] : []),
                        { value: 'keep_separate', label: '独立保留' },
                        { value: 'skip', label: '跳过' },
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 items-center justify-between border-t border-border px-5 py-4 sm:justify-between">
          <div className="text-xs text-muted-foreground">原文件只保存路径引用，不会复制到资产库。</div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>取消</Button>
            <Button variant="primary" size="sm" onClick={commit} loading={saving}>确认并导入</Button>
          </div>
        </DialogFooter>
        {error && (
          <Alert variant="destructive" className="rounded-none border-x-0 border-b-0 px-5 py-2 text-xs">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};
