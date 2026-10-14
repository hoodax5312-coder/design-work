import { useMemo, type ElementType } from 'react';
import { NodeToolbar, Position } from '@xyflow/react';
import { ArrowUp, AspectRatio, ChevronDown, Film, Image as ImageIcon, Settings, Sparkles, Stack, StopFill, Type } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useProviderStore } from '../../stores/useProviderStore';
import { useUIStore } from '../../stores/useUIStore';
import { ThinkingOrb } from '../motion';
import { useEditHistory } from '../nodes/NodeFrame';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '../ui';
import { IMAGE_COUNTS, clampCount, type CanvasNodeKind } from './canvasModel';
import { NODE_CATEGORY, resolveModelChoice, runNodeGeneration, stopNodeGeneration, upstreamReferences, type ModelOption } from './generation';

const RATIOS: Record<CanvasNodeKind, string[]> = {
  text: [],
  imageGen: ['1:1', '16:9', '9:16'],
  video: ['16:9', '9:16', '1:1'],
};

const QUALITY_LABEL: Record<string, string> = { standard: '标准', hd: '高清' };

const PLACEHOLDER: Record<CanvasNodeKind, string> = {
  text: '描述要写的内容，连入的文本会作为参考…',
  imageGen: '描述画面的主体、风格、构图与光线…',
  video: '描述视频主题、动作与镜头节奏…',
};

const REFERENCE_ICON: Record<CanvasNodeKind, ElementType> = { text: Type, imageGen: ImageIcon, video: Film };

const chipClassName = 'flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground';

