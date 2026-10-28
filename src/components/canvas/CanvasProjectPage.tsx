import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Plus, Search } from '@/lib/remixIconShim';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { Card, Input } from '../ui';
import { Canvas } from './Canvas';

export const CanvasProjectPage = () => {
  const openProjectId = useProjectStore((state) => state.canvasSession?.projectId);
  const [readyProjectId, setReadyProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const projects = useProjectStore((state) => state.projects);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const createProject = useProjectStore((state) => state.createProject);

  useEffect(() => {
    if (!openProjectId) return;
    const project = useProjectStore.getState().projects.find((item) => item.id === openProjectId);
    if (!project) return;
    if (useCanvasStore.getState().projectId !== openProjectId) {
      useCanvasStore.getState().loadProject(openProjectId, project.canvas || { nodes: [], edges: [] });
    }
    setActiveProject(openProjectId);
    setReadyProjectId(openProjectId);
  }, [openProjectId, setActiveProject]);

  const visibleProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(term));
  }, [projects, query]);

  const enterProject = useCallback((projectId: string) => {
    const project = useProjectStore.getState().projects.find((item) => item.id === projectId);
    if (!project) return;
    useCanvasStore.getState().loadProject(projectId, project.canvas || { nodes: [], edges: [] });
    useProjectStore.getState().beginCanvasSession(projectId);
    setReadyProjectId(projectId);
  }, []);

  const createAndEnter = () => enterProject(createProject());

  if (openProjectId) return readyProjectId === openProjectId
    ? <Canvas onBack={() => useProjectStore.getState().endCanvasSession()} />
    : <div role="status" className="p-4 text-sm text-muted-foreground">正在恢复画布…</div>;

  return (
    <main className="module-workspace h-full overflow-y-auto bg-[var(--module-workspace-bg,var(--background))] px-8 pb-8 pt-6 text-foreground">
      <div className="mx-auto w-full max-w-[1080px]">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em]">选择项目</h1>
            <p className="mt-2 text-sm text-muted-foreground">进入项目后开始编辑该项目的画布。</p>
          </div>
          <div className="w-full sm:w-[240px] sm:flex-none"><div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目" aria-label="搜索项目" className="module-search-input h-8 border border-neutral-border bg-neutral-surface py-0 pl-9 text-sm text-neutral-foreground placeholder:text-muted-foreground shadow-none focus:placeholder:text-transparent focus-visible:ring-1 focus-visible:ring-[color:var(--field-focus-ring)]" /></div></div>
        </header>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {visibleProjects.map((project) => <Card key={project.id} role="button" tabIndex={0} onClick={() => enterProject(project.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') enterProject(project.id); }} className="group flex min-h-[136px] cursor-pointer flex-col p-4 transition-[border-color] hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><div className="grid h-9 w-9 place-items-center rounded-md bg-muted text-lg">{project.emoji || '😀'}</div><ArrowRight size={16} className="mt-0.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div><div className="mt-auto truncate text-sm font-semibold">{project.name}</div><div className="mt-1 text-xs text-muted-foreground">{project.canvas?.nodes.length || 0} 个画布节点</div></Card>)}
          <button type="button" onClick={createAndEnter} className="theme-card group flex min-h-[136px] flex-col items-center justify-center !border-dashed p-4 text-center transition-[background-color,border-color] hover:border-foreground/30 hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="添加项目">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-[var(--surface-hover)] group-hover:text-foreground"><Plus size={18} /></span>
            <span className="mt-3 text-sm font-semibold">添加项目</span>
            <span className="mt-1 text-xs text-muted-foreground">创建并进入新的画布项目</span>
          </button>
        </div>
      </div>
    </main>
  );
};
