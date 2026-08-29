import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Equalizer2, Equalizer3, Eye, FileUp, GripVertical, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, Tag, Trash2, Upload } from '@/lib/remixIconShim';
import { Badge, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Separator, Textarea } from '../ui';
import { cn } from '../../lib/utils';

type LibraryEntry = { id: string; name: string; category: string; prompt: string; updatedAt: number };
type LibraryContextMenu = { entryId?: string; categoryItem?: string; x: number; y: number };
const STORAGE_KEY = 'design-work-quick-notes';
const LIBRARY_KEY = 'design-work-prompt-library';
const CATEGORY_KEY = 'design-work-prompt-categories';
const defaultCategories = ['我的', '精选', '职业', '商业', '工具', '语言', '办公', '通用', '写作', '编程', '情感', '教育', '创意', '学术', '设计', '艺术', '娱乐', '生活', '医疗', '游戏'];
const defaults: LibraryEntry[] = [
  { id: 'entry-brief', name: '打工牛马小助手', category: '我的', prompt: '你是我日常处理工作的助手，我在遇到问题时，需要根据具体需求帮助我解决问题。', updatedAt: Date.now() - 840000 },
  { id: 'entry-comfy', name: 'ComfyUI 报错小助手', category: '我的', prompt: '你是一个专注于处理 ComfyUI AI 绘画报错的技术人员，熟练掌握各种编码技术。', updatedAt: Date.now() - 1680000 },
  { id: 'entry-video', name: '视频内容分析专家', category: '精选', prompt: '专业的视频内容分析专家，具备深度解构和结构化分析视频内容的能力。', updatedAt: Date.now() - 2700000 },
  { id: 'entry-qwen', name: 'Qwen-image 文生图提示词', category: '精选', prompt: '专注生成 QWEN-IMAGE 模型提示词的助手，基于用户创意扩写结构化提示词。', updatedAt: Date.now() - 3120000 },
  { id: 'entry-wan', name: 'Wan2.1 图生视频提示词', category: '视频', prompt: '将静态图像转化动态视频内容，生成适合 Wan2.1 的结构化提示词。', updatedAt: Date.now() - 4200000 },
  { id: 'entry-flux', name: 'Flux 文生图提示词', category: '设计', prompt: '你来充当一位有艺术气息的 FLUX prompt 助理，根据自然语言想象完整画面。', updatedAt: Date.now() - 5700000 },
  { id: 'entry-writing', name: '短篇科幻小说作家', category: '写作', prompt: '结合科学知识和哲学思考，创作具有独特世界观与情绪张力的短篇科幻小说。', updatedAt: Date.now() - 7200000 },
  { id: 'entry-ui', name: 'UI/UX 设计师专家', category: '设计', prompt: '在视觉设计与用户体验领域提供专业建议，关注可用性、层次和一致性。', updatedAt: Date.now() - 9600000 },
];
const readEntries = (): LibraryEntry[] => { try { const saved = JSON.parse(localStorage.getItem(LIBRARY_KEY) || 'null'); if (Array.isArray(saved)) return saved; const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (Array.isArray(old) && old.length) return old.map((note: { id: string; content: string; tags?: string[]; updatedAt: number }) => ({ id: note.id, name: note.content.trim().split('\n')[0] || '未命名词条', category: note.tags?.[0] || '我的', prompt: note.content, updatedAt: note.updatedAt })); } catch { /* use defaults */ } return defaults; };
const readCategories = (): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORY_KEY) || 'null');
    if (Array.isArray(saved) && saved.every((item) => typeof item === 'string')) return saved;
  } catch { /* use defaults */ }
  return defaultCategories;
};
const formatDate = (value: number) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(value);

