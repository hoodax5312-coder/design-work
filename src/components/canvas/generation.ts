import type { Edge, Node } from '@xyflow/react';
import { assetService } from '../../services/assetService';
import { generateProviderImage, generateProviderMusic, generateProviderText, generateProviderVideo } from '../../services/providerService';
import { assertMusicModelSupported, clampMusicSeconds } from '../../lib/musicModels';
import { canvasImageCapability, resolveCanvasImageParameters } from '../../lib/canvasImageCapabilities';
import { imageInputFromNode, resolveImageInput, type CanvasImageInput } from './imageInputs';
import { runningGenerations, useCanvasStore } from '../../stores/useCanvasStore';
import { assertReferenceImageSupported, readReferenceImage } from './referenceImage';
import {
  getConfiguredModels,
  getSelectedModel,
  providerSupportsCategory,
  useProviderStore,
  type ModelCategory,
  type ProviderConfig,
} from '../../stores/useProviderStore';
import {
  audioMediaUrl,
  clampCount,
  collectChain,
  composeMusicPrompt,
  composePrompt,
  isCanvasNodeKind,
  mergeResults,
  nodeTitle,
  readResults,
  videoResolutionForRatio,
  type CanvasNodeKind,
  type CanvasResult,
  type CanvasImageGenerationSnapshot,
} from './canvasModel';

export const NODE_CATEGORY: Record<CanvasNodeKind, ModelCategory> = { text: 'language', imageGen: 'image', video: 'video', audio: 'music' };
const CATEGORY_LABEL: Record<ModelCategory, string> = { language: '文本', image: '图像', video: '视频', music: '音乐' };

/** 视频结果可能是整段 base64，历史版本少留几条。 */
const MAX_VIDEO_RESULTS = 8;

export const STOPPED_NOTICE = '已停止。请求已在本地取消，供应商侧可能仍会完成并计费';

export interface ModelOption {
  value: string;
  provider: ProviderConfig;
  model: string;
}

export const modelOptionsFor = (providers: ProviderConfig[], category: ModelCategory, activeProviderId?: string): ModelOption[] =>
  providers.filter((provider) => provider.id === activeProviderId).flatMap((provider) => getConfiguredModels(provider, category)
    .map((model) => ({ value: `${provider.id}::${model.id}`, provider, model: model.id })));

/** 节点自身选择 → 当前默认厂商 → 第一个可用模型。 */
export const resolveModelChoice = (
  data: Record<string, unknown>,
  category: ModelCategory,
  providers: ProviderConfig[],
  activeProviderId?: string,
): { provider?: ProviderConfig; model: string; option?: ModelOption; options: ModelOption[] } => {
  const options = modelOptionsFor(providers, category, activeProviderId);
  const provider = providers.find((item) => item.id === activeProviderId && providerSupportsCategory(item, category));
  const requested = typeof data.model === 'string' ? data.model : '';
  const model = requested && getConfiguredModels(provider, category).some((item) => item.id === requested)
    ? requested
    : getSelectedModel(provider, category) || options[0]?.model || '';
  const option = options.find((item) => item.provider.id === provider?.id && item.model === model);
  return { provider, model, option, options };
};

export interface UpstreamReference {
  id: string;
  kind: CanvasNodeKind;
  title: string;
  text: string;
  mediaUrl?: string;
  /** 文本可拼入提示词；图片还需在运行前按目标模型及数量校验。 */
  sendable: boolean;
  assetId?: string;
  error?: string;
}

