import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  Film,
  FolderOpen,
  Grid3X3,
  HardDriveDownload,
  Layers3,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import {
  fallbackFolders,
  fallbackProjects,
  higgsfieldService,
  type HiggsfieldAudit,
} from '../../services/higgsfieldService';
import type {
  GenerationParams,
  HiggsfieldAssetItem,
  HiggsfieldFolder,
  HiggsfieldJob,
  HiggsfieldMedia,
  HiggsfieldProject,
} from '../../types/higgsfield.types';
import {
  Alert,
  Button,
  Card,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from '../ui';

interface StudioClip {
  id: string;
  media: HiggsfieldMedia;
  prompt: string;
  params: GenerationParams;
  model: string;
  createdAt?: number;
  comments: number;
}

const isVideo = (media?: HiggsfieldMedia) =>
  Boolean(media && (media.type === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(media.url)));

const getMedia = (job: HiggsfieldJob): HiggsfieldMedia | null =>
  job.results?.min || job.results?.raw || job.result || null;

const mapAssets = (items: HiggsfieldAssetItem[]): StudioClip[] =>
  items.flatMap((item) => {
    if (!item.job) return [];
    const media = getMedia(item.job);
    if (!media?.url) return [];
    return [{
      id: item.job.id,
      media,
      prompt: item.job.params?.prompt || '这个片段没有公开提示词。',
      params: item.job.params || {},
      model: item.job.job_set_type || '未知模型',
      createdAt: item.job.created_at,
      comments: item.job.comments_count || 0,
    }];
  });

const sampleMedia = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_3BqS82zb13uOsqY5vKcQO8YPFFQ/hf_20260702_123127_44bbec3c-3420-4a79-b3d5-c14cc5814981.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3BqS82zb13uOsqY5vKcQO8YPFFQ/hf_20260702_123126_ae15f3d0-93a2-4384-a098-d170cad40f70.png',
  'https://d2ol7oe51mr4n9.cloudfront.net/user_3CRGV60QtXkARI1qsjfrcLQIV4l/4359cdad-12b6-4f58-bc1a-71c7985ec35d.jpg',
];

const fallbackClips: StudioClip[] = Array.from({ length: 9 }, (_, index) => ({
  id: `sample-${index + 1}`,
  media: { type: 'image', url: sampleMedia[index % sampleMedia.length] },
  prompt:
    index < 3
      ? 'A weathered pirate captain bursts through the cabin door into hard morning sunlight. Handheld anamorphic camera pushes backward, cloth and hair respond to the sea wind, the deck geography remains locked, photoreal live action.'
      : 'Cinematic action insert. The antique brass device emits an acid-green pulse while the camera performs a fast projectile follow. Hard positive lock on prop shape, hand position and screen direction. Diegetic sound only.',
  params: {
    seed: 878111 + index * 97,
    width: 4032,
    height: 1728,
    quality: '4K',
    duration: 8,
    aspect_ratio: '21:9',
    enhance_prompt: true,
    style: { name: index % 2 ? 'Soul Cinematic' : 'General', strength: 1 },
  },
  model: index % 2 ? 'seedance_2_0' : 'soul_cinematic',
  comments: index % 3,
}));

const compactNumber = (value = 0) =>
  new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const sceneNumber = (name: string, index: number) => {
  const match = name.match(/(?:scene|sc)[\s_-]*(\d+)/i);
  return match?.[1]?.padStart(2, '0') || String(index + 1).padStart(2, '0');
};

const modelLabel = (model: string) =>
  model
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

const MediaView = ({ media, className = '' }: { media?: HiggsfieldMedia | null; className?: string }) => {
  if (!media?.url) {
    return (
      <div className={`${className} grid place-items-center bg-muted`}>
        <Film size={22} className="text-muted-foreground/45" />
      </div>
    );
  }
  if (isVideo(media) && !media.url.includes('.m3u8')) {
    return <video className={className} src={media.url} muted loop playsInline preload="metadata" />;
  }
  return <img className={className} src={media.thumbnail_url || media.url} alt="" loading="lazy" />;
};

