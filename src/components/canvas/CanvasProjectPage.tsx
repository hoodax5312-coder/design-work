import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, FolderOpen, Plus, Search } from '@/lib/remixIconShim';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { Button, Card, Input } from '../ui';
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
    <main className="module-workspace h-full overflow-y-auto bg-[var(--workspace-bg)] px-8 pb-8 pt-8 text-foreground">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><FolderOpen size={14} /> 画布</div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">选择项目</h1>
            <p className="mt-2 text-sm text-muted-foreground">进入项目后开始编辑该项目的画布。</p>
          </div>
          <Button type="button" variant="primary" size="sm" onClick={createAndEnter} className="bg-[var(--action-generate-bg)] text-[var(--action-generate-foreground)] hover:bg-[var(--action-generate-bg-hover)]"><Plus size={15} /> 新建项目</Button>
        </header>
        <div className="mb-5 max-w-sm"><div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目" aria-label="搜索项目" className="h-9 pl-9 text-sm" /></div></div>
        {visibleProjects.length ? <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">{visibleProjects.map((project) => <Card key={project.id} role="button" tabIndex={0} onClick={() => enterProject(project.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') enterProject(project.id); }} className="group cursor-pointer p-4 transition-[border-color] hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-muted text-xl">{project.emoji || '😀'}</div><ArrowRight size={16} className="mt-1 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div><div className="mt-8 truncate text-sm font-semibold">{project.name}</div><div className="mt-1 text-xs text-muted-foreground">{project.canvas?.nodes.length || 0} 个画布节点</div></Card>)}</div> : <Card padding="lg" className="flex min-h-56 flex-col items-center justify-center text-center"><FolderOpen size={28} className="text-muted-foreground" /><div className="mt-3 text-sm font-medium">没有找到项目</div><p className="mt-1 text-xs text-muted-foreground">创建一个新项目开始使用画布。</p><Button type="button" variant="secondary" size="sm" onClick={createAndEnter} className="mt-4"><Plus size={14} /> 新建项目</Button></Card>}
      </div>
    </main>
  );
};
