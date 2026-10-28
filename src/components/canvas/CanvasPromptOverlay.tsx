import { useEffect, useMemo, useRef, type ElementType } from 'react';
import { ArrowUp, AspectRatio, ChevronDown, Film, Image as ImageIcon, Music, Settings, Sparkles, Stack, StopFill, Clock, Type, X } from '@/lib/remixIconShim';
import { canvasImageCapability, defaultCanvasImageParameters, resolveCanvasImageParameters } from '../../lib/canvasImageCapabilities';
import { resolveImageInput } from './imageInputs';
import { MUSIC_DURATION_PRESETS, clampMusicSeconds, musicModelCapability } from '../../lib/musicModels';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '../ui';
import { IMAGE_COUNTS, clampCount, type CanvasNodeKind } from './canvasModel';
import { NODE_CATEGORY, ownPrompt, resolveModelChoice, runNodeGeneration, stopNodeGeneration, upstreamReferences, type ModelOption } from './generation';
import { CanvasReferenceImageInput } from './CanvasReferenceImage';
import { readReferenceImage } from './referenceImage';

const RATIOS: Record<CanvasNodeKind, string[]> = {
  text: [],
  imageGen: ['1:1', '16:9', '9:16'],
  video: ['16:9', '9:16', '1:1'],
  audio: [],
};

const QUALITY_LABEL: Record<string, string> = { standard: '标准', hd: '高清' };
const parameterGroupClassName = 'grid gap-1 rounded-lg border-solid [border-color:var(--generation-control-border)] [border-width:var(--generation-control-border-width)] bg-[var(--generation-control-bg)] p-1 text-[var(--neutral-foreground)]';
const parameterOptionClassName = 'rounded-md text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring hover:bg-[var(--generation-segment-hover-bg)] hover:text-[var(--generation-segment-hover-foreground)] aria-pressed:bg-[var(--generation-segment-selected-bg)] aria-pressed:text-[var(--generation-segment-selected-foreground)] aria-pressed:shadow-sm';

const PLACEHOLDER: Record<CanvasNodeKind, string> = {
  text: '描述要写的内容，连入的文本会作为参考…',
  imageGen: '描述画面的主体、风格、构图与光线…',
  video: '描述视频主题、动作与镜头节奏…',
  audio: '描述配乐用途与画面，如：30 秒产品宣传片片头，结尾收束…',
};

const MUSIC_FIELDS = [
  { key: 'musicStyle', label: '风格', placeholder: '电子 / 国风' },
  { key: 'musicMood', label: '情绪', placeholder: '明快 / 温暖' },
  { key: 'musicInstruments', label: '乐器', placeholder: '钢琴 / 弦乐' },
  { key: 'musicTempo', label: '节奏', placeholder: '120 BPM' },
] as const;

const formatSeconds = (seconds: number) => (seconds >= 60 ? `${Math.floor(seconds / 60)}分${seconds % 60 ? `${seconds % 60}秒` : '钟'}` : `${seconds}秒`);
const CATEGORY_NAME: Record<CanvasNodeKind, string> = { text: '文本', imageGen: '图像', video: '视频', audio: '音乐' };

const REFERENCE_ICON: Record<CanvasNodeKind, ElementType> = { text: Type, imageGen: ImageIcon, video: Film, audio: Music };

const chipClassName = 'flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground';

