import { useEffect, useMemo, useState } from 'react';
import { Download, Folder, FolderInput, FolderOpen, Heart, HeartFill, Maximize2, Pencil, Trash2 } from '@/lib/remixIconShim';
import { assetService } from '../../services/assetService';
import type { AssetFolder } from '../../types/asset.types';
import { AnchoredMenu, type ScreenPoint } from '../canvas/CanvasContextMenu';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  Input,
} from '../ui';

const NO_FOLDER = '__none__';

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

/** 按父子关系排好顺序，子文件夹缩进显示。 */
const orderFolders = (folders: AssetFolder[]) => {
  const children = new Map<string | null, AssetFolder[]>();
  folders.forEach((folder) => children.set(folder.parentId, [...(children.get(folder.parentId) || []), folder]));
  const ordered: Array<{ folder: AssetFolder; depth: number }> = [];
  const walk = (parentId: string | null, depth: number) => {
    (children.get(parentId) || []).forEach((folder) => {
      ordered.push({ folder, depth });
      walk(folder.id, depth + 1);
    });
  };
  walk(null, 0);
  // 父文件夹不在列表里的也要显示，避免漏掉。
  folders.forEach((folder) => {
    if (!ordered.some((item) => item.folder.id === folder.id)) ordered.push({ folder, depth: 0 });
  });
  return ordered;
};

export interface GeneratedImageMenuTarget {
  point: ScreenPoint;
  url: string;
  saved: boolean;
  /** 已知资产 ID 时直接使用，不再调用 ensureAsset（例如资产库里的素材）。 */
  assetId?: string;
}

/**
 * 生成结果图片的右键菜单，参考 Eagle：全屏、收藏、移动至文件夹、重命名、在访达中显示、导出、删除。
 * 除全屏与删除记录外，其余操作都作用于这张图片在资产库里的资产。
 */
