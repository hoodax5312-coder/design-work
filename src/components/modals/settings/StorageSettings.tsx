import { useEffect, useState } from 'react';
import { CheckCircle2, Database, FolderOpen, HardDrive, Loader2, Save, Layers } from '@/lib/remixIconShim';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Switch } from '../../ui/Switch';
import { Alert, AlertDescription } from '../../ui/Alert';

interface StorageSettingsState {
  dataDirectory: string;
  cacheDirectory: string;
  autoSaveGeneratedAssets: boolean;
}

interface ModuleStorageEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  storage: '数据' | '缓存';
}

const defaultSettings: StorageSettingsState = {
  dataDirectory: '',
  cacheDirectory: '',
  autoSaveGeneratedAssets: true,
};

const requestJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '存储设置操作失败');
  return payload as StorageSettingsState;
};

const storageGroupClassName =
  'rounded-[var(--surface-panel-radius)] [border-color:var(--surface-panel-border)] [border-style:solid] [border-width:var(--settings-group-border-width,var(--surface-panel-border-width))] bg-[var(--surface-panel-bg)] text-[var(--surface-panel-foreground)] [box-shadow:var(--settings-group-shadow,var(--surface-panel-shadow))]';

export function StorageSettings() {
  const [settings, setSettings] = useState<StorageSettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modules, setModules] = useState<ModuleStorageEntry[]>([]);
  const [openingModuleId, setOpeningModuleId] = useState<string | null>(null);

  const loadModules = async () => {
    const response = await fetch('/api/storage/modules');
    const payload = await response.json().catch(() => ({})) as { modules?: ModuleStorageEntry[]; error?: string };
    if (!response.ok) throw new Error(payload.error || '读取模块存储位置失败');
    if (Array.isArray(payload.modules)) setModules(payload.modules);
  };

  useEffect(() => {
    let active = true;

    requestJson('/api/storage/settings')
      .then((payload) => {
        if (active) setSettings(payload);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : '读取存储设置失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetch('/api/storage/modules')
      .then((response) => response.json())
      .then((payload: { modules?: ModuleStorageEntry[] }) => {
        if (active && Array.isArray(payload.modules)) setModules(payload.modules);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const saveSettings = async (nextSettings = settings) => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = await requestJson('/api/storage/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings),
      });
      setSettings(payload);
      setMessage('存储设置已保存');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存存储设置失败');
    } finally {
      setSaving(false);
    }
  };

  const chooseDirectory = async (kind: 'data' | 'cache') => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = await requestJson(
        kind === 'data' ? '/api/storage/choose-directory' : '/api/storage/choose-cache-directory',
        {
        method: 'POST',
        },
      );
      setSettings(payload);
      await loadModules();
      setMessage(kind === 'data' ? '已选择并保存数据文件夹' : '已选择并保存缓存文件夹');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '选择文件夹失败');
    } finally {
      setSaving(false);
    }
  };

  const openModuleLocation = async (module: ModuleStorageEntry) => {
    setOpeningModuleId(module.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/storage/modules/${encodeURIComponent(module.id)}/reveal`, { method: 'POST' });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '打开存储位置失败');
      setMessage(`已在 Finder 中打开“${module.name}”存储位置`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '打开存储位置失败');
    } finally {
      setOpeningModuleId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        正在读取存储设置...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
          <Database size={16} />
          本地数据目录
        </h4>

        <div className={`p-4 ${storageGroupClassName}`}>
          <div className="mb-2 text-sm font-medium text-foreground">
            保存位置
          </div>
          <p className="mb-3 text-xs leading-5 text-muted-foreground">
            项目、对话、素材和生成记录后续都可以统一写入这个本地目录。保存时会自动创建不存在的文件夹。
          </p>
          <div className="flex gap-2">
            <Input
              value={settings.dataDirectory}
              onChange={(event) =>
                setSettings((current) => ({ ...current, dataDirectory: event.target.value }))
              }
              placeholder="/Users/you/Documents/LIZUO"
              className="storage-path-input h-9 min-w-0 flex-1 text-xs"
            />
            <Button
              onClick={() => void chooseDirectory('data')}
              disabled={saving}
              variant="secondary" size="sm" className="h-9"
            >
              <FolderOpen size={16} />
              选择文件夹
            </Button>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h4 className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
            <HardDrive size={16} />
            缓存位置
          </h4>

          <div className={`p-4 ${storageGroupClassName}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                缓存目录
              </span>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                可随时清理
              </span>
            </div>
            <p className="mb-3 text-xs leading-5 text-muted-foreground">
              缩略图、视频代理、PPT 预览、提取文本和任务临时文件会写入这里，不影响原始素材与项目数据。
            </p>
            <div className="flex gap-2">
              <Input
                value={settings.cacheDirectory}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, cacheDirectory: event.target.value }))
                }
                placeholder="/Users/you/Library/Caches/LIZUO"
                aria-label="缓存目录"
                className="storage-path-input h-9 min-w-0 flex-1 text-xs"
              />
              <Button
                onClick={() => void chooseDirectory('cache')}
                disabled={saving}
                variant="secondary" size="sm" className="h-9"
              >
                <FolderOpen size={16} />
                选择文件夹
              </Button>
            </div>
          </div>
        </div>

        <label className={`flex cursor-pointer items-start gap-3 p-4 ${storageGroupClassName}`}>
          <Switch
            checked={settings.autoSaveGeneratedAssets}
            onCheckedChange={(checked) =>
              setSettings((current) => ({
                ...current,
                autoSaveGeneratedAssets: checked,
              }))
            }
            className="mt-0.5 data-[state=checked]:bg-foreground"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              生成完成后自动保存到数据目录
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              打开后，后续生成的图片、视频和素材记录会优先写入上方目录。
            </span>
          </span>
        </label>

        <div className="space-y-3 pt-2">
          <h4 className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
            <Layers size={16} />
            按模块查找
          </h4>
          <div className={`divide-y divide-border ${storageGroupClassName}`}>
            {modules.map((module) => (
              <div key={module.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span>{module.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{module.storage}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{module.description}</p>
                </div>
                <div className="flex max-w-[52%] shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openModuleLocation(module)}
                    disabled={openingModuleId === module.id}
                    className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                    title={`在 Finder 中打开 ${module.path}`}
                  >
                    {openingModuleId === module.id ? <Loader2 size={12} className="shrink-0 animate-spin" /> : <FolderOpen size={12} className="shrink-0" />}
                    <code className="truncate">{module.path}</code>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => void chooseDirectory(module.storage === '数据' ? 'data' : 'cache')}
                    className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
                    title={`更改${module.storage}根目录；同类模块会同步更新`}
                  >
                    更改
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(message || error) && (
        <Alert
          variant={error ? 'destructive' : 'default'}
          className={error ? undefined : 'border-border bg-muted/40'}
        >
          {!error && <CheckCircle2 size={16} />}
          <AlertDescription>{error || message}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => void saveSettings()}
          disabled={saving || !settings.dataDirectory.trim() || !settings.cacheDirectory.trim()}
          variant="secondary" size="sm"
          className="border-transparent bg-secondary text-secondary-foreground shadow-none hover:bg-accent hover:text-accent-foreground"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          保存存储设置
        </Button>
      </div>
    </div>
  );
}
