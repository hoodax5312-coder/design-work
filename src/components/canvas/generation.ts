import type { Edge, Node } from '@xyflow/react';
import { assetService } from '../../services/assetService';
import { generateProviderImage, generateProviderText, generateProviderVideo } from '../../services/providerService';
import { runningGenerations, useCanvasStore } from '../../stores/useCanvasStore';
import {
  getConfiguredModels,
  getSelectedModel,
  providerSupportsCategory,
  useProviderStore,
  type ModelCategory,
  type ProviderConfig,
} from '../../stores/useProviderStore';
import {
  assetPreviewUrl,
  clampCount,
  collectChain,
  composePrompt,
  imageSizeForRatio,
  isCanvasNodeKind,
  mergeResults,
  nodeTitle,
  readResults,
  videoResolutionForRatio,
  type CanvasNodeKind,
  type CanvasResult,
} from './canvasModel';

export const NODE_CATEGORY: Record<CanvasNodeKind, ModelCategory> = { text: 'language', imageGen: 'image', video: 'video' };
const CATEGORY_LABEL: Record<ModelCategory, string> = { language: '文本', image: '图像', video: '视频' };

/** 视频结果可能是整段 base64，历史版本少留几条。 */
const MAX_VIDEO_RESULTS = 8;

export const STOPPED_NOTICE = '已停止。请求已在本地取消，供应商侧可能仍会完成并计费';

export interface ModelOption {
  value: string;
  provider: ProviderConfig;
  model: string;
}

export const modelOptionsFor = (providers: ProviderConfig[], category: ModelCategory): ModelOption[] =>
  providers.flatMap((provider) => getConfiguredModels(provider, category)
    .map((model) => ({ value: `${provider.id}::${model.id}`, provider, model: model.id })));

/** 节点自身选择 → 当前默认厂商 → 第一个可用模型。 */
export const resolveModelChoice = (
  data: Record<string, unknown>,
  category: ModelCategory,
  providers: ProviderConfig[],
  activeProviderId?: string,
): { provider?: ProviderConfig; model: string; option?: ModelOption; options: ModelOption[] } => {
  const options = modelOptionsFor(providers, category);
  const provider = providers.find((item) => item.id === data.providerId && providerSupportsCategory(item, category))
    || providers.find((item) => item.id === activeProviderId && providerSupportsCategory(item, category))
    || options[0]?.provider;
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
  /** 当前接口能否随请求发送：文本内容会拼进提示词，图片与视频暂不支持。 */
  sendable: boolean;
}

export const upstreamReferences = (nodeId: string, nodes: Node[], edges: Edge[]): UpstreamReference[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => byId.get(edge.source))
    .filter((node): node is Node => Boolean(node) && isCanvasNodeKind(node?.type))
    .map((node) => {
      const kind = node.type as CanvasNodeKind;
      const text = kind === 'text' ? String(node.data?.content || node.data?.prompt || '') : '';
      const mediaUrl = kind === 'imageGen' ? String(node.data?.imageUrl || '') : kind === 'video' ? String(node.data?.previewUrl || '') : '';
      return { id: node.id, kind, title: nodeTitle(node), text, mediaUrl: mediaUrl || undefined, sendable: kind === 'text' && Boolean(text.trim()) };
    });
};

/** 有提示词或可发送的上游文本，且不在生成中。 */
export const isNodeRunnable = (node: Node, nodes: Node[], edges: Edge[]) =>
  isCanvasNodeKind(node.type) && !node.data?.isGenerating
  && (Boolean(String(node.data?.prompt || '').trim()) || upstreamReferences(node.id, nodes, edges).some((reference) => reference.sendable));

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

/** 等待资产库预览就绪，返回稳定地址；超时返回 null，调用方继续使用原地址。 */
const waitForAssetPreview = async (assetId: string, size = 1024, attempts = 16) => {
  await assetService.requestPreview(assetId, size).catch(() => undefined);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(assetPreviewUrl(assetId, size), { method: 'HEAD' }).catch(() => null);
    if (response?.ok) return assetPreviewUrl(assetId, size);
    await new Promise((resolve) => setTimeout(resolve, 500 + attempt * 150));
  }
  return null;
};

