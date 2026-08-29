import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, Plus, Search } from '@/lib/remixIconShim';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { Card, Input } from '../ui';
import { Canvas } from './Canvas';

export const CanvasProjectPage = () => {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const projects = useProjectStore((state) => state.projects);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const createProject = useProjectStore((state) => state.createProject);

  const visibleProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(term));
  }, [projects, query]);

  const enterProject = useCallback((projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    setActiveProject(projectId);
    useCanvasStore.getState().restoreSnapshot(project.canvas?.nodes || [], project.canvas?.edges || []);
    setOpenProjectId(projectId);
  }, [projects, setActiveProject]);

  const createAndEnter = () => enterProject(createProject());

  if (openProjectId) return <Canvas onBack={() => setOpenProjectId(null)} />;

  return (
    <main className="module-workspace h-full overflow-y-auto bg-[var(--module-workspace-bg,var(--background))] px-8 pb-8 pt-6 text-foreground">
      <div className="mx-auto w-full max-w-[1080px]">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em]">选择项目</h1>
            <p className="mt-2 text-sm text-muted-foreground">进入项目后开始编辑该项目的画布。</p>
          </div>
          <div className="w-full sm:w-[240px] sm:flex-none"><div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目" aria-label="搜索项目" className="module-search-input h-8 border border-neutral-border bg-neutral-surface py-0 pl-9 text-sm text-neutral-foreground placeholder:text-muted-foreground shadow-none focus:placeholder:text-transparent focus-visible:ring-1 focus-visible:ring-neutral-border" /></div></div>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map((project) => <Card key={project.id} role="button" tabIndex={0} onClick={() => enterProject(project.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') enterProject(project.id); }} className="group flex min-h-[220px] cursor-pointer flex-col p-5 transition-[border-color] hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><div className="grid h-12 w-12 place-items-center rounded-md bg-muted text-2xl">{project.emoji || '😀'}</div><ArrowRight size={18} className="mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div><div className="mt-auto truncate text-base font-semibold">{project.name}</div><div className="mt-1 text-xs text-muted-foreground">{project.canvas?.nodes.length || 0} 个画布节点</div></Card>)}
          <button type="button" onClick={createAndEnter} className="theme-card group flex min-h-[220px] flex-col items-center justify-center border-dashed p-5 text-center transition-[background-color,border-color] hover:border-foreground/30 hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="添加项目">
            <span className="grid h-12 w-12 place-items-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-[var(--surface-hover)] group-hover:text-foreground"><Plus size={22} /></span>
            <span className="mt-4 text-sm font-semibold">添加项目</span>
            <span className="mt-1 text-xs text-muted-foreground">创建并进入新的画布项目</span>
          </button>
        </div>
      </div>
    </main>
  );
};
