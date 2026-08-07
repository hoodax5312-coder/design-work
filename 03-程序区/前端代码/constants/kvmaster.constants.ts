import { TypographyStyle, VisualStyle, type ScenarioItem } from '../types/kvmaster.types';

export const VISUAL_STYLES = [
  { id: VisualStyle.AUTO, label: '智能匹配', desc: 'AI 根据产品属性自动匹配最佳风格' },
  { id: 'Magazine Editorial', label: '杂志编辑风格', desc: '高级、专业、大片感、粗衬线标题、极简留白' },
  { id: 'Watercolor Art', label: '水彩艺术风格', desc: '温暖、柔和、晕染效果、手绘质感' },
  { id: 'Tech Future', label: '科技未来风格', desc: '冷色调、几何图形、数据可视化、蓝光效果' },
  { id: 'Retro Film', label: '复古胶片风格', desc: '颗粒质感、暖色调、怀旧氛围、宝丽来边框' },
  { id: 'Nordic Minimalist', label: '极简北欧风格', desc: '大留白、几何线条、黑白灰、精确秩序' },
  { id: 'Neon Cyberpunk', label: '霓虹赛博风格', desc: '荧光色、描边发光、未来都市、暗色背景' },
  { id: 'Natural Organic', label: '自然有机风格', desc: '植物元素、大地色系、手工质感、环保理念' },
];

export const TYPO_STYLES = [
  { id: TypographyStyle.AUTO, label: '智能匹配', desc: 'AI 根据画面风格自动匹配排版' },
  { id: 'Magazine Grid', label: '杂志风', desc: '粗衬线大标题 + 细线装饰 + 网格对齐' },
  { id: 'Modern Glass', label: '现代风', desc: '玻璃拟态卡片 + 半透明背景 + 柔和圆角' },
  { id: 'Luxury 3D', label: '奢华风', desc: '3D 浮雕文字 + 金属质感 + 光影效果' },
  { id: 'Artistic Handwritten', label: '艺术风', desc: '手写体标注 + 水彩笔触 + 不规则布局' },
  { id: 'Cyber Neon', label: '赛博风', desc: '无衬线粗体 + 霓虹描边 + 发光效果' },
  { id: 'Minimal Clean', label: '极简风', desc: '极细线条字 + 大量留白 + 精确对齐' },
];

export const ASPECT_RATIOS = ['9:16', '2:3', '3:4', '4:5', '1:1', '4:3', '3:2', '16:9', '21:9'];

export const LANGUAGES = [
  { id: 'Chinese', label: '中文' },
  { id: 'English', label: 'English' },
  { id: 'Japanese', label: '日本語' },
  { id: 'Korean', label: '한국어' },
  { id: 'French', label: 'Français' },
  { id: 'German', label: 'Deutsch' },
  { id: 'Spanish', label: 'Español' },
  { id: 'none', label: '无副文案' },
];

export const DEFAULT_SCENARIOS: ScenarioItem[] = [
  { id: '01_hero', label: '01 主KV视觉', desc: '严格还原产品，极致展现品牌调性' },
  { id: '02_lifestyle', label: '02 生活/使用场景', desc: '展示产品在实际生活中的使用状态' },
  { id: '03_process', label: '03 工艺/技术/概念', desc: '可视化展示成分、工艺或技术核心' },
  { id: '04_detail1', label: '04 细节特写01', desc: '放大产品局部细节' },
  { id: '05_detail2', label: '05 细节特写02', desc: '材质与质感特写' },
  { id: '06_detail3', label: '06 细节特写03', desc: '功能细节展示' },
  { id: '07_review', label: '07 用户评价', desc: '好评展示或更多细节' },
  { id: '08_story', label: '08 品牌故事', desc: 'Moodboard 与品牌配色灵感' },
  { id: '09_specs', label: '09 产品参数', desc: '规格表与数据化卖点展示' },
  { id: '10_guide', label: '10 使用指南', desc: '步骤图或使用说明' },
];
