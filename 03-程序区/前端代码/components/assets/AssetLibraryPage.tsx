import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  CheckSquare2,
  ChevronDown,
  FileText,
  Film,
  FolderPlus,
  FolderKanban,
  Image as ImageIcon,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Presentation,
  Search,
  Star,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { assetService, waitForTask } from '../../services/assetService';
import type {
  AssetFolder,
  AssetPage,
  AssetSummary,
  AssetTag,
  ImportSession,
} from '../../types/asset.types';
import { AssetDetailPanel } from './AssetDetailPanel';
import { AssetThumbnail } from './AssetThumbnail';
import { ImportCenter } from './ImportCenter';
import { TaskDrawer } from './TaskDrawer';
import { contentFeed, type GeneratedContentItem } from '../../services/contentFeed';
import { Alert, AlertDescription, AlertTitle, Button, Input, Select, Skeleton } from '../ui';

const sortOptions = [
  { id: 'updatedAt', label: '时间', hint: '最新优先' },
  { id: 'title', label: '名字', hint: 'A–Z' },
];

const formatDate = (value: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(value);

const imageAspectRatio = (asset: AssetSummary) => {
  const imageMetadata = asset.normalizedMetadata?.image;
  const width = Number((imageMetadata as { sourceWidth?: unknown } | undefined)?.sourceWidth);
  const height = Number((imageMetadata as { sourceHeight?: unknown } | undefined)?.sourceHeight);
  if (width > 0 && height > 0) return `${width} / ${height}`;
  return '4 / 3';
};

export const AssetLibraryPage = () => {
  const [page, setPage] = useState<AssetPage>({ items: [], total: 0, limit: 60, offset: 0 });
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [tags, setTags] = useState<AssetTag[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState('');
  const [folderId, setFolderId] = useState('');
  const [tagId, setTagId] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState('updatedAt');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importSession, setImportSession] = useState<ImportSession | null>(null);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assets' | 'projects'>('assets');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [dropZoneOpen, setDropZoneOpen] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const [generatedItems, setGeneratedItems] = useState<GeneratedContentItem[]>([]);

  useEffect(() => {
    const sync = () => setGeneratedItems(contentFeed.list());
    sync();
    window.addEventListener('design-work:content-feed-updated', sync);
    return () => window.removeEventListener('design-work:content-feed-updated', sync);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadTaxonomy = useCallback(async () => {
    const [nextFolders, nextTags] = await Promise.all([
      assetService.folders(),
      assetService.tags(),
    ]);
    setFolders(nextFolders);
    setTags(nextTags);
  }, []);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await assetService.list({
        query: debouncedQuery,
        type,
        folderId,
        tagId,
        favorite: favoritesOnly || undefined,
        sort,
        limit: 60,
        offset,
      });
      const generated = generatedItems
        .filter((item) => !type || item.type === type)
        .filter(() => !tagId)
        .filter((item) => {
          const needle = debouncedQuery.trim().toLowerCase();
          return !needle || `${item.title} ${item.description} ${String(item.metadata.prompt || '')}`.toLowerCase().includes(needle);
        })
        .map((item) => ({
        id: item.id, type: item.type, title: item.title, description: item.description,
        primaryFolderId: null, favorite: false, rating: 0, status: 'generated',
        normalizedMetadata: {}, userMetadata: { feedItem: true, savedToAssets: item.savedToAssets, ...item.metadata },
        createdAt: item.createdAt, importedAt: item.createdAt, updatedAt: item.createdAt,
        previewUrl: item.previewUrl, previewStatus: 'ready',
        } satisfies AssetSummary));
      // 生成内容与资产库使用同一张首页卡片：保存后不再追加一张重复的数据库卡片。
      const generatedUrls = new Set(generatedItems.map((item) => item.previewUrl));
      const importedAssets = result.items.filter((asset) => {
        const generatedUrl = asset.userMetadata?.generatedUrl;
        return typeof generatedUrl !== 'string' || !generatedUrls.has(generatedUrl);
      });
      const combinedItems = [...generated, ...importedAssets].sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title, 'zh-CN');
        if (sort === 'rating') return b.rating - a.rating;
        if (sort === 'createdAt') return b.createdAt - a.createdAt;
        return b.updatedAt - a.updatedAt;
      });
      setPage({ ...result, total: combinedItems.length, items: combinedItems });
      setSelectedIds(
        (current) =>
          new Set([...current].filter((id) => combinedItems.some((item) => item.id === id))),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '资产库读取失败');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, favoritesOnly, folderId, generatedItems, offset, sort, tagId, type]);

  useEffect(() => {
    loadTaxonomy().catch(() => undefined);
  }, [loadTaxonomy]);
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);
  useEffect(() => {
    const navigate = (event: Event) => {
      const destination = (event as CustomEvent<string>).detail;
      if (destination === 'all') {
        setType('');
        setFolderId('');
        setTagId('');
        setFavoritesOnly(false);
        setOffset(0);
      } else if (destination.startsWith('folder:')) {
        setFolderId(destination.slice('folder:'.length));
        setType('');
        setTagId('');
        setFavoritesOnly(false);
        setOffset(0);
      } else {
        document
          .querySelector<HTMLElement>(
            destination === 'folders' ? '[aria-label="按文件夹筛选"]' : '[aria-label="按标签筛选"]',
          )
          ?.focus();
      }
    };
    window.addEventListener('design-work:asset-navigation', navigate);
    return () => window.removeEventListener('design-work:asset-navigation', navigate);
  }, []);

  const refresh = useCallback(() => {
    loadAssets();
    loadTaxonomy();
  }, [loadAssets, loadTaxonomy]);

  const selectAll = () =>
    setSelectedIds((current) =>
      current.size === page.items.length ? new Set() : new Set(page.items.map((asset) => asset.id)),
    );
  const toggleSelected = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startImport = async (
    paths: string[],
    autoConfirm = false,
    targetTagId: string | null = null,
  ) => {
    const task = await assetService.scan(paths);
    setTaskRefreshKey((value) => value + 1);
    setTasksOpen(true);
    const result = await waitForTask(task.id);
    if (result.status !== 'waiting_for_user')
      throw new Error(result.error?.message || '文件扫描未完成');
    const sessionId = (result.output as { sessionId?: string })?.sessionId;
    if (!sessionId) throw new Error('扫描任务未返回导入会话');
    const session = await assetService.importSession(sessionId);
    if (autoConfirm && !session.items.some((item) => item.duplicateAssetId || item.duplicateItemId)) {
      await assetService.saveImportDecisions(
        session.id,
        session.items.map((item) => ({ itemId: item.id, decision: item.decision || 'import_new' })),
      );
      const commit = await assetService.confirmImport(session.id);
      setNotice(`已接收 ${session.items.length} 张图片，正在自动入库`);
      trackCommit(commit.id, targetTagId);
      return;
    }
    setImportSession(session);
    setTasksOpen(false);
  };

  const importAssets = async (mode: 'files' | 'folder') => {
    setError('');
    const picked =
      mode === 'files' ? await assetService.pickFiles() : await assetService.pickDirectory();
    if (picked.cancelled || !picked.paths.length) return;
    await startImport(picked.paths);
  };

  const importDroppedImages = async (files: File[]) => {
    setError('');
    const uploaded = await Promise.all(files.map((file) => assetService.dropImage(file)));
    await startImport(uploaded.map((item) => item.path), true, tagId);
  };

  const trackCommit = (taskId: string, targetTagId: string | null = null) => {
    setImportSession(null);
    setTasksOpen(true);
    setTaskRefreshKey((value) => value + 1);
    waitForTask(taskId).then((task) => {
      setTaskRefreshKey((value) => value + 1);
      if (task.status === 'completed') {
        const assetIds = Array.isArray((task.output as { assetIds?: unknown })?.assetIds)
          ? ((task.output as { assetIds: unknown[] }).assetIds.filter(
              (id): id is string => typeof id === 'string',
            ))
          : [];
        const applyTag = targetTagId && assetIds.length
          ? assetService.bulkTags(assetIds, [targetTagId])
          : Promise.resolve();
        applyTag
          .then(() => {
            setNotice('资产导入完成');
            refresh();
            window.setTimeout(() => setNotice(''), 2200);
          })
          .catch((caught) => setError(caught instanceof Error ? caught.message : '标签归类失败'));
      } else setError(task.error?.message || '资产导入失败');
    });
  };

  const createTag = async () => {
    const name = window.prompt('新标签名称');
    if (!name?.trim()) return;
    try {
      await assetService.createTag(name.trim());
      await loadTaxonomy();
      setNotice(`已创建标签「${name.trim()}」`);
      window.setTimeout(() => setNotice(''), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '创建标签失败');
    }
  };

  const renameTag = async (tag: AssetTag) => {
    const name = window.prompt('重命名标签', tag.name);
    if (!name?.trim() || name.trim() === tag.name) return;
    try {
      await assetService.renameTag(tag.id, name.trim());
      await loadTaxonomy();
      setNotice(`标签已重命名为「${name.trim()}」`);
      window.setTimeout(() => setNotice(''), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '重命名标签失败');
    }
  };

  const deleteTag = async (tag: AssetTag) => {
    if (!window.confirm(`删除标签「${tag.name}」？图片不会被删除。`)) return;
    try {
      await assetService.deleteTag(tag.id);
      if (tagId === tag.id) setTagId('');
      setOffset(0);
      await loadTaxonomy();
      setNotice(`已删除标签「${tag.name}」`);
      window.setTimeout(() => setNotice(''), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除标签失败');
    }
  };

  const removeSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length || !window.confirm(`将 ${ids.length} 项资产移入回收站？`)) return;
    await Promise.all(ids.map(assetService.remove));
    setSelectedIds(new Set());
    if (selectedId && ids.includes(selectedId)) setSelectedId(null);
    refresh();
  };

  const selectedCount = selectedIds.size;
  const activeFilterCount = [type, folderId, tagId, favoritesOnly ? 'favorites' : '', sort === 'updatedAt' ? '' : sort].filter(Boolean).length;
  const showingAll = !type && !folderId && !tagId && !favoritesOnly;
  const activeCollectionTitle = tags.find((tag) => tag.id === tagId)?.name || '全部';
  const showEmptyImport = !loading && !error && !page.items.length && !activeFilterCount && !debouncedQuery;
  const showDropZone = dropZoneOpen || showEmptyImport;
  const showAll = () => {
    setType('');
    setFolderId('');
    setTagId('');
    setFavoritesOnly(false);
    setOffset(0);
  };

  return (
    <div className="module-workspace relative flex h-full min-w-0 flex-col bg-background text-foreground">
      <header className="mx-16 shrink-0 p-0">
        <div className="flex min-h-14 w-full items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="资产库类型"
            className="order-1 flex h-8 shrink-0 items-center rounded-lg bg-[#f8f8f6] p-0.5 dark:bg-white/[0.035]"
          >
            {[
              { id: 'assets' as const, label: '素材' },
              { id: 'projects' as const, label: '项目' },
            ].map(({ id, label }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08]',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative order-2 ml-auto w-[240px] max-w-full">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、描述和提取文字…"
              className="h-8 border-0 bg-[#f3f3f1] py-0 pl-9 pr-9 shadow-none focus-visible:ring-1 focus-visible:ring-black/10 dark:bg-white/[0.06] dark:focus-visible:ring-white/15"
            />
            {query && (
              <Button variant="ghost" size="iconSm" onClick={() => setQuery('')} aria-label="清空搜索" className="absolute right-0.5 top-1/2 h-6 w-6 -translate-y-1/2"><X size={13} /></Button>
            )}
          </div>

        </div>
      </header>

      <div className="mx-16 mb-0 mt-0 flex min-h-0 flex-1 overflow-hidden rounded-xl bg-[#f8f8f6] p-2 dark:bg-white/[0.035]">
      {activeTab === 'assets' ? (
        <div className="flex min-h-0 flex-1 gap-3">
        {filterPanelOpen && <aside
          id="asset-filter-panel"
          aria-label="资产筛选"
          className="asset-filter-panel flex h-full w-[200px] shrink-0 flex-col overflow-hidden bg-transparent text-card-foreground"
        >
          <header className="flex h-11 shrink-0 items-center px-4">
            <h2 className="text-sm font-semibold tracking-[-0.01em]">筛选</h2>
          </header>

          <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3" aria-label="图片筛选条件">
            <section className="px-0 py-1" data-filter-section="tags">
              <div className="flex h-8 items-center justify-between px-0">
                <span className="text-[12px] font-semibold tracking-[0.04em] text-muted-foreground">标签</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconSm"
                  onClick={() => void createTag()}
                  aria-label="新建标签"
                  className="-mr-3 h-7 w-7 hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]"
                >
                  <Plus size={14} />
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={showAll}
                aria-current={showingAll ? 'page' : undefined}
                className={cn(
                  '-mx-3 h-8 w-[calc(100%+1.5rem)] justify-between px-3 text-sm font-semibold hover:bg-black/[0.08] hover:text-foreground dark:hover:bg-white/[0.12]',
                  showingAll && 'bg-foreground text-background hover:bg-foreground/90 hover:text-background',
                )}
              >
                <span>全部</span>
                <span className="w-6 text-right text-sm font-semibold tabular-nums text-muted-foreground">{page.total}</span>
              </Button>

              {tags.length ? (
                <div className="mt-1 space-y-1">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className={cn(
                        'group -mx-3 flex min-h-8 items-center rounded-md px-3 transition-colors',
                        tagId === tag.id
                          ? 'bg-foreground text-background'
                          : 'hover:bg-black/[0.08] hover:text-foreground dark:hover:bg-white/[0.12]',
                      )}
                    >
                      <Button type="button" variant="ghost"
                        onClick={() => {
                          setTagId(tagId === tag.id ? '' : tag.id);
                          setOffset(0);
                        }}
                        aria-pressed={tagId === tag.id}
                        className="h-auto min-w-0 flex-1 justify-start gap-2 self-stretch rounded-none bg-transparent px-0 text-left hover:bg-transparent hover:text-inherit"
                      >
                        <span className="truncate text-sm font-semibold">
                          {tag.name}
                        </span>
                      </Button>
                      <div className="flex shrink-0 items-center pr-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconSm"
                          onClick={() => void renameTag(tag)}
                          aria-label={`重命名标签 ${tag.name}`}
                          className="h-7 w-7 text-muted-foreground"
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconSm"
                          onClick={() => void deleteTag(tag)}
                          aria-label={`删除标签 ${tag.name}`}
                          className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                      <span className={cn('w-6 shrink-0 text-right text-sm font-semibold tabular-nums', tagId === tag.id ? 'text-background/70' : 'text-muted-foreground')}>
                        {tag.assetCount}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 px-2 py-2 text-xs leading-5 text-muted-foreground">
                  暂无标签
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => void createTag()}
                    className="ml-1 h-auto px-1 py-0 text-xs"
                  >
                    新建
                  </Button>
                </div>
              )}
            </section>
          </nav>
        </aside>}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-background">
        <header className="relative flex h-11 shrink-0 items-center justify-between border-b border-black/[0.03] px-6 dark:border-white/[0.04]">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              onClick={() => setFilterPanelOpen((open) => !open)}
              aria-label={filterPanelOpen ? '收起筛选' : '展开筛选'}
              title={filterPanelOpen ? '收起筛选' : '展开筛选'}
              className="h-7 w-7 text-muted-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              {filterPanelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </Button>
            <span aria-hidden="true" className="h-4 w-px bg-black/[0.06] dark:bg-white/[0.07]" />
            <h1 className="text-sm font-semibold tracking-[-0.01em]">{activeCollectionTitle}</h1>
          </div>
          <div className="relative flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              onClick={() => { if (!showEmptyImport) setDropZoneOpen((open) => !open); }}
              aria-label="导入素材"
              title="导入素材"
              aria-expanded={showDropZone}
              className="h-8 w-8 text-muted-foreground hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]"
            >
              <Plus size={16} className={cn('transition-transform', showDropZone && 'rotate-45')} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSortOpen((open) => !open)}
              aria-expanded={sortOpen}
              aria-controls="asset-sort-menu"
              className="h-8 gap-1 px-2 text-xs font-medium text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
            >
              排序
              <ChevronDown size={13} className={cn('transition-transform', sortOpen && 'rotate-180')} />
            </Button>
            {sortOpen && (
              <div id="asset-sort-menu" className="absolute right-0 top-10 z-30 w-48 rounded-lg border border-black/[0.04] bg-background p-1.5 shadow-lg dark:border-white/[0.06]">
                {sortOptions.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSort(option.id);
                      setOffset(0);
                      setSortOpen(false);
                    }}
                    aria-pressed={sort === option.id}
                    className={cn(
                      'h-9 w-full justify-between hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]',
                      sort === option.id && 'bg-black/[0.06] text-foreground shadow-none dark:bg-white/[0.1]',
                    )}
                  >
                    <span className="text-xs font-semibold">{option.label}</span>
                    <span className="text-xs font-medium text-muted-foreground">{option.hint}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </header>
        {showDropZone && (
          <section
            className={cn(
              'mx-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-black/[0.12] bg-black/[0.02] px-6 text-center transition-colors dark:border-white/[0.14] dark:bg-white/[0.025]',
              showEmptyImport ? 'my-6 min-h-[330px] flex-1' : 'mt-6 min-h-[220px] shrink-0',
              draggingFiles && 'border-foreground/40 bg-black/[0.06] dark:bg-white/[0.08]',
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDraggingFiles(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDraggingFiles(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDraggingFiles(false);
              const files = Array.from(event.dataTransfer.files);
              if (files.length) void importDroppedImages(files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = '';
                if (files.length) void importDroppedImages(files);
              }}
            />
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <UploadCloud size={21} />
            </span>
            <p className="text-sm font-semibold">{draggingFiles ? '松开即可自动入库' : '把图片拖到这里'}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">支持 PNG、JPG、WebP、GIF、AVIF 和 HEIC，可一次导入多张图片</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <UploadCloud size={14} aria-hidden="true" /> 从电脑选择图片
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  void importAssets('folder');
                }}
              >
                <FolderPlus size={14} aria-hidden="true" /> 选择文件夹
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">图片会保存到 Design Work 本地管理目录，不会上传到第三方服务</p>
          </section>
        )}
        {selectedCount > 0 && (
          <div className="mx-6 mt-6 flex shrink-0 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-6 py-2 text-xs">
            <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
              <CheckSquare2 size={13} />
              已选 {selectedCount} 项
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => assetService.bulkFavorite([...selectedIds], true).then(refresh)}
              className="h-7 text-xs"
            >
              <Star size={12} />
              收藏
            </Button>
            {folders.length > 0 && (
              <Select
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value)
                      assetService.bulkMove([...selectedIds], event.target.value).then(refresh);
                    event.target.value = '';
                  }}
                  selectSize="sm"
                  className="h-7 min-w-28 text-xs"
                  options={[{ value: '', label: '移动到…', disabled: true }, ...folders.map((folder) => ({ value: folder.id, label: folder.name }))]}
                />
            )}
            <Button variant="ghost" size="sm"
              onClick={removeSelected}
              className="ml-auto h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={12} />
              移入回收站
            </Button>
          </div>
        )}

        {!showEmptyImport && <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6">
          {loading ? (
            <div className="columns-2 gap-6 md:columns-3 xl:columns-4 2xl:columns-5" aria-label="正在加载资产">
              {Array.from({ length: 10 }, (_, index) => (
                <Skeleton key={index} className={cn('mb-4 w-full break-inside-avoid rounded-lg', index % 3 === 0 ? 'aspect-[3/4]' : index % 3 === 1 ? 'aspect-square' : 'aspect-[4/3]')} />
              ))}
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center">
              <Alert variant="destructive" className="max-w-md">
                <X size={16} />
                <AlertTitle>资产库暂时无法读取</AlertTitle>
                <AlertDescription className="mt-1">{error}</AlertDescription>
                <Button variant="secondary" size="sm" onClick={loadAssets} className="mt-4">重试</Button>
              </Alert>
            </div>
          ) : page.items.length ? (
            <div
              role="grid"
              aria-label="资产瀑布流"
              className="columns-2 gap-6 md:columns-3 xl:columns-4 2xl:columns-5"
            >
              {page.items.map((asset, index) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  index={index}
                  selected={selectedId === asset.id}
                  checked={selectedIds.has(asset.id)}
                  onOpen={() => setSelectedId(asset.id)}
                  onToggle={() => toggleSelected(asset.id)}
                  onPreviewReady={loadAssets}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
              <span className="relative grid h-16 w-16 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Archive size={28} />
                <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Plus size={14} />
                </span>
              </span>
              <div className="mt-5 text-base font-semibold tracking-[-0.02em]">
                {activeFilterCount || debouncedQuery ? '没有匹配的资产' : '建立你的第一个资产索引'}
              </div>
              <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
                调整搜索或筛选条件，原有资产不会被删除。
              </p>
            </div>
          )}
        </div>}
      </main>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center rounded-lg bg-background text-center">
          <div className="max-w-xs px-6">
            <FolderKanban size={28} className="mx-auto mb-3 text-muted-foreground/60" />
            <h2 className="text-sm font-semibold">项目</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">项目视图即将推出，后续可在这里整理项目和交付内容。</p>
          </div>
        </div>
      )}
      </div>

      <AssetDetailPanel
        assetId={selectedId}
        folders={folders}
        availableTags={tags}
        onClose={() => setSelectedId(null)}
        onChanged={refresh}
      />
      {importSession && (
        <ImportCenter
          session={importSession}
          onClose={() => setImportSession(null)}
          onCommitted={trackCommit}
        />
      )}
      <TaskDrawer
        open={tasksOpen}
        onClose={() => setTasksOpen(false)}
        refreshKey={taskRefreshKey}
      />
      {notice && (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 z-[140] -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background shadow-lg"
        >
          {notice}
        </div>
      )}
    </div>
  );
};

