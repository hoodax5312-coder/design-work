import type { ProviderProtocol } from '../types/provider';

// Only documented GPT Image edits models; aliases and other vendors need explicit adapters.
// https://developers.openai.com/api/reference/resources/images/methods/edit (2026-10-26)
const EDIT_MODELS = new Set([
  'gpt-image-1-mini', 'gpt-image-1.5', 'gpt-image-2', 'gpt-image-2-2026-04-21',
  'gpt-image-2.5-sunburst', 'gpt-image-2.5-sunburst-2026-09-08',
  'gpt-image-2.5-flare', 'gpt-image-2.5-flare-2026-09-08', 'chatgpt-image-latest',
]);

export const assertImageEditSupported = (protocol: ProviderProtocol, model: string) => {
  if (!['responses', 'chat-completions'].includes(protocol) || !EDIT_MODELS.has(model)) {
    throw Object.assign(new Error(`当前 ${protocol} / ${model} 尚不支持已实现的标准图生图协议；请选择受支持的 GPT Image edits 模型。不会忽略参考图发起收费请求。`), { status: 400 });
  }
};
