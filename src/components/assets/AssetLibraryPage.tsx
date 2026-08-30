import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  CheckSquare2,
  ChevronDown,
  Copy,
  FileText,
  Film,
  FolderPlus,
  Globe2,
  Hash,
  Image as ImageIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Presentation,
  Music,
  Search,
  Star,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from '@/lib/remixIconShim';
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

type AssetSource = 'uploaded' | 'online';
type AssetTypeFilter = 'image' | 'video' | 'audio' | 'project';

const assetTypeOptions: Array<{ id: AssetTypeFilter; label: string; icon: React.ElementType }> = [
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'video', label: '视频', icon: Film },
  { id: 'audio', label: '音频', icon: Music },
];
const visibleAssetTypes = new Set(['image', 'video', 'audio']);
const caseTabs: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'gpt-image', label: 'GPT Image' },
  { id: 'seedance', label: 'Seedance' },
  { id: 'nanobanana', label: 'Nanobanana' },
  { id: 'midjourney', label: 'Midjourney' },
];
const formatDate = (value: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(value);

export const AssetLibraryPage = ({ initialSource = 'uploaded', showSourceTabs = true, showSearch = true }: { initialSource?: AssetSource; showSourceTabs?: boolean; showSearch?: boolean }) => {
  const [page, setPage] = useState<AssetPage>({ items: [], total: 0, limit: 60, offset: 0 });
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [tags, setTags] = useState<AssetTag[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [source, setSource] = useState<AssetSource>(initialSource);
  const [caseTab, setCaseTab] = useState('all');
  const [type, setType] = useState<AssetTypeFilter>('image');
  const [folderId, setFolderId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState('updatedAt');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importSession, setImportSession] = useState<ImportSession | null>(null);
  const [tasksOpen, setTasksOpen] = useState(false);
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
        type: type === 'project' ? '' : type,
        folderId,
        tagIds,
        favorite: favoritesOnly || undefined,
        sort,
        limit: 60,
        offset,
      });
      const generated = generatedItems
        .filter((item) => item.savedToAssets)
        .filter((item) => visibleAssetTypes.has(item.type))
        .filter((item) => !type || item.type === type)
        .filter(() => !tagIds.length)
        .filter((item) => {
          const needle = debouncedQuery.trim().toLowerCase();
          return !needle || `${item.title} ${item.description} ${String(item.metadata.prompt || '')}`.toLowerCase().includes(needle);
        })
        .map((item) => ({
        id: item.id, type: item.type, title: item.title, description: item.description,
        primaryFolderId: null, favorite: false, rating: 0, status: 'generated',
        normalizedMetadata: {}, userMetadata: { feedItem: true, savedToAssets: item.savedToAssets, ...item.metadata },
        createdAt: item.createdAt, importedAt: item.createdAt, updatedAt: item.createdAt,
        previewUrl: item.previewUrl, previewStatus: 'remote',
        } satisfies AssetSummary));
      // 生成内容与资产库使用同一张首页卡片：保存后不再追加一张重复的数据库卡片。
      const generatedAssets = result.items.filter((asset) => {
        if (!visibleAssetTypes.has(asset.type)) return false;
        const metadataSource = asset.userMetadata?.source;
        return typeof asset.userMetadata?.generatedUrl === 'string'
          || metadataSource === 'image-generation'
          || metadataSource === 'video-generation';
      });
      const importedAssets = result.items.filter((asset) => {
        if (!visibleAssetTypes.has(asset.type)) return false;
        const generatedUrl = asset.userMetadata?.generatedUrl;
        const metadataSource = asset.userMetadata?.source;
        return typeof generatedUrl !== 'string'
          && metadataSource !== 'image-generation'
          && metadataSource !== 'video-generation';
      });
      const generatedDatabaseUrls = new Set(
        generatedAssets
          .map((asset) => asset.userMetadata?.generatedUrl)
          .filter((url): url is string => typeof url === 'string'),
      );
      // 已保存的生成内容以数据库资产为准，让本地预览和文件引用生效；仅保留没有对应数据库记录的旧会话卡片。
      const generatedFallbackItems = generated.filter((item) => !generatedDatabaseUrls.has(item.previewUrl));
      const generatedDatabaseItems = generatedAssets;
      const sourceItems = source === 'uploaded'
        ? [...generatedFallbackItems, ...generatedDatabaseItems, ...importedAssets]
        : [];
      const combinedItems = sourceItems.sort((a, b) => {
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
  }, [debouncedQuery, favoritesOnly, folderId, generatedItems, offset, sort, source, tagIds, type]);

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
        setType('image');
        setFolderId('');
        setTagIds([]);
        setFavoritesOnly(false);
        setOffset(0);
      } else if (destination.startsWith('folder:')) {
        setFolderId(destination.slice('folder:'.length));
        setType('image');
        setTagIds([]);
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
      setNotice(`已接收 ${session.items.length} 个素材，正在自动入库`);
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

  const importDroppedAssets = async (files: File[]) => {
    setError('');
    const uploaded = await Promise.all(files.map((file) => assetService.dropImage(file)));
    await startImport(uploaded.map((item) => item.path), true, tagIds[0] || null);
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

  const removeSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length || !window.confirm(`将 ${ids.length} 项资产移入回收站？`)) return;
    await Promise.all(ids.map(assetService.remove));
    setSelectedIds(new Set());
    if (selectedId && ids.includes(selectedId)) {
      setSelectedId(null);
      setSelectedAsset(null);
    }
    refresh();
  };

  const createTag = async () => {
    const name = window.prompt('请输入新标签名称');
    if (!name?.trim()) return;
    try {
      const created = await assetService.createTag(name.trim());
      await loadTaxonomy();
      setTagIds([created.id]);
      setOffset(0);
      setNotice(`已创建标签「${created.name}」`);
      window.setTimeout(() => setNotice(''), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '创建标签失败');
    }
  };

  const renameTag = async (tag: AssetTag) => {
    const name = window.prompt('修改标签名称', tag.name);
    if (!name?.trim() || name.trim() === tag.name) return;
    try {
      const renamed = await assetService.renameTag(tag.id, name.trim());
      await loadTaxonomy();
      setNotice(`已重命名为「${renamed.name}」`);
      window.setTimeout(() => setNotice(''), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '重命名标签失败');
    }
  };

  const deleteTag = async (tag: AssetTag) => {
    if (!window.confirm(`删除标签「${tag.name}」？\n资产本身不会被删除。`)) return;
    try {
      await assetService.deleteTag(tag.id);
      if (tagIds.includes(tag.id)) setTagIds([]);
      await loadTaxonomy();
      setOffset(0);
      setNotice(`已删除标签「${tag.name}」`);
      window.setTimeout(() => setNotice(''), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除标签失败');
    }
  };

  const selectedCount = selectedIds.size;
  const activeFilterCount = [type, folderId, tagIds.length ? 'tags' : '', favoritesOnly ? 'favorites' : '', sort === 'updatedAt' ? '' : sort].filter(Boolean).length;
  const showEmptyImport = source === 'uploaded' && type !== 'project' && !loading && !error && !page.items.length && !activeFilterCount && !debouncedQuery;
  const showDropZone = source === 'uploaded' && type !== 'project' && (dropZoneOpen || showEmptyImport);
  const activeTypeLabel = assetTypeOptions.find((option) => option.id === type)?.label || '图片';
  const activeTagLabel = tagIds.length ? tags.find((tag) => tag.id === tagIds[0])?.name : undefined;
  const activeFolderLabel = folderId ? folders.find((folder) => folder.id === folderId)?.name : undefined;
  const assetViewTitle = source === 'online'
    ? '案例资源'
    : activeTagLabel || activeFolderLabel || (favoritesOnly ? '收藏' : activeTypeLabel);
  return (
    <div className="module-workspace ui-workspace-surface relative flex h-full min-w-0 flex-col bg-[var(--module-workspace-bg,var(--background))] text-foreground">
      <header className="mx-3 shrink-0 p-0">
        <div className="flex min-h-14 w-full items-center justify-between gap-4">
          {showSourceTabs && <div
            role="tablist"
            aria-label="素材来源"
            className="order-1 flex h-8 shrink-0 items-center gap-1 bg-transparent p-0"
          >
            {[
              { id: 'uploaded' as const, label: '我的资产' },
              { id: 'online' as const, label: '案例资源' },
            ].map(({ id, label }) => {
              const active = source === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSource(id);
                    setType(type !== 'project' ? type : 'image');
                    setFolderId('');
                    setTagIds([]);
                    setDropZoneOpen(false);
                    setSelectedIds(new Set());
                    setSelectedId(null);
                    setOffset(0);
                  }}
                  className={cn(
                    'flex h-8 items-center rounded-md border-0 bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none transition-colors',
                    active
                      ? 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)]'
                      : 'hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>}

          {showSearch && <div className="relative order-2 ml-auto w-[240px] max-w-full">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、描述和提取文字…"
              className="module-search-input h-8 border border-neutral-border bg-neutral-surface py-0 pl-9 pr-9 text-neutral-foreground placeholder:text-muted-foreground shadow-none focus-visible:ring-1 focus-visible:ring-neutral-border"
            />
            {query && (
              <Button variant="ghost" size="iconSm" onClick={() => setQuery('')} aria-label="清空搜索" className="absolute right-0.5 top-1/2 h-6 w-6 -translate-y-1/2"><X size={13} /></Button>
            )}
          </div>}

        </div>
      </header>

      <div className="ui-module-panel mx-3 mb-3 mt-0 flex min-h-0 flex-1 bg-[var(--module-workspace-bg,var(--background))]">
        <div className="flex min-h-0 flex-1 gap-0">
        {(source === 'uploaded' || source === 'online') && filterPanelOpen && <aside
          id="asset-filter-panel"
          aria-label="资产筛选"
          className="asset-filter-panel ui-module-divider-r flex h-full w-[200px] shrink-0 flex-col overflow-hidden bg-[var(--module-workspace-bg,var(--background))] text-foreground"
        >
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="素材标签筛选">
            {source === 'uploaded' && <section className="px-0 pb-1" data-filter-section="type">
              <div className="flex flex-col gap-0.5">
                {assetTypeOptions
                  .filter((option) => option.id !== 'project')
                  .map((option) => {
                    const Icon = option.icon;
                    const active = type === option.id;
                    return (
                      <Button
                        key={option.id}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setType(option.id);
                          setFolderId('');
                          setOffset(0);
                        }}
                        aria-pressed={active}
                        className={cn(
                          'h-8 w-full justify-start gap-2 rounded-md px-2.5 text-sm font-medium text-foreground hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]',
                          active && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]',
                        )}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span>{option.label}</span>
                      </Button>
                    );
                  })}
              </div>
            </section>}
            {source === 'uploaded' && <section className="px-0 py-1" data-filter-section="tags">
              <div className="flex h-10 items-center gap-2 text-sidebar-foreground/70">
                <Hash size={12} className="shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium">标签</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconSm"
                  onClick={() => void createTag()}
                  aria-label="新建标签"
                  title="新建标签"
                  className="ml-auto h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Plus size={15} />
                </Button>
              </div>
              <div className="ui-module-divider-l ml-[7px] pl-[9px]">
                <button
                  type="button"
                  onClick={() => { setTagIds([]); setOffset(0); }}
                  aria-pressed={!tagIds.length}
                  className={cn(
                    'flex h-7 w-full items-center rounded-md px-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]',
                    !tagIds.length && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]',
                  )}
                >
                  All
                </button>
                {tags.map((tag) => {
                  const selected = tagIds.includes(tag.id);
                  return (
                    <div
                      key={tag.id}
                      className={cn(
                        'group/tag mt-0.5 flex h-7 w-full items-center rounded-md transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)] focus-within:bg-[var(--surface-hover)] focus-within:text-[var(--surface-hover-foreground)]',
                        selected && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)] focus-within:bg-[var(--surface-control)] focus-within:text-[var(--surface-control-foreground)]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => { setTagIds([tag.id]); setOffset(0); }}
                        aria-pressed={selected}
                        className="min-w-0 flex-1 truncate px-2.5 text-left text-xs font-medium text-inherit focus-visible:outline-none"
                      >
                        {tag.name}
                      </button>
                      <span className="mr-0.5 flex shrink-0 items-center transition-opacity">
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconSm"
                          onClick={() => void renameTag(tag)}
                          aria-label={`编辑标签 ${tag.name}`}
                          title="编辑标签"
                          className="h-6 w-6 text-sidebar-foreground/70 opacity-0 transition-opacity group-hover/tag:opacity-100 group-focus-within/tag:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconSm"
                          onClick={() => void deleteTag(tag)}
                          aria-label={`删除标签 ${tag.name}`}
                          title="删除标签"
                          className="h-6 w-6 text-sidebar-foreground/70 opacity-0 transition-opacity group-hover/tag:opacity-100 group-focus-within/tag:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </span>
                    </div>
                  );
                })}
                {!tags.length && <div className="px-3 py-3 text-xs text-muted-foreground">暂无标签，点击右上角添加</div>}
              </div>
            </section>}
          </nav>
        </aside>}
      {source === 'online' ? (
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
          <header className="ui-module-divider-b flex h-12 shrink-0 items-center px-4">
            <div role="tablist" aria-label="案例模型" className="flex min-w-0 items-center gap-1">
              {caseTabs.map(({ id, label }) => {
                const active = caseTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-state={active ? 'active' : 'inactive'}
                    onClick={() => setCaseTab(id)}
                    className="flex h-8 shrink-0 items-center rounded-md border-0 bg-transparent px-4 py-0 text-sm font-medium text-muted-foreground shadow-none transition-colors focus-visible:ring-offset-0 data-[state=inactive]:hover:text-foreground data-[state=active]:!bg-[var(--surface-control)] data-[state=active]:!text-[var(--surface-control-foreground)] data-[state=active]:!shadow-none"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center px-6">
            <div className="flex max-w-sm flex-col items-center text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-control)] text-[var(--surface-control-foreground)]">
                <Globe2 size={20} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold">暂无案例资源</h2>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">接入案例资源来源后，内容会显示在这里。</p>
            </div>
          </div>
        </main>
      ) : <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        <header className="ui-module-divider-b relative flex h-12 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {source === 'uploaded' && <Button
              type="button"
              variant="ghost"
              size="iconSm"
              onClick={() => setFilterPanelOpen((open) => !open)}
              aria-label={filterPanelOpen ? '收起筛选' : '展开筛选'}
              title={filterPanelOpen ? '收起筛选' : '展开筛选'}
              className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {filterPanelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </Button>}
            {source === 'uploaded' && <h1 className="min-w-0 truncate text-sm font-semibold tracking-[-0.01em]">{assetViewTitle}</h1>}
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
              className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Upload size={16} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSortOpen((open) => !open)}
              aria-expanded={sortOpen}
              aria-controls="asset-sort-menu"
              className="relative h-8 gap-1 px-2 text-xs font-medium text-muted-foreground before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:bg-accent hover:text-accent-foreground"
            >
              排序
              <ChevronDown size={13} className={cn('transition-transform', sortOpen && 'rotate-180')} />
            </Button>
            {sortOpen && (
              <div id="asset-sort-menu" className="absolute right-0 top-8 z-30 w-48 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
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
                      'h-9 w-full justify-between hover:bg-accent hover:text-accent-foreground',
                      sort === option.id && 'bg-accent text-accent-foreground shadow-none',
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
              'mx-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-4 text-center transition-colors',
              showEmptyImport ? 'my-6 min-h-[330px] flex-1' : 'mt-6 min-h-[220px] shrink-0',
              draggingFiles && 'border-ring bg-accent',
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
              if (files.length) void importDroppedAssets(files);
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
                if (files.length) void importDroppedAssets(files);
              }}
            />
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <UploadCloud size={21} />
            </span>
            <p className="text-sm font-semibold">{draggingFiles ? '松开即可自动入库' : '把素材拖到这里'}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">支持批量选择文件或文件夹，导入后可按类型与标签筛选</p>
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
                <UploadCloud size={14} aria-hidden="true" /> 从电脑选择素材
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
            <p className="mt-4 text-xs text-muted-foreground">素材会保存到栗作本地管理目录，不会上传到第三方服务</p>
          </section>
        )}
        {selectedCount > 0 && (
          <div className="mx-4 mt-6 flex shrink-0 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs">
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

        {!showEmptyImport && <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
          {loading ? (
            <div className="columns-2 gap-1 md:columns-3 xl:columns-4 2xl:columns-5" aria-label="正在加载资产">
              {Array.from({ length: 10 }, (_, index) => (
                <Skeleton key={index} className={cn('mb-1 w-full break-inside-avoid rounded-[2px]', index % 3 === 0 ? 'aspect-[3/4]' : index % 3 === 1 ? 'aspect-square' : 'aspect-[4/3]')} />
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
              className="columns-2 gap-1 md:columns-3 xl:columns-4 2xl:columns-5"
            >
              {page.items.map((asset, index) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  index={index}
                  selected={selectedId === asset.id}
                  checked={selectedIds.has(asset.id)}
                  onOpen={() => {
                    setSelectedId(asset.id);
                    setSelectedAsset(asset);
                  }}
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
      }
        </div>
      </div>

      <AssetDetailPanel
        assetId={selectedId}
        selectedAsset={selectedAsset}
        assets={page.items}
        onSelectAsset={(asset) => {
          setSelectedId(asset.id);
          setSelectedAsset(asset);
        }}
        folders={folders}
        availableTags={tags}
        onClose={() => {
          setSelectedId(null);
          setSelectedAsset(null);
        }}
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
      'group relative mb-1 break-inside-avoid overflow-hidden text-left transition-transform duration-200 focus:outline-none',
      selected
        ? 'ring-2 ring-inset ring-primary'
        : '',
    )}
  >
    <div
      className={cn(
        'relative overflow-hidden rounded-md',
        asset.type === 'image' ? '' : 'aspect-[16/10]',
      )}
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
            ? 'border-primary bg-primary text-primary-foreground opacity-100'
            : 'border-white/50 bg-black/25 text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        <CheckSquare2 size={12} />
      </Button>
      {asset.favorite && (
        <span className="absolute right-2.5 top-2.5 z-10 grid h-6 w-6 place-items-center rounded-lg bg-white/85 text-amber-500 backdrop-blur-md dark:bg-black/55">
          <Star size={12} className="fill-current" />
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/80 via-black/55 to-transparent px-3 pb-3 pt-10 text-white opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="truncate text-[12px] font-semibold">{asset.title}</div>
        <div className="mt-1 flex items-start gap-2 text-xs text-white/70">
          <span className="line-clamp-2 min-w-0 flex-1" title={String(asset.userMetadata?.prompt || asset.description || '暂无提示词')}>
            {String(asset.userMetadata?.prompt || asset.description || '暂无提示词')}
          </span>
          <button
            type="button"
            className="pointer-events-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="复制提示词"
            title="复制提示词"
            onClick={(event) => {
              event.stopPropagation();
              void navigator.clipboard?.writeText(String(asset.userMetadata?.prompt || asset.description || ''));
            }}
          >
            <Copy size={13} />
          </button>
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
      selected && 'bg-accent text-accent-foreground',
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
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-transparent',
      )}
    >
      <CheckSquare2 size={11} />
    </span>
    <span className="grid h-10 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
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
      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {asset.description || '暂无笔记'}
      </span>
    </span>
    <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
      {asset.type}
    </span>
    {asset.favorite && <Star size={12} className="fill-amber-400 text-amber-400" />}
    <span className="w-20 text-right text-xs text-muted-foreground">{formatDate(asset.updatedAt)}</span>
  </Button>
);
