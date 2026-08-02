import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Folder,
  FolderOpen,
  LayoutGrid,
  Search,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button, Card, Input } from '../ui';
import { useProjectStore } from '../../stores/useProjectStore';

type SpaceKind = 'home' | 'folder' | 'document' | 'project';

type SpaceEntry = {
  id: string;
  name: string;
  kind: SpaceKind;
  parent?: string;
  description?: string;
  updatedAt?: string;
  content?: string[];
};

const DOCUMENTS: SpaceEntry[] = [
  { id: 'creative', name: '创作资料', kind: 'folder', description: '图像、视频和提示词的创作规范', updatedAt: '今天' },
  { id: 'references', name: '视觉参考', kind: 'folder', parent: 'creative', description: '构图、光影和色彩参考', updatedAt: '昨天' },
  {
    id: 'workflow',
    name: '创作工作流.md',
    kind: 'document',
    parent: 'creative',
    description: '从灵感、分镜到交付的一组标准步骤',
    updatedAt: '今天 10:24',
    content: [
      '创作工作流',
      '将每一次生成沉淀为可复用的素材与上下文，而不是孤立的结果。',
      '1. 先整理目标、受众与核心画面；再拆分镜头、角色、场景和道具。',
      '2. 图像与视频生成分别选择已配置的模型，保留提示词、比例和版本。',
      '3. 将确认后的结果归档至资产库，并在视频工程中引用最终素材。',
    ],
  },
  {
    id: 'brand-guide',
    name: '品牌视觉指南.md',
    kind: 'document',
    parent: 'creative',
    description: '品牌色、图像调性与版式规则',
    updatedAt: '昨天 18:06',
    content: [
      '品牌视觉指南',
      '保持画面主体清晰，优先使用克制的色彩与层次明确的光线。',
      '每个创作项目开始前，先确认品牌关键词、禁止项与交付尺寸。',
    ],
  },
  {
    id: 'video',
    name: '视频工程',
    kind: 'folder',
    description: '分镜、角色、场景与视频项目文件',
    updatedAt: '今天' },
  {
    id: 'prompt-guide',
    name: '提示词编写指南.md',
    kind: 'document',
    parent: 'video',
    description: '人物、镜头和节奏的提示词写法',
    updatedAt: '上周',
    content: [
      '提示词编写指南',
      '先描述主体和动作，再补充镜头语言、光线、空间层次和风格。',
      '为视频提示词补充起止动作、运镜和节奏，避免一个镜头里出现过多变化。',
    ],
  },
];

const itemIcon = (kind: SpaceKind, open = false) =>
  kind === 'document' ? FileText : open ? FolderOpen : Folder;