/** 选中节点下方的提示词面板：模型、比例、质量与生成按钮。三类节点共用。 */
export const CanvasPromptOverlay = ({ id, kind, data }: { id: string; kind: CanvasNodeKind; data: Record<string, unknown> }) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const providers = useProviderStore((state) => state.providers);
  const activeProviderIds = useProviderStore((state) => state.activeProviderIds);
  const setActiveModule = useUIStore((state) => state.setActiveModule);
  const editHistory = useEditHistory();
  const removeEdges = useCanvasStore((state) => state.removeEdges);
  const category = NODE_CATEGORY[kind];
  const choice = useMemo(
    () => resolveModelChoice(data, category, providers, activeProviderIds[category]),
    [activeProviderIds, category, data, providers],
  );
  const references = useMemo(() => upstreamReferences(id, nodes, edges), [edges, id, nodes]);
  const prompt = String(data.prompt || '');
  const count = clampCount(data.count);
  const error = typeof data.error === 'string' ? data.error : '';
  const notice = typeof data.notice === 'string' ? data.notice : '';
  const generating = Boolean(data.isGenerating);
  let imageCapability: ReturnType<typeof canvasImageCapability> | undefined;
  let imageParameters: ReturnType<typeof resolveCanvasImageParameters> | undefined;
  let inputError = '';
  if (kind === 'imageGen' && choice.provider) {
    try {
      imageCapability = canvasImageCapability(choice.provider.protocol, choice.model);
      imageParameters = resolveCanvasImageParameters(choice.provider.protocol, choice.model, data);
      resolveImageInput(id, data, nodes, edges, imageCapability.maxReferences);
    } catch (cause) { inputError = cause instanceof Error ? cause.message : '图片参数或参考不可用'; }
  }
  const ratios = kind === 'imageGen' ? imageCapability?.ratios || [] : RATIOS[kind];
  const qualities = imageCapability?.qualities || [];
  const ratio = imageParameters?.aspectRatio || String(data.aspectRatio || RATIOS[kind][0] || '');
  const quality = imageParameters?.quality || String(data.quality || 'standard');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  // 输入由浏览器管理，避免受控值回写打断 IME；只同步真正的外部修改（如撤销）。
  useEffect(() => {
    if (inputRef.current && !composing.current && inputRef.current.value !== prompt) {
      inputRef.current.value = prompt;
    }
  }, [prompt]);
  const savePrompt = (value: string) => {
    if (value === prompt) return;
    editHistory.beforeChange();
    updateNode(id, { prompt: value, error: undefined });
  };
  const musicCapability = kind === 'audio' ? musicModelCapability(choice.model) : undefined;
  const durationSeconds = musicCapability ? clampMusicSeconds(data.durationSeconds, musicCapability) : 30;
  const instrumental = data.instrumental !== false;
  const canRun = !generating && !data.uploading && !inputError && (kind !== 'audio' || Boolean(musicCapability))
    && Boolean(ownPrompt({ type: kind, data }) || references.some((reference) => reference.kind === 'text' && reference.sendable));
  const providerGroups = useMemo(() => {
    const groups = new Map<string, ModelOption[]>();
    choice.options.forEach((option) => groups.set(option.provider.name || option.provider.id, [...(groups.get(option.provider.name || option.provider.id) || []), option]));
    return [...groups.entries()];
  }, [choice.options]);

  return (
    <div
      className="canvas-chrome canvas-prompt-panel nodrag nopan nowheel w-full max-w-[640px] rounded-xl p-2 text-card-foreground"
        style={{ boxShadow: 'var(--canvas-shadow-lg)' }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {(kind === 'imageGen' || kind === 'video' || references.length > 0) && (
          <div className="flex items-center justify-between gap-3 px-1 pt-1">
            {(kind === 'imageGen' || kind === 'video') && <CanvasReferenceImageInput key={id} image={readReferenceImage(data.referenceImage)} disabled={generating}
              onChange={(referenceImage) => updateNode(id, { referenceImage, error: undefined }, { history: true })} />}
          <div className="ml-auto flex min-w-0 flex-wrap justify-end gap-1 self-start">
            {references.map((reference) => {
              const Icon = REFERENCE_ICON[reference.kind];
              return (
                <Tooltip key={reference.id} content={reference.error || (reference.kind === 'imageGen' && kind === 'imageGen' ? '生成时使用上游当前选中的原图；模型与数量不支持时阻止提交' : reference.sendable ? '内容会作为参考拼入提示词' : reference.kind === 'text' ? '上游文本为空' : '当前接口暂不支持发送该媒体参考，仅作关系标注')}>
                  <span className={cn('flex min-h-8 max-w-[240px] items-center gap-1 rounded-md bg-muted px-1.5 text-[11px]', reference.sendable ? 'text-foreground' : 'text-muted-foreground')}>
                    {reference.mediaUrl && reference.kind === 'imageGen'
                      ? <img src={reference.mediaUrl} alt="" className="h-4 w-4 rounded-sm object-cover" />
                      : <Icon size={12} className="shrink-0" />}
                    <span className="truncate">{reference.title}</span>
                    {!reference.sendable && <span className="shrink-0 opacity-70">未发送</span>}
                    {reference.kind === 'imageGen' && kind === 'imageGen' && reference.sendable && <span className="shrink-0">原图参考</span>}
                    <button type="button" aria-label={`移除上游参考 ${reference.title}`} title="仅断开连线，不删除上游节点" disabled={generating}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                      onClick={() => removeEdges(edges.filter((edge) => edge.target === id && edge.source === reference.id).map((edge) => edge.id))}><X size={12} /></button>
                  </span>
                </Tooltip>
              );
            })}
          </div>
          </div>
        )}

        {kind === 'audio' && (
          <div className="grid grid-cols-4 gap-1 px-1 pt-1">
            {MUSIC_FIELDS.map((field) => (
              <label key={field.key} className="min-w-0">
                <span className="sr-only">{field.label}</span>
                <input
                  aria-label={`音乐${field.label}`}
                  defaultValue={String(data[field.key] || '')}
                  placeholder={`${field.label}：${field.placeholder}`}
                  title={field.label}
                  onFocus={editHistory.onFocus}
                  onBlur={(event) => {
                    const value = event.currentTarget.value.trim();
                    if (value !== String(data[field.key] || '')) {
                      editHistory.beforeChange();
                      updateNode(id, { [field.key]: value, error: undefined });
                    }
                  }}
                  className="canvas-prompt-field nokey h-8 w-full min-w-0 rounded-md bg-muted/60 px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            ))}
          </div>
        )}

        {inputError && <p role="alert" className="px-2 pt-2 text-xs leading-5 text-destructive">{inputError}</p>}
        <textarea
          ref={inputRef}
          aria-label="提示词"
          defaultValue={prompt}
          onFocus={editHistory.onFocus}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            // data 只有本次合成片段，value 才包含原文及光标处插入的完整内容。
            savePrompt(event.currentTarget.value);
          }}
          onChange={(event) => {
            if (!composing.current) savePrompt(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
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
                <span className="truncate">{choice.model || '未启用模型'}</span>
                <ChevronDown size={12} className="shrink-0 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-[240px]">
              {providerGroups.length ? (
                <DropdownMenuRadioGroup
                  value={choice.option?.value || ''}
                  onValueChange={(value) => {
                    const [providerId, ...parts] = value.split('::');
                    const model = parts.join('::');
                    const provider = providers.find((item) => item.id === providerId);
                    let parameters = {};
                    try {
                      parameters = kind === 'imageGen' && provider ? defaultCanvasImageParameters(provider.protocol, model) : {};
                    } catch { /* Unsupported protocols stay selectable with an inline preflight error. */ }
                    updateNode(id, { providerId, model, ...parameters, error: undefined }, { history: true });
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
                <DropdownMenuLabel className="py-2 font-normal">还没有已启用的{CATEGORY_NAME[kind]}模型</DropdownMenuLabel>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={Settings} onSelect={() => setActiveModule('settings')}>管理模型</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {ratios.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={chipClassName} aria-label="画面比例">
                  <AspectRatio size={13} />
                  {ratio}
                  {kind === 'imageGen' && <span className="opacity-70">{qualities.find((item) => item.value === quality)?.label || QUALITY_LABEL[quality] || quality}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" aria-label="画布画面参数" className="parameter-popover w-72 max-w-[calc(100vw-32px)] max-h-[var(--radix-popover-content-available-height)] space-y-4 overflow-y-auto p-4">
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold">画面比例</legend>
                  <div className={cn(parameterGroupClassName, 'grid-cols-3')}>
                    {ratios.map((value) => {
                      const [width, height] = value.split(':').map(Number);
                      const scale = 18 / Math.max(width, height);
                      return (
                        <button key={value} type="button" aria-label={`画面比例 ${value}`} aria-pressed={ratio === value}
                          onClick={() => updateNode(id, { aspectRatio: value }, { history: true })}
                          className={cn(parameterOptionClassName, 'flex h-14 flex-col items-center justify-center gap-1 px-1 py-1')}>
                          <span aria-hidden="true" className={cn('shrink-0 rounded-[2px] border-[1.5px] border-current', ratio !== value && 'text-muted-foreground')}
                            style={{ width: width * scale, height: height * scale }} />
                          <span>{value}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                {kind === 'imageGen' && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold">质量</legend>
                    <div className={cn(parameterGroupClassName, 'grid-cols-2')}>
                      {qualities.map(({ value, label }) => (
                        <button key={value} type="button" aria-label={`质量 ${label}`} aria-pressed={quality === value}
                          onClick={() => updateNode(id, { quality: value })}
                          className={cn(parameterOptionClassName, 'h-8 px-2')}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {kind === 'imageGen' && <p className="text-xs leading-5 text-muted-foreground">参数按当前网关登记能力显示，最终比例以返回原图为准；供应商是否支持仍以实际响应为准。</p>}
              </PopoverContent>
            </Popover>
          )}

          {kind === 'audio' && musicCapability && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={chipClassName} aria-label="音乐参数">
                  <Clock size={13} />
                  {formatSeconds(durationSeconds)}
                  {musicCapability.instrumentalToggle && <span className="opacity-70"> / {instrumental ? '纯音乐' : '带人声'}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" aria-label="音乐参数" className="parameter-popover w-72 max-w-[calc(100vw-32px)] space-y-4 p-4">
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold">时长</legend>
                  <div className={cn(parameterGroupClassName, 'grid-cols-3')}>
                    {MUSIC_DURATION_PRESETS.filter((value) => value >= musicCapability.minSeconds && value <= musicCapability.maxSeconds).map((value) => (
                      <button key={value} type="button" aria-label={`时长 ${formatSeconds(value)}`} aria-pressed={durationSeconds === value}
                        onClick={() => updateNode(id, { durationSeconds: value }, { history: true })}
                        className={cn(parameterOptionClassName, 'h-8 px-2')}>
                        {formatSeconds(value)}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {musicCapability.instrumentalToggle && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold">人声</legend>
                    <div className={cn(parameterGroupClassName, 'grid-cols-2')}>
                      {[true, false].map((value) => (
                        <button key={String(value)} type="button" aria-pressed={instrumental === value}
                          onClick={() => updateNode(id, { instrumental: value }, { history: true })}
                          className={cn(parameterOptionClassName, 'h-8 px-2')}>
                          {value ? '纯音乐' : '带人声'}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <p className="text-[11px] leading-5 text-muted-foreground">按时长计费，单次提交不自动重试。歌词与参考音频当前模型未开放。</p>
              </PopoverContent>
            </Popover>
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
              <DropdownMenuContent align="start" side="top" className="w-[188px]">
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
        {kind === 'audio' && choice.model && !musicCapability && !error && (
          <div role="status" className="mx-1 mt-2 rounded-md bg-muted px-2 py-1.5 text-xs leading-5 text-muted-foreground">
            「{choice.model}」没有已实现的音乐生成协议，不会发起请求。请在设置 → API 与模型的「音乐」类型中添加已登记的音乐模型。
          </div>
        )}
        {!error && notice && !generating && (
          <div role="status" className="mx-1 mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs leading-5 text-amber-600 dark:text-amber-400">{notice}</div>
        )}
    </div>
  );
};
