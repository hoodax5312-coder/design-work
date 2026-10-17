import { useMemo, type ElementType } from 'react';
import { ChevronDown, Film, Image as ImageIcon, Settings, Sparkles, MousePointer2, StopFill, Type } from '@/lib/remixIconShim';
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
import { IMAGE_COUNTS, clampCount, nodeTitle, type CanvasNodeKind } from './canvasModel';
import { NODE_CATEGORY, isNodeRunnable, resolveModelChoice, runNodeGeneration, stopNodeGeneration, upstreamReferences, type ModelOption } from './generation';
import { NODE_CATALOG } from './nodeCatalog';

export interface ParamNode {
  id: string;
  kind: CanvasNodeKind;
  data: Record<string, unknown>;
}

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

const GENERATE_LABEL: Record<CanvasNodeKind, string> = { text: '生成文本', imageGen: '生成图片', video: '生成视频' };

// 以下样式与「生成」页左侧面板保持一致。
const controlShellClass = 'relative overflow-hidden rounded-lg border-solid [border-color:var(--generation-control-border)] [border-width:var(--generation-control-border-width)] bg-[var(--generation-control-bg)] text-[var(--neutral-foreground)]';
const triggerClass = cn(controlShellClass, 'flex h-10 w-full items-center justify-between gap-2 px-3 text-left text-sm font-normal outline-none transition-colors hover:bg-[var(--neutral-surface-hover)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--neutral-border)] data-[state=open]:bg-[var(--neutral-surface-hover)]');
const segmentedOptionClass = (selected: boolean) => cn(
  'h-8 w-full rounded-md px-1 text-xs transition-colors',
  'hover:bg-[var(--generation-segment-hover-bg)] hover:text-[var(--generation-segment-hover-foreground)]',
  selected && 'bg-[var(--generation-count-selected-bg)] text-[var(--generation-segment-selected-foreground)] hover:bg-[var(--generation-count-selected-bg)] hover:text-[var(--generation-segment-selected-foreground)]',
);
const generateButtonClass = 'relative flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--action-generate-bg)] text-sm font-semibold text-[var(--action-generate-foreground)] transition-colors hover:bg-[var(--action-generate-bg-hover)] disabled:pointer-events-none disabled:opacity-40';

/** 未选中可编辑节点时的占位说明。 */
export const CanvasNodeParamsEmpty = ({ selectedCount, reason }: { selectedCount: number; reason?: 'annotation' }) => (
  <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
    <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground"><MousePointer2 size={18} /></span>
    <p className="mt-3 text-sm font-semibold text-foreground">
      {reason === 'annotation' ? '便签和分组没有生成参数' : selectedCount > 1 ? `已选中 ${selectedCount} 个节点` : '未选中节点'}
    </p>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">
      {reason === 'annotation' ? '它们用于整理画布内容，不参与生成或参数编辑。' : selectedCount > 1 ? '选中单个文本、图片或视频节点后，可在这里编辑参数。' : '选中一个文本、图片或视频节点，在这里编辑创作描述与生成参数。'}
    </p>
  </div>
);

