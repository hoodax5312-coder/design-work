# Design QA：模型默认配置下拉菜单

- source visual truth path: `/var/folders/lx/m6jhyf_j7rj62zr076tmjckr0000gn/T/codex-clipboard-a6ecf4c4-b525-4d9f-9ecd-dc82449d9818.png`
- implementation screenshot path: `/Users/hoodax/Documents/Codex/项目-design work/03-程序区/电脑运行文件/design-qa-default-source-menu.jpg`
- focused comparison path: `/Users/hoodax/Documents/Codex/项目-design work/03-程序区/电脑运行文件/design-qa-default-source-menu-comparison.jpg`
- implementation URL: `http://127.0.0.1:5173/`
- viewport: `1375 × 923 CSS px`, `deviceScaleFactor: 1`
- source pixels: `1224 × 310`；implementation pixels: `1375 × 923`；focused comparison pixels: `1224 × 619`
- density normalization: 将实现局部区域等比缩放到参考图的 1224px 宽后上下排列比较；参考图为暗色主题，实现沿用当前产品亮色主题，颜色按现有语义 token 映射，不将主题差异视为偏差。
- state: 亮色模式，设置 > API 与模型 > 编辑 OpenAI Chat Completions > 文本模型 > minimax/minimax-m3 > API Key 默认配置菜单展开。

## Full-view comparison evidence

菜单在模型卡片内从 API Key 输入框下方展开，宽度与字段控件一致，并覆盖后续内容而不改变卡片排版。当前未保存的其他模型配置仍保留。

## Focused region comparison evidence

上下对照图确认实现已复现参考结构：箭头按钮呈打开态；下方是完整宽度、圆角、带阴影的浮层；第一行显示继承说明，第二行显示“默认”标签和脱敏继承值。浏览器实测菜单宽度 668px、圆角 8px、层级 50。

## Findings

- 无未解决的 P0/P1/P2 问题。
- Fonts and typography: 说明与继承值均为 14px；“默认”标签使用 12px，符合当前产品中文控件规范。
- Spacing and layout rhythm: 浮层与输入框间隔 4px，内边距 8px，内容项使用 12px 横向内边距和 12px 两行间距，结构与参考一致。
- Colors and visual tokens: 亮色模式使用 `bg-card`、`bg-muted`、`text-muted-foreground` 和低透明度边框；暗色模式使用对应语义 token。
- Image quality and asset fidelity: 当前目标不包含位图资产；下拉箭头与查看密钥继续使用 Lucide 矢量图标。
- Copy and content: “使用全局 KEY（不单独填写）”、中文“默认”标签和脱敏继承值完整呈现；URL 字段使用同构的“使用全局 URL（不单独填写）”。

## Primary interactions tested

- 点击来源箭头可展开默认配置菜单，按钮同步旋转并显示打开态。
- 点击默认项后恢复继承模式并关闭菜单。
- Escape 可关闭菜单。
- API Key 与 Base URL 使用同一套菜单交互。
- 自定义 URL 草稿 `2222` 在验证过程中保持不变。
- 浏览器 console error/warning 为 0。

## Comparison history

- Initial P1: 原生 `select` 只显示一个狭窄的浏览器菜单，缺少继承说明、默认标签和当前继承值，并与下方操作按钮重叠。
- Fix: 用产品内浮层菜单替换原生 `select`；仅保留“恢复默认继承”选项，自定义模式继续由直接输入触发；加入点击外部与 Escape 关闭、ARIA 菜单语义和密钥脱敏摘要。
- Post-fix evidence: 上下局部对照确认信息结构、宽度、圆角、阴影和两行排版均与参考一致；浏览器交互检查全部通过。

## Implementation Checklist

- [x] 默认配置菜单使用完整宽度浮层。
- [x] 展示继承说明、默认标签和继承值。
- [x] 密钥继承值保持脱敏。
- [x] API Key 与 Base URL 交互一致。
- [x] 支持选择、点击外部和 Escape 关闭。
- [x] 保留当前未保存的模型覆盖配置。

## Follow-up Polish

- 无。

final result: passed