export const upstreamReferences = (nodeId: string, nodes: Node[], edges: Edge[]): UpstreamReference[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const target = byId.get(nodeId);
  const seen = new Set<string>();
  return edges
    .filter((edge) => {
      if (edge.target !== nodeId || seen.has(edge.source)) return false;
      seen.add(edge.source);
      return true;
    })
    .map((edge) => byId.get(edge.source))
    .filter((node): node is Node => Boolean(node) && isCanvasNodeKind(node?.type))
    .map((node) => {
      const kind = node.type as CanvasNodeKind;
      const text = kind === 'text' ? String(node.data?.content || node.data?.prompt || '') : '';
      const mediaUrl = kind === 'imageGen' ? String(node.data?.imageUrl || '') : kind === 'video' ? String(node.data?.previewUrl || '') : kind === 'audio' ? String(node.data?.audioUrl || '') : '';
      if (kind === 'imageGen' && target?.type === 'imageGen') {
        try {
          const image = imageInputFromNode(node);
          return { id: node.id, kind, title: nodeTitle(node), text, mediaUrl: mediaUrl || undefined, sendable: true, assetId: image.assetId };
        } catch (error) {
          return { id: node.id, kind, title: nodeTitle(node), text, mediaUrl: mediaUrl || undefined, sendable: false, error: errorMessage(error, '参考图不可用') };
        }
      }
      return { id: node.id, kind, title: nodeTitle(node), text, mediaUrl: mediaUrl || undefined, sendable: kind === 'text' && Boolean(text.trim()) };
    });
};

/** 节点自身的需求文本：音乐节点由风格、情绪、乐器、节奏与用途拼成。 */
export const ownPrompt = (node: Pick<Node, 'type' | 'data'>) =>
  node.type === 'audio' ? composeMusicPrompt((node.data || {}) as Record<string, unknown>) : String(node.data?.prompt || '').trim();

/** 有提示词或可发送的上游文本，且不在生成中。 */
export const isNodeRunnable = (node: Node, nodes: Node[], edges: Edge[]) => {
  if (!isCanvasNodeKind(node.type) || node.data?.isGenerating || node.data?.uploading
    || !(ownPrompt(node) || upstreamReferences(node.id, nodes, edges).some((reference) => reference.kind === 'text' && reference.sendable))) return false;
  if (node.type === 'imageGen') {
    const { providers, activeProviderIds } = useProviderStore.getState();
    const { provider, model } = resolveModelChoice(node.data, 'image', providers, activeProviderIds.image);
    if (!provider || !model) return false;
    try {
      resolveCanvasImageParameters(provider.protocol, model, node.data);
      resolveImageInput(node.id, node.data, nodes, edges, canvasImageCapability(provider.protocol, model).maxReferences);
    } catch { return false; }
  }
  return true;
};

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

const nodeData = (nodeId: string) =>
  (useCanvasStore.getState().nodes.find((node) => node.id === nodeId)?.data || undefined) as Record<string, unknown> | undefined;

/* ---------------- 停止 ---------------- */

const controllers = new Map<string, AbortController>();

/**
 * 停止只在本地生效：取消浏览器请求并丢弃之后的返回。
 * 当前网关是同步转发，供应商侧可能仍会完成并计费，界面如实提示。
 */
export const stopNodeGeneration = (nodeId: string) => {
  const controller = controllers.get(nodeId);
  if (!controller) return false;
  controller.abort();
  return true;
};

export const stopNodeGenerations = (ids: string[]) => ids.filter((id) => stopNodeGeneration(id)).length;

/* ---------------- 结果入库 ---------------- */

/** 修改某条结果；它正是当前主图时同步主图地址。 */
const patchResult = (nodeId: string, resultId: string, patch: Partial<CanvasResult>) => {
  const data = nodeData(nodeId);
  if (!data) return;
  const results = readResults(data).map((result) => (result.id === resultId ? { ...result, ...patch } : result));
  const active = data.activeResultId === resultId && patch.url ? { imageUrl: patch.url } : {};
  useCanvasStore.getState().updateNode(nodeId, { results, ...active });
};

/**
 * 生成的图片逐张存入资产库。入库后改用本机原图地址：
 * 供应商返回的临时链接会过期，整段 base64 也不适合长期留在画布缓存里。
 */
const saveImageResults = async (nodeId: string, results: CanvasResult[], meta: Record<string, unknown>, notice?: string) => {
  const outcomes = await Promise.allSettled(results.map(async (result) => {
    const asset = await assetService.create({
      type: 'image',
      title: `画布生成 / ${new Date(result.createdAt).toLocaleDateString('zh-CN')}`,
      description: result.prompt,
      sourceUrl: result.url,
      userMetadata: { source: 'canvas', canvasNodeId: nodeId, canvasResultId: result.id, prompt: result.prompt, model: result.model, ...meta, generationSnapshot: result.generationSnapshot },
    });
    if (!asset.id) throw new Error('图片入库失败：没有返回资产 ID');
    patchResult(nodeId, result.id, { assetId: asset.id, url: `/api/assets/${encodeURIComponent(asset.id)}/original` });
  }));
  const failed = outcomes.filter((outcome) => outcome.status === 'rejected').length;
  const saveNotice = !failed ? '' : results.length > 1 ? `其中 ${failed} 张保存至资产库失败` : '图片已生成，但保存至资产库失败';
  const combined = [notice, saveNotice].filter(Boolean).join('；');
  useCanvasStore.getState().updateNode(nodeId, { assetSaved: !failed, ...(combined ? { notice: combined } : {}) });
};

