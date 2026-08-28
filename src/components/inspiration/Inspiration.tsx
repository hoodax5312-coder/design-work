import { useState } from 'react';
import {
  Camera,
  Check,
  Clock3,
  Copy,
  Grid3X3,
  Heart,
  Mountain,
  Palette,
  Sparkles,
  Sun,
  type LucideIcon,
} from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { Button } from '../ui';

type PromptCategory =
  | 'camera'
  | 'lighting'
  | 'composition'
  | 'visual'
  | 'color'
  | 'atmosphere'
  | 'emotion'
  | 'era';

type Prompt = {
  id: string;
  category: PromptCategory;
  title: string;
  prompt: string;
};

type Category = {
  id: PromptCategory;
  label: string;
  icon: LucideIcon;
};

const CATEGORIES: Category[] = [
  { id: 'camera', label: '镜头语言', icon: Camera },
  { id: 'lighting', label: '光影布光', icon: Sun },
  { id: 'composition', label: '构图视角', icon: Grid3X3 },
  { id: 'visual', label: '视觉风格', icon: Sparkles },
  { id: 'color', label: '色彩调色', icon: Palette },
  { id: 'atmosphere', label: '场景氛围', icon: Mountain },
  { id: 'emotion', label: '情绪张力', icon: Heart },
  { id: 'era', label: '年代质感', icon: Clock3 },
];

const PROMPTS: Prompt[] = [
  {
    id: 'CAM-01',
    category: 'camera',
    title: '手持跟拍 Handheld Tracking',
    prompt: 'handheld tracking shot, intimate camera movement, natural micro-shake, subject walking through a crowded street, shallow depth of field, cinematic documentary energy',
  },
  {
    id: 'CAM-02',
    category: 'camera',
    title: '低机位仰拍 Low Angle',
    prompt: 'dramatic low angle shot looking upward, imposing subject silhouette, wide lens perspective, towering architecture, cinematic scale, crisp foreground detail',
  },
  {
    id: 'LIT-01',
    category: 'lighting',
    title: '伦勃朗布光 Rembrandt',
    prompt: 'Rembrandt lighting, single soft key light at 45 degrees, triangular catch light on the shadow cheek, dark falloff, elegant portrait photography, rich tonal separation',
  },
  {
    id: 'LIT-02',
    category: 'lighting',
    title: '霓虹逆光 Neon Rim',
    prompt: 'electric cyan and magenta rim lighting, strong neon backlight, luminous edge separation, subtle haze, dark background, high-end music video lighting',
  },
  {
    id: 'COMP-01',
    category: 'composition',
    title: '对称中心 Symmetrical Frame',
    prompt: 'perfectly symmetrical composition, subject centered on the vanishing point, repeating architectural lines, controlled negative space, meticulous editorial framing',
  },
  {
    id: 'COMP-02',
    category: 'composition',
    title: '框中框 Frame Within Frame',
    prompt: 'frame within a frame composition, subject seen through a doorway, layered foreground and background, graphic depth, refined cinematic blocking',
  },
  {
    id: 'STYLE-01',
    category: 'visual',
    title: '胶片颗粒 Film Grain',
    prompt: 'heavy 35mm film grain, Kodak Vision3 500T stock, slight halation around highlights, soft grain texture over entire image, celluloid feel, projected on a cinema screen, warm tones',
  },
  {
    id: 'STYLE-02',
    category: 'visual',
    title: '黑白高反差 B&W High Contrast',
    prompt: 'stark black and white, extreme contrast between deep blacks and blown-out whites, hard shadows, 1950s film noir, graphic novel aesthetic, Ilford HP5 pushed two stops',
  },
  {
    id: 'STYLE-03',
    category: 'visual',
    title: '赛博朋克 Cyberpunk',
    prompt: 'cyberpunk aesthetic, neon-drenched megacity, rain-slicked streets, holographic advertisements, flying vehicles, dense Asian metropolis, Blade Runner 2049 meets Ghost in the Shell, futuristic',
  },
  {
    id: 'STYLE-04',
    category: 'visual',
    title: '赛璐璐动漫 Anime Cel',
    prompt: 'anime cel-shaded style, hand-painted backgrounds, soft pastel colors, clean line work, expressive cel animation, Spirited Away atmosphere, Makoto Shinkai lighting',
  },
  {
    id: 'STYLE-05',
    category: 'visual',
    title: '宽银幕史诗 Anamorphic',
    prompt: 'anamorphic widescreen 2.39:1 aspect ratio, oval bokeh, horizontal blue lens flares, slight edge distortion, cinematic scope, epic scale, Panavision C-Series lenses',
  },
  {
    id: 'STYLE-06',
    category: 'visual',
    title: '写实纪录片 Documentary',
    prompt: 'documentary realism, handheld camera, available light, no art direction, raw unpolished feel, natural performances, 16mm grain, cinéma vérité, gritty authenticity',
  },
  {
    id: 'COLOR-01',
    category: 'color',
    title: '青橙电影 Teal & Orange',
    prompt: 'cinematic teal and orange color grade, warm skin tones against cool shadows, balanced saturation, polished blockbuster color science, rich contrast',
  },
  {
    id: 'COLOR-02',
    category: 'color',
    title: '低饱和雾感 Muted Haze',
    prompt: 'muted desaturated palette, lifted black point, gentle atmospheric haze, soft beige and grey tones, understated editorial color grading, quiet and tactile',
  },
  {
    id: 'MOOD-01',
    category: 'atmosphere',
    title: '雨夜街巷 Rainy Alley',
    prompt: 'rainy midnight alley, wet pavement reflecting distant shop lights, drifting steam, sparse pedestrians under umbrellas, immersive urban atmosphere, cinematic depth',
  },
  {
    id: 'MOOD-02',
    category: 'atmosphere',
    title: '晨雾山谷 Morning Valley',
    prompt: 'first light over a misty mountain valley, low clouds rolling through pine trees, quiet pale gold sun, expansive landscape, serene natural atmosphere',
  },
  {
    id: 'EMO-01',
    category: 'emotion',
    title: '孤独感 Solitude',
    prompt: 'a solitary figure in a vast empty space, restrained body language, distant composition, cool desaturated light, contemplative silence, emotionally cinematic',
  },
  {
    id: 'EMO-02',
    category: 'emotion',
    title: '紧迫感 Urgency',
    prompt: 'tense urgent moment, strong diagonal composition, blurred motion at the edges, harsh directional light, compressed space, rising visual pressure',
  },
  {
    id: 'ERA-01',
    category: 'era',
    title: '90年代录像带 90s VHS',
    prompt: '1990s VHS tape aesthetic, soft interlacing, chromatic aberration, timestamp overlay, analog tracking noise, suburban street at dusk, nostalgic home-video texture',
  },
  {
    id: 'ERA-02',
    category: 'era',
    title: '复古未来 Retro Futurism',
    prompt: '1960s retro futurism, optimistic space-age interiors, brushed aluminum, bold geometric forms, sun-faded colors, editorial product photography, analog future',
  },
];

