import { FavoriteIcon } from '../ui/FavoriteIcon';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Globe2,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
} from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { assetService } from '../../services/assetService';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/Dialog';
import { getCasePlaybackUrl, getCaseVideoUrl, isCaseVideo } from './caseMedia';
import { CaseVideoPlayer } from './CaseVideoPlayer';
import { CASE_PAGE_SIZE, paginateCases } from './casePagination';

export type CaseItem = {
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
  videoUrl?: string | null;
};

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

const CaseActionIcon = ({ kind, saved = false }: { kind: 'download' | 'save'; saved?: boolean }) => {
  return <span className="grid h-6 w-6 shrink-0 place-items-center">{kind === 'save' ? <FavoriteIcon saved={saved} size={16} /> : <Download size={16} aria-hidden="true" />}</span>;
};

const CaseCover = ({ item }: { item: CaseItem }) => {
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const playbackUrl = getCasePlaybackUrl(item);
  return <div className="relative aspect-[16/10] overflow-hidden bg-muted" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    {hovered && playbackUrl ? <CaseVideoPlayer src={playbackUrl} poster={getCaseVideoUrl(item) ? undefined : item.coverUrl || undefined} preview />
      : !item.coverUrl || failed ? <div className="grid h-full place-items-center text-xs text-muted-foreground">{failed ? '封面加载失败，点击查看详情' : '暂无封面'}</div>
      : getCaseVideoUrl(item)
        ? <video src={item.coverUrl} muted playsInline preload="none" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        : <img src={item.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
    {isCaseVideo(item) && <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[11px] text-white"><Play size={12} aria-hidden="true" />视频案例</span>}
  </div>;
};

// 案例资源的状态与操作；布局外壳仍由 AssetLibraryPage 提供，各区块组件按位置嵌入。
export const useCaseLibrary = ({
  query,
  enabled,
  onError,
  onNotice,
  onSaved,
}: {
  query: string;
  enabled: boolean;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSaved: () => void;
}) => {
  const [caseTab, setCaseTab] = useState('all');
  const [caseSourceTab, setCaseSourceTab] = useState('all');
  const [caseTag, setCaseTag] = useState('');
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [caseSources, setCaseSources] = useState<Array<{ id: string; name: string; homepageUrl: string | null; itemCount: number }>>([]);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [savedCaseIds, setSavedCaseIds] = useState<Set<string>>(new Set());
  const [caseAssetIdsByCaseId, setCaseAssetIdsByCaseId] = useState<Record<string, string>>({});
  const pendingFavoriteIds = useRef(new Set<string>());
  const [pagination, setPagination] = useState({ key: '', page: 1 });

  useEffect(() => {
    if (!enabled) return;
    const loadCases = () => Promise.all([
      assetService.cases(query),
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
    }).catch((caught) => onError(caught instanceof Error ? caught.message : '案例读取失败'));
    void loadCases();
    window.addEventListener('design-work:prompt-sources-updated', loadCases);
    return () => window.removeEventListener('design-work:prompt-sources-updated', loadCases);
  }, [enabled, onError, query]);

  const downloadCaseImage = (item: CaseItem) => {
    const url = getCaseVideoUrl(item) || item.coverUrl;
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${item.title || (isCaseVideo(item) ? 'case-video' : 'case-image')}.${getCaseVideoUrl(item) ? 'mp4' : 'jpg'}`;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.click();
  };

  const copyCasePrompt = async (item: CaseItem) => {
    try {
      await navigator.clipboard.writeText(item.prompt || item.description);
      onNotice('提示词已复制');
    } catch {
      onError('复制失败，请检查剪贴板权限后重试');
    }
  };

  const toggleCaseFavorite = async (item: CaseItem) => {
    if (!item.coverUrl || pendingFavoriteIds.current.has(item.id)) return;
    pendingFavoriteIds.current.add(item.id);
    const favorite = !savedCaseIds.has(item.id);
    try {
      const existingAssetId = caseAssetIdsByCaseId[item.id];
      if (existingAssetId) {
        await assetService.update(existingAssetId, { favorite });
      } else {
        const created = await assetService.create({
          type: getCaseVideoUrl(item) ? 'video' : 'image',
          title: item.title,
          description: item.prompt || item.description,
          sourceUrl: getCaseVideoUrl(item) || item.coverUrl,
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
      setSavedCaseIds((current) => {
        const next = new Set(current);
        if (favorite) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
      onNotice(favorite ? '已添加至收藏' : '已取消收藏');
      onSaved();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : '更新收藏失败');
    } finally {
      pendingFavoriteIds.current.delete(item.id);
    }
  };

  const reset = () => {
    setCaseTag('');
    setCaseTab('all');
    setCaseSourceTab('all');
  };

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
  const paginationKey = JSON.stringify([query, caseSourceTab, caseTab, caseTag]);
  // 筛选发生变化即重置，切回旧分类也不恢复旧页码。
  if (pagination.key !== paginationKey) setPagination({ key: paginationKey, page: 1 });
  const casePagination = paginateCases(visibleCaseItems, pagination.key === paginationKey ? pagination.page : 1);

  return {
    caseTab,
    setCaseTab,
    caseSourceTab,
    setCaseSourceTab,
    caseTag,
    setCaseTag,
    caseItems,
    caseSources,
    selectedCase,
    setSelectedCase,
    savedCaseIds,
    caseTagCounts,
    visibleCaseItems,
    pagedCaseItems: casePagination.items,
    casePage: casePagination.page,
    casePageCount: casePagination.pageCount,
    casePageStart: casePagination.start,
    paginationKey,
    setCasePage: (page: number) => setPagination({ key: paginationKey, page }),
    downloadCaseImage,
    copyCasePrompt,
    toggleCaseFavorite,
    reset,
  };
};

export type CaseLibraryState = ReturnType<typeof useCaseLibrary>;

export const CaseTabs = ({ cases }: { cases: CaseLibraryState }) => {
  const { caseTab, setCaseTab, setCaseTag } = cases;
  return <div role="tablist" aria-label="案例分类" className="order-1 flex min-w-0 items-center gap-1 overflow-x-auto">
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
  </div>;
};

export const CaseFilterSections = ({ cases }: { cases: CaseLibraryState }) => {
  const { caseItems, caseSources, caseSourceTab, setCaseSourceTab, caseTag, setCaseTag, caseTagCounts } = cases;
  return <>
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
  </>;
};

export const CaseGrid = ({ cases }: { cases: CaseLibraryState }) => {
  const { visibleCaseItems, pagedCaseItems, casePage, casePageCount, casePageStart, paginationKey, setCasePage, caseSources, savedCaseIds, setSelectedCase, setCaseTag, downloadCaseImage, copyCasePrompt, toggleCaseFavorite } = cases;
  return <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
    <div key={`${paginationKey}:${casePage}`} className="min-h-0 flex-1 overflow-y-auto p-4">
      {visibleCaseItems.length ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{pagedCaseItems.map((item) => {
        const sourceItem = caseSources.find((entry) => entry.id === item.sourceId);
        const saved = savedCaseIds.has(item.id);
        let sourceHost = '';
        try { sourceHost = item.sourceUrl ? new URL(item.sourceUrl).hostname.replace(/^www\./, '') : ''; } catch { /* ignore malformed upstream item URL */ }
        return <article
          key={item.id}
          role="button"
          tabIndex={0}
          aria-label={`全屏查看案例：${item.title}`}
          onClick={() => setSelectedCase(item)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            setSelectedCase(item);
          }}
          className="cursor-pointer overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CaseCover key={item.coverUrl} item={item} />
          <div className="space-y-2 p-3">
            <h2 className="truncate text-sm font-semibold">{item.title}</h2>
            <p className="truncate text-xs leading-5 text-muted-foreground">{item.prompt}</p>
            <div className="flex min-h-5 flex-wrap gap-1">{item.tags.slice(0, 4).map((tag) => <button key={tag} type="button" onClick={(event) => { event.stopPropagation(); setCaseTag(tag); }} className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]">{tag}</button>)}</div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <div className="flex min-w-0 flex-1 items-center">
                {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="min-w-0 truncate hover:text-foreground" title={sourceHost || sourceItem?.name || item.author || '公开来源'}>来源：{sourceHost || sourceItem?.name || item.author || '公开来源'}</a> : <span className="min-w-0 truncate" title={sourceItem?.name || item.author || '公开来源'}>来源：{sourceItem?.name || item.author || '公开来源'}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                {item.coverUrl && <>
                <Button type="button" variant="ghost" size="iconSm" onClick={() => downloadCaseImage(item)} aria-label={`下载${item.title}`} title={getCaseVideoUrl(item) ? '下载视频' : isCaseVideo(item) ? '下载封面' : '下载图片'} className="h-8 w-8 p-0"><CaseActionIcon kind="download" /></Button>
                <Button type="button" variant="ghost" size="iconSm" onClick={() => { void toggleCaseFavorite(item); }} aria-pressed={saved} aria-label={saved ? `取消${item.title}收藏` : `添加${item.title}至收藏`} title={saved ? '取消收藏' : '添加至收藏'} className="h-8 w-8 p-0"><CaseActionIcon kind="save" saved={saved} /></Button>
                </>}
                <Button type="button" variant="ghost" size="iconSm" onClick={() => { void copyCasePrompt(item); }} disabled={!(item.prompt || item.description)} aria-label={`复制${item.title}提示词`} title="复制提示词" className="h-8 w-8 p-0"><Copy size={16} aria-hidden="true" /></Button>
              </div>
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
    <nav aria-label="案例分页" className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-4 py-3 text-xs text-muted-foreground">
      <span className="mr-2 tabular-nums">共 {visibleCaseItems.length} 条 / 每页 {CASE_PAGE_SIZE} 条{visibleCaseItems.length ? ` / ${casePageStart + 1}–${casePageStart + pagedCaseItems.length}` : ''}</span>
      <Button type="button" variant="ghost" size="iconSm" aria-label="上一页案例" title="上一页" disabled={casePage <= 1} onClick={() => setCasePage(casePage - 1)}><ChevronLeft size={16} /></Button>
      <span className="tabular-nums text-foreground" aria-live="polite">{casePage} / {casePageCount}</span>
      <Button type="button" variant="ghost" size="iconSm" aria-label="下一页案例" title="下一页" disabled={casePage >= casePageCount} onClick={() => setCasePage(casePage + 1)}><ChevronRight size={16} /></Button>
    </nav>
  </main>;
};

export const CaseDetailOverlay = ({ cases }: { cases: CaseLibraryState }) => {
  const { selectedCase, setSelectedCase, savedCaseIds, caseSources, setCaseTag, downloadCaseImage, toggleCaseFavorite } = cases;
  const returnFocusRef = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={Boolean(selectedCase)} onOpenChange={(open) => !open && setSelectedCase(null)}>
      {selectedCase && <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/30 backdrop-blur-xl"
        aria-label={`${selectedCase.title}详情`}
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          // Cases open from a separate grid, without a DialogTrigger to restore focus to.
          if (returnFocusRef.current?.isConnected) {
            event.preventDefault();
            returnFocusRef.current.focus();
          }
        }}
        className="!inset-0 !left-0 !top-0 !h-screen !w-screen !max-w-none !translate-x-0 !translate-y-0 !gap-0 !rounded-none !border-0 !bg-transparent !p-0 !shadow-none"
      >
        <aside className="flex h-screen w-screen flex-col overflow-hidden bg-black/25 text-white shadow-2xl backdrop-blur-xl">
        <header className="flex h-12 w-full shrink-0 items-center justify-between gap-4 px-4">
          <DialogTitle className="min-w-0 truncate text-sm font-semibold leading-5 tracking-normal" title={selectedCase.title}>{selectedCase.title}</DialogTitle>
          <DialogDescription className="sr-only">案例详情及媒体预览</DialogDescription>
          <div className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white/10 text-white/85 backdrop-blur-xl">
            {selectedCase.coverUrl ? <>
              <Button type="button" variant="ghost" size="iconSm" onClick={() => downloadCaseImage(selectedCase)} aria-label={getCaseVideoUrl(selectedCase) ? '下载视频' : isCaseVideo(selectedCase) ? '下载封面' : '下载图片'} title={getCaseVideoUrl(selectedCase) ? '下载视频' : isCaseVideo(selectedCase) ? '下载封面' : '下载图片'} className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"><Download size={15} /></Button>
              <Button type="button" variant="ghost" size="iconSm" onClick={() => void toggleCaseFavorite(selectedCase)} aria-pressed={savedCaseIds.has(selectedCase.id)} aria-label={savedCaseIds.has(selectedCase.id) ? '取消收藏' : '添加至收藏'} title={savedCaseIds.has(selectedCase.id) ? '取消收藏' : '添加至收藏'} className="h-8 w-8 text-white hover:bg-white/10 hover:text-white disabled:opacity-100"><FavoriteIcon saved={savedCaseIds.has(selectedCase.id)} size={15} /></Button>
            </> : null}
            <Button type="button" variant="ghost" size="iconSm" onClick={() => setSelectedCase(null)} aria-label="关闭详情" title="关闭详情" className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"><X size={16} /></Button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col items-stretch md:flex-row">
          <div className="relative flex min-h-[280px] min-w-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4">
            {getCasePlaybackUrl(selectedCase)
              ? <CaseVideoPlayer key={selectedCase.id} src={getCasePlaybackUrl(selectedCase)!} poster={getCaseVideoUrl(selectedCase) ? undefined : selectedCase.coverUrl || undefined} />
              : selectedCase.coverUrl
              ? <img src={selectedCase.coverUrl} alt={selectedCase.title} className="block max-h-full max-w-full rounded-md object-contain" />
              : <div className="grid h-full w-full place-items-center text-sm text-white/55">暂无封面</div>}
          </div>
          <div className="flex min-h-0 w-full flex-col border-t border-white/10 bg-black/45 text-white backdrop-blur-xl md:mb-4 md:mr-2 md:max-w-[400px] md:rounded-xl md:border md:border-white/10 md:shadow-lg">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {isCaseVideo(selectedCase) && !getCasePlaybackUrl(selectedCase) && <p className="rounded-lg bg-white/10 p-3 text-xs leading-5 text-white/75">当前来源仅提供视频封面，未提供可播放的视频地址。可通过下方“查看来源”访问原视频。</p>}
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
      </DialogContent>}
    </Dialog>
  );
};
