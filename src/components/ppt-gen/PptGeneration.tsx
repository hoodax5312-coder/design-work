import { useMemo, useState } from 'react';
import {
  Check,
  Download,
  LayoutTemplate,
  MonitorPlay,
  Plus,
  Presentation,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button, Card, Input, Select, Skeleton, Textarea } from '../ui';

interface SlideDraft {
  id: number;
  kicker: string;
  title: string;
  body: string;
  layout: 'cover' | 'statement' | 'split' | 'list';
}

const themes = [
  { id: 'editorial', name: '编辑黑白', swatches: ['#111315', '#f1f0ea', '#c8ff00'] },
  { id: 'museum', name: '博物馆红', swatches: ['#711d1d', '#f3eadb', '#e8a04b'] },
  { id: 'ocean', name: '深海数据', swatches: ['#062b36', '#d6f5ef', '#c8ff00'] },
];

const buildSlides = (topic: string, count: number): SlideDraft[] => {
  const subject = topic.trim() || '一个值得分享的新想法';
  const structure = [
    { kicker: 'OPENING', title: subject, body: '从一个清晰的问题开始，让观众立刻理解这次分享的价值。', layout: 'cover' as const },
    { kicker: '01 / CONTEXT', title: '我们正在面对什么？', body: `用三个事实建立“${subject}”的背景，不给观众堆积无关信息。`, layout: 'statement' as const },
    { kicker: '02 / INSIGHT', title: '真正的机会在结构之中', body: '拆解表象、核心矛盾和可执行的突破口，让观点变得可记忆。', layout: 'split' as const },
    { kicker: '03 / SYSTEM', title: '从想法到行动的路径', body: '第一步：对齐目标\n第二步：建立原型\n第三步：验证与放大', layout: 'list' as const },
    { kicker: '04 / PROOF', title: '用结果而不是口号说服', body: '放置一个核心案例、一组对比数据，以及一个可被验证的结论。', layout: 'split' as const },
    { kicker: 'NEXT STEP', title: '现在，让改变开始发生', body: '用一句行动召唤收束，给出负责人、时间点和第一个可执行动作。', layout: 'statement' as const },
  ];
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    ...(structure[index % structure.length]),
    kicker: index >= structure.length ? `${String(index + 1).padStart(2, '0')} / DETAIL` : structure[index].kicker,
  }));
};

