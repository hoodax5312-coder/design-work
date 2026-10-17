import { useEffect, useMemo, useState } from 'react';
import {
  Heart,
  Copy,
  Download,
  Globe2,
  Maximize2,
  X,
} from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { assetService } from '../../services/assetService';
import { Button } from '../ui';
import { isCaseVideo } from './caseMedia';

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

const CaseActionIcon = ({ kind }: { kind: 'download' | 'save' | 'fullscreen' }) => {
  const Icon = kind === 'download' ? Download : kind === 'save' ? Heart : Maximize2;
  const opticalScale = kind === 'save' ? 'scale-[1.15]' : kind === 'fullscreen' ? 'scale-[0.95]' : 'scale-[1.05]';
  return <span className="grid h-6 w-6 shrink-0 place-items-center"><Icon size={20} className={opticalScale} aria-hidden="true" /></span>;
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

  useEffect(() => {
    if (!selectedCase) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCase(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedCase]);

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
      onNotice('已添加至收藏');
      onSaved();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : '添加至收藏失败');
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
    downloadCaseImage,
    saveCaseToAssets,
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
  const { visibleCaseItems, caseSources, savedCaseIds, setSelectedCase, setCaseTag, downloadCaseImage, saveCaseToAssets } = cases;
  return <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
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
  </main>;
};

export const CaseDetailOverlay = ({ cases }: { cases: CaseLibraryState }) => {
  const { selectedCase, setSelectedCase, savedCaseIds, caseSources, setCaseTag, downloadCaseImage, saveCaseToAssets } = cases;
  if (!selectedCase) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label={`${selectedCase.title}详情`} onClick={() => setSelectedCase(null)}>
      <aside className="flex h-screen w-screen flex-col overflow-hidden bg-black/25 text-white shadow-2xl backdrop-blur-xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex h-12 w-full shrink-0 items-center justify-between gap-4 px-4">
          <span className="min-w-0 truncate text-sm font-semibold" title={selectedCase.title}>{selectedCase.title}</span>
          <div className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white/10 text-white/85 backdrop-blur-xl">
            {selectedCase.coverUrl ? <>
              <Button type="button" variant="ghost" size="iconSm" onClick={() => downloadCaseImage(selectedCase)} aria-label={isCaseVideo(selectedCase) ? '下载视频' : '下载图片'} title={isCaseVideo(selectedCase) ? '下载视频' : '下载图片'} className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"><Download size={15} /></Button>
              <Button type="button" variant="ghost" size="iconSm" onClick={() => void saveCaseToAssets(selectedCase)} disabled={savedCaseIds.has(selectedCase.id)} aria-label={savedCaseIds.has(selectedCase.id) ? '已收藏' : '添加至收藏'} title={savedCaseIds.has(selectedCase.id) ? '已收藏' : '添加至收藏'} className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"><Heart size={15} /></Button>
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
  );
};