/* ---------------- 运行 ---------------- */

export type GenerationOutcome = 'done' | 'failed' | 'stopped' | 'skipped';

/**
 * 运行一个节点的生成。所有入口（提示词面板、节点工具条、快捷键、批量运行）共用这一条链路。
 * 失败时把真实错误写回节点，不伪造结果。
 */
export const runNodeGeneration = async (nodeId: string): Promise<GenerationOutcome> => {
  const { nodes, edges, updateNode } = useCanvasStore.getState();
  const node = nodes.find((item) => item.id === nodeId);
  if (!node || !isCanvasNodeKind(node.type) || node.data?.uploading || runningGenerations.has(nodeId)) return 'skipped';
  const kind = node.type;
  const data = (node.data || {}) as Record<string, unknown>;
  const category = NODE_CATEGORY[kind];
  const { providers, activeProviderIds } = useProviderStore.getState();
  const { provider, model } = resolveModelChoice(data, category, providers, activeProviderIds[category]);
  const references = upstreamReferences(nodeId, nodes, edges).filter((reference) => reference.kind === 'text' && reference.sendable);
  const prompt = composePrompt(ownPrompt(node), references);

  if (!prompt) {
    updateNode(nodeId, { error: references.length ? '上游文本为空，请先填写内容' : '请先输入提示词', notice: undefined });
    return 'failed';
  }
  if (!provider || !model) {
    updateNode(nodeId, { error: `请先在设置 → API 与模型中配置${CATEGORY_LABEL[category]}模型`, notice: undefined });
    return 'failed';
  }

  let imageInput: CanvasImageInput | undefined;
  let imageParameters: ReturnType<typeof resolveCanvasImageParameters> | undefined;
  if (kind === 'imageGen') {
    try {
      imageParameters = resolveCanvasImageParameters(provider.protocol, model, data);
      imageInput = resolveImageInput(nodeId, data, nodes, edges, canvasImageCapability(provider.protocol, model).maxReferences);
      if (imageInput) assertReferenceImageSupported(kind, provider, model);
    } catch (error) {
      updateNode(nodeId, { error: errorMessage(error, '图片参数或参考无效'), notice: undefined });
      return 'failed';
    }
  }
  if (kind === 'video' && data.referenceImage != null) {
    try {
      if (!readReferenceImage(data.referenceImage)) throw new Error('参考图资产引用无效，请重新选择');
      assertReferenceImageSupported(kind, provider, model);
    } catch (error) {
      updateNode(nodeId, { error: errorMessage(error, '当前协议不支持参考图'), notice: undefined });
      return 'failed';
    }
  }

  if (kind === 'audio') {
    try {
      assertMusicModelSupported(provider.protocol, model);
    } catch (error) {
      updateNode(nodeId, { error: errorMessage(error, '当前模型不支持音乐生成'), notice: undefined });
      return 'failed';
    }
  }

  const controller = new AbortController();
  const { signal } = controller;
  controllers.set(nodeId, controller);
  runningGenerations.add(nodeId);
  const startedAt = Date.now();
  updateNode(nodeId, { isGenerating: true, error: undefined, notice: undefined, stoppedAt: undefined, providerId: provider.id, model, startedAt });

  const markStopped = (notice = STOPPED_NOTICE) => {
    updateNode(nodeId, { isGenerating: false, stoppedAt: Date.now(), notice });
    return 'stopped' as const;
  };

  try {
    if (kind === 'text') {
      const result = await generateProviderText(provider, prompt, model, signal);
      if (signal.aborted) return markStopped();
      updateNode(nodeId, { content: result.content, isGenerating: false });
      return 'done';
    }

    if (kind === 'imageGen') {
      const { aspectRatio: ratio, quality, size } = imageParameters!;
      const count = clampCount(data.count);
      const referenceImage = imageInput;
      // 只拷贝实际请求参数，不保存 API Key / Base URL；编辑节点不会改写旧结果。
      const snapshot: CanvasImageGenerationSnapshot = {
        version: 1, providerId: provider.id, protocol: provider.protocol, model, prompt,
        ownPrompt: ownPrompt(node), aspectRatio: ratio, size, quality, count, requestCount: 1,
        ...(referenceImage ? { referenceImage: { ...referenceImage } } : {}),
        textReferences: references.map(({ id, title, text }) => ({ id, title, text })),
      };
      // 每张图是一次独立的真实请求：网关按 n=1 转发，不假装供应商支持一次多张。
      const settled = await Promise.allSettled(Array.from({ length: count }, async (): Promise<CanvasResult> => {
        const result = await generateProviderImage(provider, {
          prompt, size, quality, canvasParameters: { aspectRatio: ratio, quality },
          ...(referenceImage ? { referenceImage: { assetId: referenceImage.assetId } } : {}),
        }, model, signal);
        return { id: crypto.randomUUID(), url: result.url, prompt, model, createdAt: Date.now(), durationMs: Date.now() - startedAt, generationSnapshot: JSON.parse(JSON.stringify(snapshot)) as CanvasImageGenerationSnapshot };
      }));
      const fresh = settled.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : []));
      const failures = settled.flatMap((outcome) => (outcome.status === 'rejected' ? [outcome.reason] : []));

      if (fresh.length) {
        const latest = nodeData(nodeId);
        updateNode(nodeId, {
          results: mergeResults(readResults(latest), fresh),
          imageUrl: fresh[0].url,
          activeResultId: fresh[0].id,
          isGenerating: false,
          assetSaved: false,
        });
      }
      if (signal.aborted) {
        const notice = fresh.length ? `已停止，保留已返回的 ${fresh.length} 张` : STOPPED_NOTICE;
        if (fresh.length) await saveImageResults(nodeId, fresh, { ratio, quality }, notice);
        return markStopped(notice);
      }
      if (!fresh.length) {
        updateNode(nodeId, { isGenerating: false, error: errorMessage(failures[0], '生成失败') });
        return 'failed';
      }
      const partial = failures.length ? `${count} 张中有 ${failures.length} 张失败：${errorMessage(failures[0], '生成失败')}` : undefined;
      if (partial) updateNode(nodeId, { notice: partial });
      // 下游图片参考必须等入库后才能读取原文件，不能在入库仍在途时启动。
      await saveImageResults(nodeId, fresh, { ratio, quality }, partial);
      return 'done';
    }

    if (kind === 'audio') {
      const capability = assertMusicModelSupported(provider.protocol, model);
      const durationSeconds = clampMusicSeconds(data.durationSeconds, capability);
      const instrumental = capability.instrumentalToggle ? data.instrumental !== false : true;
      // 单次提交，不自动重试；网关已把结果写入资产库，节点只保存资产引用。
      const result = await generateProviderMusic(provider, { prompt, durationSeconds, instrumental, canvasNodeId: nodeId }, model, signal);
      if (signal.aborted) return markStopped();
      const entry: CanvasResult = { id: crypto.randomUUID(), url: audioMediaUrl(result.assetId), assetId: result.assetId, prompt, model, createdAt: Date.now(), durationMs: Date.now() - startedAt };
      updateNode(nodeId, {
        results: mergeResults(readResults(nodeData(nodeId)), [entry]),
        audioUrl: entry.url,
        audioAssetId: result.assetId,
        audioName: result.title,
        activeResultId: entry.id,
        source: 'generated',
        isGenerating: false,
        assetSaved: true,
      });
      return 'done';
    }

    const ratio = String(data.aspectRatio || '16:9');
    const resolution = videoResolutionForRatio(ratio);
    const result = await generateProviderVideo(provider, { prompt, resolution }, model, signal);
    if (signal.aborted) return markStopped();
    const entry: CanvasResult = { id: crypto.randomUUID(), url: result.url, prompt, model, createdAt: Date.now(), durationMs: Date.now() - startedAt };
    updateNode(nodeId, {
      results: mergeResults(readResults(nodeData(nodeId)), [entry], MAX_VIDEO_RESULTS),
      previewUrl: result.url,
      activeResultId: entry.id,
      taskId: result.id,
      isGenerating: false,
      assetSaved: false,
      status: undefined,
    });
    try {
      await assetService.create({
        type: 'video',
        title: `画布生成 / ${new Date().toLocaleDateString('zh-CN')}`,
        description: prompt,
        sourceUrl: result.url,
        userMetadata: { source: 'canvas', canvasNodeId: nodeId, canvasResultId: entry.id, generatedUrl: result.url, prompt, model, ratio, resolution, taskId: result.id },
      });
      updateNode(nodeId, { assetSaved: true });
    } catch {
      updateNode(nodeId, { notice: '视频已生成，但保存至资产库失败' });
    }
    return 'done';
  } catch (error) {
    if (signal.aborted) return markStopped();
    updateNode(nodeId, { isGenerating: false, error: errorMessage(error, '生成失败') });
    return 'failed';
  } finally {
    runningGenerations.delete(nodeId);
    if (controllers.get(nodeId) === controller) controllers.delete(nodeId);
  }
};

