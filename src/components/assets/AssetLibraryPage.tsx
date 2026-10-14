import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  BookmarkPlus,
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Film,
  Folder,
  FolderOpen,
  FolderPlus,
  Globe2,
  Image as ImageIcon,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Presentation,
  Music,
  Palette,
  Search,
  Sparkles,
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  Input,
  Select,
  Separator,
  Skeleton,
} from '../ui';
import { isCaseVideo } from './caseMedia';

const sortOptions = [
  { id: 'updatedAt', label: '时间', hint: '最新优先' },
  { id: 'title', label: '名字', hint: 'A–Z' },
];

type AssetSource = 'uploaded' | 'online';
type AssetTypeFilter = '' | 'image' | 'video' | 'audio' | 'project';
type AssetOriginFilter = 'all' | 'generated' | 'canvas' | 'uploaded' | 'favorites';
type CaseItem = {
  id: string;
  sourceId: string;
  title: string;
  prompt: string;
  description: string;
  coverUrl: string | null;
  tags: string[];
  author: string;
  sourceUrl: string;
  imageModel: string;
  mediaType?: string;
};

const assetTypeOptions: Array<{ id: AssetTypeFilter; label: string; icon: React.ElementType }> = [
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'video', label: '视频', icon: Film },
  { id: 'audio', label: '音频', icon: Music },
];
const visibleAssetTypes = new Set(['image', 'video', 'audio']);
const assetOriginOptions: Array<{ id: AssetOriginFilter; label: string; icon: React.ElementType }> = [
  { id: 'all', label: '全部资产', icon: FolderOpen },
  { id: 'generated', label: '生成资产', icon: Sparkles },
  { id: 'canvas', label: '画布资产', icon: Palette },
  { id: 'uploaded', label: '本地上传', icon: Upload },
  { id: 'favorites', label: '我的收藏', icon: Star },
];
const caseTabs: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'gpt-image', label: 'GPT Image' },
  { id: 'seedance', label: 'Seedance' },
  { id: 'nanobanana', label: 'Nanobanana' },
  { id: 'midjourney', label: 'Midjourney' },
];
const caseModelMatches = (model: string, tabId: string) => {
  if (tabId === 'all') return true;
  const normalized = model.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return normalized.includes(tabId.replace(/[^a-z0-9]+/g, ''));
};

