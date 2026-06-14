import { useEffect, useState } from 'react';
import { CheckCircle2, Database, FolderOpen, Loader2, Save } from 'lucide-react';

interface StorageSettingsState {
  dataDirectory: string;
  autoSaveGeneratedAssets: boolean;
}

const defaultSettings: StorageSettingsState = {
  dataDirectory: '',
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

  const chooseDirectory = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = await requestJson('/api/storage/choose-directory', {
        method: 'POST',
      });
      setSettings(payload);
      setMessage('已选择并保存数据文件夹');
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
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
          <Database size={16} />
          本地数据目录
        </h4>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            保存位置
          </div>
          <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            项目、对话、素材和生成记录后续都可以统一写入这个本地目录。保存时会自动创建不存在的文件夹。
          </p>
          <div className="flex gap-2">
            <input
              value={settings.dataDirectory}
              onChange={(event) =>
                setSettings((current) => ({ ...current, dataDirectory: event.target.value }))
              }
              placeholder="/Users/you/Documents/Mboard"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200"
            />
            <button
              onClick={chooseDirectory}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-zinc-800"
            >
              <FolderOpen size={16} />
              选择文件夹
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <input
            type="checkbox"
            checked={settings.autoSaveGeneratedAssets}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                autoSaveGeneratedAssets: event.target.checked,
              }))
            }
            className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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
        <div
          className={
            error
              ? 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
              : 'flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'
          }
        >
          {!error && <CheckCircle2 size={16} />}
          {error || message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => void saveSettings()}
          disabled={saving || !settings.dataDirectory.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          保存存储设置
        </button>
      </div>
    </div>
  );
}
