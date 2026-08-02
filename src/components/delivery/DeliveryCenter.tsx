import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDot,
  Database,
  Download,
  FileImage,
  Film,
  FolderOpen,
  HardDrive,
  PackageCheck,
  Presentation,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { assetService } from '../../services/assetService';
import type { FileIssue } from '../../types/asset.types';
import { Inspiration } from '../inspiration/Inspiration';
import { QuickNotes } from '../knowledge/QuickNotes';
import { Badge, Button, Card, Input, Tabs, TabsList, TabsTrigger } from '../ui';

type SourceStatus = 'online' | 'warning' | 'offline';

type SourceCard = {
  name: string;
  detail: string;
  status: SourceStatus;
  statusLabel: string;
  icon: React.ElementType;
  count: string;
};

export const KnowledgeSources = () => {
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [issues, setIssues] = useState<FileIssue[]>([]);
  const [totalReferences, setTotalReferences] = useState(0);
  const [assetTotal, setAssetTotal] = useState(0);
  const [dataDirectory, setDataDirectory] = useState('读取中…');
  const [loading, setLoading] = useState(true);
  const filteredMissing = useMemo(
    () =>
      issues.filter((asset) =>
        `${asset.fileName}${asset.assetTitle}${asset.absolutePath}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [issues, query],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [issueResult, assets, storageResponse] = await Promise.all([
        assetService.issues(),
        assetService.list({ limit: 1 }),
        fetch('/api/storage/settings'),
      ]);
      const storage = (await storageResponse.json()) as { dataDirectory?: string };
      setIssues(issueResult.items);
      setTotalReferences(issueResult.totalReferences);
      setAssetTotal(assets.total);
      setDataDirectory(storage.dataDirectory || '未配置');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '资源状态读取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sources: SourceCard[] = [
    {
      name: '本地资产库',
      detail: dataDirectory,
      status: 'online',
      statusLabel: '已连接',
      icon: Database,
      count: `${assetTotal} 项索引`,
    },
    {
      name: '原文件引用',
      detail: '文件保留在原位置，不重复复制',
      status: issues.length ? 'warning' : 'online',
      statusLabel: issues.length ? '需处理' : '正常',
      icon: HardDrive,
      count: `${Math.max(totalReferences - issues.length, 0)} / ${totalReferences} 可访问`,
    },
    {
      name: '异常与断链',
      detail: '移动、离线或已变更的原文件',
      status: issues.length ? 'offline' : 'online',
      statusLabel: issues.length ? `${issues.length} 项` : '无异常',
      icon: AlertTriangle,
      count: issues.length ? '可逐项重新定位' : '所有引用正常',
    },
  ];

  const relocate = async (issue: FileIssue) => {
    try {
      const result = await assetService.relocateFile(issue.assetId, issue.id);
      if (!result.cancelled) {
        setNotice(`已恢复：${issue.fileName}`);
        await load();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '重新定位失败');
    }
    window.setTimeout(() => setNotice(''), 2600);
  };

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="module-surface mx-auto max-w-6xl p-6 lg:p-8">
        <Header
          eyebrow="Sources"
          title="资源来源"
          description="统一查看素材来自哪里、是否可访问，以及哪些文件需要重新定位或归档。"
          icon={Database}
        />

        <div className="mt-7 grid gap-3 lg:grid-cols-3">
          {sources.map((source) => {
            const Icon = source.icon;
            return (
              <Card key={source.name} padding="md">
                <div className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-foreground text-background">
                    <Icon size={19} />
                  </span>
                  <StatusDot status={source.status} label={source.statusLabel} />
                </div>
                <div className="mt-5 text-sm font-semibold">{source.name}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{source.detail}</div>
                <div className="mt-4 flex items-center justify-between pt-3 text-xs text-muted-foreground">
                  <span>{source.count}</span>
                  <CircleDot size={11} />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="mt-6 overflow-hidden" padding="sm">
          <div className="flex flex-col gap-3 p-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle size={15} className="text-amber-500" /> 文件异常
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                只显示数据库中真实检测到的离线、变更或断链文件。
              </p>
            </div>
            <div className="relative w-48"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="搜索缺失资产"
                placeholder="搜索资产"
                inputSize="sm" className="pl-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            {filteredMissing.map((asset) => (
              <div key={asset.id} className="flex flex-col gap-3 rounded-md bg-muted/45 p-4 sm:flex-row sm:items-center">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10">
                  <FileImage size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{asset.fileName}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {asset.assetTitle} · {asset.absolutePath}
                  </div>
                </div>
                <span className="text-xs font-medium text-amber-600">{asset.status}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="iconSm"
                    onClick={load}
                    className="h-8 w-8"
                    aria-label={`重新检查 ${asset.fileName}`}
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </Button>
                  <Button variant="primary" size="sm"
                    onClick={() => relocate(asset)}
                    className="h-8 text-xs"
                  >
                    <FolderOpen size={13} /> 重新定位
                  </Button>
                </div>
              </div>
            ))}
            {!loading && !filteredMissing.length && (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <Check size={22} className="text-foreground" />
                <div className="mt-3 text-xs font-semibold">
                  {query ? '没有匹配的异常文件' : '所有原文件引用正常'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">这里不再显示示例数据。</div>
              </div>
            )}
          </div>
        </Card>
      </div>
      {notice && (
        <div
          role="status"
          className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-xs text-background shadow-lg"
        >
          {notice}
        </div>
      )}
    </div>
  );
};

export const SourceCenter = () => {
  const [activeSection, setActiveSection] = useState<'notes' | 'prompts'>('notes');
  const [query, setQuery] = useState('');

  return (
    <div className="module-workspace flex h-full min-h-0 flex-col">
      <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as typeof activeSection)} className="ui-module-toolbar h-14 shrink-0 border-0 px-3 shadow-none">
        <TabsList aria-label="知识中心内容" className="h-8 gap-0 rounded-lg bg-muted p-0.5 shadow-none"><TabsTrigger value="notes" className="h-7 border-0 px-4 text-xs shadow-none data-[state=active]:bg-background data-[state=active]:shadow-sm">小记</TabsTrigger><TabsTrigger value="prompts" className="h-7 border-0 px-4 text-xs shadow-none data-[state=active]:bg-background data-[state=active]:shadow-sm">提示词库</TabsTrigger></TabsList>
        <div className="relative ml-auto w-[min(28vw,360px)] min-w-[160px]">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索知识内容" placeholder="搜索标题、描述和提取文字…" className="h-8 border-0 bg-[#f3f3f1] py-0 pl-9 shadow-none focus-visible:ring-1 focus-visible:ring-black/10 dark:bg-white/[0.06] dark:focus-visible:ring-white/15" />
        </div>
      </Tabs>
      <div className="mx-2 mb-2 min-h-0 flex-1 overflow-hidden rounded-xl bg-[#f8f8f6] p-2 dark:bg-white/[0.035]">
        {activeSection === 'notes' ? <QuickNotes /> : <Inspiration />}
      </div>
    </div>
  );
};

type ExportKind = 'pptx' | 'video';

export const ExportCenter = () => {
  const [kind, setKind] = useState<ExportKind>('pptx');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const blocked = kind === 'video';

  const startExport = () => {
    if (blocked || exporting) return;
    setExporting(true);
    setProgress(24);
    window.setTimeout(() => setProgress(62), 500);
    window.setTimeout(() => setProgress(100), 1000);
    window.setTimeout(() => setExporting(false), 1450);
  };

  const checks =
    kind === 'pptx'
      ? [
          { label: '8 个页面均为 16:9', ok: true },
          { label: '图片资源可访问', ok: true },
          { label: '可编辑文本与字体替代', ok: true },
          { label: '演讲者备注尚未填写', ok: false, warning: true },
        ]
      : [
          { label: '6 个视频片段已加入序列', ok: true },
          { label: '旁白与字幕轨道已对齐', ok: true },
          { label: 'hero-shot-v04.mp4 缺少本地副本', ok: false },
          { label: '永久归档盘当前离线', ok: false },
        ];

  return (
    <div className="module-workspace h-full overflow-y-auto bg-background p-4 text-foreground lg:p-6">
      <div className="mx-auto max-w-6xl">
        <Header
          eyebrow="Delivery"
          title="导出中心"
          description="在一个地方完成交付前检查、格式设置和导出队列管理。"
          icon={PackageCheck}
        />
        <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex gap-1 border-b border-border p-3">
              <ExportTab
                active={kind === 'pptx'}
                icon={Presentation}
                label="PPTX 演示稿"
                onClick={() => {
                  setKind('pptx');
                  setProgress(0);
                }}
              />
              <ExportTab
                active={kind === 'video'}
                icon={Film}
                label="视频成片"
                onClick={() => {
                  setKind('video');
                  setProgress(0);
                }}
              />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">
                    {kind === 'pptx' ? '品牌发布提案' : '品牌发布片'}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {kind === 'pptx'
                      ? '8 页 · 1920×1080 · 可编辑文本'
                      : '00:24 · 1920×1080 · 24 fps'}
                  </p>
                </div>
                <Badge variant={blocked ? 'secondary' : 'default'} className={cn('text-xs', blocked && 'bg-amber-500/10 text-amber-700 dark:text-amber-300')}>
                  {blocked ? '需补资源' : '配置就绪'}
                </Badge>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Setting
                  label="文件格式"
                  value={kind === 'pptx' ? 'PowerPoint (.pptx)' : 'H.264 (.mp4)'}
                />
                <Setting
                  label="输出规格"
                  value={kind === 'pptx' ? '16:9 · 可编辑' : '1080p · 高质量'}
                />
                <Setting label="文件位置" value="~/Mboard/Exports" />
                <Setting
                  label="资源策略"
                  value={kind === 'pptx' ? '嵌入图片与字体替代' : '复制所有依赖文件'}
                />
              </div>

              <div className="mt-6 rounded-md bg-muted/55 p-4">
                <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <span>交付检查</span>
                  <span>
                    {checks.filter((check) => check.ok).length}/{checks.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {checks.map((check) => (
                    <div key={check.label} className="flex items-center gap-2.5 text-xs">
                      <span
                        className={cn(
                          'grid h-4 w-4 place-items-center rounded-full',
                          check.ok
                            ? 'bg-primary text-primary-foreground'
                            : check.warning
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-600',
                        )}
                      >
                        {check.ok ? (
                          <Check size={10} strokeWidth={3} />
                        ) : (
                          <AlertTriangle size={10} />
                        )}
                      </span>
                      <span className={cn(!check.ok && !check.warning && 'text-red-600')}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {progress > 0 && (
                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                    <span>{progress === 100 ? '导出配置检查完成' : '正在检查资源与参数…'}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2">
                {blocked && (
                  <Button variant="secondary" size="sm">
                    <FolderOpen size={14} /> 打开缺失资产
                  </Button>
                )}
                <Button variant="primary" size="sm"
                  onClick={startExport}
                  disabled={blocked}
                  loading={exporting}
                >
                  <Download size={14} /> {exporting ? '检查中…' : '验证导出配置'}
                </Button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <Card padding="lg" className="bg-foreground text-background">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                <ShieldCheck size={14} /> Export readiness
              </div>
              <div className="mt-6 text-4xl font-semibold tracking-[-0.05em]">
                {kind === 'pptx' ? '92%' : '50%'}
              </div>
              <p className="mt-2 text-xs leading-5 text-background/65">
                {kind === 'pptx'
                  ? '结构与资源已满足导出要求，可在导出后补充备注。'
                  : '找到两个阻塞问题，定位资源后即可恢复导出。'}
              </p>
            </Card>
            <Card padding="md">
              <div className="text-xs font-semibold">最近导出</div>
              <div className="mt-3 space-y-3">
                {[
                  ['夏季提案.pptx', '今天 14:32 · 18.4 MB'],
                  ['KV-preview.png', '昨天 19:06 · 4.1 MB'],
                ].map(([name, meta]) => (
                  <Button key={name} variant="ghost" className="h-auto w-full justify-start gap-3 px-0 text-left">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/15">
                      <Download size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{meta}</span>
                    </span>
                    <ChevronRight size={12} className="text-slate-300" />
                  </Button>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};

const Header = ({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) => (
  <header className="flex items-start gap-4">
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-foreground text-background shadow-sm">
      <Icon size={21} />
    </span>
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </div>
  </header>
);

const StatusDot = ({ status, label }: { status: SourceStatus; label: string }) => (
  <Badge
    variant={status === 'online' ? 'default' : 'secondary'}
    className={cn(
      'gap-1.5 text-xs',
      status === 'warning'
          ? 'bg-amber-50 text-amber-700'
          : status === 'offline' ? 'bg-muted text-muted-foreground' : '',
    )}
  >
    <CircleDot size={10} />
    {label}
  </Badge>
);

const ExportTab = ({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) => (
  <Button
    variant={active ? 'primary' : 'ghost'}
    size="sm"
    onClick={onClick}
  >
    <Icon size={14} />
    {label}
  </Button>
);

const Setting = ({ label, value }: { label: string; value: string }) => (
  <Button variant="secondary" className="h-auto w-full justify-between gap-3 whitespace-normal px-3 py-3 text-left">
    <span>
      <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block truncate text-xs font-medium">{value}</span>
    </span>
    <ChevronRight size={12} className="shrink-0 text-slate-300" />
  </Button>
);
