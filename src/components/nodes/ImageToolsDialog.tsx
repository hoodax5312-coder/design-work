import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Label, NumberField, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Slider, Tabs, TabsList, TabsTrigger, Toggle, ToggleGroup, ToggleGroupItem } from '../ui';
import { cn } from '../../lib/utils';
import { gridImageRects, imageRegionFile, loadToolImage, saveToolOutputs, type PixelRect } from '../canvas/imageTools';

export type ImageTool = 'crop' | 'mask' | 'split' | 'upscale';
const names: Record<ImageTool, string> = { crop: '裁切图片', mask: '绘制遮罩', split: '网格切图', upscale: 'AI 超分' };

export function ImageToolsDialog({ nodeId, assetId, tool, onToolChange, onClose, onSaved }: {
  nodeId: string; assetId: string; tool: ImageTool; onToolChange: (tool: ImageTool) => void; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [image, setImage] = useState<HTMLImageElement>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [crop, setCrop] = useState<PixelRect>({ x: 0, y: 0, width: 1, height: 1 });
  const [ratio, setRatio] = useState(0);
  const [rows, setRows] = useState(2);
  const [columns, setColumns] = useState(2);
  const [brush, setBrush] = useState(40);
  const [erase, setErase] = useState(false);
  const [painted, setPainted] = useState(false);
  const [maskOnly, setMaskOnly] = useState(false);
  const [scale, setScale] = useState(2);
  const mask = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | undefined>(undefined);
  const width = image?.naturalWidth || 1;
  const height = image?.naturalHeight || 1;

  useEffect(() => {
    let cancelled = false;
    void loadToolImage(assetId).then((loaded) => {
      if (cancelled) return;
      setImage(loaded);
      setCrop({ x: 0, y: 0, width: loaded.naturalWidth, height: loaded.naturalHeight });
      setRows(Math.min(2, loaded.naturalHeight));
      setColumns(Math.min(2, loaded.naturalWidth));
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '原图加载失败'); });
    return () => { cancelled = true; };
  }, [assetId]);

  const point = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(width - 1, Math.floor((event.clientX - bounds.left) / bounds.width * width))),
      y: Math.max(0, Math.min(height - 1, Math.floor((event.clientY - bounds.top) / bounds.height * height))) };
  };
  const paint = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = mask.current?.getContext('2d');
    if (!ctx) return;
    setError('');
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = '#ef4444';
    ctx.lineWidth = brush;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(to.x, to.y, brush / 2, 0, Math.PI * 2); ctx.fill();
    setPainted(true);
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!image || busy || (tool !== 'crop' && tool !== 'mask') || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = point(event);
    if (tool === 'mask') paint(drag.current, drag.current);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const next = point(event);
    if (tool === 'mask') { paint(drag.current, next); drag.current = next; return; }
    let w = Math.abs(next.x - drag.current.x) + 1;
    let h = Math.abs(next.y - drag.current.y) + 1;
    if (ratio) { if (w / h > ratio) w = Math.max(1, Math.floor(h * ratio)); else h = Math.max(1, Math.floor(w / ratio)); }
    setCrop({ x: Math.min(drag.current.x, next.x), y: Math.min(drag.current.y, next.y), width: w, height: h });
  };
  const updateCrop = (key: keyof PixelRect, value: number) => {
    if (!Number.isFinite(value)) return;
    setRatio(0);
    setCrop((old) => {
      const next = { ...old, [key]: Math.floor(value) };
      next.x = Math.max(0, Math.min(width - 1, next.x)); next.y = Math.max(0, Math.min(height - 1, next.y));
      next.width = Math.max(1, Math.min(width - next.x, next.width)); next.height = Math.max(1, Math.min(height - next.y, next.height));
      return next;
    });
  };
  const chooseRatio = (value: number) => {
    setRatio(value);
    if (!value) return;
    const w = Math.min(width, Math.floor(height * value));
    const h = Math.max(1, Math.floor(w / value));
    setCrop({ x: Math.floor((width - Math.max(1, w)) / 2), y: Math.floor((height - h) / 2), width: Math.max(1, w), height: h });
  };
  const save = async () => {
    if (!image || busy || tool === 'upscale') return;
    setBusy(true); setError('');
    try {
      if (tool === 'mask') {
        const output = document.createElement('canvas'); output.width = width; output.height = height;
        const ctx = output.getContext('2d');
        if (!ctx || !mask.current) throw new Error('无法创建遮罩');
        const pixels = mask.current.getContext('2d')?.getImageData(0, 0, width, height).data;
        if (!pixels?.some((value, index) => index % 4 === 3 && value > 0)) throw new Error('请先绘制需要修改的区域');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(mask.current, 0, 0);
        const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error('遮罩导出失败')), 'image/png'));
        await saveToolOutputs(nodeId, assetId, [{ file: new File([blob], '遮罩.png', { type: 'image/png' }), width, height, title: '遮罩' }], 'mask');
      } else {
        const regions = tool === 'crop' ? [crop] : gridImageRects(width, height, rows, columns);
        const outputs = [];
        for (const [index, rect] of regions.entries()) {
          const title = tool === 'crop' ? '裁切结果' : `切图 ${Math.floor(index / columns) + 1}-${index % columns + 1}`;
          outputs.push({ file: await imageRegionFile(image, rect, `${title}.png`), width: rect.width, height: rect.height, title });
        }
        await saveToolOutputs(nodeId, assetId, outputs, tool);
      }
      onSaved(tool === 'mask' ? '遮罩已保存至资产库与画布；尚未调用局部重绘模型' : '已保存新图片至资产库与画布，原图未改动');
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); }
    finally { setBusy(false); }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="nodrag nopan max-h-[90dvh] max-w-4xl overflow-y-auto" showCloseButton={!busy} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <DialogTitle>{names[tool]}</DialogTitle>
      <Tabs value={tool} onValueChange={(value) => onToolChange(value as ImageTool)}>
        <TabsList aria-label="图片工具" className="h-auto flex-wrap justify-start">{(Object.keys(names) as ImageTool[]).map((key) => <TabsTrigger key={key} value={key} disabled={busy}>{names[key]}</TabsTrigger>)}</TabsList>
      </Tabs>
      <DialogDescription>{tool === 'mask' ? '涂色区域为待修改区域；保存同原图尺寸的 PNG（待修改区透明，保留区不透明）。仅保存遮罩，不会发起收费重绘。' : tool === 'upscale' ? '选择倍率并查看目标尺寸。当前尚未配置已验证的 AI 超分适配器，不会用普通插值放大冒充 AI 超分。' : '使用资产原图处理，结果另存为新资产与图片节点，不覆盖源图。'}</DialogDescription>
      {image ? <>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="tabular-nums text-muted-foreground">原图 {width} × {height}</span>
          {tool === 'crop' && <div className="flex items-center gap-2"><Label htmlFor="image-crop-ratio">裁切比例</Label>
            <Select value={String(ratio)} disabled={busy} onValueChange={(value) => chooseRatio(Number(value))}>
              <SelectTrigger id="image-crop-ratio" aria-label="裁切比例" className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{[[0, '自由'], [1, '1:1'], [16 / 9, '16:9'], [9 / 16, '9:16'], [4 / 3, '4:3']].map(([value, label]) => <SelectItem key={value} value={String(value)}>{label}</SelectItem>)}</SelectContent>
            </Select></div>}
          {tool === 'split' && <>{(['行数', '列数'] as const).map((label, i) => <div key={label} className="flex items-center gap-2"><Label htmlFor={`image-grid-${i}`}>{label}</Label>
            <Select value={String(i ? columns : rows)} disabled={busy} onValueChange={(value) => (i ? setColumns : setRows)(Number(value))}>
              <SelectTrigger id={`image-grid-${i}`} aria-label={label} className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: Math.min(6, i ? width : height) }, (_, n) => <SelectItem key={n} value={String(n + 1)}>{n + 1}</SelectItem>)}</SelectContent>
            </Select></div>)}<span>共 {rows * columns} 张，按从左到右、从上到下输出</span></>}
          {tool === 'mask' && <>
            <ToggleGroup type="single" value={erase ? 'erase' : 'brush'} onValueChange={(value) => { if (value) setErase(value === 'erase'); }} disabled={busy} aria-label="遮罩工具">
              <ToggleGroupItem value="brush" aria-label="画笔">画笔</ToggleGroupItem><ToggleGroupItem value="erase" aria-label="橡皮擦">橡皮擦</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-center gap-2"><Label htmlFor="image-mask-brush">笔刷 {brush}px</Label><Slider id="image-mask-brush" aria-label="笔刷大小" className="w-32" min={1} max={300} step={1} value={[brush]} disabled={busy} onValueChange={([value]) => setBrush(value)} /></div>
            <Button size="sm" disabled={busy} onClick={() => { mask.current?.getContext('2d')?.clearRect(0, 0, width, height); setPainted(false); setError(''); }}>清空</Button>
            <Toggle size="sm" disabled={busy} pressed={maskOnly} onPressedChange={setMaskOnly} aria-label="黑白预览">{maskOnly ? '叠加预览' : '黑白预览'}</Toggle>
          </>}
          {tool === 'upscale' && <div className="flex items-center gap-2"><Label htmlFor="image-upscale-factor">放大倍率</Label><Select value={String(scale)} onValueChange={(value) => setScale(Number(value))}><SelectTrigger id="image-upscale-factor" aria-label="放大倍率" className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2">2×</SelectItem><SelectItem value="4">4×</SelectItem></SelectContent></Select></div>}
        </div>
        <div className="flex min-h-32 justify-center overflow-hidden rounded-md bg-muted p-3">
          <div className={cn('relative max-w-full touch-none self-center', (tool === 'crop' || tool === 'mask') && 'cursor-crosshair')} style={{ width: `min(100%, ${Math.min(720, 380 * width / height)}px)`, aspectRatio: `${width}/${height}` }}
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }} onLostPointerCapture={() => { drag.current = undefined; }}>
            <img src={image.src} alt="待处理原图" draggable={false} className="block size-full select-none object-contain" />
            {tool === 'mask' && maskOnly && <div className="pointer-events-none absolute inset-0 bg-white" />}
            {tool === 'mask' && <canvas ref={mask} width={width} height={height} aria-label="遮罩绘制区" className="pointer-events-none absolute inset-0 size-full" style={{ opacity: maskOnly ? 1 : 0.55, filter: maskOnly ? 'brightness(0)' : undefined }} />}
            {tool === 'crop' && <div className="pointer-events-none absolute border-2 border-white bg-white/10 ring-1 ring-black" style={{ left: `${crop.x / width * 100}%`, top: `${crop.y / height * 100}%`, width: `${crop.width / width * 100}%`, height: `${crop.height / height * 100}%` }} />}
            {tool === 'split' && <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>{Array.from({ length: rows * columns }, (_, i) => <div key={i} className="border border-white/80 bg-black/10 p-1 text-xs text-white"><span className="rounded bg-black/70 px-1">{i + 1}</span></div>)}</div>}
          </div>
        </div>
        {tool === 'crop' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(['x', 'y', 'width', 'height'] as const).map((key) => { const label = { x: '起点 X', y: '起点 Y', width: '宽度', height: '高度' }[key]; const min = key === 'x' || key === 'y' ? 0 : 1; const max = key === 'x' || key === 'width' ? width : height; return <div key={key}><Label htmlFor={`image-crop-${key}`} className="mb-1 block text-xs text-muted-foreground">{label}</Label><NumberField id={`image-crop-${key}`} aria-label={label} min={min} max={max} value={crop[key]} disabled={busy} onValueChange={(value) => updateCrop(key, value)} /></div>; })}</div>}
        {tool === 'crop' && <p className="text-xs text-muted-foreground">拖动原图重选区域，或输入像素坐标；输出 {crop.width} × {crop.height} PNG。</p>}
        {tool === 'split' && <p className="text-xs text-muted-foreground">按原始像素切分，边缘余数分配到相邻切片，无丢失、无重复。</p>}
        {tool === 'mask' && <p className="text-xs text-muted-foreground">鼠标或触控绘制；需键盘操作时，可先在外部工具制作 PNG 遮罩后导入。当前不支持键盘绘画。</p>}
        {tool === 'upscale' && <div className="rounded-md border border-border p-4 text-sm" role="status"><p>待接入 · 尚未提交任务</p><p className="mt-2 tabular-nums">输入 {width} × {height} → 目标 {width * scale} × {height * scale}</p><p className="mt-2 text-muted-foreground">输出：暂无。接入供应商专用超分协议后才能执行；更换普通生图模型不会解除此限制。</p></div>}
      </> : !error && <p role="status" className="text-sm text-muted-foreground">正在读取资产原图…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">切换工具或关闭面板后，未保存的编辑不会保留。</p>
      <div className="flex justify-end gap-2"><Button disabled={busy} onClick={onClose}>取消</Button><Button variant="primary" disabled={!image || busy || tool === 'upscale' || (tool === 'mask' && !painted)} onClick={() => void save()}>{busy ? '正在保存…' : tool === 'upscale' ? '未配置超分服务' : tool === 'mask' ? '保存遮罩' : tool === 'split' ? `保存 ${rows * columns} 张切图` : '保存裁切结果'}</Button></div>
    </DialogContent>
  </Dialog>;
}
