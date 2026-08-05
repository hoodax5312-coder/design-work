import {
  type AdvancedSettings,
  type AnalysisReport,
  type GenerationConfig,
  type ManualProductInfo,
  TypographyStyle,
  VisualStyle,
} from '../types/kvmaster.types';

const normalizeBaseUrl = (baseUrl: string) => {
  const trimmed = (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  return trimmed.endsWith('/v1beta') ? trimmed : `${trimmed}/v1beta`;
};

const callGemini = async (
  apiKey: string,
  baseUrl: string,
  model: string,
  body: Record<string, unknown>,
) => {
  const key = apiKey.trim();
  if (!key) throw new Error('请先配置 Gemini API Key');

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Gemini request failed: ${response.status}`);
  }

  return response.json();
};

const textFromResponse = (response: any) => {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.map((part: any) => part.text || '').join('').trim();
};

const imagePartFromBase64 = (image: string) => {
  const mimeMatch = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const data = image.includes('base64,') ? image.split('base64,')[1] : image;
  return { inlineData: { mimeType, data } };
};

const ensureArray = (value: unknown): string[] => Array.isArray(value) ? value.filter(Boolean).map(String) : [];

export const validateApiKey = async (apiKey: string, baseUrl: string): Promise<boolean> => {
  if (!apiKey.trim()) return false;

  try {
    await callGemini(apiKey, baseUrl, 'gemini-2.5-flash', {
      contents: [{ parts: [{ text: 'ping' }] }],
      generationConfig: { maxOutputTokens: 1 },
    });
    return true;
  } catch (error) {
    console.error('API Key validation failed:', error);
    return false;
  }
};

export const analyzeProductImage = async (
  apiKey: string,
  base64Images: string[],
  settings: AdvancedSettings,
  manualInfo?: ManualProductInfo,
): Promise<AnalysisReport> => {
  const parts: any[] = base64Images.map(imagePartFromBase64);

  if (manualInfo?.logoBase64) {
    parts.push(imagePartFromBase64(manualInfo.logoBase64));
  }

  parts.push({
    text: `
你是一位专业品牌策略专家。请分析上传的 ${base64Images.length} 张产品图片，建立电商详情页视觉素材索引，并输出中文 JSON。

请识别：
1. 图片素材索引 imageTags：按上传顺序输出，如 "[PRODUCT] 产品包装正面图"、"[TEXTURE] 膏体质地特写"、"[PROCESS] 工艺过程"、"[AUTHORITY] 证书奖牌"、"[DETAIL] 局部细节"。
2. 品牌、产品类型、产品名、规格、目标人群、价格/消费层级、卖点、认证、视觉特征、数据指标、使用场景、保质期、包装结构、品牌调性。
3. 主色/辅助色、设计风格、字体风格、视觉元素。

只返回 JSON，不要 Markdown。字段结构：
{
  "imageTags": string[],
  "brandName": {"chinese": string, "english": string, "logoStyle": string},
  "productType": string,
  "productName": string,
  "productSpecs": string,
  "marketingCopy": string[],
  "colors": {"primary": string[], "secondary": string[], "styleDescription": string},
  "designStyle": string,
  "fontStyle": string,
  "visualElements": string,
  "targetAudience": string,
  "targetAudienceAge": string,
  "consumptionLevel": string,
  "productMaterials": string,
  "packagingMaterial": string,
  "packagingStructure": string,
  "packagingDesign": string,
  "productCertifications": string[],
  "visualFeatures": string[],
  "dataMetrics": string[],
  "usageScenario": string,
  "shelfLife": string,
  "brandTone": string
}

用户补充信息：
产品名：${manualInfo?.name || '未填写'}
产品描述：${manualInfo?.description || '未填写'}
`,
  });

  const response = await callGemini(apiKey, settings.baseUrl, settings.textModel, {
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  const raw = JSON.parse(textFromResponse(response));

  return {
    ...raw,
    brandName: raw.brandName || { chinese: manualInfo?.name || '未知品牌', english: '' },
    colors: raw.colors || { primary: [], secondary: [] },
    imageTags: ensureArray(raw.imageTags),
    marketingCopy: ensureArray(raw.marketingCopy),
    productCertifications: ensureArray(raw.productCertifications),
    visualFeatures: ensureArray(raw.visualFeatures),
    dataMetrics: ensureArray(raw.dataMetrics),
    sellingPoints: ensureArray(raw.marketingCopy || raw.sellingPoints),
    productMaterials: raw.productMaterials || '',
    usageScenario: raw.usageScenario || '',
    shelfLife: raw.shelfLife || '',
    brandTone: raw.brandTone || '',
  } as AnalysisReport;
};

export const generateCampaignPrompts = async (
  apiKey: string,
  analysis: AnalysisReport,
  config: GenerationConfig,
  settings: AdvancedSettings,
  manualInfo?: ManualProductInfo,
): Promise<string> => {
  const brandName = manualInfo?.name || analysis.brandName?.chinese || analysis.brandName?.english || 'BRAND';
  const imageInventory = analysis.imageTags?.length
    ? analysis.imageTags.map((tag, index) => `Image Index [${index}]: ${tag}`).join('\n')
    : 'Image Index [0]: [PRODUCT] Main Product Image';

  const scenarioList = config.selectedScenarios.map((scenario, index) => (
    `${index + 1}. ${scenario.label}: ${scenario.desc}`
  )).join('\n');

  const styleInstruction = config.visualStyle === VisualStyle.AUTO
    ? '请基于产品属性自动选择最合适的电商视觉风格。'
    : `指定视觉风格：${config.visualStyle}`;

  const typographyInstruction = config.typographyStyle === TypographyStyle.AUTO
    ? '请基于画面自动选择最合适的排版风格。'
    : `指定排版风格：${config.typographyStyle}`;

  const prompt = `
你是一位世界级电商视觉策划师 KV Master。请严格根据素材索引和场景清单，生成 ${config.selectedScenarios.length} 个电商详情页 KV 海报方案。

品牌：${brandName}
产品：${analysis.productName || analysis.productType}
卖点：${analysis.marketingCopy?.join(' | ') || '未识别'}
素材索引：
${imageInventory}

场景清单：
${scenarioList}

${styleInstruction}
${typographyInstruction}
画面比例：${config.aspectRatio}
主标题语言：${config.mainLanguage}
副文案语言：${config.subLanguage}

选图规则：
- 主视觉优先选 [PRODUCT]
- 工艺/技术优先选 [PROCESS] 或 [TEXTURE]
- 背书/评价优先选 [AUTHORITY]
- 细节特写优先选 [DETAIL] 或 [TEXTURE]
- Prompt 中引用素材时使用 "The object shown in [Image X]"，不要重新虚构包装外观。

请严格按以下 Markdown 格式输出，不要加代码块：

## 海报[编号] | [场景名称]
**创意描述 (Chinese)**: [画面描述与选图理由]
**参考图索引**: [0, 1]
**排版策略 (Chinese)**:
- **构图思路**: [说明]
- **主标题**: [标题]
- **副文案**: [副文案]
**Prompt (English)**: [完整英文生图 prompt，包含参考图引用、光影、背景、文字 text '...' 指令]
**Negative Prompts**: [负面词]
---
`;

  const response = await callGemini(apiKey, settings.baseUrl, settings.textModel, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
  });

  return textFromResponse(response);
};

export const generatePosterImage = async (
  apiKey: string,
  prompt: string,
  settings: AdvancedSettings,
  aspectRatio = '9:16',
  referenceImageBase64s: string[] = [],
  logoImageBase64?: string | null,
  modelRefImageBase64?: string | null,
): Promise<string> => {
  const supportedRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
  const targetRatio = supportedRatios.includes(aspectRatio)
    ? aspectRatio
    : aspectRatio === '2:3' || aspectRatio === '4:5'
      ? '3:4'
      : aspectRatio === '3:2'
        ? '4:3'
        : aspectRatio === '21:9'
          ? '16:9'
          : '1:1';

  const parts: any[] = referenceImageBase64s.map(imagePartFromBase64);
  if (logoImageBase64) parts.push(imagePartFromBase64(logoImageBase64));
  if (modelRefImageBase64) parts.push(imagePartFromBase64(modelRefImageBase64));

  const logoIndex = referenceImageBase64s.length + 1;
  const modelIndex = referenceImageBase64s.length + (logoImageBase64 ? 1 : 0) + 1;
  const refIntro = referenceImageBase64s.map((_, index) => `[IMAGE ${index + 1}] is a reference asset.`).join('\n');

  parts.push({
    text: `
${refIntro}
${logoImageBase64 ? `[IMAGE ${logoIndex}] is the brand logo.` : ''}
${modelRefImageBase64 ? `[IMAGE ${modelIndex}] is the human face reference.` : ''}

MANDATORY:
- Use reference product assets faithfully.
- Do not redesign packaging or logo.
- Preserve product identity.
- Generate an ecommerce key visual with aspect ratio ${targetRatio}.

SCENE DESCRIPTION:
${prompt}
`,
  });

  const response = await callGemini(apiKey, settings.baseUrl, settings.imageModel, {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: targetRatio,
        ...(settings.imageModel.includes('pro') ? { imageSize: settings.imageSize } : {}),
      },
    },
  });

  const responseParts = response?.candidates?.[0]?.content?.parts || [];
  const inline = responseParts.find((part: any) => part.inlineData);
  if (!inline?.inlineData) throw new Error('未生成图片');

  return `data:${inline.inlineData.mimeType};base64,${inline.inlineData.data}`;
};
