import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, CheckSquare2, ImagePlus, Paperclip, Plus, Send, Tag, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, Textarea } from '../ui';

type QuickNote = {
  id: string;
  content: string;
  tags: string[];
  updatedAt: number;
};

const STORAGE_KEY = 'mboard-quick-notes';

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
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '');
    if (!tag || tags.includes(tag)) return;
    setTags((current) => [...current, tag]);
    setTagInput('');
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

  return (
    <main className="ui-module-frame h-full min-h-0 flex-col text-foreground md:flex-row">
      <section className="flex max-h-[46vh] w-full shrink-0 flex-col bg-transparent px-4 py-5 shadow-none md:max-h-none md:w-[min(390px,38vw)] md:min-w-[300px] sm:px-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold tracking-[-0.03em]">小记</div>
            <p className="mt-1 text-xs text-muted-foreground">记录灵感，沉淀创作上下文</p>
          </div>
          <Badge variant="subtle">本地保存</Badge>
        </div>

        <Card className="flex min-h-0 flex-1 flex-col" padding="md">
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
            variant="ghost" className="mt-4 min-h-[220px] flex-1 text-sm leading-7"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" onClick={() => setTags((current) => current.filter((item) => item !== tag))} aria-label={`移除标签 ${tag}`} className="cursor-pointer text-xs">#{tag} ×</Badge>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative min-w-0 flex-1"><Tag aria-hidden="true" size={13} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" /><Input inputSize="sm" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="添加标签" className="pl-8 pr-9" /><Button type="button" variant="ghost" size="iconSm" onClick={addTag} aria-label="添加标签" className="absolute right-0 top-0 h-8 w-8"><Plus size={14} /></Button></div>
          </div>
        </Card>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" variant="primary" size="sm" onClick={publish} disabled={!content.trim()}><Send aria-hidden="true" size={14} /> 记一下</Button>
          <span className="text-xs text-muted-foreground">按 ⌘ Enter 发布</span>
        </div>
      </section>

      <section aria-label="小记列表" className="min-h-0 flex-1 overflow-y-auto px-1 sm:px-2">
        <div className="mx-auto max-w-4xl space-y-4">
          {notes.map((note) => (
            <Card key={note.id} padding="lg">
              <header className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">更新于 {formatUpdatedAt(note.updatedAt)}</span>
                <Button type="button" variant="ghost" size="iconSm" onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))} aria-label={`删除小记 ${noteTitle(note.content)}`} className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 aria-hidden="true" size={14} /></Button>
              </header>
              <h2 className="mt-4 text-base font-semibold tracking-[-0.02em]">{noteTitle(note.content)}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{note.content.split('\n').slice(1).join('\n') || note.content}</p>
              {note.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{note.tags.map((tag) => <Badge key={tag} variant="subtle" className="text-xs">#{tag}</Badge>)}</div>}
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
};