const Parameter = ({ label, value }: { label: string; value: string | number | boolean | undefined }) => (
  <div className="flex items-center justify-between border-b py-2.5 last:border-0">
    <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
    <span className="max-w-[190px] truncate font-mono text-[12px] text-foreground">
      {typeof value === 'boolean' ? (value ? '开启' : '关闭') : value || '—'}
    </span>
  </div>
);

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index >= 3 ? 2 : 1)} ${units[index]}`;
};

const AuditPanel = ({
  audit,
  onClose,
  onStart,
  onCancel,
}: {
  audit: HiggsfieldAudit | null;
  onClose: () => void;
  onStart: () => void;
  onCancel: () => void;
}) => {
  const progress = audit?.projectsDiscovered
    ? Math.round((audit.projectsScanned / audit.projectsDiscovered) * 100)
    : 0;
  const recommendedBytes = Math.ceil((audit?.totalBytes || 0) * 1.4);
  const largest = [...(audit?.projects || [])].sort((a, b) => b.bytes - a.bytes).slice(0, 8);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-[460px] flex-col">
        <SheetHeader className="shrink-0 border-b px-5 py-5 pr-14">
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Archive intelligence</div>
          <SheetTitle className="text-base">全站资源容量盘点</SheetTitle>
          <SheetDescription>扫描元数据并估算归档容量，不下载原始文件。</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <Alert variant="default" className="p-4">
            <div className="flex items-center gap-2 text-xs font-medium"><Database size={14} /> 只做测量，不下载原片</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              扫描项目目录和元数据，使用 HEAD 或 1 字节 Range 请求读取文件容量。不会保存图片或视频内容。
            </p>
          </Alert>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              ['已发现项目', audit?.projectsDiscovered || 0],
              ['已扫描项目', audit?.projectsScanned || 0],
              ['生成记录', audit?.generations || 0],
              ['独立文件', audit?.filesMeasured || 0],
              ['图片', audit?.images || 0],
              ['视频', audit?.videos || 0],
            ].map(([label, value]) => (
              <Card key={String(label)} padding="sm"><div className="font-mono text-lg text-foreground">{Number(value).toLocaleString('zh-CN')}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></Card>
            ))}
          </div>

          <div className="mt-5 border-y py-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">可确认的独立素材容量</div>
                <div className="mt-1 font-mono text-3xl tracking-[-0.05em] text-foreground">{formatBytes(audit?.totalBytes)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">建议归档盘</div>
                <div className="mt-1 font-mono text-sm text-foreground">{formatBytes(recommendedBytes)}</div>
              </div>
            </div>
            <div className="mt-3 flex gap-4 font-mono text-xs text-muted-foreground">
              <span>无法测量 {audit?.unknownSizeFiles || 0}</span>
              <span>失效 {audit?.unreachableFiles || 0}</span>
              <span>URL 重复 {audit?.duplicateUrls || 0}</span>
            </div>
          </div>

          {audit?.status === 'running' && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate pr-4">正在扫描：{audit.currentProject || '准备项目列表'}</span>
                <span className="font-mono text-foreground">{progress}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
              <Button type="button" variant="secondary" size="sm" onClick={onCancel} className="mt-3 w-full text-xs"><X size={12} /> 停止盘点</Button>
            </div>
          )}

          {audit?.status !== 'running' && (
            <Button type="button" variant="primary" onClick={onStart} className="mt-5 h-11 w-full text-xs">
              <HardDriveDownload size={15} />
              {audit?.status === 'complete' ? '重新扫描全站' : '开始全站容量盘点'}
            </Button>
          )}

          {audit?.error && <Alert variant="destructive" className="mt-4 text-xs">{audit.error}</Alert>}

          {largest.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">项目容量排名</div>
              <div className="space-y-1">
                {largest.map((project, index) => (
                  <div key={project.publicationId} className="flex items-center gap-3 border-b py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">{project.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatBytes(project.bytes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {audit?.reportPath && (
            <Card variant="solid" className="mt-5 break-all bg-muted/45 p-3 font-mono text-xs leading-4 text-muted-foreground">
              MANIFEST<br />{audit.reportPath}
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const ProjectGallery = () => {
  const [projects, setProjects] = useState<HiggsfieldProject[]>(fallbackProjects);
  const [selectedProject, setSelectedProject] = useState<HiggsfieldProject | null>(null);
  const [folders, setFolders] = useState<HiggsfieldFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<HiggsfieldFolder | null>(null);
  const [clips, setClips] = useState<StudioClip[]>([]);
  const [selectedClip, setSelectedClip] = useState<StudioClip | null>(null);
  const [timelineIds, setTimelineIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'open'>('all');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingClips, setLoadingClips] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const [nextCursor, setNextCursor] = useState<string | number | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<HiggsfieldAudit | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingProjects(true);
    higgsfieldService
      .listProjects(sourceFilter === 'open' ? 'open-sourced-by-higgsfield' : '')
      .then((page) => {
        if (active && page.items.length) setProjects(page.items);
      })
      .catch(() => {
        if (active) setNotice('当前使用本地预览数据，启动本地服务后会读取全部共享项目。');
      })
      .finally(() => active && setLoadingProjects(false));
    return () => {
      active = false;
    };
  }, [sourceFilter]);

  useEffect(() => {
    if (!auditOpen) return;
    let active = true;
    const refresh = () => higgsfieldService.getAudit().then((value) => active && setAudit(value)).catch(() => undefined);
    void refresh();
    const interval = window.setInterval(refresh, audit?.status === 'running' ? 1500 : 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [auditOpen, audit?.status]);

  const openAudit = () => {
    setAuditOpen(true);
    void higgsfieldService.getAudit().then(setAudit).catch(() => undefined);
  };

  const startAudit = async () => {
    const state = await higgsfieldService.startAudit();
    setAudit(state);
  };

  const cancelAudit = async () => {
    await higgsfieldService.cancelAudit();
    setAudit((current) => current ? { ...current, status: 'cancelled' } : current);
  };

  const visibleProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) =>
      [project.name, project.description, project.authors?.[0]?.username, ...(project.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [projects, query]);

  const loadFolder = async (folder: HiggsfieldFolder) => {
    setSelectedFolder(folder);
    setLoadingClips(true);
    setNextCursor(null);
    try {
      const page = await higgsfieldService.listAssets(folder.id);
      const mapped = mapAssets(page.items);
      const next = page.cursor || null;
      const usable = mapped.length ? mapped : fallbackClips;
      setClips(usable);
      setSelectedClip(usable[0] || null);
      setTimelineIds(usable.slice(0, 5).map((clip) => clip.id));
      setNextCursor(next);
    } catch {
      setClips(fallbackClips);
      setSelectedClip(fallbackClips[0]);
      setTimelineIds(fallbackClips.slice(0, 5).map((clip) => clip.id));
      setNotice('片段接口暂时不可用，已载入交互预览素材。');
    } finally {
      setLoadingClips(false);
    }
  };

  const openProject = async (project: HiggsfieldProject) => {
    setSelectedProject(project);
    setFolders([]);
    setClips([]);
    setSelectedClip(null);
    setLoadingClips(true);
    try {
      const page = await higgsfieldService.listFolders(project.snapshot_folder_id);
      const scenes = page.items.length
        ? page.items
        : [{ id: project.snapshot_folder_id, name: '全部片段', count: 0 }];
      setFolders(scenes);
      await loadFolder(scenes[0]);
    } catch {
      const scenes = project.publication_id === fallbackProjects[0].publication_id
        ? fallbackFolders
        : [{ id: project.snapshot_folder_id, name: '全部片段', count: 0 }];
      setFolders(scenes);
      await loadFolder(scenes[0]);
    }
  };

  const loadMore = async () => {
    if (!selectedFolder || !nextCursor) return;
    setLoadingClips(true);
    try {
      const page = await higgsfieldService.listAssets(selectedFolder.id, nextCursor);
      setClips((current) => [...current, ...mapAssets(page.items)]);
      setNextCursor(page.cursor || null);
    } finally {
      setLoadingClips(false);
    }
  };

  const toggleTimeline = (clipId: string) => {
    setTimelineIds((current) =>
      current.includes(clipId) ? current.filter((id) => id !== clipId) : [...current, clipId],
    );
  };

  const syncProject = async () => {
    if (!selectedProject || syncing) return;
    setSyncing(true);
    setNotice('正在遍历全部情节和片段元数据…');
    try {
      const result = await higgsfieldService.syncProject(selectedProject.snapshot_folder_id);
      setNotice(`同步完成：${result.folders} 个目录，${result.assets} 个片段元数据。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '项目同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const copyPrompt = async () => {
    if (!selectedClip) return;
    await navigator.clipboard.writeText(selectedClip.prompt);
    setNotice('提示词已复制');
  };

  if (!selectedProject) {
    return (
      <div className="project-studio relative h-full overflow-y-auto bg-background text-foreground">
        <header className="sticky top-0 z-20 border-0 bg-background/90 px-4 py-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
                <Film size={20} strokeWidth={2.4} />
              </div>
              <div>
                <div className="font-mono text-xs tracking-[0.28em] text-muted-foreground">FRAMEBASE / LOCAL</div>
                <h1 className="text-[20px] font-semibold tracking-[-0.02em]">视频工程素材库</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={openAudit}>
                <Database size={14} />
                容量盘点
              </Button>
              <Button type="button" variant="primary" size="sm">
                <Plus size={15} />
                新建工程
              </Button>
            </div>
          </div>
        </header>

        <main className="relative z-10 px-4 pb-20 pt-8 sm:px-7">
          <div className="mb-8 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-px w-8 bg-primary" />
                Shared production archives
              </div>
              <h2 className="max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-foreground">
                不只看成片，<br />还原每一个镜头是怎么长出来的。
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                以项目、情节和片段为单位管理公开制作资料，保留每次生成的提示词、模型、种子和原始结果。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-72"><Search size={15} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、作者、标签…" className="pl-9 text-xs" /></div>
              <Button type="button" variant="secondary" size="icon" aria-label="筛选项目">
                <ListFilter size={16} />
              </Button>
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between border-y py-3">
            <div className="flex items-center gap-1">
              {([
                ['all', '全部共享项目'],
                ['open', 'Higgsfield 开放工程'],
              ] as const).map(([value, label]) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  key={value}
                  onClick={() => setSourceFilter(value)}
                  className={sourceFilter === value ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'text-muted-foreground'}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {loadingProjects && <Loader2 size={12} className="animate-spin" />}
              {visibleProjects.length} projects indexed
              <Grid3X3 size={14} />
            </div>
          </div>

          {notice && (
            <Alert className="mb-4 flex items-center justify-between px-4 py-2.5 text-xs">
              <span>{notice}</span>
              <Button type="button" variant="ghost" size="iconSm" onClick={() => setNotice('')} aria-label="关闭通知" className="h-7 w-7"><X size={14} /></Button>
            </Alert>
          )}

          {loadingProjects && !visibleProjects.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Card key={index} padding="none" className="overflow-hidden"><Skeleton className="aspect-video w-full" /><div className="space-y-2 p-4"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div></Card>)}</div>
          ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleProjects.map((project, index) => (
              <Card
                role="button"
                tabIndex={0}
                key={project.publication_id}
                onClick={() => openProject(project)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') void openProject(project); }}
                padding="none"
                className="group cursor-pointer overflow-hidden text-left transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-video overflow-hidden bg-zinc-900">
                  <MediaView
                    media={project.cover}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025] group-hover:brightness-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-60" />
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <span className="bg-black/75 px-2 py-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300 backdrop-blur">
                      P-{String(index + 1).padStart(3, '0')}
                    </span>
                    {project.categories?.includes('open-sourced-by-higgsfield') && (
                      <span className="rounded-sm bg-primary px-2 py-1 text-xs font-bold uppercase text-primary-foreground">OPEN FILES</span>
                    )}
                  </div>
                  <div className="absolute bottom-3 right-3 grid h-9 w-9 translate-y-2 place-items-center rounded-md bg-primary text-primary-foreground opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                    <ChevronRight size={18} />
                  </div>
                </div>
                <div className="px-4 pb-4 pt-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-medium text-foreground">{project.name}</h3>
                      <p className="mt-1 truncate text-xs text-muted-foreground">@{project.authors?.[0]?.username || '未知作者'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye size={12} />{compactNumber(project.views)}</span>
                      <span className="flex items-center gap-1"><Star size={12} />{compactNumber(project.likes)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          )}
        </main>
        {auditOpen && (
          <AuditPanel
            audit={audit}
            onClose={() => setAuditOpen(false)}
            onStart={startAudit}
            onCancel={cancelAudit}
          />
        )}
      </div>
    );
  }

  const timelineClips = timelineIds.map((id) => clips.find((clip) => clip.id === id)).filter(Boolean) as StudioClip[];
  const resolution = selectedClip?.params.width && selectedClip.params.height
    ? `${selectedClip.params.width} × ${selectedClip.params.height}`
    : '—';

  return (
    <div className="project-studio module-workspace flex h-full min-w-0 flex-col text-foreground">
      <header className="ui-module-toolbar h-10 shrink-0 px-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="secondary" size="iconSm" onClick={() => setSelectedProject(null)} aria-label="返回项目库" className="h-8 w-8 shrink-0">
            <ArrowLeft size={16} />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              项目库 <ChevronRight size={11} /> 影片工程
            </div>
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em]">{selectedProject.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-3 hidden items-center gap-5 pr-5 lg:flex">
            <span className="font-mono text-xs text-muted-foreground"><b className="mr-1 text-foreground">{folders.length}</b> 情节</span>
            <span className="font-mono text-xs text-muted-foreground"><b className="mr-1 text-foreground">{clips.length}</b> 当前片段</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={syncProject}
            disabled={syncing}
            className="h-8 text-xs"
          >
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <HardDriveDownload size={13} />}
            同步工程元数据
          </Button>
          <Button type="button" variant="ghost" size="iconSm" aria-label="更多工程操作" className="h-8 w-8"><MoreHorizontal size={16} /></Button>
        </div>
      </header>

      {notice && (
        <Alert className="flex shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-2 text-xs"><span>{notice}</span><Button type="button" variant="ghost" size="iconSm" onClick={() => setNotice('')} aria-label="关闭通知" className="h-7 w-7"><X size={13} /></Button></Alert>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="w-[224px] shrink-0 overflow-y-auto border-0 bg-white dark:bg-[#0b0b0b]">
          <div className="border-0 p-4">
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Story structure</div>
            <div className="text-xs leading-5 text-muted-foreground">{selectedProject.description || '按情节组织生成片段与最终采用镜头。'}</div>
          </div>
          <div className="p-2">
            {folders.map((folder, index) => {
              const active = selectedFolder?.id === folder.id;
              return (
                <Button
                  type="button"
                  variant="ghost"
                  key={folder.id}
                  onClick={() => loadFolder(folder)}
                  className={cn('group mb-1 h-auto w-full justify-start gap-3 whitespace-normal border px-2.5 py-3 text-left', active ? 'border-primary bg-primary/10' : 'border-transparent')}
                >
                  <span className={cn('font-mono text-[18px]', active ? 'text-foreground' : 'text-muted-foreground/50')}>{sceneNumber(folder.name, index)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-xs', active ? 'text-foreground' : 'text-muted-foreground')}>{folder.name.replace(/^SCENE\s*\d+\s*[-·:]?\s*/i, '')}</span>
                    <span className="mt-1 block font-mono text-xs text-muted-foreground/60">{folder.count} generations</span>
                  </span>
                  <ChevronRight size={13} className={active ? 'text-foreground' : 'text-muted-foreground/45'} />
                </Button>
              );
            })}
          </div>
          <Button type="button" variant="secondary" size="sm" className="mx-3 mt-3 w-[calc(100%-24px)] border-dashed text-xs">
            <Plus size={13} /> 新建情节
          </Button>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-0 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <FolderOpen size={15} className="text-foreground" />
              <span className="truncate text-xs font-medium">{selectedFolder?.name || '加载中'}</span>
              <span className="font-mono text-xs text-muted-foreground">/ {clips.length} CLIPS</span>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"><SlidersHorizontal size={13} /> 参数筛选</Button>
              <Button type="button" variant="ghost" size="iconSm" aria-label="网格视图" className="h-7 w-7"><Grid3X3 size={14} /></Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loadingClips && !clips.length ? (
              <div className="grid h-full place-items-center text-center">
                <div><Loader2 size={22} className="mx-auto mb-3 animate-spin text-foreground" /><p className="text-xs text-muted-foreground">正在读取情节片段…</p></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
                {clips.map((clip, index) => {
                  const active = selectedClip?.id === clip.id;
                  const onTimeline = timelineIds.includes(clip.id);
                  return (
                    <Card key={clip.id} padding="none" className={cn('group overflow-hidden', active ? 'border-primary' : '')}>
                      <Button type="button" variant="ghost" onClick={() => setSelectedClip(clip)} className="block h-auto w-full rounded-none p-0 text-left">
                        <div className="relative aspect-video overflow-hidden bg-black">
                          <MediaView media={clip.media} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                          {isVideo(clip.media) && <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white"><Play size={11} fill="currentColor" /></span>}
                          <div className="absolute bottom-2 left-2 font-mono text-xs text-white/75">SHOT {String(index + 1).padStart(3, '0')}</div>
                          <div className="absolute bottom-2 right-2 bg-black/70 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
                            {clip.params.duration ? `${clip.params.duration}s` : isVideo(clip.media) ? 'VIDEO' : 'STILL'}
                          </div>
                        </div>
                        <div className="p-2.5">
                          <p className="line-clamp-2 h-8 text-xs font-normal leading-4 text-muted-foreground">{clip.prompt}</p>
                          <div className="mt-2 flex items-center justify-between font-mono text-xs font-normal uppercase text-muted-foreground/65">
                            <span className="truncate pr-2">{modelLabel(clip.model)}</span>
                            <span>Seed {clip.params.seed || '—'}</span>
                          </div>
                        </div>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => toggleTimeline(clip.id)}
                        className={cn('h-7 w-full rounded-none border-t text-xs uppercase tracking-[0.12em]', onTimeline ? 'bg-primary/10 text-foreground' : 'text-muted-foreground')}
                      >
                        {onTimeline ? <Check size={11} /> : <Plus size={11} />}{onTimeline ? '已加入组合' : '加入镜头组合'}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
            {nextCursor && (
              <Button type="button" variant="secondary" size="sm" onClick={loadMore} disabled={loadingClips} className="mt-4 w-full text-xs uppercase tracking-[0.15em]">
                {loadingClips && <Loader2 size={12} className="animate-spin" />} 加载更多生成片段
              </Button>
            )}
          </div>

          <div className="h-[118px] shrink-0 border-0 bg-white dark:bg-[#0b0b0b]">
            <div className="flex h-8 items-center justify-between border-0 px-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground"><Layers3 size={13} className="text-foreground" /> 片段组合 · V1</div>
              <div className="font-mono text-xs text-muted-foreground">{timelineClips.length} shots · {timelineClips.length * 8}s</div>
            </div>
            <div className="flex h-[86px] items-center gap-1 overflow-x-auto px-3">
              <div className="mr-1 flex h-14 w-8 shrink-0 items-center justify-center rounded-sm bg-primary font-mono text-xs text-primary-foreground">V1</div>
              {timelineClips.map((clip, index) => (
                <Button type="button" variant="secondary" key={clip.id} onClick={() => setSelectedClip(clip)} className={cn('relative h-14 w-24 shrink-0 overflow-hidden rounded-sm border p-0', selectedClip?.id === clip.id ? 'border-primary' : '')}>
                  <MediaView media={clip.media} className="h-full w-full object-cover opacity-70" />
                  <span className="absolute left-1 top-1 bg-black/70 px-1 font-mono text-xs text-white">{index + 1}</span>
                  <span className="absolute bottom-1 right-1 font-mono text-xs text-white">8s</span>
                </Button>
              ))}
              <Button type="button" variant="secondary" size="icon" aria-label="添加镜头" className="h-14 w-16 shrink-0 border-dashed"><Plus size={16} /></Button>
            </div>
          </div>
        </section>

        <aside className="hidden w-[340px] shrink-0 overflow-y-auto border-0 bg-white dark:bg-[#0b0b0b] xl:block">
          {selectedClip ? (
            <>
              <div className="relative aspect-video bg-black">
                <MediaView media={selectedClip.media} className="h-full w-full object-contain" />
                {isVideo(selectedClip.media) && <Button type="button" variant="primary" size="iconLg" aria-label="播放片段" className="absolute inset-0 m-auto rounded-full"><Play size={16} fill="currentColor" /></Button>}
              </div>
              <div className="border-b p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Generation detail</span>
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground"><Clock3 size={10} /> {selectedClip.createdAt ? new Date(selectedClip.createdAt * 1000).toLocaleDateString('zh-CN') : '本地预览'}</span>
                </div>
                <h2 className="text-sm font-semibold">片段参数与提示词</h2>
              </div>
              <div className="border-b p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Prompt</span>
                  <Button type="button" variant="ghost" size="sm" onClick={copyPrompt} className="h-7 px-2 text-xs"><Copy size={11} /> 复制</Button>
                </div>
                <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-[12px] leading-[1.7] text-foreground">{selectedClip.prompt}</p>
              </div>
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"><Sparkles size={12} /> 生成参数</div>
                <Parameter label="Model" value={modelLabel(selectedClip.model)} />
                <Parameter label="Seed" value={selectedClip.params.seed} />
                <Parameter label="Resolution" value={resolution} />
                <Parameter label="Quality" value={selectedClip.params.quality} />
                <Parameter label="Aspect" value={selectedClip.params.aspect_ratio} />
                <Parameter label="Duration" value={selectedClip.params.duration ? `${selectedClip.params.duration}s` : undefined} />
                <Parameter label="Style" value={selectedClip.params.style?.name} />
                <Parameter label="Enhance" value={selectedClip.params.enhance_prompt} />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a href={selectedClip.media.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"><Eye size={12} /> 打开原文件</a>
                  <a href={selectedClip.media.url} download className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Download size={12} /> 下载原片</a>
                </div>
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center px-8 text-center"><div><Film size={24} className="mx-auto mb-3 text-muted-foreground/45" /><p className="text-xs leading-5 text-muted-foreground">选择一个片段查看提示词和生成参数。</p></div></div>
          )}
        </aside>
      </div>
    </div>
  );
};