export const Inspiration = () => {
  const [activeCategory, setActiveCategory] = useState<PromptCategory>('visual');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeCategoryData = CATEGORIES.find((category) => category.id === activeCategory)!;
  const visiblePrompts = PROMPTS.filter((prompt) => prompt.category === activeCategory);

  const copyPrompt = async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopiedId(prompt.id);
      window.setTimeout(() => setCopiedId((current) => current === prompt.id ? null : current), 1800);
    } catch {
      setCopiedId(null);
      window.alert('复制失败，请检查浏览器的剪贴板权限。');
    }
  };

  return (
    <main className="h-full overflow-hidden bg-transparent text-foreground">
      <div className="flex h-full min-w-0 flex-col gap-3 md:flex-row">
        <aside className="flex w-full shrink-0 flex-col bg-sidebar px-3 py-3 text-sidebar-foreground md:w-[232px] md:px-4 md:py-4">
          <div className="mb-3 pl-1 text-xs font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/70">分类</div>
          <nav aria-label="提示词分类" className="flex gap-1 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const count = PROMPTS.filter((prompt) => prompt.category === category.id).length;
              const isActive = activeCategory === category.id;

              return (
                <Button type="button" variant="ghost"
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    'group relative h-8 shrink-0 justify-start gap-2 px-3 text-left text-[13px] md:w-full md:gap-3 md:text-sm',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon aria-hidden="true" size={19} strokeWidth={1.7} />
                  <span className="flex-1">{category.label}</span>
                  <span className={cn('hidden h-5 min-w-5 place-items-center rounded-md px-1 text-xs tabular-nums md:grid', isActive ? 'bg-sidebar-foreground/15 text-sidebar-accent-foreground' : 'bg-sidebar-foreground/10 text-sidebar-foreground/70')}>
                    {count}
                  </span>
                </Button>
              );
            })}
          </nav>

        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg bg-background p-4">
          <header className="mb-4 flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-[-0.01em] text-foreground">{activeCategoryData.label}</h1>
            <span className="text-xs tabular-nums text-muted-foreground">{visiblePrompts.length}</span>
          </header>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visiblePrompts.map((prompt) => {
              const isCopied = copiedId === prompt.id;
              return (
                <article key={prompt.id} className="group relative flex min-h-[176px] min-w-0 flex-col rounded-lg border border-border bg-card p-4 text-card-foreground transition-[border-color] hover:border-foreground/20 focus-within:border-ring">
                  <Button type="button" variant="ghost" size="iconSm"
                      onClick={() => copyPrompt(prompt)}
                      aria-label={`复制「${prompt.title}」提示词`}
                      title={isCopied ? '已复制' : '复制提示词'}
                      className="absolute right-2 top-2 h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {isCopied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
                    </Button>
                  <h2 className="pr-8 text-sm font-semibold leading-6 tracking-[-0.015em] text-foreground">{prompt.title}</h2>
                  <p className="mt-3 line-clamp-4 text-xs leading-5 text-muted-foreground">{prompt.prompt}</p>
                  <footer className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">{activeCategoryData.label}</span>
                    <span className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground/70">{prompt.id}</span>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      </div>
      <p aria-live="polite" role="status" className="sr-only">{copiedId ? '提示词已复制到剪贴板' : ''}</p>
    </main>
  );
};