/** 选中节点下方的提示词面板：模型、比例、质量与生成按钮。三类节点共用。 */
export const CanvasPromptOverlay = ({ id, kind, data, visible }: { id: string; kind: CanvasNodeKind; data: Record<string, unknown>; visible: boolean }) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const providers = useProviderStore((state) => state.providers);
  const activeProviderIds = useProviderStore((state) => state.activeProviderIds);
  const setActiveModule = useUIStore((state) => state.setActiveModule);
  const editHistory = useEditHistory();
  const category = NODE_CATEGORY[kind];
  const choice = useMemo(
    () => resolveModelChoice(data, category, providers, activeProviderIds[category]),
    [activeProviderIds, category, data, providers],
  );
  const references = useMemo(() => (visible ? upstreamReferences(id, nodes, edges) : []), [edges, id, nodes, visible]);
  const prompt = String(data.prompt || '');
  const ratio = String(data.aspectRatio || RATIOS[kind][0] || '');
  const quality = String(data.quality || 'standard');
  const count = clampCount(data.count);
  const error = typeof data.error === 'string' ? data.error : '';
  const notice = typeof data.notice === 'string' ? data.notice : '';
  const generating = Boolean(data.isGenerating);
  const canRun = !generating && Boolean(prompt.trim() || references.some((reference) => reference.sendable));
  const providerGroups = useMemo(() => {
    const groups = new Map<string, ModelOption[]>();
    choice.options.forEach((option) => groups.set(option.provider.name || option.provider.id, [...(groups.get(option.provider.name || option.provider.id) || []), option]));
    return [...groups.entries()];
  }, [choice.options]);

  return (
    <NodeToolbar isVisible={visible} position={Position.Bottom} offset={14} align="center" className="!p-0">
      <div
        className="canvas-chrome canvas-prompt-panel nodrag nopan nowheel w-[640px] max-w-[min(640px,calc(100vw-32px))] rounded-xl p-2 text-card-foreground"
        style={{ boxShadow: 'var(--canvas-shadow-lg)' }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {references.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1 pb-1.5">
            {references.map((reference) => {
              const Icon = REFERENCE_ICON[reference.kind];
              return (
                <Tooltip key={reference.id} content={reference.sendable ? '内容会作为参考拼入提示词' : reference.kind === 'text' ? '上游文本为空' : '当前接口暂不支持发送图片或视频参考，仅作关系标注'}>
                  <span className={cn('flex h-6 max-w-[160px] items-center gap-1 rounded-md bg-muted px-1.5 text-[11px]', reference.sendable ? 'text-foreground' : 'text-muted-foreground')}>
                    {reference.mediaUrl && reference.kind === 'imageGen'
                      ? <img src={reference.mediaUrl} alt="" className="h-4 w-4 rounded-sm object-cover" />
                      : <Icon size={12} className="shrink-0" />}
                    <span className="truncate">{reference.title}</span>
                    {!reference.sendable && <span className="shrink-0 opacity-70">· 未发送</span>}
                  </span>
                </Tooltip>
              );
            })}
          </div>
        )}

        <textarea
          aria-label="提示词"
          value={prompt}
          onFocus={editHistory.onFocus}
          onChange={(event) => {
            editHistory.beforeChange();
            updateNode(id, { prompt: event.target.value, error: undefined });
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              if (canRun) void runNodeGeneration(id);
            }
          }}
          placeholder={PLACEHOLDER[kind]}
          rows={5}
          className="canvas-prompt-field nokey block max-h-[280px] min-h-[120px] w-full resize-none bg-transparent px-2.5 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/80"
        />

        <div className="flex items-center gap-0.5 pt-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(chipClassName, 'min-w-0 max-w-[180px]')} aria-label="选择模型">
                <Sparkles size={13} className="shrink-0" />
                <span className="truncate">{choice.model || '未配置模型'}</span>
                <ChevronDown size={12} className="shrink-0 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-[240px]">
              {providerGroups.length ? (
                <DropdownMenuRadioGroup
                  value={choice.option?.value || ''}
                  onValueChange={(value) => {
                    const [providerId, ...parts] = value.split('::');
                    updateNode(id, { providerId, model: parts.join('::'), error: undefined });
                  }}
                >
                  {providerGroups.map(([name, options], index) => (
                    <div key={name}>
                      {index > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>{name}</DropdownMenuLabel>
                      {options.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.model}</DropdownMenuRadioItem>)}
                    </div>
                  ))}
                </DropdownMenuRadioGroup>
              ) : (
                <DropdownMenuLabel className="py-2 font-normal">还没有可用的{kind === 'text' ? '文本' : kind === 'imageGen' ? '图像' : '视频'}模型</DropdownMenuLabel>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={Settings} onSelect={() => setActiveModule('settings')}>管理模型</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {RATIOS[kind].length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={chipClassName} aria-label="画面比例">
                  <AspectRatio size={13} />
                  {ratio}
                  {kind === 'imageGen' && <span className="opacity-70">· {QUALITY_LABEL[quality] || quality}</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-[168px]">
                <DropdownMenuLabel>画面比例</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={ratio} onValueChange={(value) => updateNode(id, { aspectRatio: value }, { history: true })}>
                  {RATIOS[kind].map((value) => <DropdownMenuRadioItem key={value} value={value}>{value}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
                {kind === 'imageGen' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>质量</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={quality} onValueChange={(value) => updateNode(id, { quality: value })}>
                      <DropdownMenuRadioItem value="standard">标准</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="hd">高清</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {kind === 'imageGen' && (
            <DropdownMenu>
              <Tooltip content="一次生成的张数">
                <DropdownMenuTrigger asChild>
                  <button type="button" className={chipClassName} aria-label="生成数量">
                    <Stack size={13} />
                    {count} 张
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent align="start" side="bottom" className="w-[188px]">
                <DropdownMenuLabel>生成数量</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={String(count)} onValueChange={(value) => updateNode(id, { count: clampCount(value) }, { history: true })}>
                  {IMAGE_COUNTS.map((value) => <DropdownMenuRadioItem key={value} value={String(value)}>{value} 张</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="font-normal leading-5">每张单独发起一次请求，按张计费</DropdownMenuLabel>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <span className="ml-auto pr-1.5 text-[11px] text-muted-foreground/80">{generating ? '' : '⌘↵'}</span>
          {generating ? (
            <Tooltip content="停止生成">
              <button
                type="button"
                onClick={() => stopNodeGeneration(id)}
                aria-label="停止生成"
                className="group/stop relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform duration-150 hover:scale-105 active:scale-95"
              >
                <span className="absolute inset-0 grid place-items-center transition-opacity duration-150 group-hover/stop:opacity-0"><ThinkingOrb size={18} /></span>
                <StopFill size={14} className="relative opacity-0 transition-opacity duration-150 group-hover/stop:opacity-100" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip content={kind === 'imageGen' && count > 1 ? `生成 ${count} 张` : '生成'} shortcut="⌘↵">
              <button
                type="button"
                onClick={() => void runNodeGeneration(id)}
                disabled={!canRun}
                aria-label="生成"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-background transition-[transform,opacity] duration-150 hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
              >
                <ArrowUp size={16} />
              </button>
            </Tooltip>
          )}
        </div>

        {error && (
          <div role="alert" className="mx-1 mt-2 flex items-start gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs leading-5 text-destructive">
            <span className="min-w-0 flex-1 break-words">{error}</span>
            {/配置|设置/.test(error)
              ? <button type="button" className="shrink-0 font-medium underline-offset-2 hover:underline" onClick={() => setActiveModule('settings')}>前往设置</button>
              : canRun && <button type="button" className="shrink-0 font-medium underline-offset-2 hover:underline" onClick={() => void runNodeGeneration(id)}>重试</button>}
          </div>
        )}
        {!error && notice && !generating && (
          <div role="status" className="mx-1 mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs leading-5 text-amber-600 dark:text-amber-400">{notice}</div>
        )}
      </div>
    </NodeToolbar>
  );
};
