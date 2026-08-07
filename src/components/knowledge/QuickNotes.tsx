import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Check, CheckSquare2, ImagePlus, PanelLeftClose, PanelLeftOpen, Paperclip, Pencil, Plus, Send, Tags as TagsIcon, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Textarea } from '../ui';

type QuickNote = {
  id: string;
  content: string;
  tags: string[];
  updatedAt: number;
};

const STORAGE_KEY = 'design-work-quick-notes';
const TAGS_STORAGE_KEY = 'design-work-quick-note-tags';
const ALL_NOTES_FILTER = '__all_notes__';
const UNTAGGED_NOTES_FILTER = '__untagged_notes__';

const initialNotes: QuickNote[] = [
  {
    id: 'note-creative-brief',
    content: '品牌短片方向\n\n保留电影感的低饱和色彩，先从人物情绪和空间关系切入，再逐步拉开场景尺度。',
    tags: ['视频灵感', '品牌'],
    updatedAt: Date.now() - 1000 * 60 * 48,
  },
  {
    id: 'note-prompt',
    content: '提示词整理\n\n人物镜头先写主体、服装与动作，再补充光线、景别和环境层次；让每个镜头都有一个清晰视觉重点。',
    tags: ['提示词'],
    updatedAt: Date.now() - 1000 * 60 * 60 * 25,
  },
  {
    id: 'note-assets',
    content: '素材归档规则\n\n角色、场景、道具和风格图分别归类；视频工程中只引用已确认的最终版本。',
    tags: ['工作流'],
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
];

const readNotes = (): QuickNote[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(saved) ? saved : initialNotes;
  } catch {
    return initialNotes;
  }
};

const readManagedTags = (notes: QuickNote[]) => {
  try {
    const saved = JSON.parse(localStorage.getItem(TAGS_STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) return Array.from(new Set(saved.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)));
  } catch {
    // Fall back to tags already used by notes.
  }
  return Array.from(new Set(notes.flatMap((note) => note.tags)));
};

const noteTitle = (content: string) => content.trim().split('\n')[0] || '无标题小记';

const formatUpdatedAt = (value: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);