export const QuickNotes = ({ query = '' }: { query?: string }) => {
  const [entries, setEntries] = useState<LibraryEntry[]>(readEntries);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(true);
  const [category, setCategory] = useState('全部'); const [manageMode, setManageMode] = useState(false); const [selected, setSelected] = useState<string[]>([]);
  const [categoryItems, setCategoryItems] = useState<string[]>(() => Array.from(new Set([...readCategories(), ...entries.map((entry) => entry.category)]))); const [manageCategories, setManageCategories] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]); const [draggedCategory, setDraggedCategory] = useState<string | null>(null); const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false); const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState(''); const [categoryError, setCategoryError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false); const [importOpen, setImportOpen] = useState(false); const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null); const [contextMenu, setContextMenu] = useState<LibraryContextMenu | null>(null);
  const [draft, setDraft] = useState({ name: '', category: '我的', prompt: '' }); const [importUrl, setImportUrl] = useState('');
  const contextMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem(CATEGORY_KEY, JSON.stringify(categoryItems)); }, [categoryItems]);
  useEffect(() => {
    if (manageCategories) return;
    setSelectedCategories([]);
    setDraggedCategory(null);
    setDragOverCategory(null);
  }, [manageCategories]);
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
  const counts = useMemo(() => new Map(categoryItems.map((item) => [item, entries.filter((entry) => entry.category === item).length])), [categoryItems, entries]);
  const filtered = useMemo(() => entries.filter((entry) => { const inCategory = category === '全部' || entry.category === category; return inCategory && `${entry.name} ${entry.prompt} ${entry.category}`.toLowerCase().includes(query.trim().toLowerCase()); }), [entries, category, query]);
  const contextEntry = entries.find((entry) => entry.id === contextMenu?.entryId);
  const contextCategory = contextMenu?.categoryItem;
  const viewingEntry = entries.find((entry) => entry.id === viewingId);
  const openCreate = () => { setEditingId(null); setDraft({ name: '', category: categoryItems[0] || '我的', prompt: '' }); setEditorOpen(true); };
  const openEdit = (entry: LibraryEntry) => { setEditingId(entry.id); setDraft({ name: entry.name, category: entry.category, prompt: entry.prompt }); setEditorOpen(true); };
  const openView = (entry: LibraryEntry) => setViewingId(entry.id);
  const saveEntry = () => { if (!draft.name.trim() || !draft.prompt.trim()) return; const next = { name: draft.name.trim(), category: draft.category, prompt: draft.prompt.trim(), updatedAt: Date.now() }; setEntries((current) => editingId ? current.map((entry) => entry.id === editingId ? { ...entry, ...next } : entry) : [{ id: `entry-${Date.now()}`, ...next }, ...current]); setEditorOpen(false); };
  const remove = (id: string) => setEntries((current) => current.filter((entry) => entry.id !== id)); const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const confirmRemove = (entry: LibraryEntry) => {
    if (!window.confirm(`确定删除“${entry.name}”吗？`)) return;
    remove(entry.id);
    if (viewingId === entry.id) setViewingId(null);
  };
  const openContextMenu = (event: React.MouseEvent, entryId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 240;
    const menuHeight = entryId ? 228 : 60;
    setContextMenu({
      entryId,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };
  const openCategoryContextMenu = (event: React.MouseEvent, item: string) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 240;
    const menuHeight = item === '全部' ? 112 : 228;
    setContextMenu({
      categoryItem: item,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };
  const selectAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((entry) => entry.id)); const deleteSelected = () => { setEntries((current) => current.filter((entry) => !selected.includes(entry.id))); setSelected([]); setManageMode(false); };
  const importEntry = () => { if (!importUrl.trim()) return; setEntries((current) => [{ id: `entry-${Date.now()}`, name: '外部导入词条', category: categoryItems[0] || '我的', prompt: importUrl.trim(), updatedAt: Date.now() }, ...current]); setImportUrl(''); setImportOpen(false); };
  const openCreateCategory = () => { setEditingCategory(null); setCategoryDraft(''); setCategoryError(''); setCategoryEditorOpen(true); };
  const openEditCategory = (item: string) => { setEditingCategory(item); setCategoryDraft(item); setCategoryError(''); setCategoryEditorOpen(true); };
  const saveCategory = () => {
    const nextName = categoryDraft.trim();
    if (!nextName) { setCategoryError('请输入标签名称'); return; }
    if (nextName === '全部' || categoryItems.some((item) => item === nextName && item !== editingCategory)) { setCategoryError('标签名称已存在'); return; }
    if (editingCategory) {
      setCategoryItems((current) => current.map((item) => item === editingCategory ? nextName : item));
      setEntries((current) => current.map((entry) => entry.category === editingCategory ? { ...entry, category: nextName } : entry));
      setSelectedCategories((current) => current.map((item) => item === editingCategory ? nextName : item));
      if (category === editingCategory) setCategory(nextName);
      setDraft((current) => current.category === editingCategory ? { ...current, category: nextName } : current);
    } else {
      setCategoryItems((current) => [...current, nextName]);
    }
    setCategoryEditorOpen(false);
  };
  const toggleCategorySelected = (item: string) => setSelectedCategories((current) => current.includes(item) ? current.filter((candidate) => candidate !== item) : [...current, item]);
  const toggleAllCategories = () => setSelectedCategories((current) => current.length === categoryItems.length ? [] : [...categoryItems]);
  const deleteSelectedCategories = () => {
    if (!selectedCategories.length || selectedCategories.length >= categoryItems.length) return;
    const replacement = categoryItems.find((item) => !selectedCategories.includes(item));
    if (!replacement || !window.confirm(`删除选中的 ${selectedCategories.length} 个标签吗？\n这些标签下的助手会移动到“${replacement}”。`)) return;
    const removed = new Set(selectedCategories);
    setCategoryItems((current) => current.filter((item) => !removed.has(item)));
    setEntries((current) => current.map((entry) => removed.has(entry.category) ? { ...entry, category: replacement } : entry));
    if (removed.has(category)) setCategory(replacement);
    setDraft((current) => removed.has(current.category) ? { ...current, category: replacement } : current);
    setSelectedCategories([]);
  };
  const deleteCategory = (item: string) => {
    if (categoryItems.length <= 1) return;
    const replacement = categoryItems.find((candidate) => candidate !== item);
    if (!replacement || !window.confirm(`确定删除标签“${item}”吗？\n该标签下的助手会移动到“${replacement}”。`)) return;
    setCategoryItems((current) => current.filter((candidate) => candidate !== item));
    setEntries((current) => current.map((entry) => entry.category === item ? { ...entry, category: replacement } : entry));
    if (category === item) setCategory(replacement);
    setDraft((current) => current.category === item ? { ...current, category: replacement } : current);
    setSelectedCategories((current) => current.filter((candidate) => candidate !== item));
  };
  const reorderCategory = (source: string, target: string) => {
    if (source === target) return;
    setCategoryItems((current) => {
      if (!current.includes(source) || !current.includes(target)) return current;
      const next = current.filter((item) => item !== source);
      next.splice(next.indexOf(target), 0, source);
      return next;
    });
  };

  return <main className="ui-module-panel flex h-full min-h-0 bg-[var(--module-workspace-bg,var(--background))] shadow-none">
    {categoryPanelOpen && <aside className="ui-module-divider-r hidden w-[200px] shrink-0 flex-col overflow-hidden bg-[var(--module-workspace-bg,var(--background))] text-foreground md:flex">
      <div className="ui-module-divider-b flex h-12 shrink-0 items-center justify-center gap-3 px-2">
        <Button type="button" variant="ghost" size="iconSm" onClick={openCreateCategory} aria-label="新建标签" title="新建标签" className="h-8 w-8 text-foreground/70 hover:bg-[var(--surface-hover)] hover:text-foreground"><Tag size={16} /></Button>
        <Button type="button" variant="ghost" size="iconSm" onClick={() => setManageCategories((value) => !value)} aria-label={manageCategories ? '退出标签管理' : '管理标签'} aria-pressed={manageCategories} title={manageCategories ? '退出标签管理' : '管理标签'} className={cn('h-8 w-8 text-foreground/70 hover:bg-[var(--surface-hover)] hover:text-foreground', manageCategories && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]')}><Equalizer2 size={16} /></Button>
      </div>
      {manageCategories && <div className="ui-module-divider-b flex h-9 shrink-0 items-center gap-2 px-3 text-xs">
        <Checkbox checked={selectedCategories.length === categoryItems.length ? true : selectedCategories.length ? 'indeterminate' : false} onCheckedChange={toggleAllCategories} aria-label={selectedCategories.length === categoryItems.length ? '取消全选标签' : '全选标签'} className="border-muted-foreground/50" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">已选 {selectedCategories.length}</span>
        <Button type="button" variant="ghost" size="iconSm" disabled={!selectedCategories.length || selectedCategories.length >= categoryItems.length} onClick={deleteSelectedCategories} aria-label="删除所选标签" title={selectedCategories.length >= categoryItems.length ? '至少保留一个标签' : '删除所选标签'} className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
      </div>}
      <nav className="knowledge-file-tree-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 pt-3" aria-label="助手分类">
        {['全部', ...categoryItems].map((item) => {
          const count = item === '全部' ? entries.length : counts.get(item) || 0;
          const isActive = category === item;
          if (item === '全部' || !manageCategories) {
            return <button key={item} type="button" onClick={() => setCategory(item)} onContextMenu={(event) => openCategoryContextMenu(event, item)} className={cn('flex h-8 w-full items-center justify-between rounded-md px-2 text-xs transition-colors', isActive ? 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]' : 'text-foreground/70 hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]')}><span className="truncate">{item}</span><span className="shrink-0 tabular-nums opacity-70">{count}</span></button>;
          }
          const isSelectedCategory = selectedCategories.includes(item);
          return <div key={item} onContextMenu={(event) => openCategoryContextMenu(event, item)} onDragOver={(event) => { event.preventDefault(); if (draggedCategory !== item) setDragOverCategory(item); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverCategory((current) => current === item ? null : current); }} onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/plain') || draggedCategory; if (source) reorderCategory(source, item); setDraggedCategory(null); setDragOverCategory(null); }} className={cn('group flex h-8 items-center rounded-md px-1 transition-colors', isSelectedCategory ? 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)]' : 'text-foreground/70 hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]', dragOverCategory === item && 'ring-1 ring-ring/50')}>
            <button type="button" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item); setDraggedCategory(item); }} onDragEnd={() => { setDraggedCategory(null); setDragOverCategory(null); }} aria-label={`拖动标签 ${item} 调整顺序`} title="拖动调整顺序" className="grid h-7 w-7 shrink-0 cursor-grab place-items-center rounded text-foreground/50 hover:bg-[var(--surface-hover)] hover:text-foreground active:cursor-grabbing"><GripVertical size={16} /></button>
            <button type="button" onClick={() => toggleCategorySelected(item)} className="min-w-0 flex-1 truncate text-left text-xs">{item}</button>
            <div className="relative flex h-7 w-12 shrink-0 items-center justify-end">
              <span className="mr-1 text-xs tabular-nums opacity-70 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">{count}</span>
              <div className="absolute inset-y-0 right-0 flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button type="button" onClick={() => openEditCategory(item)} aria-label={`编辑标签 ${item}`} title="编辑标签" className="grid h-6 w-6 place-items-center rounded text-foreground/60 hover:bg-[var(--surface-hover)] hover:text-foreground"><Pencil size={14} /></button>
                <button type="button" disabled={categoryItems.length <= 1} onClick={() => deleteCategory(item)} aria-label={`删除标签 ${item}`} title={categoryItems.length <= 1 ? '至少保留一个标签' : '删除标签'} className="grid h-6 w-6 place-items-center rounded text-foreground/60 hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"><Trash2 size={14} /></button>
              </div>
            </div>
            <Checkbox checked={isSelectedCategory} onCheckedChange={() => toggleCategorySelected(item)} aria-label={`选择标签 ${item}`} className="mr-1 border-muted-foreground/50" />
          </div>;
        })}
      </nav>
    </aside>}
    <section className="min-w-0 flex-1 overflow-y-auto bg-[var(--module-workspace-bg,var(--background))]"><header className="ui-module-divider-b sticky top-0 z-10 flex h-12 shrink-0 flex-wrap items-center gap-2 bg-[var(--module-workspace-bg,var(--background))] px-4 backdrop-blur"><div className="flex min-w-0 flex-1 items-center gap-2"><Button type="button" variant="ghost" size="iconSm" onClick={() => setCategoryPanelOpen((value) => !value)} aria-label={categoryPanelOpen ? '收起助手分类' : '展开助手分类'} title={categoryPanelOpen ? '收起助手分类' : '展开助手分类'} className="hidden h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:inline-flex">{categoryPanelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}</Button><h1 className="text-sm font-semibold">{category === '全部' ? '助手库' : category}</h1><span className="text-xs text-muted-foreground">{filtered.length}</span></div><Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(true)} className="h-8 gap-1.5 text-xs text-foreground/70 hover:text-foreground"><Upload size={14} /> 从外部导入</Button><Button type="button" variant={manageMode ? 'secondary' : 'ghost'} size="sm" onClick={() => { setManageMode((value) => !value); setSelected([]); }} className={cn('h-8 gap-1.5 text-xs', !manageMode && 'text-foreground/70 hover:text-foreground')}><Equalizer3 size={14} /> 管理助手</Button><Button type="button" variant="ghost" size="sm" onClick={openCreate} className="h-8 gap-1.5 text-xs text-foreground/70 hover:text-foreground"><Plus size={14} /> 创建助手</Button></header>
      {manageMode && <div className="ui-module-divider-b flex h-10 items-center gap-3 px-4 text-xs"><Button type="button" variant="ghost" size="sm" onClick={selectAll} className="h-7 gap-1.5 px-2"><Check size={16} /> 全选</Button><span className="text-muted-foreground">已选择 {selected.length}</span><Button type="button" variant="ghost" size="sm" disabled={!selected.length} onClick={deleteSelected} className="ml-auto h-7 gap-1.5 px-2 text-destructive"><Trash2 size={16} /> 删除</Button></div>}
      <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2 xl:grid-cols-3" onContextMenu={(event) => { if ((event.target as HTMLElement).closest('[data-library-entry]')) return; openContextMenu(event); }}>{filtered.map((entry) => { const isSelected = selected.includes(entry.id); return <Card key={entry.id} data-library-entry padding="none" onContextMenu={(event) => openContextMenu(event, entry.id)} className={cn('group relative min-h-[150px] overflow-hidden', isSelected && 'ring-2 ring-ring/30')}><button type="button" className={cn('block w-full text-left transition-colors', manageMode && (isSelected ? 'bg-[var(--surface-control)] hover:bg-[var(--surface-control)]' : 'hover:bg-[var(--surface-hover)]'))} onClick={() => manageMode ? toggleSelected(entry.id) : openEdit(entry)}><div className="p-4"><div className="flex items-start gap-2"><h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.name}</h2><span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(entry.updatedAt)}</span>{manageMode && <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded border bg-[var(--surface-card-bg)] transition-colors', isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 group-hover:border-foreground/50')} aria-hidden="true">{isSelected && <Check size={12} />}</span>}</div><Badge variant="subtle" className="mt-2 text-[10px]">{entry.category}</Badge><p className="mt-3 line-clamp-4 text-xs leading-5 text-muted-foreground">{entry.prompt}</p></div></button>{!manageMode && <div className="absolute bottom-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"><Button type="button" variant="ghost" size="iconSm" onClick={() => openEdit(entry)} aria-label={`编辑 ${entry.name}`} title="编辑" className="h-8 w-8 p-0 text-foreground/70 hover:bg-[var(--surface-hover)] hover:text-foreground"><Pencil size={16} /></Button><Button type="button" variant="ghost" size="iconSm" onClick={() => confirmRemove(entry)} aria-label={`删除 ${entry.name}`} title="删除" className="h-8 w-8 p-0 text-foreground/70 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></Button></div>}</Card>; })}{!filtered.length && <div className="col-span-full flex min-h-60 flex-col items-center justify-center text-center text-xs text-muted-foreground"><Search size={20} /><p className="mt-3">没有匹配的词条</p><Button type="button" variant="ghost" size="sm" onClick={openCreate} className="mt-2 h-8">创建一个助手</Button></div>}</div>
    </section>
    {contextMenu && <Card ref={contextMenuRef} role="menu" aria-label={contextEntry ? `${contextEntry.name} 操作` : contextCategory ? `${contextCategory} 标签操作` : '助手库操作'} style={{ left: contextMenu.x, top: contextMenu.y }} padding="sm" className="fixed z-[100] w-60 p-2 shadow-lg">{contextEntry ? <><Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { openView(contextEntry); setContextMenu(null); }} className="h-11 w-full justify-start gap-3 px-3 text-left text-sm"><Eye size={16} className="text-muted-foreground" />查看助手</Button><Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { openCreate(); setContextMenu(null); }} className="h-11 w-full justify-start gap-3 px-3 text-left text-sm"><Plus size={16} className="text-muted-foreground" />新建助手</Button><Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { openEdit(contextEntry); setContextMenu(null); }} className="h-11 w-full justify-start gap-3 px-3 text-left text-sm"><Pencil size={16} className="text-muted-foreground" />编辑助手</Button><Separator className="my-1" /><Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { confirmRemove(contextEntry); setContextMenu(null); }} className="h-11 w-full justify-start gap-3 px-3 text-left text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} />删除助手</Button></> : contextCategory ? <><Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { setCategory(contextCategory); setContextMenu(null); }} className="h-11 w-full justify-start gap-3 px-3 text-left text-sm"><Eye size={16} className="text-muted-foreground" />查看标签</Button><Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { openCreateCategory(); setContextMenu(null); }} className="h-11 w-full justify-start gap-3 px-3 text-left text-sm"><Plus size={16} className="text-muted-foreground" />新建标签</Button>{contextCategory !== '全部' && <><Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { openEditCategory(contextCategory); setContextMenu(null); }} className="h-11 w-full justify-start gap-3 px-3 text-left text-sm"><Pencil size={16} className="text-muted-foreground" />编辑标签</Button><Separator className="my-1" /><Button type="button" variant="ghost" size="sm" role="menuitem" disabled={categoryItems.length <= 1} onClick={() => { deleteCategory(contextCategory); setContextMenu(null); }} className="h-11 w-full justify-start gap-3 px-3 text-left text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} />删除标签</Button></>}</> : <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { openCreate(); setContextMenu(null); }} className="h-11 w-full justify-start gap-3 px-3 text-left text-sm"><Plus size={16} className="text-muted-foreground" />新建助手</Button>}</Card>}
    <Dialog open={Boolean(viewingEntry)} onOpenChange={(open) => { if (!open) setViewingId(null); }}><DialogContent className="max-w-[520px] gap-0 p-0"><DialogHeader className="border-b border-border px-5 py-4 pr-14"><div className="flex items-center gap-2"><DialogTitle className="min-w-0 flex-1 truncate text-base">{viewingEntry?.name}</DialogTitle>{viewingEntry && <Badge variant="subtle" className="shrink-0 text-[10px]">{viewingEntry.category}</Badge>}</div><DialogDescription className="text-xs">更新于 {viewingEntry ? formatDate(viewingEntry.updatedAt) : ''}</DialogDescription></DialogHeader><div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap px-5 py-4 text-sm leading-6 text-foreground">{viewingEntry?.prompt}</div><div className="flex justify-end gap-2 border-t border-border px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => setViewingId(null)}>关闭</Button><Button type="button" variant="primary" size="sm" onClick={() => { if (viewingEntry) openEdit(viewingEntry); setViewingId(null); }}><Pencil size={15} />编辑</Button></div></DialogContent></Dialog>
    <Dialog open={categoryEditorOpen} onOpenChange={setCategoryEditorOpen}><DialogContent className="max-w-[400px] gap-0 p-0"><DialogHeader className="border-b border-border px-5 py-4 pr-14"><DialogTitle className="text-base">{editingCategory ? '编辑标签' : '新建标签'}</DialogTitle><DialogDescription className="text-xs">标签用于整理和筛选助手。</DialogDescription></DialogHeader><div className="px-5 py-4"><label className="block text-xs font-medium">标签名称<Input autoFocus value={categoryDraft} onChange={(event) => { setCategoryDraft(event.target.value); setCategoryError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') saveCategory(); }} placeholder="输入标签名称" aria-invalid={Boolean(categoryError)} className="mt-2 h-8 text-xs" /></label>{categoryError && <p role="alert" className="mt-2 text-xs text-destructive">{categoryError}</p>}</div><div className="flex justify-end gap-2 border-t border-border px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => setCategoryEditorOpen(false)}>取消</Button><Button type="button" variant="primary" size="sm" onClick={saveCategory} disabled={!categoryDraft.trim()}>{editingCategory ? '保存更改' : '创建标签'}</Button></div></DialogContent></Dialog>
    <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent aria-describedby={undefined} className="max-w-[520px] gap-0 p-0 [&>button]:top-2"><DialogHeader className="h-12 justify-center border-b border-border px-5 pr-14"><DialogTitle className="text-base">{editingId ? '编辑助手' : '创建助手'}</DialogTitle></DialogHeader><div className="space-y-4 px-5 py-4"><label className="block text-xs font-medium">名称<Input autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="输入名称" className="assistant-editor-field mt-2 h-8 text-xs" /></label><label className="block text-xs font-medium">提示词<Textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} placeholder="输入提示词" className="assistant-editor-field mt-2 min-h-[150px] text-xs leading-6" /></label><label className="block text-xs font-medium">分类<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="mt-2 h-8 w-full rounded-md border-0 bg-muted px-2 text-xs outline-none">{categoryItems.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="flex justify-end gap-2 border-t border-border px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => setEditorOpen(false)}>取消</Button><Button type="button" variant="primary" size="sm" onClick={saveEntry} disabled={!draft.name.trim() || !draft.prompt.trim()}>{editingId ? '保存更改' : '添加到词库'}</Button></div></DialogContent></Dialog>
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="max-w-[440px] gap-0 p-0"><DialogHeader className="border-b border-border px-5 py-4 pr-14"><DialogTitle className="text-base">从外部导入</DialogTitle><DialogDescription className="text-xs">通过 URL 或文件内容添加词条。</DialogDescription></DialogHeader><div className="space-y-3 px-5 py-4"><div className="flex gap-2"><Button type="button" variant="secondary" size="sm" className="h-8 gap-1.5"><Upload size={16} /> URL</Button><Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5"><FileUp size={16} /> 文件</Button></div><Input value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="输入 JSON URL" className="h-8 text-xs" /></div><div className="flex justify-end gap-2 border-t border-border px-5 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(false)}>取消</Button><Button type="button" variant="primary" size="sm" onClick={importEntry} disabled={!importUrl.trim()}>导入</Button></div></DialogContent></Dialog>
  </main>;
};
