import { getActiveProvider, useProviderStore } from '../../../stores/useProviderStore';

export function ModelsSettings() {
  const provider = useProviderStore(getActiveProvider);
  const models = provider?.models.length ? provider.models : provider?.model ? [provider.model] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-lg">
        <div className="text-sm text-blue-700 dark:text-blue-300">
          {provider?.health?.status === 'healthy'
            ? `${provider.name} 已连接，发现 ${models.length} 个模型`
            : '请先在 API 配置中完成连接测试'}
        </div>
      </div>

      <div className="space-y-3">
        {models.map((model) => (
          <div
            key={model}
            className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-zinc-700 dark:to-zinc-600 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                {model[0]}
              </div>
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-white">
                  {model}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  ID: {model.toLowerCase().replace(/ /g, '-')}
                </div>
              </div>
            </div>
            <div className={`h-2 w-2 rounded-full ${provider?.health?.status === 'healthy' ? 'bg-green-500' : 'bg-slate-300'}`} />
          </div>
        ))}
        {!models.length && <div className="py-10 text-center text-sm text-slate-400">暂无可用模型</div>}
      </div>
    </div>
  );
}
