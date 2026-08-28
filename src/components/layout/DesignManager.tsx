import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Clock3,
  FileImage,
  Infinity as InfinityIcon,
  MoreHorizontal,
  Pause,
  Presentation,
  Sparkles,
} from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { ModuleType, useUIStore } from '../../stores/useUIStore';
import { Button, Card } from '../ui';

const tasks: Array<{
  title: string;
  project: string;
  module: ModuleType;
  type: string;
  progress: number;
  status: 'running' | 'review' | 'done';
  icon: React.ElementType;
  tone: string;
  artifacts: number;
}> = [
  { title: '生成新品发布主视觉', project: '夏季品牌战役', module: 'image-gen', type: '图像生成', progress: 68, status: 'running', icon: FileImage, tone: 'bg-muted', artifacts: 12 },
  { title: '重组品牌策略演示稿', project: '品牌升级 2026', module: 'ppt-gen', type: 'PPT 生成', progress: 100, status: 'review', icon: Presentation, tone: 'bg-muted', artifacts: 8 },
  { title: '整理 AI 短片六个分镜', project: 'Higgsfield 研究', module: 'video-gen', type: '视频制作', progress: 42, status: 'running', icon: Clapperboard, tone: 'bg-muted', artifacts: 19 },
  { title: '归档活动视觉与模板', project: '社交媒体套件', module: 'assets', type: '资产整理', progress: 100, status: 'done', icon: CheckCircle2, tone: 'bg-muted', artifacts: 34 },
];

export const DesignManager = () => {
  const { setActiveModule, setWorkspaceMode } = useUIStore();

  const openTask = (module: ModuleType) => {
    setActiveModule(module);
    setWorkspaceMode('editor');
  };

  return (
    <div className="h-full overflow-y-auto bg-background px-4 py-5 text-foreground sm:px-7 sm:py-6">
      <div className="mx-auto max-w-[1380px]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"><Sparkles size={13} /> Manager surface</div>
            <h1 className="text-[28px] font-semibold tracking-[-0.04em]">生成中心</h1>
            <p className="mt-2 text-sm text-muted-foreground">观察所有设计任务、异步生成进度和待审核产物。</p>
          </div>
          <Button type="button" variant="primary" onClick={() => openTask('magic-canvas')}><InfinityIcon size={15} /> 打开资产素材</Button>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['运行中', '02', '正在使用本地模型'],
            ['待审核', '01', '已生成完整产物'],
            ['今日产物', '73', '图片、页面与片段'],
            ['本地缓存', '18%', '92.4 GB 可用'],
          ].map(([label, value, detail]) => (
            <Card key={label} className="px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
            </Card>
          ))}
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Production queue</div><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">制作任务</h2></div><Button type="button" variant="secondary" size="sm" className="text-xs">全部任务</Button></div>
          <div className="grid gap-3 lg:grid-cols-2">
            {tasks.map((task) => {
              const Icon = task.icon;
              return (
                <Card key={task.title} padding="none" className="group overflow-hidden transition-[border-color] hover:border-foreground/20">
                  <div className="flex items-start gap-4 p-4">
                    <div className={cn('relative h-[84px] w-[110px] shrink-0 overflow-hidden rounded-xl', task.tone)}>
                      <Icon size={22} className="absolute bottom-3 left-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{task.type}</div><Button type="button" variant="ghost" size="iconSm" aria-label={`${task.title} 更多操作`} className="h-7 w-7"><MoreHorizontal size={16} /></Button></div>
                      <h3 className="mt-2 truncate text-sm font-semibold tracking-[-0.015em]">{task.title}</h3>
                      <div className="mt-1 text-xs text-muted-foreground">{task.project} · {task.artifacts} 个产物</div>
                      <div className="mt-4 flex items-center gap-3"><div className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${task.progress}%` }} /></div><span className="text-xs font-medium tabular-nums text-muted-foreground">{task.progress}%</span></div>
                    </div>
                  </div>
                  <div className="flex h-10 items-center justify-between border-t px-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {task.status === 'running' ? <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> 制作中</> : task.status === 'review' ? <><Clock3 size={12} /> 等待审核</> : <><CheckCircle2 size={12} className="text-primary" /> 已归档</>}
                    </div>
                    <div className="flex items-center gap-1">
                      {task.status === 'running' && <Button type="button" variant="ghost" size="iconSm" aria-label={`暂停 ${task.title}`} className="h-7 w-7"><Pause size={12} /></Button>}
                      <Button type="button" variant="ghost" size="sm" onClick={() => openTask(task.module)} className="h-7 px-2 text-xs">打开 <ArrowRight size={12} /></Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-7 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Verification</div>
            <h2 className="mt-1 text-base font-semibold">设计验证</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {['尺寸与比例', '字体与颜色', '资产完整性'].map((item, index) => <Card key={item} variant="solid" padding="sm" className="bg-muted/45"><div className="flex items-center gap-1.5 text-xs font-medium"><CheckCircle2 size={13} className="text-foreground" />{item}</div><div className="mt-2 text-xs text-muted-foreground">{index === 1 ? '12 项通过' : '8 项通过'}</div></Card>)}
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quick dispatch</div>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em]">开始一个新制作任务</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">选择一个工具，任务会在编辑器右侧的制作控制器中执行。</p>
            <Button type="button" variant="primary" size="sm" onClick={() => openTask('tools')} className="mt-3 text-xs">选择设计工具 <ArrowRight size={14} /></Button>
          </Card>
        </section>
      </div>
    </div>
  );
};
