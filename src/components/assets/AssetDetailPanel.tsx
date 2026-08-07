import { useEffect, useState } from 'react';
import { AlertTriangle, Check, File, Folder, Link, Save, Star, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { assetService } from '../../services/assetService';
import type { AssetDetail, AssetFolder, AssetTag } from '../../types/asset.types';
import { AssetThumbnail } from './AssetThumbnail';
import { Button, Card, Input, Label, Select, Skeleton, Textarea } from '../ui';

interface AssetDetailPanelProps {
  assetId: string | null;
  folders: AssetFolder[];
  availableTags: AssetTag[];
  onClose: () => void;
  onChanged: () => void;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

export const AssetDetailPanel = ({
  assetId,
  folders,
  availableTags,
  onClose,
  onChanged,
}: AssetDetailPanelProps) => {
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [author, setAuthor] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [favorite, setFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setDetail(null);
    if (!assetId) return;
    let active = true;
    assetService
      .detail(assetId)
      .then((value) => {
        if (!active) return;
        setDetail(value);
        setTitle(value.title);
        setDescription(value.description);
        setSourceUrl(value.sourceUrl || '');
        setAuthor(value.author || '');
        setFolderId(value.primaryFolderId);
        setRating(value.rating);
        setFavorite(value.favorite);
      })
      .catch((error) => active && setNotice(error instanceof Error ? error.message : '读取失败'));
    return () => {
      active = false;
    };
  }, [assetId]);

  if (!assetId) return null;

  const save = async () => {
    if (!detail || !title.trim()) return;
    setSaving(true);
    try {
      await assetService.update(detail.id, {
        title: title.trim(),
        description,
        sourceUrl: sourceUrl || null,
        author: author || null,
        primaryFolderId: folderId,
        rating,
        favorite,
      });
      setNotice('已保存');
      onChanged();
      window.setTimeout(() => setNotice(''), 1800);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = async (tag: AssetTag) => {
    if (!detail) return;
    const attached = detail.tags.some((item) => item.id === tag.id);
    await assetService.bulkTags([detail.id], [tag.id], attached ? 'remove' : 'add');
    setDetail(await assetService.detail(detail.id));
    onChanged();
  };

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-0 bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="text-sm font-semibold">资产详情</div>
        <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="关闭详情">
          <X size={15} />
        </Button>
      </div>
      {!detail ? (
        <div className="space-y-4 p-4">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div className="mx-4 flex max-h-[48vh] min-h-[240px] shrink-0 items-center justify-center overflow-auto rounded-lg bg-muted p-3">
            <AssetThumbnail
              asset={{
                ...detail,
                previewUrl: '',
                previewStatus: String(detail.previews[0]?.status || 'missing'),
              }}
              fit={detail.type === 'image' ? 'contain' : 'cover'}
            />
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <section className="space-y-3">
              <Input label="标题" inputSize="sm" value={title} onChange={(event) => setTitle(event.target.value)} className="font-semibold" />
              <Textarea label="描述与笔记" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="text-xs leading-5" />
            </section>

            <section className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Select
                  label="文件夹"
                  value={folderId || ''}
                  onChange={(event) => setFolderId(event.target.value || null)}
                  selectSize="sm"
                  options={[{ value: '', label: '未分类' }, ...folders.map((folder) => ({ value: folder.id, label: folder.name }))]}
                />
              </div>
              <Input label="作者" inputSize="sm" value={author} onChange={(event) => setAuthor(event.target.value)} />
              <div>
                <Label className="mb-1.5 block text-sm">来源链接</Label>
                <div className="relative"><Link size={12} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" /><Input inputSize="sm" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="pl-8" /></div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs">
                  标签
                </Label>
                <span className="text-xs text-muted-foreground">{detail.tags.length} 个</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.length ? (
                  availableTags.map((tag) => {
                    const active = detail.tags.some((item) => item.id === tag.id);
                    return (
                      <Button
                        key={tag.id}
                        type="button"
                        variant={active ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => toggleTag(tag)}
                        className="h-7 px-2 text-xs"
                      >
                        {active && <Check size={10} className="mr-1 inline" />}
                        {tag.name}
                      </Button>
                    );
                  })
                ) : (
                  <span className="text-xs text-muted-foreground">还没有标签</span>
                )}
              </div>
            </section>

            <Card padding="sm" variant="solid">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  评分与收藏
                </span>
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={() => setFavorite(!favorite)}
                  aria-label={favorite ? '取消收藏' : '收藏'}
                  className={cn('h-7 w-7', favorite ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15' : 'text-muted-foreground')}
                >
                  <Star size={14} className={favorite ? 'fill-current' : ''} />
                </Button>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    onClick={() => setRating(value === rating ? 0 : value)}
                    aria-label={`${value} 星`}
                    className="h-7 w-7"
                  >
                    <Star
                      size={15}
                      className={cn(
                        value <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-zinc-700',
                      )}
                    />
                  </Button>
                ))}
              </div>
            </Card>

            <section>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                原文件引用
              </div>
              <div className="space-y-2">
                {detail.files.length ? (
                  detail.files.map((file) => (
                    <Card
                      key={file.id}
                      padding="sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'grid h-7 w-7 place-items-center rounded-lg',
                            file.status === 'online'
                              ? 'bg-[#c8ff00]/20 text-[#587100] dark:bg-[#c8ff00]/10 dark:text-[#c8ff00]'
                              : 'bg-amber-50 text-amber-600',
                          )}
                        >
                          {file.status === 'online' ? (
                            <File size={13} />
                          ) : (
                            <AlertTriangle size={13} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{file.fileName}</div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {formatBytes(file.fileSize)} · {file.status}
                          </div>
                        </div>
                      </div>
                      <div
                        className="mt-2 truncate font-mono text-xs text-slate-400"
                        title={file.absolutePath}
                      >
                        {file.absolutePath}
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                    <Folder size={14} /> 该资产没有原文件
                  </div>
                )}
              </div>
            </section>
          </div>
          <div className="shrink-0 border-t border-border p-3">
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              loading={saving}
              disabled={!title.trim()}
              className="w-full"
            >
              {!saving && <Save size={14} />}
              {saving ? '保存中' : '保存更改'}
            </Button>
            {notice && (
              <div role="status" className="mt-2 text-center text-xs text-muted-foreground">
                {notice}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
