import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Circle,
  FileImage,
  Film,
  Layers3,
  Loader2,
  PanelRightClose,
  Play,
  Presentation,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';
import { Badge, Button, Card, Separator, Tabs, TabsList, TabsTrigger, Textarea } from '../ui';

const moduleNames = {
  'magic-canvas': '无限画板',
  'image-gen': '图片生成',
  'ppt-gen': 'PPT 生成',
  'video-gen': '视频生成',
  assets: '资产库',
  projects: '个人空间',
  tools: 'AI 应用',
  ecommerce: '电商设计',
  sources: '知识',
  exports: '导出中心',
  settings: '设置',
} as const;

export const CreativeTaskPanel = () => {
  const { activeModule, toggleRightPanel } = useUIStore();
  const [tab, setTab] = useState<'task' | 'artifacts'>('task');
  const [brief, setBrief] = useState('');
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(2);
  const moduleName = moduleNames[activeModule];

  const steps = useMemo(() => [
    { title: '分析项目上下文', detail: '读取尺寸、风格、引用资产', done: completed >= 1 },
    { title: '组织创作方案', detail: `为${moduleName}生成可执行步骤`, done: completed >= 2 },
    { title: '生成并整理版本', detail: '保留参数、提示词和中间结果', done: completed >= 3 },
    { title: '验证与归档', detail: '检查规格并写入资产库', done: completed >= 4 },
  ], [completed, moduleName]);

  const runTask = async () => {
    if (!brief.trim() || running) return;
    setRunning(true);
    setCompleted(2);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    setCompleted(3);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    setCompleted(4);
    setRunning(false);
  };

  return (
    <aside className="flex h-full w-[326px] shrink-0 flex-col border-l bg-card text-foreground">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'task' | 'artifacts')}>
          <TabsList className="h-8">
            <TabsTrigger value="task" className="px-2.5 py-1 text-xs">制作任务</TabsTrigger>
            <TabsTrigger value="artifacts" className="px-2.5 py-1 text-xs">设计产物</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button type="button" variant="ghost" size="iconSm" onClick={toggleRightPanel} aria-label="关闭制作控制器" className="h-7 w-7"><PanelRightClose size={15} /></Button>
      </div>

      {tab === 'task' ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"><Sparkles size={13} className="text-primary" /> Production controller</div>
              <h2 className="mt-2 text-[17px] font-semibold tracking-[-0.025em]">{moduleName}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">在后台执行制作步骤，编辑器可继续操作。</p>
            </div>

            <Card padding="sm" className="mb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">当前运行</span>
                <Badge variant={running ? 'secondary' : completed === 4 ? 'default' : 'subtle'} className="px-2 py-1 text-xs">
                  {running ? '处理中' : completed === 4 ? '已验证' : '就绪'}
                </Badge>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${completed * 25}%` }} /></div>
            </Card>

            <div className="space-y-1">
              {steps.map((step, index) => {
                const active = running && index === completed;
                return (
                  <div key={step.title} className="flex gap-3 rounded-md px-2 py-3 hover:bg-accent/50">
                    <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center">
                      {step.done ? <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check size={10} strokeWidth={3} /></span> : active ? <Loader2 size={15} className="animate-spin text-foreground" /> : <Circle size={14} className="text-muted-foreground/45" />}
                    </div>
                    <div><div className={cn('text-xs font-medium', step.done ? 'text-muted-foreground' : 'text-foreground')}>{step.title}</div><div className="mt-1 text-xs leading-4 text-muted-foreground">{step.detail}</div></div>
                  </div>
                );
              })}
            </div>

            <Separator className="mt-5" />
            <div className="pt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">上下文</div>
              <div className="flex flex-wrap gap-1.5">
                {['当前项目', '选中资产', '品牌规范'].map((item) => <Badge key={item} variant="outline" className="rounded-md px-2 py-1 text-xs font-normal text-muted-foreground">@ {item}</Badge>)}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t p-3">
            <Card padding="none" className="overflow-hidden focus-within:border-ring focus-within:ring-1 focus-within:ring-inset focus-within:ring-ring">
              <Textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="输入制作指令，@ 引用资产…" className="h-20 min-h-20 resize-none border-0 bg-transparent px-3 py-3 text-xs leading-5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              <div className="flex items-center justify-between px-2.5 pb-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-xs text-muted-foreground"><Layers3 size={12} /> 自动规划 <ChevronDown size={11} /></Button>
                <Button type="button" variant="primary" size="iconSm" onClick={() => void runTask()} disabled={!brief.trim() || running} aria-label="运行制作任务" className="h-7 w-7 rounded-full"><Play size={11} fill="currentColor" /></Button>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <ArtifactList />
      )}
    </aside>
  );
};

const ArtifactList = () => {
  const artifacts = [
    { icon: FileImage, title: '主视觉封面', meta: 'PNG · 2048×2048', color: 'bg-amber-100 text-amber-700' },
    { icon: Presentation, title: '演示稿结构', meta: '8 页 · 16:9', color: 'bg-blue-100 text-blue-700' },
    { icon: Film, title: '分镜预览', meta: '6 片段 · 24s', color: 'bg-rose-100 text-rose-700' },
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Latest artifacts</div>
      <div className="space-y-2">
        {artifacts.map((artifact) => {
          const Icon = artifact.icon;
          return <Button key={artifact.title} type="button" variant="secondary" className="h-auto w-full justify-start gap-3 whitespace-normal p-3 text-left"><span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', artifact.color)}><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{artifact.title}</span><span className="mt-1 block text-xs text-muted-foreground">{artifact.meta}</span></span><ChevronDown size={13} className="-rotate-90 text-muted-foreground" /></Button>;
        })}
      </div>
    </div>
  );
};
