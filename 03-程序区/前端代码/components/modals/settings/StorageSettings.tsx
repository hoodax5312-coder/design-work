import { useEffect, useState } from 'react';
import { CheckCircle2, Database, FolderOpen, HardDrive, Loader2, Save } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Switch } from '../../ui/Switch';
import { Alert, AlertDescription } from '../../ui/Alert';

interface StorageSettingsState {
  dataDirectory: string;
  cacheDirectory: string;
  autoSaveGeneratedAssets: boolean;
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

export function StorageSettings() {
  const [settings, setSettings] = useState<StorageSettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
      setMessage(kind === 'data' ? '已选择并保存数据文件夹' : '已选择并保存缓存文件夹');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '选择文件夹失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        正在读取存储设置...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-[12px] font-semibold text-slate-900 dark:text-white">
          <Database size={16} />
          本地数据目录
        </h4>

        <div className="rounded-xl border border-black/[0.028] bg-[#fafaf8] p-4 dark:border-white/[0.045] dark:bg-white/[0.025]">
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            保存位置
          </div>
          <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            项目、对话、素材和生成记录后续都可以统一写入这个本地目录。保存时会自动创建不存在的文件夹。
          </p>
          <div className="flex gap-2">
            <Input
              value={settings.dataDirectory}
              onChange={(event) =>
                setSettings((current) => ({ ...current, dataDirectory: event.target.value }))
              }
              placeholder="/Users/you/Documents/Mboard"
              className="min-w-0 flex-1 text-xs"
            />
            <Button
              onClick={() => void chooseDirectory('data')}
              disabled={saving}
              variant="secondary" size="sm"
            >
              <FolderOpen size={16} />
              选择文件夹
            </Button>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h4 className="flex items-center gap-2 text-[12px] font-semibold text-slate-900 dark:text-white">
            <HardDrive size={16} />
            缓存位置
          </h4>

          <div className="rounded-xl border border-black/[0.028] bg-[#fafaf8] p-4 dark:border-white/[0.045] dark:bg-white/[0.025]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                缓存目录
              </span>
              <span className="rounded-md bg-black/[0.035] px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 dark:bg-white/[0.055]">
                可随时清理
              </span>
            </div>
            <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              缩略图、视频代理、PPT 预览、提取文本和任务临时文件会写入这里，不影响原始素材与项目数据。
            </p>
            <div className="flex gap-2">
              <Input
                value={settings.cacheDirectory}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, cacheDirectory: event.target.value }))
                }
                placeholder="/Users/you/Library/Caches/Mboard"
                aria-label="缓存目录"
                className="min-w-0 flex-1 text-xs"
              />
              <Button
                onClick={() => void chooseDirectory('cache')}
                disabled={saving}
                variant="secondary" size="sm"
              >
                <FolderOpen size={16} />
                选择文件夹
              </Button>
            </div>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/[0.028] bg-white p-4 dark:border-white/[0.045] dark:bg-white/[0.025]">
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
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              生成完成后自动保存到数据目录
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
              打开后，后续生成的图片、视频和素材记录会优先写入上方目录。
            </span>
          </span>
        </label>
      </div>

      {(message || error) && (
        <Alert
          variant={error ? 'destructive' : 'default'}
          className={error ? undefined : 'border-black/[0.028] bg-black/[0.012] dark:border-white/[0.045] dark:bg-white/[0.025]'}
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
          className="border-transparent bg-black/[0.055] text-foreground shadow-none hover:bg-black/[0.09] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          保存存储设置
        </Button>
      </div>
    </div>
  );
}