export const PersonalSpace = () => {
  const { projects, activeProjectId, setActiveProject } = useProjectStore();
  const [selectedId, setSelectedId] = useState('home');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['creative', 'video']));
  const [query, setQuery] = useState('');

  const projectEntries = useMemo<SpaceEntry[]>(() => projects.map((project) => ({
    id: project.id,
    name: project.name,
    kind: 'project',
    parent: 'video',
    description: `${project.canvas?.nodes.length || 0} 个画布节点`,
    updatedAt: new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(project.updatedAt),
  })), [projects]);
  const allEntries = useMemo(() => [...DOCUMENTS, ...projectEntries], [projectEntries]);
  const selected = selectedId === 'home' ? undefined : allEntries.find((entry) => entry.id === selectedId);
  const currentFolder = selected?.kind === 'folder' ? selected.id : selected?.parent || 'home';
  const visibleEntries = allEntries.filter((entry) => {
    const inFolder = currentFolder === 'home'
      ? !entry.parent
      : entry.parent === currentFolder;
    return inFolder && entry.name.toLowerCase().includes(query.toLowerCase());
  });

  const openEntry = (entry: SpaceEntry) => {
    if (entry.kind === 'project') setActiveProject(entry.id);
    setSelectedId(entry.id);
  };
  const toggleFolder = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const renderTree = (parent: string | undefined, depth = 0) => allEntries
    .filter((entry) => entry.parent === parent)
    .map((entry) => {
      const isContainer = entry.kind === 'folder';
      const isOpen = expanded.has(entry.id);
      const Icon = itemIcon(entry.kind, isOpen);
      const isActive = selectedId === entry.id || (entry.kind === 'project' && activeProjectId === entry.id);
      return (
        <div key={entry.id}>
          <Button
            type="button"
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              if (isContainer) {
                toggleFolder(entry.id);
                setSelectedId(entry.id);
                return;
              }
              openEntry(entry);
            }}
            aria-expanded={isContainer ? isOpen : undefined}
            className="h-8 w-full justify-start pr-2 text-left text-xs"
            style={{ paddingLeft: `${10 + depth * 18}px` }}
          >
            {isContainer ? <span aria-hidden="true" className="grid h-4 w-3 place-items-center text-slate-400">{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span> : <span className="w-3" />}
            <Icon aria-hidden="true" size={14} className={isContainer ? 'text-[#607b00] dark:text-[#c8ff00]' : 'text-sky-500'} />
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
          </Button>
          {isContainer && isOpen && renderTree(entry.id, depth + 1)}
        </div>
      );
    });

  const selectedDocument = selected?.kind === 'document' ? selected : undefined;
  const selectedProject = selected?.kind === 'project' ? selected : undefined;

  return (
    <main className="module-workspace flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="mx-16 flex h-14 shrink-0 items-center justify-between gap-4 border-0 px-0">
        <h1 className="text-base font-semibold tracking-[-0.02em]">空间</h1>
        <label className="flex h-8 w-[240px] max-w-[48vw] items-center gap-2 rounded-md bg-muted px-2.5">
          <Search aria-hidden="true" size={15} className="shrink-0 text-muted-foreground" />
          <Input
            variant="ghost"
            inputSize="sm"
            aria-label="搜索空间文件"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索空间文件"
            className="h-8 min-w-0 flex-1 text-xs"
          />
        </label>
      </header>

      <div className="mx-16 mb-0 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-xl bg-[#f8f8f6] p-2 dark:bg-white/[0.035] md:flex-row">
      <aside className="flex max-h-[38vh] w-full shrink-0 flex-col bg-transparent p-4 shadow-none md:max-h-none md:w-[270px]">
        <h2 className="px-2 text-sm font-semibold">标题筛选</h2>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <Button type="button" variant={selectedId === 'home' ? 'secondary' : 'ghost'} size="sm" onClick={() => setSelectedId('home')} className="h-8 w-full justify-start text-xs"><LayoutGrid aria-hidden="true" size={14} /> 所有文件</Button>
          <div className="mt-1">{renderTree(undefined)}</div>
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto rounded-lg bg-background shadow-sm">
        {selectedDocument || selectedProject ? (
          <article className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={13} /> 更新于 {selected?.updatedAt || '刚刚'}</div>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">{selected?.name}</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{selected?.description}</p>
            {selectedDocument?.content ? <div className="mt-8 space-y-4 text-sm leading-7 text-foreground/80">{selectedDocument.content.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div> : <Card className="mt-8" padding="lg"><div className="flex items-center gap-2 text-sm font-semibold"><FolderOpen size={17} /> 工程文件夹</div><p className="mt-2 text-sm leading-6 text-muted-foreground">该空间已与画布关联。进入创作或视频模块后，生成物会自动归档到这里。</p></Card>}
          </article>
        ) : (
          <div className="mx-auto max-w-6xl px-5 py-6 sm:px-7 lg:px-12">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleEntries.map((entry) => {
                const Icon = itemIcon(entry.kind);
                return <Button key={entry.id} type="button" variant="ghost" onClick={() => openEntry(entry)} className="group flex h-auto min-h-[120px] flex-col items-stretch justify-start whitespace-normal rounded-lg border border-border bg-card p-4 text-left shadow-sm hover:bg-muted hover:shadow-md"><span className={cn('grid h-10 w-10 place-items-center rounded-md', entry.kind === 'document' ? 'bg-sky-500/10 text-sky-500' : 'bg-muted text-foreground')}><Icon aria-hidden="true" size={19} /></span><span className="mt-auto min-w-0"><span className="block truncate text-sm font-semibold">{entry.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{entry.description || '个人空间文件'} · {entry.updatedAt}</span></span></Button>;
              })}
              {!visibleEntries.length && <Card className="col-span-full p-10 text-center text-sm text-muted-foreground">没有找到匹配文件</Card>}
            </div>
          </div>
        )}
      </section>
      </div>
    </main>
  );
};