export const GeneratedImageMenu = ({
  target,
  onClose,
  ensureAsset,
  onFullscreen,
  onSave,
  allowUnsave = false,
  onDelete,
  onNotice,
  onError,
  headerLabel,
  deleteLabel = '删除此图片',
}: {
  target: GeneratedImageMenuTarget | null;
  onClose: () => void;
  /** 返回这张图片对应的资产 ID；还没有资产时创建一个。target 带 assetId 时可省略。 */
  ensureAsset?: (url: string) => Promise<string>;
  onFullscreen: (url: string) => void;
  onSave: (url: string) => void;
  allowUnsave?: boolean;
  onDelete: (url: string, assetId: string | null) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  /** 菜单头文字；不传时显示资产名称。 */
  headerLabel?: string;
  deleteLabel?: string;
}) => {
  const [assetId, setAssetId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<AssetFolder[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [renaming, setRenaming] = useState<{ assetId: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const url = target?.url || '';
  const knownAssetId = target?.assetId;

  const resolveAsset = async (imageUrl: string) => {
    if (knownAssetId) return knownAssetId;
    if (!ensureAsset) throw new Error('找不到这张图片对应的资产');
    return ensureAsset(imageUrl);
  };

  useEffect(() => {
    if (!url) return;
    let active = true;
    setAssetId(null);
    setTitle('');
    setFolderId(null);
    setFolders(null);
    setLoadError('');
    void (async () => {
      try {
        const id = await resolveAsset(url);
        const [detail, folderList] = await Promise.all([assetService.detail(id), assetService.folders()]);
        if (!active) return;
        setAssetId(id);
        setTitle(detail.title);
        setFolderId(detail.primaryFolderId);
        setFolders(folderList);
      } catch (error) {
        if (active) setLoadError(errorText(error, '读取资产信息失败'));
      }
    })();
    return () => { active = false; };
    // ensureAsset 每次渲染都是新函数，只在换了图片或资产时重新读取。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, knownAssetId]);

  const orderedFolders = useMemo(() => orderFolders(folders || []), [folders]);

  /** 需要资产的操作：菜单先关闭，再在后台执行，失败时提示原因。 */
  const withAsset = (run: (id: string) => Promise<void>, fallback: string) => {
    const id = assetId;
    const imageUrl = url;
    onClose();
    void (async () => {
      try {
        await run(id || await resolveAsset(imageUrl));
      } catch (error) {
        onError(errorText(error, fallback));
      }
    })();
  };

  const moveTo = (value: string) => {
    const nextFolderId = value === NO_FOLDER ? null : value;
    const name = folders?.find((folder) => folder.id === nextFolderId)?.name;
    withAsset(async (id) => {
      await assetService.bulkMove([id], nextFolderId);
      onNotice(name ? `已移动至“${name}”` : '已移出文件夹');
    }, '移动失败');
  };

  const submitRename = async () => {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (!value) return;
    setBusy(true);
    try {
      await assetService.update(renaming.assetId, { title: value });
      setRenaming(null);
      onNotice('已重命名');
    } catch (error) {
      onError(errorText(error, '重命名失败'));
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(assetId);

  return (
    <>
      <AnchoredMenu point={target?.point || null} onClose={onClose} label="图片操作" width={232}>
        <DropdownMenuLabel className="truncate font-normal" title={title}>
          {loadError || headerLabel || title || '正在读取…'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Maximize2} shortcut="双击" onSelect={() => onFullscreen(url)}>全屏显示</DropdownMenuItem>
        <DropdownMenuItem icon={target?.saved ? HeartFill : Heart} disabled={target?.saved && !allowUnsave} className={target?.saved ? 'data-[disabled]:opacity-100 [&>svg]:text-red-500 [&>svg]:opacity-100' : undefined} onSelect={() => onSave(url)}>
          {target?.saved ? (allowUnsave ? '取消收藏' : '已收藏') : '添加至收藏'}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={FolderInput} disabled={!ready}>移动至文件夹</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-[220px]">
            <DropdownMenuRadioGroup value={folderId || NO_FOLDER} onValueChange={moveTo}>
              <DropdownMenuRadioItem value={NO_FOLDER}>不放入文件夹</DropdownMenuRadioItem>
              {orderedFolders.length > 0 && <DropdownMenuSeparator />}
              {orderedFolders.map(({ folder, depth }) => (
                <DropdownMenuRadioItem key={folder.id} value={folder.id} style={{ paddingLeft: 8 + depth * 14 }}>
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder size={13} className="shrink-0 opacity-70" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {orderedFolders.length === 0 && (
              <DropdownMenuLabel className="font-normal leading-5">还没有文件夹，可在资产库中新建</DropdownMenuLabel>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          icon={Pencil}
          disabled={!ready}
          onSelect={() => { if (assetId) setRenaming({ assetId, value: title }); }}
        >
          重命名
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={FolderOpen}
          disabled={!ready}
          onSelect={() => withAsset(async (id) => { await assetService.reveal(id); }, '无法打开文件所在位置')}
        >
          打开文件所在位置
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={Download}
          disabled={!ready}
          onSelect={() => withAsset(async (id) => {
            const result = await assetService.exportFile(id);
            if (!result.cancelled) onNotice(`已导出到 ${result.path}`);
          }, '导出失败')}
        >
          导出到本地…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={Trash2}
          destructive
          onSelect={() => { onClose(); onDelete(url, assetId); }}
        >
          {deleteLabel}
        </DropdownMenuItem>
      </AnchoredMenu>

      <Dialog open={Boolean(renaming)} onOpenChange={(open) => { if (!open && !busy) setRenaming(null); }}>
        <DialogContent className="max-w-[400px] gap-0 p-0">
          <DialogHeader className="border-b border-border px-5 py-4 pr-14">
            <DialogTitle className="text-base">重命名</DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4">
            <Input
              autoFocus
              aria-label="图片名称"
              value={renaming?.value || ''}
              onChange={(event) => setRenaming((current) => current && { ...current, value: event.target.value })}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void submitRename();
                }
              }}
              className="h-8 text-sm"
            />
          </div>
          <DialogFooter className="border-t border-border px-5 py-3">
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setRenaming(null)}>取消</Button>
            <Button type="button" size="sm" disabled={busy || !renaming?.value.trim()} onClick={() => void submitRename()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