const keyboardNavigate = (event: React.KeyboardEvent, index: number) => {
  const columns = window.innerWidth >= 1536 ? 4 : window.innerWidth >= 768 ? 3 : 2;
  const delta =
    event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowLeft'
        ? -1
        : event.key === 'ArrowDown'
          ? columns
          : event.key === 'ArrowUp'
            ? -columns
            : 0;
  if (!delta) return;
  event.preventDefault();
  document.querySelector<HTMLElement>(`[data-asset-index="${index + delta}"]`)?.focus();
};

const AssetCard = ({
  asset,
  index,
  selected,
  checked,
  onOpen,
  onToggle,
  onPreviewReady,
}: {
  asset: AssetSummary;
  index: number;
  selected: boolean;
  checked: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onPreviewReady: () => void;
}) => (
  <article
    data-asset-index={index}
    tabIndex={0}
    role="gridcell"
    onClick={onOpen}
    onKeyDown={(event) => {
      keyboardNavigate(event, index);
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    }}
    className={cn(
      'group relative mb-4 break-inside-avoid overflow-hidden rounded-lg border bg-white text-left transition-all duration-200 focus:outline-none dark:bg-[#151515]',
      selected
        ? 'border-[#c8ff00] shadow-[0_0_0_2px_rgba(169,199,47,0.18)]'
        : 'border-black/[0.07] shadow-[0_8px_26px_rgba(20,24,28,0.035)] hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[0_16px_34px_rgba(20,24,28,0.09)] dark:border-white/10',
    )}
  >
    <div
      className={cn(
        'relative overflow-hidden',
        asset.type === 'image' ? 'bg-[#ebeae4] dark:bg-[#171717]' : 'aspect-[16/10]',
      )}
      style={asset.type === 'image' ? { aspectRatio: imageAspectRatio(asset) } : undefined}
    >
      <AssetThumbnail asset={asset} onReady={onPreviewReady} fit={asset.type === 'image' ? 'contain' : 'cover'} />
      <Button type="button" variant="ghost" size="iconSm"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-label={checked ? '取消选择' : '选择资产'}
        className={cn(
          'absolute left-2.5 top-2.5 h-6 w-6 rounded-md border p-0 backdrop-blur-md transition-opacity',
          checked
            ? 'border-[#c8ff00] bg-[#c8ff00] text-black opacity-100'
            : 'border-white/50 bg-black/25 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        <CheckSquare2 size={12} />
      </Button>
      {asset.favorite && (
        <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-lg bg-white/85 text-amber-500 backdrop-blur-md dark:bg-black/55">
          <Star size={12} className="fill-current" />
        </span>
      )}
      {Boolean(asset.userMetadata?.feedItem && asset.userMetadata.savedToAssets) && (
        <span className="absolute right-2.5 top-2.5 rounded-lg bg-[#c8ff00] px-2 py-1 text-xs font-bold text-black shadow-sm">
          已保存入资产
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/80 via-black/55 to-transparent px-3 pb-3 pt-10 text-white opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="truncate text-[12px] font-semibold">{asset.title}</div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-white/70">
          <span className="truncate">{asset.description || '暂无笔记'}</span>
          <span className="shrink-0">{formatDate(asset.updatedAt)}</span>
        </div>
      </div>
    </div>
  </article>
);

export const AssetRow = ({
  asset,
  index,
  selected,
  checked,
  onOpen,
  onToggle,
}: {
  asset: AssetSummary;
  index: number;
  selected: boolean;
  checked: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) => (
  <Button type="button" variant="ghost"
    data-asset-index={index}
    onClick={onOpen}
    onKeyDown={(event) => keyboardNavigate(event, index)}
    className={cn(
      'h-16 w-full justify-start gap-3 rounded-none border-b px-3 text-left last:border-0',
      selected && 'bg-[#f8ffd6] dark:bg-[#c8ff00]/[0.07]',
    )}
  >
    <span
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
        checked
          ? 'border-[#c8ff00] bg-[#c8ff00] text-black'
          : 'border-black/15 text-transparent dark:border-white/20',
      )}
    >
      <CheckSquare2 size={11} />
    </span>
    <span className="grid h-10 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#eeede8] text-slate-400 dark:bg-white/[0.05]">
      {asset.type === 'image' ? (
        <ImageIcon size={16} />
      ) : asset.type === 'video' ? (
        <Film size={16} />
      ) : asset.type === 'ppt' ? (
        <Presentation size={16} />
      ) : (
        <FileText size={16} />
      )}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-semibold">{asset.title}</span>
      <span className="mt-1 block truncate text-xs text-slate-400">
        {asset.description || '暂无笔记'}
      </span>
    </span>
    <span className="rounded-md bg-black/[0.04] px-2 py-1 text-xs font-semibold uppercase text-slate-400 dark:bg-white/10">
      {asset.type}
    </span>
    {asset.favorite && <Star size={12} className="fill-amber-400 text-amber-400" />}
    <span className="w-20 text-right text-xs text-slate-400">{formatDate(asset.updatedAt)}</span>
  </Button>
);