export const PptGeneration = () => {
  const [topic, setTopic] = useState('AI 视频创作如何重塑品牌内容工作流');
  const [audience, setAudience] = useState('品牌与创意团队');
  const [slideCount, setSlideCount] = useState(8);
  const [theme, setTheme] = useState(themes[0].id);
  const [slides, setSlides] = useState<SlideDraft[]>([]);
  const [selectedId, setSelectedId] = useState(1);
  const [generating, setGenerating] = useState(false);

  const selectedTheme = themes.find((item) => item.id === theme) || themes[0];
  const selectedSlide = slides.find((slide) => slide.id === selectedId) || slides[0];
  const progressLabel = slides.length ? `${slides.length} 页草稿` : '等待生成';

  const generate = async () => {
    setGenerating(true);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    const nextSlides = buildSlides(topic, slideCount);
    setSlides(nextSlides);
    setSelectedId(nextSlides[0].id);
    setGenerating(false);
  };

  const updateSlide = (patch: Partial<SlideDraft>) => {
    setSlides((current) => current.map((slide) => slide.id === selectedId ? { ...slide, ...patch } : slide));
  };

  const exportOutline = () => {
    const payload = { topic, audience, theme, slides, exportedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mboard-presentation-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const slideStats = useMemo(() => [
    ['页面', String(slides.length || slideCount)],
    ['受众', audience],
    ['版式', '16:9'],
  ], [audience, slideCount, slides.length]);

  return (
    <div className="ui-module-frame h-full w-full flex-col text-foreground md:flex-row">
      <aside className="ui-module-panel flex max-h-[46vh] w-full shrink-0 flex-col md:max-h-none md:w-[336px]">
        <div className="border-0 px-5 py-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"><Presentation size={14} /> Presentation studio</div>
          <h1 className="mt-2 text-xl font-semibold tracking-[-0.03em]">PPT 生成</h1>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">先组织故事线，再统一页面的视觉节奏。</p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <Textarea label="演示主题" value={topic} onChange={(event) => setTopic(event.target.value)} className="h-28 text-sm leading-6" placeholder="输入主题、目标或原始大纲…" />

          <div className="grid grid-cols-[1fr_86px] gap-3">
            <Input label="目标受众" value={audience} onChange={(event) => setAudience(event.target.value)} className="text-xs" />
            <Select label="页数" value={String(slideCount)} onChange={(event) => setSlideCount(Number(event.target.value))} options={[6, 8, 10, 12, 16].map((count) => ({ value: String(count), label: `${count} 页` }))} />
          </div>

          <section>
            <div className="mb-2 text-xs font-semibold">视觉主题</div>
            <div className="space-y-2">
              {themes.map((item) => (
                <Button key={item.id} variant={theme === item.id ? 'secondary' : 'ghost'} onClick={() => setTheme(item.id)} className={cn('h-12 w-full justify-start border text-left', theme === item.id ? 'border-primary bg-primary/10' : 'border-border')}>
                  <div className="flex overflow-hidden rounded-md border border-black/10">{item.swatches.map((color) => <span key={color} className="h-6 w-4" style={{ backgroundColor: color }} />)}</div>
                  <span className="flex-1 text-xs font-medium">{item.name}</span>
                  {theme === item.id && <Check size={14} />}
                </Button>
              ))}
            </div>
          </section>
        </div>

        <div className="border-0 p-4">
          <Button variant="primary" onClick={() => void generate()} loading={generating} disabled={!topic.trim()} className="h-11 w-full">
            {!generating && <Wand2 size={16} />}
            {generating ? '正在编排叙事…' : '生成 PPT 草稿'}
          </Button>
        </div>
      </aside>

      <main className="ui-module-panel flex min-w-0 flex-1 flex-col">
        <header className="ui-module-toolbar h-10 shrink-0 bg-card/90 px-3 backdrop-blur">
          <div className="flex items-center gap-5">
            <div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Deck status</div><div className="mt-0.5 text-sm font-semibold">{progressLabel}</div></div>
            <div className="hidden gap-5 lg:flex">{slideStats.map(([label, value]) => <div key={label} className="pl-1"><div className="text-xs uppercase tracking-wider text-slate-400">{label}</div><div className="mt-0.5 max-w-32 truncate text-xs font-medium">{value}</div></div>)}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={exportOutline} disabled={!slides.length}><Download size={14} /> 导出方案</Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="hidden w-[190px] shrink-0 overflow-y-auto border-0 p-3 sm:block">
            <div className="mb-3 flex items-center justify-between px-1"><span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pages</span><Button variant="ghost" size="iconSm" className="h-6 w-6"><Plus size={13} /></Button></div>
            <div className="space-y-2">
              {slides.map((slide) => (
                <Button key={slide.id} variant="ghost" onClick={() => setSelectedId(slide.id)} className={cn('h-auto w-full flex-col items-stretch border p-2 text-left', selectedId === slide.id ? 'border-primary bg-primary/10' : 'border-transparent')}>
                  <div className="mb-1 text-xs font-medium text-slate-400">{String(slide.id).padStart(2, '0')}</div>
                  <div className="aspect-video overflow-hidden rounded-lg bg-[#151719] p-3 text-white">
                    <div className="text-xs tracking-widest text-[#c8ff00]">{slide.kicker}</div>
                    <div className="mt-2 line-clamp-2 text-xs font-semibold leading-tight">{slide.title}</div>
                  </div>
                </Button>
              ))}
              {!slides.length && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="aspect-video rounded-lg" />)}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center overflow-auto p-8">
            {selectedSlide ? (
              <div className="w-full max-w-[900px]">
                <div className="relative aspect-video overflow-hidden rounded-[18px] shadow-[0_28px_80px_rgba(16,18,20,0.20)]" style={{ backgroundColor: selectedTheme.swatches[0], color: selectedTheme.swatches[1] }}>
                  <div className="absolute right-[-7%] top-[-24%] h-[64%] w-[38%] rounded-full opacity-20 blur-3xl" style={{ backgroundColor: selectedTheme.swatches[2] }} />
                  <div className="absolute left-[7%] top-[9%] text-xs font-semibold tracking-[0.24em]" style={{ color: selectedTheme.swatches[2] }}>{selectedSlide.kicker}</div>
                  <div className="absolute inset-x-[7%] top-[23%]">
                    <h2 className={cn(
                      'font-semibold leading-[0.98] tracking-[-0.045em]',
                      selectedSlide.title.length > 16
                        ? 'max-w-[82%] text-[clamp(18px,1.8vw,30px)]'
                        : 'max-w-[78%] text-[clamp(26px,3.4vw,52px)]',
                    )}>{selectedSlide.title}</h2>
                    <p className="mt-4 max-w-[56%] whitespace-pre-line text-[clamp(12px,1vw,14px)] leading-relaxed opacity-65">{selectedSlide.body}</p>
                  </div>
                  <div className="absolute bottom-[8%] left-[7%] right-[7%] flex items-center justify-between border-t pt-3 text-xs uppercase tracking-[0.18em] opacity-40" style={{ borderColor: `${selectedTheme.swatches[1]}30` }}><span>Mboard studio</span><span>{String(selectedSlide.id).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span></div>
                </div>

                <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-3">
                  <Card padding="sm"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><LayoutTemplate size={13} /> 页面标题</div><Textarea value={selectedSlide.title} onChange={(event) => updateSlide({ title: event.target.value })} variant="ghost" className="h-16 min-h-0 text-sm font-semibold" /></Card>
                  <Card padding="sm"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles size={13} /> 页面文案</div><Textarea value={selectedSlide.body} onChange={(event) => updateSlide({ body: event.target.value })} variant="ghost" className="h-16 min-h-0 text-xs leading-5" /></Card>
                </div>
              </div>
            ) : (
              <div className="max-w-sm text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-lg bg-card text-muted-foreground shadow-sm"><MonitorPlay size={25} /></div><h2 className="mt-5 text-lg font-semibold">从主题开始组织一次演示</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">左侧设置受众、页数和视觉主题，生成后可逐页修改。</p></div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