/** 修改某条结果；它正是当前主图时同步主图地址。 */
const patchResult = (nodeId: string, resultId: string, patch: Partial<CanvasResult>) => {
  const data = nodeData(nodeId);
  if (!data) return;
  const results = readResults(data).map((result) => (result.id === resultId ? { ...result, ...patch } : result));
  const active = data.activeResultId === resultId && patch.url ? { imageUrl: patch.url } : {};
  useCanvasStore.getState().updateNode(nodeId, { results, ...active });
};

/**
 * 生成的图片逐张存入资产库。入库后改用资产库的 1024 预览地址：
 * 供应商返回的临时链接会过期，整段 base64 也不适合长期留在画布缓存里。
 */
const saveImageResults = async (nodeId: string, results: CanvasResult[], meta: Record<string, unknown>, notice?: string) => {
  const outcomes = await Promise.allSettled(results.map(async (result) => {
    const asset = await assetService.create({
      type: 'image',
      title: `画布生成 · ${new Date(result.createdAt).toLocaleDateString('zh-CN')}`,
      description: result.prompt,
      sourceUrl: result.url,
      userMetadata: { source: 'canvas', canvasNodeId: nodeId, canvasResultId: result.id, prompt: result.prompt, model: result.model, ...meta },
    });
    patchResult(nodeId, result.id, { assetId: asset.id });
    const stable = await waitForAssetPreview(asset.id);
    if (stable) patchResult(nodeId, result.id, { url: stable });
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
  if (!node || !isCanvasNodeKind(node.type) || runningGenerations.has(nodeId)) return 'skipped';
  const kind = node.type;
  const data = (node.data || {}) as Record<string, unknown>;
  const category = NODE_CATEGORY[kind];
  const { providers, activeProviderIds } = useProviderStore.getState();
  const { provider, model } = resolveModelChoice(data, category, providers, activeProviderIds[category]);
  const references = upstreamReferences(nodeId, nodes, edges).filter((reference) => reference.sendable);
  const prompt = composePrompt(String(data.prompt || ''), references);

  if (!prompt) {
    updateNode(nodeId, { error: references.length ? '上游文本为空，请先填写内容' : '请先输入提示词', notice: undefined });
    return 'failed';
  }
  if (!provider || !model) {
    updateNode(nodeId, { error: `请先在设置 → API 与模型中配置${CATEGORY_LABEL[category]}模型`, notice: undefined });
    return 'failed';
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
      const ratio = String(data.aspectRatio || '1:1');
      const quality = String(data.quality || 'standard') as 'standard' | 'hd';
      const count = clampCount(data.count);
      // 每张图是一次独立的真实请求：网关按 n=1 转发，不假装供应商支持一次多张。
      const settled = await Promise.allSettled(Array.from({ length: count }, async (): Promise<CanvasResult> => {
        const result = await generateProviderImage(provider, { prompt, size: imageSizeForRatio(ratio), quality }, model, signal);
        return { id: crypto.randomUUID(), url: result.url, prompt, model, createdAt: Date.now(), durationMs: Date.now() - startedAt };
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
        if (fresh.length) void saveImageResults(nodeId, fresh, { ratio, quality }, notice);
        return markStopped(notice);
      }
      if (!fresh.length) {
        updateNode(nodeId, { isGenerating: false, error: errorMessage(failures[0], '生成失败') });
        return 'failed';
      }
      const partial = failures.length ? `${count} 张中有 ${failures.length} 张失败：${errorMessage(failures[0], '生成失败')}` : undefined;
      if (partial) updateNode(nodeId, { notice: partial });
      void saveImageResults(nodeId, fresh, { ratio, quality }, partial);
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
        title: `画布生成 · ${new Date().toLocaleDateString('zh-CN')}`,
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
    const outcomes = await Promise.all(runnable.map((id) => runNodeGeneration(id)));
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
