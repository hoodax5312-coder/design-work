import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe2, GripVertical, Pencil, Plus, RefreshCw, Trash2 } from '@/lib/remixIconShim';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Switch } from '../../ui/Switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/Dialog';

type CatalogSource = {
  id: string;
  manifestId: string;
  name: string;
  manifestUrl?: string;
  homepageUrl: string | null;
  itemCount: number;
  enabled: boolean;
};
const call = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '操作失败');
  return data;
};
export function PromptSourcesSettings() {
  const [catalogSources, setCatalogSources] = useState<CatalogSource[]>([]);
  const [catalogEnabled, setCatalogEnabled] = useState<Record<string, boolean>>({});
  const [draggedCatalogId, setDraggedCatalogId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [addName, setAddName] = useState('');
  const [addManifestUrl, setAddManifestUrl] = useState('');
  const [addHomepageUrl, setAddHomepageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [headerActions, setHeaderActions] = useState<HTMLElement | null>(null);
  const load = async () => {
    const data = await call('/api/prompt-sources/catalog');
    const sources: CatalogSource[] = Array.isArray(data.items) ? data.items : [];
    setCatalogSources(sources);
    setCatalogEnabled(Object.fromEntries(sources.map((source) => [source.id, source.enabled])));
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
    setHeaderActions(document.getElementById('settings-header-actions'));
  }, []);
  const changed = () => window.dispatchEvent(new Event('design-work:prompt-sources-updated'));
  const sync = async (id?: string) => {
    setBusy(true);
    setError('');
    try {
      await call(id ? `/api/prompt-sources/${id}/sync` : '/api/prompt-sources/sync', {
        method: 'POST',
      });
      await load();
      changed();
      setMessage('同步完成');
    } catch (e) {
      setError(e instanceof Error ? e.message : '同步失败');
    } finally {
      setBusy(false);
    }
  };
  const toggleCatalog = async (catalogSource: CatalogSource, enabled: boolean) => {
    setCatalogEnabled((current) => ({ ...current, [catalogSource.id]: enabled }));
    try {
      await call(`/api/prompt-sources/catalog/${catalogSource.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      await load();
      changed();
    } catch (e) {
      setCatalogEnabled((current) => ({ ...current, [catalogSource.id]: !enabled }));
      setError(e instanceof Error ? e.message : '状态更新失败');
    }
  };
  const addSource = async () => {
    setBusy(true);
    setError('');
    try {
      if (editingSourceId) {
        const catalogSource = catalogSources.find(
          (source) => source.manifestId === editingSourceId,
        );
        if (!catalogSource) throw new Error('来源不存在');
        await call(`/api/prompt-sources/${editingSourceId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: addName.trim(),
            manifestUrl: addManifestUrl.trim(),
            homepageUrl: addHomepageUrl.trim() || null,
          }),
        });
        await call(`/api/prompt-sources/catalog/${catalogSource.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: addName.trim(),
            homepageUrl: addHomepageUrl.trim() || null,
          }),
        });
        await call(`/api/prompt-sources/${editingSourceId}/sync`, { method: 'POST' });
      } else {
        const created = await call('/api/prompt-sources', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: addName.trim(),
            manifestUrl: addManifestUrl.trim(),
            homepageUrl: addHomepageUrl.trim() || undefined,
          }),
        });
        await call(`/api/prompt-sources/${created.id}/sync`, { method: 'POST' });
      }
      setAddOpen(false);
      setEditingSourceId(null);
      setAddName('');
      setAddManifestUrl('');
      setAddHomepageUrl('');
      await load();
      changed();
      setMessage('来源已添加');
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败');
    } finally {
      setBusy(false);
    }
  };
  const deleteSource = async (catalogSource: CatalogSource) => {
    if (!window.confirm(`确定删除来源“${catalogSource.name}”吗？`)) return;
    setBusy(true);
    setError('');
    try {
      await call(`/api/prompt-sources/catalog/${catalogSource.id}`, { method: 'DELETE' });
      await load();
      changed();
      setMessage('来源已删除');
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      {headerActions &&
        createPortal(
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={() => void sync()}
              disabled={busy}
            >
              <RefreshCw size={14} />
              同步全部
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={() => {
                setError('');
                setEditingSourceId(null);
                setAddName('');
                setAddManifestUrl('');
                setAddHomepageUrl('');
                setAddOpen(true);
              }}
              disabled={busy}
            >
              <Plus size={14} />
              增加来源
            </Button>
          </>,
          headerActions,
        )}
      {catalogSources.length ? (
        <div className="grid grid-cols-1 gap-2">
          {catalogSources.map((catalogSource) => {
            const enabled = catalogEnabled[catalogSource.id] ?? catalogSource.enabled;
            return (
              <div
                key={catalogSource.id}
                draggable
                onDragStart={() => setDraggedCatalogId(catalogSource.id)}
                onDragEnd={() => setDraggedCatalogId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggedCatalogId || draggedCatalogId === catalogSource.id) return;
                  setCatalogSources((current) => {
                    const from = current.findIndex((source) => source.id === draggedCatalogId);
                    const to = current.findIndex((source) => source.id === catalogSource.id);
                    if (from < 0 || to < 0) return current;
                    const next = [...current];
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved);
                    void call('/api/prompt-sources/catalog/order', {
                      method: 'PATCH',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ ids: next.map((source) => source.id) }),
                    })
                      .then(() => {
                        changed();
                      })
                      .catch((e) => {
                        setError(e instanceof Error ? e.message : '排序保存失败');
                        void load();
                      });
                    return next;
                  });
                  setDraggedCatalogId(null);
                }}
                className={`module-card flex min-w-0 items-center gap-3 px-3 py-2.5 transition-opacity ${enabled ? '' : 'opacity-55'} ${draggedCatalogId === catalogSource.id ? 'opacity-50' : ''}`}
              >
                <span
                  className="grid h-7 w-7 shrink-0 cursor-grab place-items-center rounded-md bg-muted text-muted-foreground"
                  aria-hidden="true"
                  title="拖动调整顺序"
                >
                  <GripVertical size={14} />
                </span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  <Globe2 size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {catalogSource.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {catalogSource.homepageUrl || '未提供主页链接'}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {catalogSource.itemCount} 条
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void sync(catalogSource.manifestId)}
                    disabled={busy}
                    aria-label={`同步${catalogSource.name}`}
                  >
                    <RefreshCw size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setError('');
                      setEditingSourceId(catalogSource.manifestId);
                      setAddName(catalogSource.name);
                      setAddManifestUrl(catalogSource.manifestUrl || '');
                      setAddHomepageUrl(catalogSource.homepageUrl || '');
                      setAddOpen(true);
                    }}
                    aria-label={`编辑${catalogSource.name}`}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void deleteSource(catalogSource)}
                    disabled={busy}
                    aria-label={`删除${catalogSource.name}`}
                    title="删除来源"
                  >
                    <Trash2 size={14} />
                  </Button>
                </span>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => void toggleCatalog(catalogSource, checked)}
                  aria-label={`${enabled ? '停用' : '启用'}${catalogSource.name}`}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-5 text-center text-xs text-muted-foreground">
          同步后会显示 Manifest 中声明的来源网站
        </div>
      )}
      {(message || error) && (
        <p className={`text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
          {error || message}
        </p>
      )}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!busy) setAddOpen(open);
        }}
      >
        <DialogContent className="max-w-[440px] gap-0 p-0">
          <DialogHeader className="border-b border-border px-5 py-4 pr-14">
            <DialogTitle className="text-base">
              {editingSourceId ? '编辑来源' : '增加来源'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingSourceId
                ? '修改来源信息，保存后会立即同步。'
                : '添加一个公开 Manifest 来源，保存后会立即同步。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <label className="block text-xs font-medium">
              来源名称
              <Input
                autoFocus
                value={addName}
                onChange={(event) => setAddName(event.target.value)}
                placeholder="例如：Banana Prompt Quicker"
                className="mt-2 h-8 text-xs"
              />
            </label>
            <label className="block text-xs font-medium">
              Manifest URL
              <Input
                value={addManifestUrl}
                onChange={(event) => setAddManifestUrl(event.target.value)}
                placeholder="https://example.com/manifest.json"
                className="mt-2 h-8 text-xs"
              />
            </label>
            <label className="block text-xs font-medium">
              主页链接（可选）
              <Input
                value={addHomepageUrl}
                onChange={(event) => setAddHomepageUrl(event.target.value)}
                placeholder="https://example.com"
                className="mt-2 h-8 text-xs"
              />
            </label>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="border-t border-border px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAddOpen(false)}
              disabled={busy}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void addSource()}
              disabled={busy || !addName.trim() || !addManifestUrl.trim()}
            >
              {editingSourceId ? '保存并同步' : '添加并同步'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
