import { useEffect, useState } from 'react';
import {
  Copy,
  Download,
  Pencil,
  Plus,
  Trash2,
  X,
} from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { assetService } from '../../services/assetService';
import type { AssetDetail, AssetFolder, AssetSummary, AssetTag } from '../../types/asset.types';
import { AssetThumbnail } from './AssetThumbnail';
import { Button, Label, Skeleton } from '../ui';

interface AssetDetailPanelProps {
  assetId: string | null;
  selectedAsset?: AssetSummary | null;
  assets: AssetSummary[];
  onSelectAsset: (asset: AssetSummary) => void;
  folders: AssetFolder[];
  availableTags: AssetTag[];
  onClose: () => void;
  onChanged: () => void;
}

export const AssetDetailPanel = ({
  assetId,
  selectedAsset,
  assets,
  onSelectAsset,
  folders: _folders,
  availableTags,
  onClose,
  onChanged,
}: AssetDetailPanelProps) => {
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');
  const [assetTags, setAssetTags] = useState<AssetTag[]>([]);
  const [tagCatalog, setTagCatalog] = useState<AssetTag[]>(availableTags);
  const [tagInput, setTagInput] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [useRemotePreview, setUseRemotePreview] = useState(false);

  useEffect(() => {
    setDetail(null);
    setAssetTags([]);
    setTagInput('');
    setEditingTagId(null);
    setEditingTagName('');
    setUseRemotePreview(false);
    if (!assetId) return;
    let active = true;
    assetService
      .detail(assetId)
      .then((value) => {
        if (!active) return;
        setDetail(value);
        setTitle(value.title);
        setDescription(value.description || '');
        setAssetTags(value.tags);
      })
      .catch((error) => {
        if (!active) return;
        // 生成内容流中的临时卡片还未落库，没有可请求的详情记录，直接使用卡片数据展示。
        if (selectedAsset && selectedAsset.id === assetId) {
          setTitle(selectedAsset.title);
          setDescription(selectedAsset.description || '');
          setAssetTags([]);
          setDetail({
            ...selectedAsset,
            sourceUrl: null,
            author: null,
            licenseNote: null,
            tags: [],
            files: [],
            previews: [],
          });
          return;
        }
        setNotice(error instanceof Error ? error.message : '读取失败');
      });
    return () => {
      active = false;
    };
  }, [assetId, selectedAsset]);

  useEffect(() => setTagCatalog(availableTags), [availableTags]);

  useEffect(() => {
    if (!assetId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [assetId, onClose]);

  if (!assetId) return null;

  const generatedUrl = detail && typeof detail.userMetadata?.generatedUrl === 'string'
    ? detail.userMetadata.generatedUrl
    : '';
  const localMediaUrl = detail?.type === 'image' && detail.previewStatus === 'ready'
    ? detail.previewUrl
    : '';
  const mediaUrl = detail ? (useRemotePreview ? generatedUrl : localMediaUrl || generatedUrl) : '';
  const metadata = detail?.userMetadata || {};
  const prompt = String(metadata.prompt || detail?.description || '');
  const model = String(metadata.model || '未记录');
  const ratio = String(metadata.ratio || metadata.aspectRatio || '未记录');
  const resolution = String(metadata.resolution || metadata.size || '未记录');
  const quality = String(metadata.quality || '标准');

  const commitTitle = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setTitle(nextTitle);
    if (!detail || nextTitle === detail.title) return;
    try {
      const updated = await assetService.update(detail.id, { title: nextTitle });
      setDetail((current) => (current ? { ...current, title: updated.title } : current));
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '标题保存失败');
    }
  };

  const commitDescription = async () => {
    if (!detail || description === detail.description) return;
    try {
      const updated = await assetService.update(detail.id, { description });
      setDetail((current) => (current ? { ...current, description: updated.description } : current));
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '注释保存失败');
    }
  };

  const addTag = async (requestedName?: string) => {
    if (!detail) return;
    const name = (requestedName || tagInput).trim();
    if (!name) return;
    try {
      let tag = tagCatalog.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (!tag) {
        tag = await assetService.createTag(name);
        setTagCatalog((current) => [...current, tag as AssetTag]);
      }
      if (assetTags.some((item) => item.id === tag?.id)) {
        setTagInput('');
        return;
      }
      await assetService.bulkTags([detail.id], [tag.id], 'add');
      setAssetTags((current) => [...current, tag as AssetTag]);
      setTagInput('');
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '添加标签失败');
    }
  };

  const removeTag = async (tag: AssetTag) => {
    if (!detail) return;
    try {
      await assetService.bulkTags([detail.id], [tag.id], 'remove');
      setAssetTags((current) => current.filter((item) => item.id !== tag.id));
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '移除标签失败');
    }
  };

  const renameTag = async (tag: AssetTag) => {
    const nextName = editingTagName.trim();
    setEditingTagId(null);
    setEditingTagName('');
    if (!nextName || nextName === tag.name) return;
    try {
      const updated = await assetService.renameTag(tag.id, nextName);
      setTagCatalog((current) => current.map((item) => (item.id === tag.id ? updated : item)));
      setAssetTags((current) => current.map((item) => (item.id === tag.id ? updated : item)));
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '重命名标签失败');
    }
  };

  const deleteTag = async (tag: AssetTag) => {
    if (!window.confirm(`删除标签「${tag.name}」？`)) return;
    try {
      if (assetTags.some((item) => item.id === tag.id) && detail) {
        await assetService.bulkTags([detail.id], [tag.id], 'remove');
      }
      await assetService.deleteTag(tag.id);
      setTagCatalog((current) => current.filter((item) => item.id !== tag.id));
      setAssetTags((current) => current.filter((item) => item.id !== tag.id));
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除标签失败');
    }
  };

  const copyPrompt = async () => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(prompt);
      setNotice('提示词已复制');
    } catch {
      setNotice('复制失败');
    }
  };

  const deleteAsset = async () => {
    if (!detail || !window.confirm(`删除资产「${title || '未命名资产'}」？`)) return;
    try {
      await assetService.remove(detail.id);
      onClose();
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除资产失败');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="flex h-screen w-screen flex-col overflow-hidden bg-black/25 text-white shadow-2xl backdrop-blur-xl" onMouseDown={(event) => event.stopPropagation()}>
      {!detail ? (
        <div className="space-y-4 p-5">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
        <div className="flex h-12 w-full shrink-0 items-center justify-between px-4">
          <div className="min-w-0 max-w-[min(50vw,420px)]">
            <span className="truncate text-sm font-semibold text-white" title={title || '未命名资产'}>{title || '未命名资产'}</span>
          </div>
          <div className="flex h-8 items-center gap-1 rounded-lg bg-white/10 text-white/85 backdrop-blur-xl">
            {detail.previewUrl || typeof detail.userMetadata?.generatedUrl === 'string' ? (
              <a
                href={String(detail.userMetadata?.generatedUrl || detail.previewUrl)}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/15 hover:text-white"
                aria-label="下载资产"
                title="下载资产"
              >
                <Download size={15} />
              </a>
            ) : null}
            <Button variant="ghost" size="iconSm" onClick={() => void deleteAsset()} aria-label="删除资产" title="删除资产" className="h-8 w-8 text-white/70 hover:bg-red-500/20 hover:text-red-200">
              <Trash2 size={15} />
            </Button>
            <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="关闭详情" title="关闭详情" className="h-8 w-8">
              <X size={16} />
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-stretch md:flex-row">
          <div className="relative flex min-h-[280px] min-w-0 flex-1 items-center justify-center overflow-hidden bg-transparent px-4 md:mb-4 md:mt-0 md:min-h-0 md:self-stretch">
            {detail.type === 'video' && mediaUrl ? (
              <video src={mediaUrl} controls playsInline className="max-h-full max-w-full rounded-md object-contain" />
            ) : detail.type === 'audio' && mediaUrl ? (
              <audio src={mediaUrl} controls className="w-full max-w-md" />
            ) : detail.type === 'image' && mediaUrl ? (
              <img
                src={mediaUrl}
                alt={title || '资产预览'}
                className="block max-h-full max-w-full rounded-md object-contain"
                onError={() => {
                  if (!useRemotePreview && generatedUrl) {
                    setUseRemotePreview(true);
                    return;
                  }
                  setNotice('图片预览加载失败');
                }}
              />
            ) : (
              <AssetThumbnail
                asset={{
                  ...detail,
                  previewUrl: detail.previewUrl,
                  previewStatus: detail.previewStatus,
                }}
                fit={detail.type === 'image' ? 'contain' : 'cover'}
              />
            )}
          </div>
          <div className="flex min-h-0 w-full flex-col border-t border-white/10 bg-black/45 text-white backdrop-blur-xl md:mb-4 md:mr-2 md:mt-0 md:max-w-[400px] md:rounded-xl md:border md:border-white/10 md:shadow-lg">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {notice && <div role="status" className="text-center text-xs text-white/60">{notice}</div>}
            <section className="max-h-[560px] space-y-3 overflow-y-auto rounded-lg border-0 bg-white/10 p-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">提示词</Label>
                  <Button variant="ghost" size="iconSm" onClick={copyPrompt} aria-label="复制提示词" title="复制提示词" className="h-7 w-7 text-white/70 hover:bg-white/10 hover:text-white">
                    <Copy size={13} />
                  </Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white">{prompt || '暂无提示词'}</p>
              </div>
            </section>
            <section className="space-y-3 rounded-lg border-0 bg-white/10 p-3">
              <Label className="text-xs">模型参数</Label>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">模型</dt><dd className="truncate font-medium text-white" title={model}>{model}</dd></div>
                <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">比例</dt><dd className="truncate font-medium text-white">{ratio}</dd></div>
                <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">分辨率</dt><dd className="truncate font-medium text-white">{resolution}</dd></div>
                <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">质量</dt><dd className="truncate font-medium text-white">{quality}</dd></div>
              </dl>
            </section>
            <div className="!mt-4 space-y-2">
              <span className="text-xs font-medium text-white/75">信息</span>
              <div className="space-y-1">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => void commitTitle()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void commitTitle();
                  }
                }}
                aria-label="资产标题"
                placeholder="输入标题"
                className="h-8 w-full rounded-md border border-white/15 bg-white/10 px-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-white/35 focus:ring-2 focus:ring-white/15"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onBlur={() => void commitDescription()}
                aria-label="资产注释"
                placeholder="添加注释，记录这项资产的用途或灵感"
                rows={3}
                className="w-full resize-y rounded-md border border-white/15 bg-white/10 px-2 py-1.5 text-sm leading-5 text-white outline-none placeholder:text-white/45 focus:border-white/35 focus:ring-2 focus:ring-white/15"
              />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/75">标签</span>
                <Button type="button" variant="ghost" size="iconSm" onClick={() => void addTag()} disabled={!tagInput.trim()} aria-label="添加标签" title="添加标签" className="h-7 w-7 text-white/70 hover:bg-white/10 hover:text-white"><Plus size={14} /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assetTags.map((tag) => (
                  <span key={tag.id} className="group inline-flex h-7 items-center gap-1 rounded-md bg-white/15 pl-2 text-xs text-white">
                    {editingTagId === tag.id ? (
                      <input
                        autoFocus
                        value={editingTagName}
                        onChange={(event) => setEditingTagName(event.target.value)}
                        onBlur={() => void renameTag(tag)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void renameTag(tag);
                          }
                          if (event.key === 'Escape') {
                            setEditingTagId(null);
                            setEditingTagName('');
                          }
                        }}
                        aria-label={`编辑标签 ${tag.name}`}
                        className="h-6 w-[150px] min-w-0 rounded border border-white/25 bg-white/10 px-1 text-xs text-white outline-none focus:border-white/60"
                      />
                    ) : (
                      <span className="max-w-[150px] truncate">{tag.name}</span>
                    )}
                    {editingTagId !== tag.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTagId(tag.id);
                            setEditingTagName(tag.name);
                          }}
                          aria-label={`重命名标签 ${tag.name}`}
                          title="重命名标签"
                          className="grid h-6 w-5 place-items-center text-white/50 opacity-0 transition-colors group-hover:opacity-100 group-focus-within:opacity-100 hover:text-white"
                        >
                          <Pencil size={11} />
                        </button>
                        <button type="button" onClick={() => void removeTag(tag)} aria-label={`移除标签 ${tag.name}`} title="从资产移除" className="grid h-6 w-5 place-items-center text-white/50 opacity-0 transition-colors group-hover:opacity-100 group-focus-within:opacity-100 hover:text-white"><X size={11} /></button>
                        <button type="button" onClick={() => void deleteTag(tag)} aria-label={`删除标签 ${tag.name}`} title="删除标签" className="grid h-6 w-5 place-items-center pr-1 text-white/50 opacity-0 transition-colors group-hover:opacity-100 group-focus-within:opacity-100 hover:text-red-300"><Trash2 size={11} /></button>
                      </>
                    )}
                  </span>
                ))}
                {!assetTags.length && <span className="text-xs text-white/45">暂无标签</span>}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void addTag(); } }}
                  aria-label="搜索或添加标签"
                  placeholder="搜索或添加标签"
                  className="h-8 min-w-0 flex-1 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none placeholder:text-white/45 focus:border-white/35 focus:ring-2 focus:ring-white/15"
                />
              </div>
              {tagInput.trim() && (
                <div className="max-h-28 overflow-y-auto rounded-md bg-black/20 p-1">
                  {tagCatalog.filter((tag) => tag.name.toLowerCase().includes(tagInput.trim().toLowerCase()) && !assetTags.some((item) => item.id === tag.id)).map((tag) => (
                    <button key={tag.id} type="button" onClick={() => void addTag(tag.name)} className="block w-full rounded px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/10">{tag.name}</button>
                  ))}
                  {!tagCatalog.some((tag) => tag.name.toLowerCase() === tagInput.trim().toLowerCase()) && <button type="button" onClick={() => void addTag()} className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/10"><Plus size={12} /> 创建“{tagInput.trim()}”</button>}
                </div>
              )}
            </div>

          </div>
          </div>
          <nav aria-label="资产切换" className="order-last flex max-h-24 w-full shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-black/25 p-2 backdrop-blur-xl md:order-none md:mb-4 md:mr-4 md:mt-0 md:max-h-none md:w-[76px] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:rounded-xl md:border md:border-white/10 md:border-l-white/10">
            {assets.map((asset) => {
              const active = asset.id === assetId;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onSelectAsset(asset)}
                  aria-label={`切换到${asset.title || '未命名资产'}`}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-black/20 transition-colors',
                    active ? 'border-white ring-2 ring-white/30' : 'border-white/10 hover:border-white/45',
                  )}
                >
                  <AssetThumbnail asset={asset} fit="contain" />
                </button>
              );
            })}
          </nav>
        </div>
        </>
      )}
      </aside>
    </div>
  );
};