/** 右侧面板「参数」页：选中节点的创作描述、模型、数量、参数与生成按钮。三类节点共用。 */
export const CanvasNodeParams = ({ id, kind, data }: ParamNode) => {
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
  const references = useMemo(() => upstreamReferences(id, nodes, edges), [edges, id, nodes]);
  const prompt = String(data.prompt || '');
  const ratio = String(data.aspectRatio || RATIOS[kind][0] || '');
  const quality = String(data.quality || 'standard');
  const count = clampCount(data.count);
  const error = typeof data.error === 'string' ? data.error : '';
  const notice = typeof data.notice === 'string' ? data.notice : '';
  const generating = Boolean(data.isGenerating);
  const node = nodes.find((item) => item.id === id);
  const canRun = Boolean(node && isNodeRunnable(node, nodes, edges));
  const providerGroups = useMemo(() => {
    const groups = new Map<string, ModelOption[]>();
    choice.options.forEach((option) => groups.set(option.provider.name || option.provider.id, [...(groups.get(option.provider.name || option.provider.id) || []), option]));
    return [...groups.entries()];
  }, [choice.options]);
  const KindIcon = NODE_CATALOG[kind].icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4 pt-1">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-foreground"><KindIcon size={14} /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{nodeTitle({ type: kind, data })}</div>
            <div className="text-[11px] text-muted-foreground">{NODE_CATALOG[kind].label}</div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold" htmlFor={`canvas-prompt-${id}`}>创作描述</label>
          <div className={cn(controlShellClass, 'focus-within:ring-1 focus-within:ring-inset focus-within:ring-[var(--neutral-border)]')}>
            {references.length > 0 && (
              <div className="flex flex-wrap gap-1 px-2.5 pt-2.5">
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
              id={`canvas-prompt-${id}`}
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
              rows={7}
              className="canvas-prompt-field nokey block max-h-[360px] min-h-[180px] w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/80"
            />
          </div>
        </div>

        <div className={cn('grid gap-3', kind === 'imageGen' ? 'grid-cols-2' : 'grid-cols-1')}>
          <div className="min-w-0">
            <span className="mb-2 block text-xs font-semibold">生成模型</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={triggerClass} aria-label="选择模型">
                  <span className="truncate">{choice.model || '未配置模型'}</span>
                  <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-[260px]">
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
          </div>

          {kind === 'imageGen' && (
            <fieldset className="min-w-0">
              <legend className="mb-2 text-xs font-semibold">生成数量</legend>
              <Tooltip content="每张单独发起一次请求，按张计费">
                <div className="grid h-10 grid-cols-4 gap-1 rounded-lg bg-[var(--neutral-surface-subtle)] p-1 text-[var(--neutral-foreground)]">
                  {IMAGE_COUNTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={count === value}
                      aria-label={`${value} 张`}
                      onClick={() => updateNode(id, { count: clampCount(value) }, { history: true })}
                      className={segmentedOptionClass(count === value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </Tooltip>
            </fieldset>
          )}
        </div>

        {RATIOS[kind].length > 0 && (
          <div>
            <span className="mb-2 block text-xs font-semibold">参数设置</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={triggerClass} aria-label="参数设置">
                  <span className="truncate">{kind === 'imageGen' ? `${ratio} · ${QUALITY_LABEL[quality] || quality}` : ratio}</span>
                  <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-[288px]">
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
          </div>
        )}
      </div>

      <div className="shrink-0 p-4 pt-0">
        {error && (
          <div role="alert" className="mb-3 flex items-start gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs leading-5 text-destructive">
            <span className="min-w-0 flex-1 break-words">{error}</span>
            {/配置|设置/.test(error)
              ? <button type="button" className="shrink-0 font-medium underline-offset-2 hover:underline" onClick={() => setActiveModule('settings')}>前往设置</button>
              : canRun && <button type="button" className="shrink-0 font-medium underline-offset-2 hover:underline" onClick={() => void runNodeGeneration(id)}>重试</button>}
          </div>
        )}
        {!error && notice && !generating && (
          <div role="status" className="mb-3 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs leading-5 text-amber-600 dark:text-amber-400">{notice}</div>
        )}
        {generating ? (
          <button type="button" onClick={() => stopNodeGeneration(id)} aria-label="停止生成" className={cn(generateButtonClass, 'group/stop')}>
            <span className="grid h-4 w-4 place-items-center">
              <span className="transition-opacity duration-150 group-hover/stop:opacity-0"><ThinkingOrb size={16} /></span>
              <StopFill size={14} className="absolute opacity-0 transition-opacity duration-150 group-hover/stop:opacity-100" />
            </span>
            正在生成 · 点击停止
          </button>
        ) : (
          <Tooltip content={kind === 'imageGen' && count > 1 ? `生成 ${count} 张` : '生成'} shortcut="⌘↵">
            <button type="button" onClick={() => void runNodeGeneration(id)} disabled={!canRun} aria-label="生成" className={generateButtonClass}>
              <Sparkles size={16} /> {GENERATE_LABEL[kind]}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
