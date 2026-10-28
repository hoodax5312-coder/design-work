# DESIGN.md — 实现契约

完整界面规范在项目资料 `资料/开发文档/界面设计规范.md`（不进 Git）。本文件只记录代码侧必须遵守的契约，避免两套规范互相矛盾；冲突时以 `src/index.css` 为准。

## 图片本地工具

- 图片节点的剪刀入口打开 Radix 编辑面板，集中提供裁切、遮罩、网格切图、AI 超分；不扩张共享节点工具栏协议。
- 裁切以像素坐标/拖选/比例配置，网格按原始像素边界切分；结果另存静态 PNG，不覆盖源资产。输出真实宽高与生成比例参数分离，不把 `300:150` 等任意像素尺寸写入模型比例。
- 遮罩涂抹区为透明待修改区，橡皮擦恢复保留区；叠加/黑白预览只影响显示，不改变导出语义。空遮罩拒绝保存，来源记录在资产元数据中，暂不自动提交重绘。
- 超分面板可选择2×/4×并查看目标尺寸；没有已验证的专用适配器时禁用执行、明确未提交与无输出，不使用普通插值伪装AI。工具切换/关闭不保留未保存编辑，界面明示。

## 图片参考与派生改图

- 图片连线是生成输入：提交时取上游当前选中结果的原文件资产 ID，快照记录来源节点/结果；无资产、生成/上传中或不支持的模型不发请求。
- 当前网关仅单参考，手动图和连线图合计超过上限明确报错，不去重丢图、不静默选择其一；移除输入只断开引用，不删源节点/资产。
- “继续改图”派生空白下游并连线，不复制历史结果、旧提示词或运行状态，不立即生成；通过一次结构历史支持撤销与重做。
- 参数复用现有 Popover/分段控件与 Remix 图标；按共享能力表显示，换模型重置参数。未知别名不推断 edits 能力，最终比例以原图为准，不把本机夹具当作供应商付费验收。

## 画布分组属性

- 分组提供半透明背景预设、宫格/水平/垂直排列、解散、删除，沿用项目 Remix 图标和弹层组件。
- 解散保留内容和连线；删除包含成员，遵循锁定保护并支持撤销。锁定分组不能调色、排列、解散或删除，组内有锁定成员时排列禁用。
- `data.memberIds` 保留归属，旧组按原位置兼容恢复；成员位置/尺寸变化触发外框适配，不能因拖出旧边界丢失成员；不引入嵌套分组。
- 画布顶部空间不足时，分组工具栏转至底部，避免被主工具栏挡住。

## Default（nature）暗色色板

- 唯一事实源：`src/index.css` 中 `:root.dark[data-theme='nature']` 的 `--lz-*` 变量。
- 表面严格递增：`--lz-canvas` #0A0A0B → `--lz-shell` #1A1A1C → `--lz-card` #1C1C1E → `--lz-field` #242426 → `--lz-overlay` #272729 → `--lz-hover` #303033 → `--lz-selected` #38383C。
- 内容容器无边框，靠底色与外壳区分：`--lz-canvas` 对 `--lz-shell` ≥1.13:1（当前 1.14:1）。
- 文字：`--lz-text` #F4F4F5、`--lz-text-secondary` #B4B4BA、`--lz-text-muted` #A1A1AA，在所有表面上 ≥4.5:1。
- 线条：`--lz-divider` #2E2E31（纯分隔，不承担控件识别）、`--lz-control-border` #74747A（输入静止边线，对画布/外壳/卡片/输入底/浮层 ≥3:1）、`--lz-focus` #D4D4D8（对上述表面及静止边线均 ≥3:1）、`--lz-edge` #6A6A70（对画布与卡片 ≥3:1）。
- shadcn 别名（background/card/popover/muted/accent/border/input/ring/sidebar…）与项目别名（workspace-bg、module-workspace-bg、neutral-*）只能引用 `--lz-*`。

## 组件约定

## 基座升级边界

- 当前前端基座为 React 19、Vite 8、Tailwind CSS 4、Radix UI 与项目现有 shadcn 风格封装；Tailwind 4 通过 `@tailwindcss/vite` 接入。
- 基座升级只负责兼容层、语义变量和组件合同，不替换栗作现有产品信息架构、画布节点模型、生成链路、资产库或本地网关。
- 管理后台是独立工作区页面，复用 `src/components/ui` 的 Card、Badge、Button、Separator 等组件，不复制 shadcn-admin 的完整布局和路由体系。
- 登录入口目前是 UI 占位：不得把弹窗提示或展示用后台统计解释为真实账户、会话、权限或服务端数据。

- 基础组件按 shadcn/ui 的语义合同组织，但继续复用现有 Radix 封装与 Remix 图标，不运行 `shadcn init` 覆盖项目组件。
- `Button`、`Badge` 保留现有变体并补充语义变体；不改变默认变体。
- `Input`、`Textarea`、`Select` 保留 `inputSize/textareaSize/selectSize` 兼容属性，同时支持统一的 `size="sm|md|lg"`；默认尺寸、标签、错误和辅助文案行为不变。
- 控件、卡片和浮层的新调用方优先使用 `--ui-*` 语义别名；旧页面仍可使用现有主题变量，避免迁移时发生视觉回归。
- 浮层边线与阴影：`border-[color:var(--popover-border)]` + `[box-shadow:var(--popover-shadow)]`。不要写 `shadow-[var(...)]`，Tailwind 会把它解析成阴影颜色导致阴影丢失。
- 输入焦点环：`focus-visible:ring-[color:var(--field-focus-ring)]`，不要写死 `ring-neutral-border`，否则焦点环与静止边线同色、无法区分。
- 卡片底色统一走 `--surface-card-bg`（经 `.theme-card`），页面不要再用 `dark:[--surface-card-bg:color-mix(...)]` 之类的局部暗色补丁。
- 画布：`--canvas-edge-color`、`--canvas-card-border-color`、`--canvas-chrome-border-color`、`--canvas-surface-raised` 由主题提供，未定义时回落原混色。
- `:root` 为新增 token 提供浅色默认值，浅色及其他主题表现不变；通用 `.dark` 块不引用 `--lz-*`。
- 参数弹窗（生成页“参数设置”、画布“画面参数”）加 `parameter-popover` 类，共用轨道规则：浮层 > 轨道（暗色 `--lz-card`，无描边）> 选中块（`--neutral-control-selected` = `--lz-selected`，加 10% 白内描边与投影）。选中块必须比轨道亮。
- 画布底部操作条（`.canvas-view-controls`）和左右展开侧栏（`.canvas-side-panel`）在 Default 暗色下共用 `--lz-canvas`（#0A0A0B）95% 不透明度底色，接近画布而非外壳；不新增边框，不改内部卡片/输入框。底栏按钮 hover/激活用 `--lz-selected`；其他主题不变。 左侧模块右边、右侧模块左边、底栏上边使用 1px、55% 透明度的 `--lz-divider` 分隔线，避免近黑表面融为一体且不过度突出。
- 正式图标统一 `@/lib/remixIconShim`。

## 守护测试

`npx tsx --test server/darkThemeTokens.test.ts`（9 项）：表面严格递增、三级文字 4.5:1、静止边线 3:1、焦点环对表面与静止边线 3:1、连线 3:1、别名映射、通用 `.dark` 不受影响、参数弹窗共用规则且选中块亮于轨道、内容容器对外壳 ≥1.13:1。
