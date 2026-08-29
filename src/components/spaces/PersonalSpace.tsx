import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Equalizer2,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Search,
  Trash2,
  X,
} from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { Button, Card, Checkbox, Input, Separator } from '../ui';
import { KnowledgeRichTextEditor } from '../knowledge/KnowledgeRichTextEditor';
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
  richContent?: string;
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const paragraphsToHtml = (paragraphs: string[]) => paragraphs
  .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
  .join('');

const DOCUMENTS: SpaceEntry[] = [
  { id: 'creative', name: '创作资料', kind: 'folder', description: '图像、视频和提示词的创作规范', updatedAt: '今天' },
  { id: 'references', name: '视觉参考', kind: 'folder', description: '构图、光影和色彩参考', updatedAt: '昨天' },
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
const DOCUMENT_TREE_STORAGE_KEY = 'design-work-document-tree';
const PROJECT_PARENT_STORAGE_KEY = 'design-work-project-document-parents';

const readDocumentTree = (): SpaceEntry[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(DOCUMENT_TREE_STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) {
      // Folders are always top-level; documents may still belong to a root folder.
      const rootFolderIds = new Set(
        saved.filter((entry: SpaceEntry) => entry?.kind === 'folder' && !entry.parent).map((entry: SpaceEntry) => entry.id),
      );
      return saved.map((entry: SpaceEntry) => entry.kind === 'folder'
        ? { ...entry, parent: undefined }
        : { ...entry, parent: entry.parent && rootFolderIds.has(entry.parent) ? entry.parent : undefined });
    }
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
  const { projects, setActiveProject } = useProjectStore();
  const [documentEntries, setDocumentEntries] = useState<SpaceEntry[]>(readDocumentTree);
  const [projectParents, setProjectParents] = useState<Record<string, string | undefined>>(readProjectParents);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['creative', 'video']));
  const [openEntryIds, setOpenEntryIds] = useState<string[]>(() => DEFAULT_DOCUMENT_ID ? [DEFAULT_DOCUMENT_ID] : []);
  const [activeEntryId, setActiveEntryId] = useState(DEFAULT_DOCUMENT_ID);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>();
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [filePanelOpen, setFilePanelOpen] = useState(true);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [entryNameDraft, setEntryNameDraft] = useState('');
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [folderReorderTarget, setFolderReorderTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ entryId?: string; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const pointerReorderRef = useRef<{ entryId: string; targetId?: string; position?: 'before' | 'after' } | null>(null);
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
  const contextEntry = allEntries.find((entry) => entry.id === contextMenu?.entryId);
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

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

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
  const createEntry = (kind: 'document' | 'folder', parentId?: string | null) => {
    const id = `${kind}-${Date.now()}`;
    const baseName = kind === 'document' ? '未命名笔记.md' : '未命名文件夹';
    const parent = kind === 'folder' ? undefined : parentId === null ? undefined : parentId ?? activeFolderId;
    const entry: SpaceEntry = {
      id,
      kind,
      name: baseName,
      parent,
      updatedAt: '刚刚',
      description: kind === 'document' ? '新建笔记' : undefined,
      content: kind === 'document' ? ['未命名笔记', ''] : undefined,
    };
    setDocumentEntries((current) => [...current, entry]);
    if (parent) setExpanded((current) => new Set(current).add(parent));
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
  const startRenamingEntry = (entry: SpaceEntry) => {
    if (entry.kind === 'project') return;
    setEditingEntryId(entry.id);
    setEntryNameDraft(entry.name.replace(/\.md$/i, ''));
  };
  const toggleSelectedEntry = (id: string) => setSelectedEntryIds((current) => current.includes(id)
    ? current.filter((entryId) => entryId !== id)
    : [...current, id]);
  const toggleAllEntries = () => setSelectedEntryIds((current) => current.length === documentEntries.length
    ? []
    : documentEntries.map((entry) => entry.id));
  const deleteEntries = (entryIds: string[]) => {
    const selected = new Set(entryIds);
    let changed = true;
    while (changed) {
      changed = false;
      documentEntries.forEach((entry) => {
        if (entry.parent && selected.has(entry.parent) && !selected.has(entry.id)) {
          selected.add(entry.id);
          changed = true;
        }
      });
    }
    setDocumentEntries((current) => current.filter((entry) => !selected.has(entry.id)));
    setOpenEntryIds((current) => current.filter((id) => !selected.has(id)));
    if (selected.has(activeEntryId)) setActiveEntryId('');
    if (activeFolderId && selected.has(activeFolderId)) setActiveFolderId(undefined);
    setSelectedEntryIds([]);
    setManageMode(false);
  };
  const deleteSelectedEntries = () => deleteEntries(selectedEntryIds);
  const openTreeContextMenu = (event: React.MouseEvent, entryId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 208;
    const menuHeight = entryId ? 220 : 104;
    setContextMenu({
      entryId,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
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
    if (entry.kind === 'folder' && targetFolderId) return;
    if (entry.kind === 'folder' && targetFolderId && isDescendant(targetFolderId, entry.id)) return;
    if (entry.kind === 'project') {
      setProjectParents((current) => ({ ...current, [entry.id]: targetFolderId }));
    } else {
      setDocumentEntries((current) => current.map((item) => item.id === entry.id ? { ...item, parent: targetFolderId } : item));
    }
    if (targetFolderId) setExpanded((current) => new Set(current).add(targetFolderId));
    setDraggedEntryId(null);
    setDragOverFolderId(null);
    setFolderReorderTarget(null);
    setRootDropActive(false);
  };
  const reorderRootFolder = (entryId: string, targetId: string, position: 'before' | 'after') => {
    if (entryId === targetId) return;
    setDocumentEntries((current) => {
      const rootFolders = current.filter((entry) => entry.kind === 'folder' && !entry.parent);
      if (!rootFolders.some((entry) => entry.id === entryId) || !rootFolders.some((entry) => entry.id === targetId)) return current;
      const reordered = rootFolders.filter((entry) => entry.id !== entryId);
      const targetIndex = reordered.findIndex((entry) => entry.id === targetId);
      const source = rootFolders.find((entry) => entry.id === entryId);
      if (!source || targetIndex < 0) return current;
      reordered.splice(targetIndex + (position === 'after' ? 1 : 0), 0, source);
      let folderIndex = 0;
      return current.map((entry) => entry.kind === 'folder' && !entry.parent ? reordered[folderIndex++] : entry);
    });
    setDraggedEntryId(null);
    setDragOverFolderId(null);
    setFolderReorderTarget(null);
    setRootDropActive(false);
  };
  const updatePointerReorderTarget = (event: React.PointerEvent<SVGSVGElement>) => {
    const pointerDrag = pointerReorderRef.current;
    if (!pointerDrag) return;
    const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-tree-drop-id]');
    const targetId = targetElement?.dataset.treeDropId;
    const targetEntry = allEntries.find((entry) => entry.id === targetId);
    if (!targetElement || !targetId || targetId === pointerDrag.entryId || targetEntry?.kind !== 'folder' || targetEntry.parent) {
      pointerReorderRef.current = { entryId: pointerDrag.entryId };
      setFolderReorderTarget(null);
      return;
    }
    const rect = targetElement.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    pointerReorderRef.current = { ...pointerDrag, targetId, position };
    setFolderReorderTarget({ id: targetId, position });
  };
  const finishPointerReorder = (event: React.PointerEvent<SVGSVGElement>) => {
    const pointerDrag = pointerReorderRef.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pointerDrag?.targetId && pointerDrag.position) reorderRootFolder(pointerDrag.entryId, pointerDrag.targetId, pointerDrag.position);
    pointerReorderRef.current = null;
    setDraggedEntryId(null);
    setFolderReorderTarget(null);
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
      const isManageable = entry.kind !== 'project';
      const isSelected = selectedEntryIds.includes(entry.id);
      const isReorderableFolder = manageMode && isContainer && depth === 0;
      return (
        <div key={entry.id} data-tree-entry className={cn(draggedEntryId === entry.id && 'opacity-45')}>
          <div
            data-tree-drop-id={entry.id}
            onDragOver={(event) => {
              if (!isContainer || draggedEntryId === entry.id) return;
              const draggedEntry = allEntries.find((item) => item.id === draggedEntryId);
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = 'move';
              if (manageMode && depth === 0 && draggedEntry?.kind === 'folder' && !draggedEntry.parent) {
                const rect = event.currentTarget.getBoundingClientRect();
                setFolderReorderTarget({ id: entry.id, position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
                setDragOverFolderId(null);
                return;
              }
              setDragOverFolderId(entry.id);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDragOverFolderId((current) => current === entry.id ? null : current);
                setFolderReorderTarget((current) => current?.id === entry.id ? null : current);
              }
            }}
            onDrop={(event) => {
              if (!isContainer) return;
              event.preventDefault();
              event.stopPropagation();
              const draggedId = draggedEntryId || event.dataTransfer.getData('text/plain');
              if (!draggedId) return;
              const draggedEntry = allEntries.find((item) => item.id === draggedId);
              if (manageMode && depth === 0 && draggedEntry?.kind === 'folder' && !draggedEntry.parent) {
                const rect = event.currentTarget.getBoundingClientRect();
                reorderRootFolder(draggedId, entry.id, event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
                return;
              }
              moveEntry(draggedId, entry.id);
            }}
            className={cn(
              'relative rounded-md',
              isContainer && dragOverFolderId === entry.id && 'bg-sidebar-accent ring-1 ring-inset ring-ring/25',
              folderReorderTarget?.id === entry.id && folderReorderTarget.position === 'before' && 'before:absolute before:inset-x-1 before:top-0 before:z-10 before:h-0.5 before:rounded-full before:bg-primary',
              folderReorderTarget?.id === entry.id && folderReorderTarget.position === 'after' && 'after:absolute after:inset-x-1 after:bottom-0 after:z-10 after:h-0.5 after:rounded-full after:bg-primary',
            )}
          >
            {editingEntryId === entry.id ? <div className="flex h-8 items-center gap-1 pr-2" style={{ paddingLeft: `${8 + depth * 16}px` }}>
              {isContainer ? <Folder size={24} className="shrink-0 text-sidebar-foreground/70" /> : <FileText size={16} className="shrink-0 text-sidebar-foreground/70" />}
              <Input autoFocus value={entryNameDraft} onChange={(event) => setEntryNameDraft(event.target.value)} onBlur={commitEntryName} onKeyDown={(event) => { if (event.key === 'Enter') commitEntryName(); if (event.key === 'Escape') { setEditingEntryId(null); setEntryNameDraft(''); } }} aria-label={isContainer ? '命名新文件夹' : '命名新笔记'} inputSize="sm" className="h-7 min-w-0 flex-1 px-2 text-xs" />
            </div> : <div
              draggable={!manageMode || isReorderableFolder}
              onDragStart={(event) => { setDraggedEntryId(entry.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', entry.id); }}
              onDragEnd={() => { setDraggedEntryId(null); setDragOverFolderId(null); setFolderReorderTarget(null); setRootDropActive(false); }}
              onContextMenu={(event) => openTreeContextMenu(event, entry.id)}
              className={cn(
                'mt-1 flex h-8 w-full items-center gap-2 rounded-md pr-2 text-sm font-normal text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isSelected && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)]',
                manageMode && !isManageable && 'cursor-default opacity-45',
              )}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              {isReorderableFolder && <GripVertical
                aria-hidden="true"
                size={16}
                className="shrink-0 cursor-grab touch-none text-sidebar-foreground/50 active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  pointerReorderRef.current = { entryId: entry.id };
                  setDraggedEntryId(entry.id);
                }}
                onPointerMove={updatePointerReorderTarget}
                onPointerUp={finishPointerReorder}
                onPointerCancel={finishPointerReorder}
              />}
              <Button
                type="button"
                variant="ghost"
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
                className="h-8 min-w-0 flex-1 justify-start gap-2 rounded-md border-0 bg-transparent p-0 text-left text-sm font-normal text-inherit shadow-none hover:bg-transparent hover:text-inherit"
              >
                {isContainer ? <span aria-hidden="true" className="flex h-6 w-8 shrink-0 items-center gap-1 text-sidebar-foreground/70">{isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}{isOpen ? <FolderOpen size={24} /> : <Folder size={24} />}</span> : <FileText aria-hidden="true" size={16} className="shrink-0 text-sidebar-foreground/70" />}
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              </Button>
              {manageMode && isManageable && <Button type="button" variant="ghost" size="iconSm" onClick={() => toggleSelectedEntry(entry.id)} aria-label={`${isSelected ? '取消选择' : '选择'}${entry.name}`} aria-pressed={isSelected} className={cn('h-4 w-4 shrink-0 rounded border bg-[var(--surface-card-bg)] p-0 hover:bg-sidebar-accent', isSelected ? 'border-primary bg-primary text-primary-foreground hover:bg-primary' : 'border-muted-foreground/40')}>{isSelected && <Check size={10} />}</Button>}
            </div>}
          </div>
          {isContainer && isOpen && renderTree(entry.id, depth + 1)}
        </div>
      );
    });

  const activeDocument = activeEntry?.kind === 'document' ? activeEntry : undefined;
  const activeProject = activeEntry?.kind === 'project' ? activeEntry : undefined;
  const updateDocumentRichContent = (entryId: string, richContent: string) => {
    setDocumentEntries((current) => current.map((entry) => entry.id === entryId
      ? { ...entry, richContent, updatedAt: '刚刚' }
      : entry));
  };

  return (
    <main className={cn('flex h-full min-h-0 flex-col text-foreground', embedded ? 'bg-transparent' : 'module-workspace bg-background')}>
      {!embedded && <header className="mx-16 flex h-14 shrink-0 items-center justify-between gap-4 border-0 px-0">
        <h1 className="text-base font-semibold tracking-[-0.02em]">知识</h1>
        <label className="flex h-9 w-[240px] max-w-[48vw] items-center gap-2 rounded-md bg-muted px-2.5">
          <Search aria-hidden="true" size={15} className="shrink-0 text-muted-foreground" />
          <Input
            variant="ghost"
            inputSize="sm"
            aria-label="搜索空间文件"
            value={query}
            onChange={(event) => setLocalQuery(event.target.value)}
            placeholder="搜索知识"
            className="h-9 min-w-0 flex-1 text-xs"
          />
        </label>
      </header>}

      <div className={cn('mb-0 flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row', embedded ? 'rounded-[10px] border border-border bg-transparent' : 'rounded-xl bg-card text-card-foreground', !embedded && 'mx-16 p-2')}>
      {filePanelOpen && <aside aria-label="知识文件树" className={cn('flex max-h-[38vh] w-full shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-none md:max-h-none', embedded ? 'border-r border-sidebar-border md:w-[200px]' : 'md:w-[240px]')}>
        <div className="ui-module-divider-b flex h-12 shrink-0 items-center justify-center px-2">
          <div className="flex shrink-0 gap-3">
            <Button type="button" variant="ghost" size="iconSm" onClick={() => createEntry('document')} aria-label="新建笔记" title="新建笔记" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><FilePlus2 size={15} /></Button>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => createEntry('folder')} aria-label="新建文件夹" title="新建文件夹" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><FolderPlus size={15} /></Button>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => { setManageMode((value) => !value); setSelectedEntryIds([]); setDraggedEntryId(null); setDragOverFolderId(null); setFolderReorderTarget(null); pointerReorderRef.current = null; setRootDropActive(false); }} aria-label={manageMode ? '退出管理' : '管理文件'} aria-pressed={manageMode} title={manageMode ? '退出管理' : '管理文件'} className={cn('h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground', manageMode && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)]')}><Equalizer2 size={15} /></Button>
          </div>
        </div>
        {manageMode && <div className="ui-module-divider-b flex h-9 shrink-0 items-center gap-2 px-3 text-xs">
          <Checkbox checked={documentEntries.length > 0 && selectedEntryIds.length === documentEntries.length ? true : selectedEntryIds.length ? 'indeterminate' : false} disabled={!documentEntries.length} onCheckedChange={toggleAllEntries} aria-label={documentEntries.length > 0 && selectedEntryIds.length === documentEntries.length ? '取消全选文件' : '全选文件'} className="border-muted-foreground/50" />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">已选 {selectedEntryIds.length}</span>
          <Button type="button" variant="ghost" size="iconSm" disabled={!selectedEntryIds.length} onClick={deleteSelectedEntries} aria-label="删除所选文件" title="删除所选文件" className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
        </div>}
        <nav
          aria-label="笔记与文件夹"
          className={cn('knowledge-file-tree-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1 transition-colors', rootDropActive && 'bg-sidebar-accent ring-1 ring-inset ring-ring/25')}
          onDragOver={(event) => { if (!draggedEntryId) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (event.target === event.currentTarget) setRootDropActive(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setRootDropActive(false); }}
          onDrop={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); const draggedId = draggedEntryId || event.dataTransfer.getData('text/plain'); if (draggedId) moveEntry(draggedId); }}
          onContextMenu={(event) => {
            if ((event.target as HTMLElement).closest('[data-tree-entry]')) return;
            openTreeContextMenu(event);
          }}
        >{renderTree(undefined)}</nav>
        {normalizedQuery && !allEntries.some((entry) => !entry.parent && entryMatchesQuery(entry)) && <div className="px-3 py-8 text-center text-xs text-sidebar-foreground/70">没有找到匹配文件</div>}
      </aside>}

      <section className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', embedded ? 'bg-transparent' : 'rounded-lg bg-background shadow-sm')}>
        <div className="knowledge-tabs-toolbar flex h-12 shrink-0 items-center border-b border-border bg-transparent px-2">
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={() => setFilePanelOpen((value) => !value)}
            aria-label={filePanelOpen ? '收起知识文件树' : '展开知识文件树'}
            title={filePanelOpen ? '收起知识文件树' : '展开知识文件树'}
            className="mr-2 hidden h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground md:inline-flex"
          >
            {filePanelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </Button>
          <div role="tablist" aria-label="已打开的知识" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {openEntries.map((entry) => {
            const isActive = activeEntryId === entry.id;
            return <div key={entry.id} className={cn('group relative flex h-8 min-w-[132px] max-w-[220px] items-center rounded-md border-0 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]', isActive && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]')}>
              <button type="button" role="tab" aria-selected={isActive} onClick={() => { setActiveEntryId(entry.id); if (entry.kind === 'project') setActiveProject(entry.id); }} className={cn('flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', isActive && 'text-[var(--surface-control-foreground)]')}><FileText size={16} className="shrink-0" /><span className="truncate">{entry.name}</span></button>
              <span aria-hidden="true" className={cn('pointer-events-none absolute inset-y-0 right-1 z-10 w-10 opacity-0 transition-opacity', isActive ? 'bg-[var(--surface-control)]' : 'bg-[var(--surface-hover)]', 'group-hover:opacity-100 group-focus-within:opacity-100', isActive && 'opacity-100')} />
              <Button type="button" variant="ghost" size="iconSm" onClick={() => closeEntry(entry.id)} aria-label={`关闭 ${entry.name}`} title="关闭文件" className={cn('absolute right-1 top-1/2 z-20 h-7 w-7 -translate-y-1/2 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100', isActive && 'opacity-100')}><X size={13} /></Button>
            </div>;
          })}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeDocument ? <>
            <KnowledgeRichTextEditor
              key={activeDocument.id}
              content={activeDocument.richContent ?? paragraphsToHtml(activeDocument.content?.slice(1) || [])}
              onChange={(richContent) => updateDocumentRichContent(activeDocument.id, richContent)}
            >
              <article className="w-full max-w-none px-4 pb-6 pt-6">
                <h1 className="text-3xl font-semibold tracking-[-0.04em]">{activeDocument.content?.[0] || activeDocument.name.replace(/\.md$/i, '')}</h1>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={13} /> 更新于 {activeDocument.updatedAt || '刚刚'}</div>
                {activeDocument.description && <p className="mt-6 text-sm leading-7 text-muted-foreground">{activeDocument.description}</p>}
              </article>
            </KnowledgeRichTextEditor>
          </> : activeProject ? <article className="w-full max-w-none px-4 py-6">
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">{activeProject.name.replace(/\.md$/i, '')}</h1>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={13} /> 更新于 {activeProject.updatedAt || '刚刚'}</div>
            {activeProject.description && <p className="mt-6 text-sm leading-7 text-muted-foreground">{activeProject.description}</p>}
            <Card className="mt-8" padding="lg"><div className="flex items-center gap-2 text-sm font-semibold"><FolderOpen size={17} /> 工程文件</div><p className="mt-2 text-sm leading-6 text-muted-foreground">该项目已与画布关联。进入创作或视频模块后，生成物会自动归档到这里。</p></Card>
          </article> : <div className="grid h-full min-h-[240px] place-items-center px-6 text-center text-sm text-muted-foreground">从左侧文件树打开一个文件</div>}
        </div>
      </section>
      </div>
      {contextMenu && (
        <Card
          ref={contextMenuRef}
          role="menu"
          aria-label={contextEntry ? `${contextEntry.name} 操作` : '知识文件树操作'}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          padding="sm"
          className="fixed z-[100] w-52 p-1.5 shadow-lg"
        >
          {!contextEntry && <>
            <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { createEntry('document', null); setContextMenu(null); }} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs"><FilePlus2 size={15} className="text-muted-foreground" />新建笔记</Button>
            <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { createEntry('folder'); setContextMenu(null); }} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs"><FolderPlus size={15} className="text-muted-foreground" />新建文件夹</Button>
          </>}
          {contextEntry && <>
            <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { openEntry(contextEntry); setContextMenu(null); }} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs"><FolderOpen size={15} className="text-muted-foreground" />{contextEntry.kind === 'folder' ? (expanded.has(contextEntry.id) ? '收起文件夹' : '展开文件夹') : contextEntry.kind === 'project' ? '打开项目' : '打开笔记'}</Button>
            {contextEntry.kind !== 'project' && <>
              <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { createEntry('document', contextEntry.kind === 'folder' ? contextEntry.id : contextEntry.parent ?? null); setContextMenu(null); }} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs"><FilePlus2 size={15} className="text-muted-foreground" />{contextEntry.kind === 'folder' ? '在此新建笔记' : '新建同级笔记'}</Button>
              <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { startRenamingEntry(contextEntry); setContextMenu(null); }} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs"><Pencil size={15} className="text-muted-foreground" />重命名</Button>
              <Separator className="my-1" />
              <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { if (window.confirm(`确定删除“${contextEntry.name}”吗？${contextEntry.kind === 'folder' ? '\n文件夹内的笔记也会一并删除。' : ''}`)) deleteEntries([contextEntry.id]); setContextMenu(null); }} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15} />删除</Button>
            </>}
          </>}
        </Card>
      )}
    </main>
  );
};