export interface RunSummary { done: number; failed: number; stopped: number; skipped: number }

/**
 * 按依赖顺序运行：上游先跑完，下游再拿到最新的文本内容。同一层并行。
 * 上游失败或被停止时，依赖它的下游不再发请求，避免拿着旧内容白白计费。
 */
export const runNodesInOrder = async (ids: string[]): Promise<RunSummary> => {
  const summary: RunSummary = { done: 0, failed: 0, stopped: 0, skipped: 0 };
  const pending = new Set(ids);
  const blocked = new Set<string>();
  const { edges } = useCanvasStore.getState();
  while (pending.size) {
    const layer = [...pending].filter((id) => !edges.some((edge) => edge.target === id && pending.has(edge.source)));
    const batch = layer.length ? layer : [...pending];
    batch.forEach((id) => pending.delete(id));
    const runnable = batch.filter((id) => {
      if (!edges.some((edge) => edge.target === id && blocked.has(edge.source))) return true;
      blocked.add(id);
      summary.skipped += 1;
      useCanvasStore.getState().updateNode(id, { notice: '上游未完成，已跳过' });
      return false;
    });
    const outcomes = await Promise.all(runnable.map((id) => {
      const state = useCanvasStore.getState();
      const node = state.nodes.find((item) => item.id === id);
      if (node?.type === 'imageGen' && !ownPrompt(node)
        && !upstreamReferences(id, state.nodes, state.edges).some((reference) => reference.kind === 'text' && reference.sendable)) {
        // 纯素材源不需要重新生成；已有原图可直接供下游使用。
        try { imageInputFromNode(node); return Promise.resolve('skipped' as const); } catch { /* Fall through to the visible generation error. */ }
      }
      return runNodeGeneration(id);
    }));
    outcomes.forEach((outcome, index) => {
      summary[outcome] += 1;
      if (outcome === 'failed' || outcome === 'stopped') blocked.add(runnable[index]);
    });
  }
  return summary;
};

/** 批量运行结束后的一句话总结。 */
export const describeRunSummary = (summary: RunSummary) => {
  const parts = [
    summary.done && `完成 ${summary.done} 个`,
    summary.failed && `失败 ${summary.failed} 个`,
    summary.stopped && `停止 ${summary.stopped} 个`,
    summary.skipped && `因上游未完成跳过 ${summary.skipped} 个`,
  ].filter(Boolean);
  return parts.length ? `运行结束：${parts.join('，')}` : '没有运行任何节点';
};

/** 从此处运行（自身及下游）或运行到此（全部上游及自身），只运行其中可运行的生成节点。 */
export const chainRunTargets = (id: string, direction: 'down' | 'up') => {
  const { nodes, edges } = useCanvasStore.getState();
  const chain = new Set(collectChain(id, edges, direction));
  return nodes.filter((node) => chain.has(node.id) && isNodeRunnable(node, nodes, edges)).map((node) => node.id);
};