const CaseActionIcon = ({ kind }: { kind: 'download' | 'save' | 'fullscreen' }) => {
  const Icon = kind === 'download' ? Download : kind === 'save' ? BookmarkPlus : Maximize2;
  const opticalScale = kind === 'save' ? 'scale-[1.15]' : kind === 'fullscreen' ? 'scale-[0.95]' : 'scale-[1.05]';
  return <span className="grid h-6 w-6 shrink-0 place-items-center"><Icon size={20} className={opticalScale} aria-hidden="true" /></span>;
};
const formatDate = (value: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(value);

export const AssetLibraryPage = ({
  initialSource = 'uploaded',
  showSourceTabs = true,
  showSearch = true,
  flushLayout = false,
}: {
  initialSource?: AssetSource;
  showSourceTabs?: boolean;
  showSearch?: boolean;
  flushLayout?: boolean;
}) => {
  const [page, setPage] = useState<AssetPage>({
    items: [],
    total: 0,
    limit: 60,
    offset: 0,
    counts: { all: 0, unfiled: 0, byType: {} },
  });
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [tags, setTags] = useState<AssetTag[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [source, setSource] = useState<AssetSource>(initialSource);
  const [caseTab, setCaseTab] = useState('all');
  const [caseSourceTab, setCaseSourceTab] = useState('all');
  const [caseTag, setCaseTag] = useState('');
  const [type, setType] = useState<AssetTypeFilter>('');
  const [origin, setOrigin] = useState<AssetOriginFilter>('all');
  const [folderId, setFolderId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
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
  const [foldersSectionExpanded, setFoldersSectionExpanded] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState<string | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [folderCreating, setFolderCreating] = useState(false);
  const cancelNewFolderRef = useRef(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState('');
  const cancelFolderRenameRef = useRef(false);
  const [folderContextMenu, setFolderContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);
  const [dropZoneOpen, setDropZoneOpen] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const [generatedItems, setGeneratedItems] = useState<GeneratedContentItem[]>([]);
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [caseSources, setCaseSources] = useState<Array<{ id: string; name: string; homepageUrl: string | null; itemCount: number }>>([]);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [savedCaseIds, setSavedCaseIds] = useState<Set<string>>(new Set());
  const [caseAssetIdsByCaseId, setCaseAssetIdsByCaseId] = useState<Record<string, string>>({});

  useEffect(() => {
    const sync = () => setGeneratedItems(contentFeed.list());
    sync();
    window.addEventListener('design-work:content-feed-updated', sync);
    return () => window.removeEventListener('design-work:content-feed-updated', sync);
  }, []);

  useEffect(() => {
    if (source !== 'online') return;
    const loadCases = () => Promise.all([
      assetService.cases(debouncedQuery),
      assetService.list({ limit: 500 }),
    ]).then(([result, allAssets]) => {
      setCaseItems(result.items);
      setCaseSources(result.sources);
      const caseAssets = allAssets.items.filter((asset) => asset.userMetadata?.source === 'case-library');
      setCaseAssetIdsByCaseId(Object.fromEntries(caseAssets.flatMap((asset) => {
        const caseId = asset.userMetadata?.caseId;
        return typeof caseId === 'string' ? [[caseId, asset.id] as const] : [];
      })));
      setSavedCaseIds(new Set(caseAssets
        .filter((asset) => asset.favorite)
        .map((asset) => asset.userMetadata?.caseId)
        .filter((caseId): caseId is string => typeof caseId === 'string')));
    }).catch((caught) => setError(caught instanceof Error ? caught.message : '案例读取失败'));
    void loadCases();
    window.addEventListener('design-work:prompt-sources-updated', loadCases);
    return () => window.removeEventListener('design-work:prompt-sources-updated', loadCases);
  }, [debouncedQuery, source]);

  useEffect(() => {
    if (!selectedCase) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCase(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedCase]);

  useEffect(() => {
    if (!folderContextMenu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFolderContextMenu(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [folderContextMenu]);

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
        favorite: origin === 'favorites' || undefined,
        origin: origin === 'generated' || origin === 'canvas' || origin === 'uploaded' ? origin : undefined,
        sort,
        limit: 60,
        offset,
      });
      const generated = generatedItems
        .filter((item) => item.savedToAssets)
        .filter(() => origin === 'all' || origin === 'generated')
        .filter((item) => visibleAssetTypes.has(item.type))
        .filter((item) => !type || item.type === type)
        .filter(() => !folderId)
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
      const databaseAssets = result.items.filter((asset) => visibleAssetTypes.has(asset.type));
      const generatedAssets = databaseAssets.filter((asset) => {
        const metadataSource = asset.userMetadata?.source;
        return metadataSource === 'image-generation' || metadataSource === 'video-generation';
      });
      const generatedDatabaseUrls = new Set(
        generatedAssets
          .map((asset) => asset.userMetadata?.generatedUrl)
          .filter((url): url is string => typeof url === 'string'),
      );
      // 已保存的生成内容以数据库资产为准，让本地预览和文件引用生效；仅保留没有对应数据库记录的旧会话卡片。
      const generatedFallbackItems = generated.filter((item) => !generatedDatabaseUrls.has(item.previewUrl));
      const sourceItems = source === 'uploaded'
        ? [...generatedFallbackItems, ...databaseAssets]
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
  }, [debouncedQuery, folderId, generatedItems, offset, origin, sort, source, tagIds, type]);

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
        setOrigin('all');
        setFolderId('');
        setTagIds([]);
        setOffset(0);
      } else if (destination.startsWith('folder:')) {
        setFolderId(destination.slice('folder:'.length));
        setType('');
        setOrigin('uploaded');
        setTagIds([]);
        setOffset(0);
      } else {
        document
          .querySelector<HTMLElement>(
            destination === 'folders' ? '[data-filter-section="folders"] button' : '[aria-label="按标签筛选"]',
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

  const downloadCaseImage = (item: CaseItem) => {
    if (!item.coverUrl) return;
    const anchor = document.createElement('a');
    anchor.href = item.coverUrl;
    anchor.download = `${item.title || (isCaseVideo(item) ? 'case-video' : 'case-image')}.${isCaseVideo(item) ? 'mp4' : 'jpg'}`;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.click();
  };

  const saveCaseToAssets = async (item: CaseItem) => {
    if (!item.coverUrl || savedCaseIds.has(item.id)) return;
    try {
      const existingAssetId = caseAssetIdsByCaseId[item.id];
      if (existingAssetId) {
        await assetService.update(existingAssetId, { favorite: true });
      } else {
        const created = await assetService.create({
          type: isCaseVideo(item) ? 'video' : 'image',
          title: item.title,
          description: item.prompt || item.description,
          sourceUrl: item.coverUrl,
          favorite: true,
          userMetadata: {
            source: 'case-library',
            prompt: item.prompt,
            model: item.imageModel,
            generatedUrl: item.coverUrl,
            caseId: item.id,
            caseSourceId: item.sourceId,
            upstreamUrl: item.sourceUrl,
          },
        });
        setCaseAssetIdsByCaseId((current) => ({ ...current, [item.id]: created.id }));
      }
      setSavedCaseIds((current) => new Set(current).add(item.id));
      setNotice('已添加至收藏');
      window.setTimeout(() => setNotice(''), 2200);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '添加至收藏失败');
    }
  };

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

  const openFolderCreator = (parentId: string | null) => {
    setFolderContextMenu(null);
    setFoldersSectionExpanded(true);
    setNewFolderParentId(parentId);
    setNewFolderName('未命名文件夹');
    cancelNewFolderRef.current = false;
    if (parentId) setExpandedFolderIds((current) => new Set(current).add(parentId));
  };

  const createFolder = async (draftName: string, parentId: string | null) => {
    const name = draftName.trim() || '未命名文件夹';
    if (folderCreating) return;
    setFolderCreating(true);
    try {
      const created = await assetService.createFolder(name, parentId);
      await loadTaxonomy();
      setNewFolderName(null);
      setNewFolderParentId(null);
      setFolderId(created.id);
      setType('');
      setOrigin('uploaded');
      setTagIds([]);
      setOffset(0);
      setNotice(`已创建文件夹「${created.name}」`);
      window.setTimeout(() => setNotice(''), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '创建文件夹失败');
    } finally {
      setFolderCreating(false);
    }
  };

  const startRenamingFolder = (folder: AssetFolder) => {
    setFolderContextMenu(null);
    setEditingFolderId(folder.id);
    setFolderNameDraft(folder.name);
    cancelFolderRenameRef.current = false;
  };

  const renameFolder = async (folder: AssetFolder, draftName: string) => {
    const name = draftName.trim();
    if (!name || name === folder.name) {
      setEditingFolderId(null);
      setFolderNameDraft('');
      return;
    }
    try {
      const renamed = await assetService.renameFolder(folder.id, name);
      await loadTaxonomy();
      setEditingFolderId(null);
      setFolderNameDraft('');
      setNotice(`已重命名为「${renamed.name}」`);
      window.setTimeout(() => setNotice(''), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '重命名文件夹失败');
    }
  };

  const deleteFolder = async (folder: AssetFolder) => {
    if (!window.confirm(`删除文件夹「${folder.name}」？\n子文件夹会一并删除，其中的素材不会被删除，将转为未分类。`)) return;
    try {
      const removedFolderIds = new Set([folder.id]);
      let foundDescendant = true;
      while (foundDescendant) {
        foundDescendant = false;
        folders.forEach((candidate) => {
          if (candidate.parentId && removedFolderIds.has(candidate.parentId) && !removedFolderIds.has(candidate.id)) {
            removedFolderIds.add(candidate.id);
            foundDescendant = true;
          }
        });
      }
      await assetService.deleteFolder(folder.id);
      if (removedFolderIds.has(folderId)) {
        setFolderId('');
        setType('');
      }
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        removedFolderIds.forEach((id) => next.delete(id));
        return next;
      });
      await loadTaxonomy();
      setOffset(0);
      setNotice(`已删除文件夹「${folder.name}」`);
      window.setTimeout(() => setNotice(''), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除文件夹失败');
    }
  };

  const openFolderContextMenu = (event: React.MouseEvent, folder: AssetFolder) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 208;
    const menuHeight = 162;
    setFolderContextMenu({
      folderId: folder.id,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  const renderNewFolderEditor = (depth: number) => <div
    className="flex h-8 items-center gap-1 pr-2"
    style={{ paddingLeft: `${8 + depth * 16}px` }}
    aria-label="新建文件夹"
    aria-busy={folderCreating}
  >
    <Folder size={24} className="shrink-0 text-sidebar-foreground/70" aria-hidden="true" />
    <Input
      autoFocus
      value={newFolderName || ''}
      onChange={(event) => setNewFolderName(event.target.value)}
      onBlur={(event) => {
        if (cancelNewFolderRef.current) {
          cancelNewFolderRef.current = false;
          setNewFolderName(null);
          setNewFolderParentId(null);
          return;
        }
        void createFolder(event.currentTarget.value, newFolderParentId);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          cancelNewFolderRef.current = true;
          event.currentTarget.blur();
        }
      }}
      aria-label="命名新文件夹"
      disabled={folderCreating}
      inputSize="sm"
      className="h-7 min-w-0 flex-1 px-2 text-xs"
    />
  </div>;

  const renderFolderTree = (parentId: string | null, depth = 0): React.ReactNode => <>
    {folders
      .filter((folder) => folder.parentId === parentId)
      .map((folder) => {
        const children = folders.filter((candidate) => candidate.parentId === folder.id);
        const expanded = expandedFolderIds.has(folder.id);
        const selected = folderId === folder.id;
        const editing = editingFolderId === folder.id;
        return (
          <div key={folder.id} data-folder-tree-entry>
            {editing ? <div className="flex h-8 items-center gap-1 pr-2" style={{ paddingLeft: `${8 + depth * 16}px` }}>
              <Folder size={24} className="shrink-0 text-sidebar-foreground/70" aria-hidden="true" />
              <Input
                autoFocus
                value={folderNameDraft}
                onChange={(event) => setFolderNameDraft(event.target.value)}
                onBlur={(event) => {
                  if (cancelFolderRenameRef.current) {
                    cancelFolderRenameRef.current = false;
                    setEditingFolderId(null);
                    setFolderNameDraft('');
                    return;
                  }
                  void renameFolder(folder, event.currentTarget.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    cancelFolderRenameRef.current = true;
                    event.currentTarget.blur();
                  }
                }}
                aria-label={`重命名文件夹 ${folder.name}`}
                inputSize="sm"
                className="h-7 min-w-0 flex-1 px-2 text-xs"
              />
            </div> : <div
              onContextMenu={(event) => openFolderContextMenu(event, folder)}
              className={cn(
                'mt-1 flex h-8 w-full items-center rounded-md pr-2 text-sm font-normal text-sidebar-foreground/70 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]',
                selected && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]',
              )}
              style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
              <button
                type="button"
                onClick={() => {
                  setFolderId(folder.id);
                  setType('');
                  setOrigin('uploaded');
                  setTagIds([]);
                  setOffset(0);
                  setExpandedFolderIds((current) => {
                    const next = new Set(current);
                    if (next.has(folder.id)) next.delete(folder.id);
                    else next.add(folder.id);
                    return next;
                  });
                }}
                aria-expanded={expanded}
                aria-pressed={selected}
                className="flex h-8 min-w-0 flex-1 items-center gap-2 bg-transparent p-0 text-left text-sm font-normal text-inherit outline-none"
              >
                <span aria-hidden="true" className="flex h-6 w-8 shrink-0 items-center gap-1 text-sidebar-foreground/70">
                  {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  {expanded ? <FolderOpen size={24} /> : <Folder size={24} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums opacity-55">{folder.assetCount}</span>
              </button>
            </div>}
            {(children.length > 0 || (newFolderName !== null && newFolderParentId === folder.id)) && expanded && renderFolderTree(folder.id, depth + 1)}
          </div>
        );
      })}
    {newFolderName !== null && newFolderParentId === parentId && renderNewFolderEditor(depth)}
  </>;

  const selectedCount = selectedIds.size;
  const contextFolder = folderContextMenu
    ? folders.find((folder) => folder.id === folderContextMenu.folderId) || null
    : null;
  const activeFilterCount = [type, folderId, origin === 'all' ? '' : origin, tagIds.length ? 'tags' : '', sort === 'updatedAt' ? '' : sort].filter(Boolean).length;
  const showEmptyImport = source === 'uploaded' && origin === 'uploaded' && type !== 'project' && !loading && !error && !page.items.length && !folderId && !tagIds.length && !debouncedQuery;
  const showDropZone = source === 'uploaded' && origin === 'uploaded' && type !== 'project' && (dropZoneOpen || showEmptyImport);
  const activeTypeLabel = assetTypeOptions.find((option) => option.id === type)?.label || '全部';
  const activeTagLabel = tagIds.length ? tags.find((tag) => tag.id === tagIds[0])?.name : undefined;
  const activeFolderLabel = folderId ? folders.find((folder) => folder.id === folderId)?.name : undefined;
  const assetViewTitle = source === 'online'
    ? '案例资源'
    : activeTagLabel || activeFolderLabel || (origin === 'all' ? activeTypeLabel : assetOriginOptions.find((option) => option.id === origin)?.label || activeTypeLabel);
  const caseTagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    caseItems.forEach((item) => item.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  }, [caseItems]);
  const visibleCaseItems = useMemo(() => caseItems.filter((item) =>
    (caseSourceTab === 'all' || item.sourceId === caseSourceTab)
      && caseModelMatches(item.imageModel, caseTab)
      && (!caseTag || item.tags.includes(caseTag))), [caseItems, caseSourceTab, caseTab, caseTag]);
  return (
    <div className="module-workspace ui-workspace-surface relative flex h-full min-w-0 flex-col bg-[var(--module-workspace-bg,var(--background))] text-foreground">
      {(showSourceTabs || showSearch) && <header className={cn(flushLayout ? 'mx-0' : 'mx-3', 'shrink-0 p-0')}>
        <div className="flex min-h-14 w-full items-center justify-between gap-4">
          {source === 'online' && <div role="tablist" aria-label="案例分类" className="order-1 flex min-w-0 items-center gap-1 overflow-x-auto">
            {caseTabs.map(({ id, label }) => {
              const active = caseTab === id;
              return <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                data-state={active ? 'active' : 'inactive'}
                onClick={() => { setCaseTab(id); setCaseTag(''); }}
                className="flex h-8 shrink-0 items-center rounded-md border-0 bg-transparent px-4 py-0 text-sm font-medium text-muted-foreground shadow-none transition-colors focus-visible:ring-offset-0 data-[state=inactive]:hover:text-foreground data-[state=active]:!bg-[var(--surface-control)] data-[state=active]:!text-[var(--surface-control-foreground)] data-[state=active]:!shadow-none"
              >
                {label}
              </button>;
            })}
          </div>}
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
                    setType(type !== 'project' ? type : '');
                    setOrigin('all');
                    setFolderId('');
                    setTagIds([]);
                    setCaseTag('');
                    setCaseTab('all');
                    setCaseSourceTab('all');
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
      </header>}

      <div className={cn('ui-module-panel mb-3 mt-0 flex min-h-0 flex-1 bg-[var(--module-workspace-bg,var(--background))]', flushLayout ? 'mx-0' : 'mx-3')}>
        <div className="flex min-h-0 flex-1 gap-0">
        {(source === 'uploaded' || source === 'online') && filterPanelOpen && <aside
          id="asset-filter-panel"
          aria-label="资产筛选"
          className="asset-filter-panel ui-module-divider-r flex h-full w-[200px] shrink-0 flex-col overflow-hidden bg-[var(--module-workspace-bg,var(--background))] text-foreground"
        >
          <nav
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-3 pb-3',
              source === 'online' ? 'pt-2' : 'pt-3',
            )}
            aria-label="素材分类筛选"
          >
            {source === 'uploaded' && <section className="px-0 pb-1" data-filter-section="origin">
              <div className="flex flex-col gap-0.5">
                {assetOriginOptions.map((option) => {
                  const Icon = option.icon;
                  const active = origin === option.id && !folderId;
                  return <Button
                    key={option.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOrigin(option.id);
                      setFolderId('');
                      setTagIds([]);
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
                  </Button>;
                })}
              </div>
            </section>}
            {source === 'uploaded' && <section className="px-0 py-1" data-filter-section="folders">
              <div className="group/folder-heading flex h-8 items-center text-sidebar-foreground/70">
                <button
                  type="button"
                  onClick={() => setFoldersSectionExpanded((expanded) => !expanded)}
                  aria-expanded={foldersSectionExpanded}
                  className="group/folder-toggle flex h-8 min-w-0 items-center gap-1 rounded-md bg-transparent px-2 text-xs font-medium text-inherit outline-none transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)] focus-visible:bg-[var(--surface-hover)] focus-visible:text-[var(--surface-hover-foreground)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  <span>文件夹</span>
                  <span className="pointer-events-none flex shrink-0 opacity-0 transition-opacity group-hover/folder-toggle:opacity-100 group-focus-within/folder-toggle:opacity-100" aria-hidden="true">
                    {foldersSectionExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="iconSm"
                  onClick={() => openFolderCreator(null)}
                  aria-label="新建文件夹"
                  title="新建文件夹"
                  className="pointer-events-none ml-auto h-8 w-8 shrink-0 text-sidebar-foreground/70 opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/folder-heading:pointer-events-auto group-hover/folder-heading:opacity-100 group-focus-within/folder-heading:pointer-events-auto group-focus-within/folder-heading:opacity-100"
                >
                  <FolderPlus size={15} />
                </Button>
              </div>
              {foldersSectionExpanded && <div className="knowledge-file-tree-scroll -mx-1 px-1 pb-1">
                {renderFolderTree(null)}
                {!folders.length && newFolderName === null && <div className="px-2 py-3 text-xs text-muted-foreground">暂无文件夹，点击右上角添加</div>}
              </div>}
            </section>}
            {source === 'online' && <>
              <section className="px-0 pb-1" data-filter-section="case-sources">
                <div className="mb-1 flex h-8 items-center text-xs font-medium text-muted-foreground">来源</div>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setCaseSourceTab('all')}
                    aria-pressed={caseSourceTab === 'all'}
                    className={cn(
                      'flex h-8 w-full items-center justify-between rounded-md px-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]',
                      caseSourceTab === 'all' && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]',
                    )}
                  >
                    <span>全部来源</span><span className="text-[11px] opacity-60">{caseItems.length}</span>
                  </button>
                  {caseSources.map((sourceItem) => (
                    <button
                      key={sourceItem.id}
                      type="button"
                      onClick={() => setCaseSourceTab(sourceItem.id)}
                      aria-pressed={caseSourceTab === sourceItem.id}
                      title={sourceItem.homepageUrl || sourceItem.name}
                      className={cn(
                        'flex h-8 w-full items-center justify-between rounded-md px-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]',
                        caseSourceTab === sourceItem.id && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]',
                      )}
                    >
                      <span className="min-w-0 truncate">{sourceItem.name}</span><span className="ml-2 shrink-0 text-[11px] opacity-60">{sourceItem.itemCount}</span>
                    </button>
                  ))}
                  {!caseSources.length && <div className="px-2.5 py-3 text-xs text-muted-foreground">暂无来源</div>}
                </div>
              </section>
              <section className="px-0 py-1" data-filter-section="case-tags">
                <div className="mb-1 flex h-8 items-center text-xs font-medium text-muted-foreground">
                  <span>标签</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setCaseTag('')}
                    aria-pressed={!caseTag}
                    className={cn(
                      'flex h-7 w-auto max-w-full items-center rounded bg-transparent px-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]',
                      !caseTag && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]',
                    )}
                  >
                    <span>全部标签</span>
                  </button>
                  {caseTagCounts.map((tag) => {
                    const active = caseTag === tag.name;
                    return <button
                      key={tag.name}
                      type="button"
                      onClick={() => setCaseTag(tag.name)}
                      aria-pressed={active}
                      className={cn(
                        'flex h-7 w-auto max-w-full items-center gap-1.5 rounded bg-transparent px-2.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]',
                        active && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]',
                      )}
                    >
                      <span className="min-w-0 truncate">{tag.name}</span>
                    </button>;
                  })}
                  {!caseTagCounts.length && <div className="py-3 text-xs text-muted-foreground">暂无标签</div>}
                </div>
              </section>
            </>}
          </nav>
        </aside>}
      {source === 'online' ? (
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {visibleCaseItems.length ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleCaseItems.map((item) => {
              const sourceItem = caseSources.find((entry) => entry.id === item.sourceId);
              const saved = savedCaseIds.has(item.id);
              let sourceHost = '';
              try { sourceHost = item.sourceUrl ? new URL(item.sourceUrl).hostname.replace(/^www\./, '') : ''; } catch { /* ignore malformed upstream item URL */ }
              return <article
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`查看案例详情：${item.title}`}
                onClick={() => setSelectedCase(item)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                  event.preventDefault();
                  setSelectedCase(item);
                }}
                className="group overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  {item.coverUrl ? <>
                    {isCaseVideo(item)
                      ? <video src={item.coverUrl} muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
                      : <img src={item.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/45 to-transparent" aria-hidden="true" />
                      <div className="relative z-10 flex items-center gap-3">
                        <Button type="button" variant="ghost" size="iconSm" onClick={(event) => { event.stopPropagation(); downloadCaseImage(item); }} aria-label={`下载${item.title}`} title={isCaseVideo(item) ? '下载视频' : '下载图片'} className="h-10 w-10 bg-black/60 p-0 text-white shadow-lg hover:bg-black/85 hover:text-white"><CaseActionIcon kind="download" /></Button>
                        <Button type="button" variant="ghost" size="iconSm" onClick={(event) => { event.stopPropagation(); void saveCaseToAssets(item); }} disabled={saved} aria-label={saved ? `${item.title}已收藏` : `添加${item.title}至收藏`} title={saved ? '已收藏' : '添加至收藏'} className={cn('h-10 w-10 bg-black/60 p-0 text-white shadow-lg hover:bg-black/85 hover:text-white', saved && 'cursor-default bg-white/20 text-white/45 hover:bg-white/20 hover:text-white/45')}><CaseActionIcon kind="save" /></Button>
                        <Button type="button" variant="ghost" size="iconSm" onClick={(event) => { event.stopPropagation(); setSelectedCase(item); }} aria-label={`全屏查看${item.title}`} title="全屏查看" className="h-10 w-10 bg-black/60 p-0 text-white shadow-lg hover:bg-black/85 hover:text-white"><CaseActionIcon kind="fullscreen" /></Button>
                      </div>
                    </div>
                  </> : <div className="grid h-full place-items-center text-xs text-muted-foreground">暂无封面</div>}
                </div>
                <div className="space-y-2 p-3">
                  <h2 className="truncate text-sm font-semibold">{item.title}</h2>
                  <p className="truncate text-xs leading-5 text-muted-foreground">{item.prompt}</p>
                  <div className="flex min-h-5 flex-wrap gap-1">{item.tags.slice(0, 4).map((tag) => <button key={tag} type="button" onClick={(event) => { event.stopPropagation(); setCaseTag(tag); }} className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]">{tag}</button>)}</div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate" title={sourceItem?.name || item.author || '公开来源'}>{sourceHost || sourceItem?.name || item.author || '公开来源'}</span>
                    {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="shrink-0 hover:text-foreground">查看来源</a> : null}
                  </div>
                </div>
              </article>;
            })}</div> : <div className="flex h-full items-center justify-center px-6"><div className="flex max-w-sm flex-col items-center text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-control)] text-[var(--surface-control-foreground)]">
                <Globe2 size={20} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-semibold">暂无案例资源</h2>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">接入案例资源来源后，内容会显示在这里。</p>
            </div></div>}
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
          <div className="flex items-center gap-2">
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
            <div className="relative">
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
            {source === 'uploaded' && <div className="w-[104px]">
              <Select
                value={type}
                onChange={(event) => {
                  setType(event.target.value as AssetTypeFilter);
                  setFolderId('');
                  setTagIds([]);
                  setOffset(0);
                }}
                options={[
                  { value: '', label: '全部类型' },
                  ...assetTypeOptions.map((option) => ({ value: option.id, label: option.label })),
                ]}
                aria-label="按文件类型筛选"
                selectSize="sm"
                className="border-transparent bg-transparent pl-2 pr-7 font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
              />
            </div>}
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
      {folderContextMenu && contextFolder && <>
        <div
          className="fixed inset-0 z-[99]"
          aria-hidden="true"
          onMouseDown={() => setFolderContextMenu(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            setFolderContextMenu(null);
          }}
        />
        <Card
          role="menu"
          aria-label={`${contextFolder.name} 操作`}
          style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
          padding="sm"
          className="fixed z-[100] w-52 p-1.5 shadow-lg"
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => openFolderCreator(null)} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs"><FolderPlus size={15} className="text-muted-foreground" />新建文件夹</Button>
          <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => openFolderCreator(contextFolder.id)} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs"><FolderPlus size={15} className="text-muted-foreground" />新建子文件夹</Button>
          <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => startRenamingFolder(contextFolder)} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs"><Pencil size={15} className="text-muted-foreground" />重命名</Button>
          <Separator className="my-1" />
          <Button type="button" variant="ghost" size="sm" role="menuitem" onClick={() => { setFolderContextMenu(null); void deleteFolder(contextFolder); }} className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15} />删除</Button>
        </Card>
      </>}
      {selectedCase && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label={`${selectedCase.title}详情`} onClick={() => setSelectedCase(null)}>
          <aside className="flex h-screen w-screen flex-col overflow-hidden bg-black/25 text-white shadow-2xl backdrop-blur-xl" onClick={(event) => event.stopPropagation()}>
            <header className="flex h-12 w-full shrink-0 items-center justify-between gap-4 px-4">
              <span className="min-w-0 truncate text-sm font-semibold" title={selectedCase.title}>{selectedCase.title}</span>
              <div className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white/10 text-white/85 backdrop-blur-xl">
                {selectedCase.coverUrl ? <>
                  <Button type="button" variant="ghost" size="iconSm" onClick={() => downloadCaseImage(selectedCase)} aria-label={isCaseVideo(selectedCase) ? '下载视频' : '下载图片'} title={isCaseVideo(selectedCase) ? '下载视频' : '下载图片'} className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"><Download size={15} /></Button>
                  <Button type="button" variant="ghost" size="iconSm" onClick={() => void saveCaseToAssets(selectedCase)} disabled={savedCaseIds.has(selectedCase.id)} aria-label={savedCaseIds.has(selectedCase.id) ? '已收藏' : '添加至收藏'} title={savedCaseIds.has(selectedCase.id) ? '已收藏' : '添加至收藏'} className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"><BookmarkPlus size={15} /></Button>
                </> : null}
                <Button type="button" variant="ghost" size="iconSm" onClick={() => setSelectedCase(null)} aria-label="关闭详情" title="关闭详情" className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"><X size={16} /></Button>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col items-stretch md:flex-row">
              <div className="relative flex min-h-[280px] min-w-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4">
                {selectedCase.coverUrl
                  ? isCaseVideo(selectedCase)
                    ? <video src={selectedCase.coverUrl} controls playsInline className="max-h-full max-w-full rounded-md object-contain" />
                    : <img src={selectedCase.coverUrl} alt={selectedCase.title} className="block max-h-full max-w-full rounded-md object-contain" />
                  : <div className="grid h-full w-full place-items-center text-sm text-white/55">暂无封面</div>}
              </div>
              <div className="flex min-h-0 w-full flex-col border-t border-white/10 bg-black/45 text-white backdrop-blur-xl md:mb-4 md:mr-2 md:max-w-[400px] md:rounded-xl md:border md:border-white/10 md:shadow-lg">
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  <section className="space-y-3 rounded-lg bg-white/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-white/75">提示词</span>
                      <Button type="button" variant="ghost" size="iconSm" onClick={() => void navigator.clipboard?.writeText(selectedCase.prompt || selectedCase.description)} aria-label="复制提示词" title="复制提示词" className="h-7 w-7 text-white/70 hover:bg-white/10 hover:text-white"><Copy size={13} /></Button>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white">{selectedCase.prompt || selectedCase.description || '暂无提示词'}</p>
                  </section>
                  <section className="space-y-3 rounded-lg bg-white/10 p-3">
                    <span className="text-xs font-medium text-white/75">案例信息</span>
                    <dl className="space-y-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">模型</dt><dd className="truncate font-medium text-white" title={selectedCase.imageModel}>{selectedCase.imageModel || '未记录'}</dd></div>
                      <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">来源</dt><dd className="truncate font-medium text-white">{caseSources.find((item) => item.id === selectedCase.sourceId)?.name || selectedCase.author || '公开来源'}</dd></div>
                    </dl>
                    {selectedCase.tags.length ? <div className="flex flex-wrap gap-1">{selectedCase.tags.map((tag) => <button key={tag} type="button" onClick={() => { setCaseTag(tag); setSelectedCase(null); }} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/75 transition-colors hover:bg-white/20 hover:text-white">{tag}</button>)}</div> : null}
                    {selectedCase.sourceUrl ? <a href={selectedCase.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white">查看来源</a> : null}
                  </section>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
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