export const QuickNotes = () => {
  const [notes, setNotes] = useState<QuickNote[]>(readNotes);
  const [managedTags, setManagedTags] = useState<string[]>(() => readManagedTags(notes));
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [managedTagInput, setManagedTagInput] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagInput, setEditingTagInput] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState(ALL_NOTES_FILTER);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [composerOpen, setComposerOpen] = useState(true);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const usedTags = Array.from(new Set(notes.flatMap((note) => note.tags)));
  const availableTags = managedTags;
  const tagCounts = new Map(managedTags.map((tag) => [tag, notes.filter((note) => note.tags.includes(tag)).length]));
  const untaggedNotesCount = notes.filter((note) => note.tags.length === 0).length;
  const filteredNotes = activeTagFilter === ALL_NOTES_FILTER
    ? notes
    : activeTagFilter === UNTAGGED_NOTES_FILTER
      ? notes.filter((note) => note.tags.length === 0)
      : notes.filter((note) => note.tags.includes(activeTagFilter));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(managedTags));
  }, [managedTags]);

  useEffect(() => {
    if (activeTagFilter !== ALL_NOTES_FILTER
      && activeTagFilter !== UNTAGGED_NOTES_FILTER
      && !usedTags.includes(activeTagFilter)) {
      setActiveTagFilter(ALL_NOTES_FILTER);
    }
  }, [activeTagFilter, usedTags]);

  useEffect(() => {
    if (!tagPopoverOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!tagPopoverRef.current?.contains(event.target as Node)) setTagPopoverOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTagPopoverOpen(false);
    };
    window.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [tagPopoverOpen]);

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '');
    if (!tag || tags.includes(tag)) return;
    setManagedTags((current) => current.includes(tag) ? current : [...current, tag]);
    setTags((current) => [...current, tag]);
    setTagInput('');
    setTagPopoverOpen(false);
  };

  const toggleTag = (tag: string) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const addManagedTag = () => {
    const tag = managedTagInput.trim().replace(/^#/, '');
    if (!tag || managedTags.includes(tag)) return;
    setManagedTags((current) => [...current, tag]);
    setManagedTagInput('');
  };

  const startRenamingTag = (tag: string) => {
    setEditingTag(tag);
    setEditingTagInput(tag);
  };

  const saveRenamedTag = () => {
    if (!editingTag) return;
    const nextTag = editingTagInput.trim().replace(/^#/, '');
    if (!nextTag || (nextTag !== editingTag && managedTags.includes(nextTag))) return;
    setManagedTags((current) => current.map((tag) => tag === editingTag ? nextTag : tag));
    setNotes((current) => current.map((note) => ({
      ...note,
      tags: Array.from(new Set(note.tags.map((tag) => tag === editingTag ? nextTag : tag))),
    })));
    setTags((current) => Array.from(new Set(current.map((tag) => tag === editingTag ? nextTag : tag))));
    if (activeTagFilter === editingTag) setActiveTagFilter(nextTag);
    setEditingTag(null);
    setEditingTagInput('');
  };

  const deleteManagedTag = (tagToDelete: string) => {
    setManagedTags((current) => current.filter((tag) => tag !== tagToDelete));
    setNotes((current) => current.map((note) => ({ ...note, tags: note.tags.filter((tag) => tag !== tagToDelete) })));
    setTags((current) => current.filter((tag) => tag !== tagToDelete));
    if (activeTagFilter === tagToDelete) setActiveTagFilter(ALL_NOTES_FILTER);
    if (editingTag === tagToDelete) {
      setEditingTag(null);
      setEditingTagInput('');
    }
  };

  const publish = () => {
    const text = content.trim();
    if (!text) return;
    setNotes((current) => [
      { id: `note-${Date.now()}`, content: text, tags, updatedAt: Date.now() },
      ...current,
    ]);
    setContent('');
    setTags([]);
    setTagInput('');
  };

  const insertText = (text: string) => setContent((current) => `${current}${current ? '\n' : ''}${text}`);

  const beginEdit = (note: QuickNote) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  const saveEdit = () => {
    const nextContent = editingContent.trim();
    if (!editingNoteId || !nextContent) return;
    setNotes((current) => current.map((note) => note.id === editingNoteId ? { ...note, content: nextContent, updatedAt: Date.now() } : note));
    setEditingNoteId(null);
    setEditingContent('');
  };

  return (
    <main className="flex h-full min-h-0 flex-col overflow-visible bg-transparent text-foreground md:flex-row">
      {composerOpen && <section className="relative z-20 flex max-h-[46vh] w-full shrink-0 flex-col overflow-visible bg-transparent p-3 shadow-none md:max-h-none md:w-[min(390px,38vw)] md:min-w-[300px] sm:p-4">
        <p className="mb-3 px-1 text-xs leading-5 text-muted-foreground">随手记下灵感，让创作有迹可循。</p>
        <div className="relative isolate shrink-0 pb-3">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-0 top-3 z-0 rounded-lg border border-black/[0.045] bg-[#e6e6e3] shadow-[0_5px_14px_rgba(15,15,15,0.045)] dark:border-white/[0.05] dark:bg-white/[0.025]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-1.5 bottom-1.5 top-1.5 z-[1] rounded-lg border border-black/[0.06] bg-[#f1f1ee] shadow-[0_3px_10px_rgba(15,15,15,0.04)] dark:border-white/[0.07] dark:bg-white/[0.045]" />
        <Card className="relative z-10 flex flex-col border-black/[0.035] bg-white shadow-[0_2px_8px_rgba(15,15,15,0.055)] dark:border-white/[0.055] dark:bg-[#171717]" padding="md">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Button type="button" variant="ghost" size="iconSm" onClick={() => insertText('[图片]')} aria-label="插入图片标记"><ImagePlus size={17} /></Button>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => insertText('- [ ] ')} aria-label="插入待办事项"><CheckSquare2 size={17} /></Button>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => insertText('#收藏 ')} aria-label="插入收藏标记"><BookmarkPlus size={17} /></Button>
            <input ref={attachmentInputRef} type="file" className="sr-only" onChange={(event) => { const files = [...(event.target.files || [])].map((file) => file.name); if (files.length) insertText(`附件：${files.join('、')}`); event.target.value = ''; }} />
            <Button type="button" variant="ghost" size="iconSm" onClick={() => attachmentInputRef.current?.click()} aria-label="添加附件"><Paperclip size={17} /></Button>
          </div>
          <label htmlFor="quick-note-content" className="sr-only">记录小记</label>
          <Textarea
            id="quick-note-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                publish();
              }
            }}
            placeholder="记你想记…"
            variant="ghost" className="mt-4 h-[290px] min-h-[290px] text-sm leading-7"
          />
          <div className="mt-3 min-h-8">
            <div className="min-w-0">
              <div ref={tagPopoverRef} className="relative flex min-h-8 flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size={tags.length === 0 ? 'sm' : 'iconSm'}
                  onClick={() => setTagPopoverOpen((open) => !open)}
                  aria-label="添加标签"
                  aria-haspopup="dialog"
                  aria-expanded={tagPopoverOpen}
                  className={tags.length === 0
                    ? 'h-8 shrink-0 gap-1.5 px-2 text-xs font-normal text-muted-foreground'
                    : 'h-8 w-8 shrink-0 text-muted-foreground'}
                >
                  <Plus size={14} />
                  {tags.length === 0 && <span>添加标签</span>}
                </Button>
                {tags.map((tag) => <Badge key={tag} variant="secondary" onClick={() => toggleTag(tag)} aria-label={`移除标签 ${tag}`} className="cursor-pointer text-xs">{tag} ×</Badge>)}
                {tagPopoverOpen && <Card role="dialog" aria-label="新增标签" padding="none" className="absolute left-0 top-10 z-[80] flex max-h-[360px] w-[220px] flex-col p-3 shadow-xl md:bottom-10 md:top-auto">
                  <div className="shrink-0 text-xs font-semibold">新增标签</div>
                  <Input autoFocus inputSize="sm" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="输入标签名…" className="mt-3 h-8 shrink-0 text-xs" />
                  {availableTags.length > 0 && <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1"><div className="sticky top-0 z-10 mb-1.5 bg-card pb-1 text-xs text-muted-foreground">已有标签（{availableTags.length}）</div><div className="space-y-1">{availableTags.map((tag) => { const selected = tags.includes(tag); return <Button key={tag} type="button" variant="ghost" size="sm" onClick={() => toggleTag(tag)} aria-pressed={selected} className="h-8 w-full justify-between px-2 text-xs"><span className="truncate">{tag}</span>{selected && <Check size={13} />}</Button>; })}</div></div>}
                  <Button type="button" variant="primary" size="sm" onClick={addTag} disabled={!tagInput.trim()} className="mt-3 h-8 w-full shrink-0 justify-center text-xs"><Plus size={13} /> 添加标签</Button>
                </Card>}
              </div>
            </div>
          </div>
        </Card>
        </div>
        <div className="mt-4 flex items-center justify-start gap-3">
          <Button type="button" variant="primary" size="sm" onClick={publish} disabled={!content.trim()} className="h-8 shrink-0"><Send aria-hidden="true" size={14} /> 记一下</Button>
          <span className="text-xs text-muted-foreground">按 ⌘ Enter 发布</span>
        </div>
      </section>}

      <section aria-label="小记列表" className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-white p-3 dark:bg-[#121212] sm:p-4">
        <div className="mx-auto max-w-4xl">
          <div aria-label="按标签筛选小记" className="sticky top-0 z-20 mb-4 flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden border-b border-black/[0.05] bg-white dark:border-white/[0.06] dark:bg-[#121212]">
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="ghost" size="iconSm" onClick={() => setComposerOpen((open) => !open)} aria-label={composerOpen ? '收起笔记输入区' : '展开笔记输入区'} title={composerOpen ? '收起笔记输入区' : '展开笔记输入区'} aria-expanded={composerOpen} className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08]">
              {composerOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
              </Button>
              <span aria-hidden="true" className="h-4 w-px shrink-0 bg-black/[0.06] dark:bg-white/[0.07]" />
            </div>
            <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max min-w-full flex-nowrap items-center gap-2 py-0.5 pr-1">
                {usedTags.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTagFilter(ALL_NOTES_FILTER)} aria-pressed={activeTagFilter === ALL_NOTES_FILTER} className={activeTagFilter === ALL_NOTES_FILTER ? 'h-8 shrink-0 whitespace-nowrap bg-foreground px-3 text-xs text-background hover:bg-foreground/90 hover:text-background' : 'h-8 shrink-0 whitespace-nowrap bg-muted px-3 text-xs font-normal text-muted-foreground'}>全部（{notes.length}）</Button>}
                {usedTags.map((tag) => <Button key={tag} type="button" variant="ghost" size="sm" onClick={() => setActiveTagFilter(tag)} aria-pressed={activeTagFilter === tag} className={activeTagFilter === tag ? 'h-8 shrink-0 whitespace-nowrap bg-foreground px-3 text-xs text-background hover:bg-foreground/90 hover:text-background' : 'h-8 shrink-0 whitespace-nowrap bg-muted px-3 text-xs font-normal text-muted-foreground'}>{tag}（{tagCounts.get(tag)}）</Button>)}
                {untaggedNotesCount > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTagFilter(UNTAGGED_NOTES_FILTER)} aria-pressed={activeTagFilter === UNTAGGED_NOTES_FILTER} className={activeTagFilter === UNTAGGED_NOTES_FILTER ? 'h-8 shrink-0 whitespace-nowrap bg-foreground px-3 text-xs text-background hover:bg-foreground/90 hover:text-background' : 'h-8 shrink-0 whitespace-nowrap bg-muted px-3 text-xs font-normal text-muted-foreground'}>
                    无标签（{untaggedNotesCount}）
                  </Button>
                ) : null}
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTagManagerOpen(true)} className="shrink-0 gap-1.5 bg-white px-2 text-xs font-normal text-muted-foreground dark:bg-[#121212]"><TagsIcon size={14} /> 标签管理</Button>
          </div>
          <div className="space-y-4 pb-2">
          {filteredNotes.map((note) => (
            <Card key={note.id} padding="none" className="group relative border-black/[0.035] bg-white px-6 py-4 dark:border-white/[0.055] dark:bg-[#171717]">
              <header className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">更新于 {formatUpdatedAt(note.updatedAt)}</span>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button type="button" variant="ghost" size="iconSm" onClick={() => beginEdit(note)} aria-label={`编辑小记 ${noteTitle(note.content)}`} title="编辑小记" className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil aria-hidden="true" size={14} /></Button>
                  <Button type="button" variant="ghost" size="iconSm" onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))} aria-label={`删除小记 ${noteTitle(note.content)}`} title="删除小记" className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 aria-hidden="true" size={14} /></Button>
                </div>
              </header>
              {editingNoteId === note.id ? <div className="mt-3 space-y-2"><Textarea autoFocus value={editingContent} onChange={(event) => setEditingContent(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') saveEdit(); if (event.key === 'Escape') setEditingNoteId(null); }} className="min-h-[150px] text-sm leading-7" aria-label="编辑小记内容" /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setEditingNoteId(null)}>取消</Button><Button type="button" variant="primary" size="sm" onClick={saveEdit} disabled={!editingContent.trim()}>保存</Button></div></div> : <><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">{note.content}</p>{note.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{note.tags.map((tag) => <Badge key={tag} variant="subtle" className="text-xs">#{tag}</Badge>)}</div>}</>}
            </Card>
          ))}
          </div>
        </div>
      </section>

      <Dialog open={tagManagerOpen} onOpenChange={setTagManagerOpen}>
        <DialogContent className="max-w-[420px] gap-0 p-0">
          <DialogHeader className="border-b border-black/[0.04] px-5 py-4 pr-14 dark:border-white/[0.06]">
            <DialogTitle className="text-base">标签管理</DialogTitle>
            <DialogDescription className="text-xs">新建、重命名或删除小记标签。</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 px-5 pt-4">
            <Input autoFocus value={managedTagInput} onChange={(event) => setManagedTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addManagedTag(); } }} placeholder="输入标签名…" className="h-8 border-0 bg-muted text-xs" />
            <Button type="button" variant="primary" size="sm" onClick={addManagedTag} disabled={!managedTagInput.trim() || managedTags.includes(managedTagInput.trim().replace(/^#/, ''))} className="h-8 shrink-0"><Plus size={13} /> 添加</Button>
          </div>
          <div className="px-5 pb-5 pt-4">
            <div className="mb-2 text-xs text-muted-foreground">已有标签（{managedTags.length}）</div>
            <div className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
              {managedTags.map((tag) => <div key={tag} className="group flex min-h-10 items-center gap-2 rounded-lg px-2 hover:bg-muted/70">
                {editingTag === tag ? <><Input autoFocus value={editingTagInput} onChange={(event) => setEditingTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveRenamedTag(); if (event.key === 'Escape') setEditingTag(null); }} className="h-8 flex-1 text-xs" /><Button type="button" variant="ghost" size="sm" onClick={() => setEditingTag(null)} className="h-8 px-2 text-xs">取消</Button><Button type="button" variant="primary" size="sm" onClick={saveRenamedTag} disabled={!editingTagInput.trim() || (editingTagInput.trim().replace(/^#/, '') !== tag && managedTags.includes(editingTagInput.trim().replace(/^#/, '')))} className="h-8 px-2 text-xs">保存</Button></> : <><span className="min-w-0 flex-1 truncate text-sm">{tag}</span><div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><Button type="button" variant="ghost" size="iconSm" onClick={() => startRenamingTag(tag)} aria-label={`重命名标签 ${tag}`} title="重命名" className="h-8 w-8 text-muted-foreground"><Pencil size={14} /></Button><Button type="button" variant="ghost" size="iconSm" onClick={() => deleteManagedTag(tag)} aria-label={`删除标签 ${tag}`} title="删除" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button></div><span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{tagCounts.get(tag) || 0}</span></>}
              </div>)}
              {managedTags.length === 0 && <div className="py-8 text-center text-xs text-muted-foreground">暂无标签，可以在上方创建。</div>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};
