import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  FilePlus2,
  FileText,
  FolderOpen,
  FolderPlus,
  Search,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button, Card, Input } from '../ui';
import { useProjectStore } from '../../stores/useProjectStore';

type SpaceKind = 'folder' | 'document' | 'project';

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

const DEFAULT_DOCUMENT_ID = DOCUMENTS.find((entry) => entry.kind === 'document')?.id || '';
const DOCUMENT_TREE_STORAGE_KEY = 'mboard-document-tree';
const PROJECT_PARENT_STORAGE_KEY = 'mboard-project-document-parents';

const readDocumentTree = (): SpaceEntry[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(DOCUMENT_TREE_STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) return saved;
  } catch {
    // Fall back to the built-in document tree.
  }
  return DOCUMENTS;
};

const readProjectParents = (): Record<string, string | undefined> => {
  try {
    const saved = JSON.parse(localStorage.getItem(PROJECT_PARENT_STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
  } catch {
    // Fall back to the default video folder.
  }
  return {};
};

export const PersonalSpace = ({ embedded = false, query: externalQuery }: { embedded?: boolean; query?: string }) => {
  const { projects, activeProjectId, setActiveProject } = useProjectStore();
  const [documentEntries, setDocumentEntries] = useState<SpaceEntry[]>(readDocumentTree);
  const [projectParents, setProjectParents] = useState<Record<string, string | undefined>>(readProjectParents);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['creative', 'video']));
  const [openEntryIds, setOpenEntryIds] = useState<string[]>(() => DEFAULT_DOCUMENT_ID ? [DEFAULT_DOCUMENT_ID] : []);
  const [activeEntryId, setActiveEntryId] = useState(DEFAULT_DOCUMENT_ID);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>();
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryNameDraft, setEntryNameDraft] = useState('');
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const query = externalQuery ?? localQuery;

  const projectEntries = useMemo<SpaceEntry[]>(() => projects.map((project) => ({
    id: project.id,
    name: project.name,
    kind: 'project',
    parent: projectParents[project.id] ?? 'video',
    description: `${project.canvas?.nodes.length || 0} 个画布节点`,
    updatedAt: new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(project.updatedAt),
  })), [projectParents, projects]);
  const allEntries = useMemo(() => [...documentEntries, ...projectEntries], [documentEntries, projectEntries]);
  const activeEntry = allEntries.find((entry) => entry.id === activeEntryId);
  const openEntries = openEntryIds.flatMap((id) => {
    const entry = allEntries.find((item) => item.id === id);
    return entry ? [entry] : [];
  });
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');

  useEffect(() => {
    localStorage.setItem(DOCUMENT_TREE_STORAGE_KEY, JSON.stringify(documentEntries));
  }, [documentEntries]);

  useEffect(() => {
    localStorage.setItem(PROJECT_PARENT_STORAGE_KEY, JSON.stringify(projectParents));
  }, [projectParents]);

  const openEntry = (entry: SpaceEntry) => {
    if (entry.kind === 'folder') {
      toggleFolder(entry.id);
      return;
    }
    if (entry.kind === 'project') setActiveProject(entry.id);
    setOpenEntryIds((current) => current.includes(entry.id) ? current : [...current, entry.id]);
    setActiveEntryId(entry.id);
  };
  const closeEntry = (id: string) => {
    setOpenEntryIds((current) => {
      const closingIndex = current.indexOf(id);
      const next = current.filter((entryId) => entryId !== id);
      if (activeEntryId === id) setActiveEntryId(next[Math.max(0, closingIndex - 1)] || next[0] || '');
      return next;
    });
  };
  const toggleFolder = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const createEntry = (kind: 'document' | 'folder') => {
    const id = `${kind}-${Date.now()}`;
    const baseName = kind === 'document' ? '未命名笔记.md' : '未命名文件夹';
    const entry: SpaceEntry = {
      id,
      kind,
      name: baseName,
      parent: activeFolderId,
      updatedAt: '刚刚',
      description: kind === 'document' ? '新建笔记' : undefined,
      content: kind === 'document' ? ['未命名笔记', ''] : undefined,
    };
    setDocumentEntries((current) => [...current, entry]);
    if (activeFolderId) setExpanded((current) => new Set(current).add(activeFolderId));
    setEditingEntryId(id);
    setEntryNameDraft(baseName.replace(/\.md$/i, ''));
    if (kind === 'document') {
      setOpenEntryIds((current) => [...current, id]);
      setActiveEntryId(id);
    }
  };
  const commitEntryName = () => {
    if (!editingEntryId) return;
    const entry = documentEntries.find((item) => item.id === editingEntryId);
    const trimmed = entryNameDraft.trim();
    if (entry && trimmed) {
      const name = entry.kind === 'document' && !trimmed.toLowerCase().endsWith('.md') ? `${trimmed}.md` : trimmed;
      setDocumentEntries((current) => current.map((item) => item.id === editingEntryId
        ? { ...item, name, content: item.kind === 'document' ? [trimmed.replace(/\.md$/i, ''), ...(item.content?.slice(1) || [])] : item.content }
        : item));
    }
    setEditingEntryId(null);
    setEntryNameDraft('');
  };
  const isDescendant = (possibleChildId: string, folderId: string): boolean => {
    const child = allEntries.find((entry) => entry.id === possibleChildId);
    if (!child?.parent) return false;
    if (child.parent === folderId) return true;
    return isDescendant(child.parent, folderId);
  };
  const moveEntry = (entryId: string, targetFolderId?: string) => {
    const entry = allEntries.find((item) => item.id === entryId);
    if (!entry || entry.id === targetFolderId) return;
    if (entry.kind === 'folder' && targetFolderId && isDescendant(targetFolderId, entry.id)) return;
    if (entry.kind === 'project') {
      setProjectParents((current) => ({ ...current, [entry.id]: targetFolderId }));
    } else {
      setDocumentEntries((current) => current.map((item) => item.id === entry.id ? { ...item, parent: targetFolderId } : item));
    }
    if (targetFolderId) setExpanded((current) => new Set(current).add(targetFolderId));
    setDraggedEntryId(null);
    setDragOverFolderId(null);
    setRootDropActive(false);
  };
  const entryMatchesQuery = (entry: SpaceEntry): boolean => {
    if (!normalizedQuery) return true;
    if (`${entry.name} ${entry.description || ''}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery)) return true;
    return entry.kind === 'folder' && allEntries
      .filter((child) => child.parent === entry.id)
      .some(entryMatchesQuery);
  };

  const renderTree = (parent: string | undefined, depth = 0) => allEntries
    .filter((entry) => entry.parent === parent && entryMatchesQuery(entry))
    .map((entry) => {
      const isContainer = entry.kind === 'folder';
      const isOpen = expanded.has(entry.id) || Boolean(normalizedQuery);
      const isActive = activeEntryId === entry.id || (entry.kind === 'project' && activeProjectId === entry.id);
      return (
        <div key={entry.id} className={cn(draggedEntryId === entry.id && 'opacity-45')}>
          <div
            onDragOver={(event) => { if (!isContainer || draggedEntryId === entry.id) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setDragOverFolderId(entry.id); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverFolderId((current) => current === entry.id ? null : current); }}
            onDrop={(event) => { if (!isContainer) return; event.preventDefault(); event.stopPropagation(); const draggedId = draggedEntryId || event.dataTransfer.getData('text/plain'); if (draggedId) moveEntry(draggedId, entry.id); }}
            className={cn('rounded-md', isContainer && dragOverFolderId === entry.id && 'bg-black/[0.08] ring-1 ring-inset ring-black/15 dark:bg-white/[0.1] dark:ring-white/20')}
          >
            {editingEntryId === entry.id ? <div className="flex h-8 items-center gap-1 pr-2" style={{ paddingLeft: `${8 + depth * 16}px` }}>
              {isContainer ? <span className="w-4 shrink-0"><ChevronRight size={13} /></span> : <FileText size={14} className="shrink-0 text-muted-foreground" />}
              <Input autoFocus value={entryNameDraft} onChange={(event) => setEntryNameDraft(event.target.value)} onBlur={commitEntryName} onKeyDown={(event) => { if (event.key === 'Enter') commitEntryName(); if (event.key === 'Escape') { setEditingEntryId(null); setEntryNameDraft(''); } }} aria-label={isContainer ? '命名新文件夹' : '命名新笔记'} inputSize="sm" className="h-7 min-w-0 flex-1 px-2 text-xs" />
            </div> : <Button
              type="button"
              draggable
              onDragStart={(event) => { setDraggedEntryId(entry.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', entry.id); }}
              onDragEnd={() => { setDraggedEntryId(null); setDragOverFolderId(null); setRootDropActive(false); }}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                if (isContainer) {
                  setActiveFolderId(entry.id);
                  toggleFolder(entry.id);
                  return;
                }
                openEntry(entry);
              }}
              aria-expanded={isContainer ? isOpen : undefined}
              className={cn('h-8 w-full justify-start gap-1 pr-2 text-left text-xs font-normal', isActive && 'bg-black/[0.07] text-foreground hover:bg-black/[0.09] dark:bg-white/[0.09] dark:hover:bg-white/[0.11]')}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              {isContainer ? <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center text-muted-foreground">{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span> : <FileText aria-hidden="true" size={14} className="shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            </Button>}
          </div>
          {isContainer && isOpen && renderTree(entry.id, depth + 1)}
        </div>
      );
    });

  const activeDocument = activeEntry?.kind === 'document' ? activeEntry : undefined;
  const activeProject = activeEntry?.kind === 'project' ? activeEntry : undefined;

  return (
    <main className={cn('flex h-full min-h-0 flex-col text-foreground', embedded ? 'bg-transparent' : 'module-workspace bg-background')}>
      {!embedded && <header className="mx-16 flex h-14 shrink-0 items-center justify-between gap-4 border-0 px-0">
        <h1 className="text-base font-semibold tracking-[-0.02em]">文档</h1>
        <label className="flex h-8 w-[240px] max-w-[48vw] items-center gap-2 rounded-md bg-muted px-2.5">
          <Search aria-hidden="true" size={15} className="shrink-0 text-muted-foreground" />
          <Input
            variant="ghost"
            inputSize="sm"
            aria-label="搜索空间文件"
            value={query}
            onChange={(event) => setLocalQuery(event.target.value)}
            placeholder="搜索文档"
            className="h-8 min-w-0 flex-1 text-xs"
          />
        </label>
      </header>}

      <div className={cn('mb-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-[#f8f8f6] dark:bg-white/[0.035] md:flex-row', !embedded && 'mx-16 p-2')}>
      <aside aria-label="文档文件树" className="flex max-h-[38vh] w-full shrink-0 flex-col overflow-hidden bg-transparent py-2 pr-2 shadow-none md:max-h-none md:w-[240px]">
        <div className="mb-2 flex h-8 shrink-0 items-center justify-between px-1">
          <button type="button" onClick={() => setActiveFolderId(undefined)} className="min-w-0 flex-1 truncate px-2 text-left text-xs font-semibold text-muted-foreground" title="在根目录新建">文件</button>
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="iconSm" onClick={() => createEntry('document')} aria-label="新建笔记" title="新建笔记" className="h-8 w-8 text-muted-foreground"><FilePlus2 size={15} /></Button>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => createEntry('folder')} aria-label="新建文件夹" title="新建文件夹" className="h-8 w-8 text-muted-foreground"><FolderPlus size={15} /></Button>
          </div>
        </div>
        <div
          className={cn('min-h-0 flex-1 overflow-y-auto rounded-md transition-colors', rootDropActive && 'bg-black/[0.045] ring-1 ring-inset ring-black/10 dark:bg-white/[0.06] dark:ring-white/15')}
          onDragOver={(event) => { if (!draggedEntryId) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (event.target === event.currentTarget) setRootDropActive(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRootDropActive(false); }}
          onDrop={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); const draggedId = draggedEntryId || event.dataTransfer.getData('text/plain'); if (draggedId) moveEntry(draggedId); }}
        >{renderTree(undefined)}</div>
        {normalizedQuery && !allEntries.some((entry) => !entry.parent && entryMatchesQuery(entry)) && <div className="px-3 py-8 text-center text-xs text-muted-foreground">没有找到匹配文件</div>}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-background shadow-sm">
        <div role="tablist" aria-label="已打开的文档" className="flex h-10 shrink-0 items-end overflow-x-auto border-b border-black/[0.05] bg-background px-1 pt-1 dark:border-white/[0.06]">
          {openEntries.map((entry) => {
            const isActive = activeEntryId === entry.id;
            return <div key={entry.id} className={cn('group flex h-9 min-w-[132px] max-w-[220px] items-center rounded-t-md border border-b-0 border-transparent', isActive && 'border-black/[0.05] bg-background dark:border-white/[0.06]')}>
              <button type="button" role="tab" aria-selected={isActive} onClick={() => { setActiveEntryId(entry.id); if (entry.kind === 'project') setActiveProject(entry.id); }} className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><FileText size={13} className="shrink-0" /><span className={cn('truncate', isActive && 'text-foreground')}>{entry.name}</span></button>
              <Button type="button" variant="ghost" size="iconSm" onClick={() => closeEntry(entry.id)} aria-label={`关闭 ${entry.name}`} title="关闭文件" className="mr-1 h-7 w-7 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"><X size={13} /></Button>
            </div>;
          })}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeDocument || activeProject ? <article className="mx-auto max-w-3xl px-8 py-8 lg:px-12">
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">{activeDocument?.content?.[0] || activeEntry?.name.replace(/\.md$/i, '')}</h1>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={13} /> 更新于 {activeEntry?.updatedAt || '刚刚'}</div>
            {activeEntry?.description && <p className="mt-6 text-sm leading-7 text-muted-foreground">{activeEntry.description}</p>}
            {activeDocument?.content ? <div className="mt-6 space-y-4 text-sm leading-7 text-foreground/85">{activeDocument.content.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div> : <Card className="mt-8" padding="lg"><div className="flex items-center gap-2 text-sm font-semibold"><FolderOpen size={17} /> 工程文件</div><p className="mt-2 text-sm leading-6 text-muted-foreground">该项目已与画布关联。进入创作或视频模块后，生成物会自动归档到这里。</p></Card>}
          </article> : <div className="grid h-full min-h-[240px] place-items-center px-6 text-center text-sm text-muted-foreground">从左侧文件树打开一个文件</div>}
        </div>
      </section>
      </div>
    </main>
  );
};
