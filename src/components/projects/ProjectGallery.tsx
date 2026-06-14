import { useMemo, useState } from 'react';
import {
  Folder,
  Grid2X2,
  List,
  MessageSquarePlus,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useChatStore } from '../../stores/useChatStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useUIStore } from '../../stores/useUIStore';

export const ProjectGallery = () => {
  const { projects, createProject, setActiveProject, removeProject } = useProjectStore();
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const setActiveModule = useUIStore((state) => state.setActiveModule);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? projects.filter((project) => project.name.toLowerCase().includes(normalized))
      : projects;
  }, [projects, query]);

  const openProject = (id: string) => {
    setActiveProject(id);
    setActiveConversation(null);
    setActiveModule('new-chat');
  };

  const addProject = () => {
    const id = createProject();
    openProject(id);
  };

  return (
    <div className="flex h-full bg-white dark:bg-black">
      <aside className="flex w-60 shrink-0 flex-col bg-white dark:bg-zinc-950">
        <div className="p-4">
          <button
            onClick={addProject}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={17} />
            新建项目
          </button>
        </div>

        <div className="px-3">
          <button className="flex h-11 w-full items-center gap-3 rounded-lg bg-indigo-50 px-3 text-sm font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Grid2X2 size={18} />
            <span className="flex-1 text-left">全部项目</span>
            <span className="text-xs text-indigo-400">{projects.length}</span>
          </button>
        </div>

        <div className="mt-auto px-4 py-4 text-center text-xs text-slate-400">
          数据保存在当前设备
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col border-l border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-6 dark:border-zinc-800">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">全部项目</h1>
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索项目..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-zinc-900">
              <button
                onClick={() => setViewMode('grid')}
                aria-label="网格视图"
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-md',
                  viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm dark:bg-zinc-700' : 'text-slate-400',
                )}
              >
                <Grid2X2 size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="列表视图"
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-md',
                  viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm dark:bg-zinc-700' : 'text-slate-400',
                )}
              >
                <List size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {visibleProjects.length ? (
            <div className={cn(viewMode === 'grid' ? 'grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4' : 'divide-y divide-slate-100 dark:divide-zinc-800')}>
              {visibleProjects.map((project) => (
                <article
                  key={project.id}
                  className={cn(
                    'group relative',
                    viewMode === 'grid'
                      ? 'min-h-44 border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm dark:border-zinc-800'
                      : 'flex h-16 items-center gap-3',
                  )}
                >
                  <button
                    onClick={() => openProject(project.id)}
                    className={cn(
                      'min-w-0 text-left',
                      viewMode === 'grid' ? 'flex h-full w-full flex-col' : 'flex flex-1 items-center gap-3',
                    )}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-zinc-900">
                      <Folder size={19} />
                    </div>
                    <div className={viewMode === 'grid' ? 'mt-auto' : 'min-w-0'}>
                      <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{project.name}</h2>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(project.updatedAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </button>

                  <div className={cn('flex items-center gap-1', viewMode === 'grid' ? 'absolute right-3 top-3 opacity-0 group-hover:opacity-100' : '')}>
                    <button
                      onClick={() => openProject(project.id)}
                      title="进入对话"
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-zinc-800"
                    >
                      <MessageSquarePlus size={15} />
                    </button>
                    <button
                      onClick={() => removeProject(project.id)}
                      title="删除项目"
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      title="更多操作"
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
              <Folder size={34} className="mb-4 text-slate-300" />
              <h2 className="text-base font-medium text-slate-900 dark:text-white">
                {query ? '没有匹配的项目' : '还没有项目'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {query ? '换一个关键词试试。' : '创建项目后，将从项目对话页面开始。'}
              </p>
              {!query && (
                <button
                  onClick={addProject}
                  className="mt-5 flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  <Plus size={16} />
                  创建第一个项目
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
