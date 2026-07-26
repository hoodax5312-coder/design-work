# Mboard 统一资产与知识平台实施计划

日期：2026-07-26

依据规格：`docs/superpowers/specs/2026-07-26-unified-asset-knowledge-platform-design.md`

## 0. 计划目标与执行规则

本计划把已确认的产品规格拆成可以在独立任务中连续执行的阶段。每一阶段必须完成自己的文档核查、实现、测试和验收，不允许用静态 UI 或延时模拟替代真实数据流。

### 固定技术决策

1. 完整产品采用本地 React/Vite 前端加 Express/Node 服务，不把单文件 HTML 当作完整运行形态。
2. 最低 Node 版本提升到 `>=22.22`，使用已在本机验证的 `node:sqlite`。
3. SQLite 只保存元数据、关系、任务和索引；图片、视频、PPT 和预览文件保存在文件系统。
4. 第一阶段明确支持 macOS；文件选择和外置卷识别封装成接口，为 Windows/Linux 留扩展点。
5. 原文件默认只引用。只有完整导出包和用户主动注册 PPT 派生素材时才复制文件。
6. 所有后台处理都经持久化任务系统运行，输出先写临时文件，再原子重命名。
7. 未声明在项目依赖中的 Codex 私有运行时、Homebrew 路径和内部工具不得直接进入生产代码。

## Phase 0：文档与能力发现（已完成）

### 已查阅来源

- 产品规格：`docs/superpowers/specs/2026-07-26-unified-asset-knowledge-platform-design.md`
- 依赖与运行：`package.json`、`package-lock.json`、`tsconfig.json`、`README.md`
- 双运行态 API 装配：`server/index.ts:14-19`、`vite.config.ts:17-24`
- 数据目录设置：`server/storageGateway.ts:15-92`
- 本地工作区子进程模式：`server/workspaceGateway.ts:1-38`
- Higgsfield 后台任务交互：`server/higgsfieldGateway.ts:75-129, 259-343, 510-545`
- 客户端任务轮询：`src/components/projects/ProjectGallery.tsx:298-323`
- 现有资产内存状态：`src/components/inspiration/Inspiration.tsx:32-77`
- 浏览器项目持久化：`src/stores/useProjectStore.ts:30-84`
- 画板快照写回：`src/stores/useCanvasStore.ts:177-186`
- Node SQLite 类型：`node_modules/@types/node/sqlite.d.ts:241-865`
- Node 文件 API 类型：`node_modules/@types/node/fs/promises.d.ts`
- PPTX 参考实现：Codex Presentations skill 中的 `inspect_template_deck.mjs:43-207` 和 `render_slides.py:24-43,111-212`，仅作原型参考，不作为可分发依赖。

### Allowed APIs

首期允许直接使用的本地 API：

```text
node:sqlite
  DatabaseSync
  DatabaseSync#exec
  DatabaseSync#prepare
  DatabaseSync#close
  StatementSync#run/get/all/iterate
  backup

node:fs/promises
  mkdir, readFile, writeFile, rename, copyFile
  open, stat, readdir, rm

node:fs
  createReadStream, createWriteStream

node:path
  resolve, relative, join, isAbsolute, basename, extname

node:crypto
  createHash('sha256'), randomUUID

node:child_process
  execFile，且只允许参数数组
```

SQLite 事务使用 `BEGIN IMMEDIATE`、`COMMIT` 和 `ROLLBACK`，不存在 `db.transaction(callback)`。

### 已确认的能力缺口

- 项目没有 SQLite 驱动、ORM、迁移工具、正式任务队列、图片后端、视频后端或 PPT 解析依赖。
- 资产页只使用组件内存数组，刷新即丢失。
- SourceCenter 和 ExportCenter 是静态界面。
- PPT 和视频生成页面使用延时模拟，不是资产处理服务。
- 当前单文件 HTML 没有 Node、SQLite 或文件系统能力，只能作为展示构建。
- 本机 FFmpeg 可用于原型，但它是 Homebrew GPL 构建，不能直接打包。
- Codex 运行时中的 Sharp、LibreOfficeDev 和 Artifact Tool 不是项目依赖，不得硬编码其私有路径。

### 全局反模式

- 不把媒体二进制或 base64 放进 SQLite 或 20 MB JSON 请求。
- 不把 `localStorage` 当作资产数据库。
- 不把用户值拼接进 SQL、命令行或路径。
- 不使用 shell 字符串执行外部工具。
- 不以扩展名作为唯一 MIME 证据。
- 不直接写最终缓存文件。
- 不在主请求线程里执行大文件哈希、目录扫描或媒体转换。
- 不将预览视作原文件。
- 不自动执行收藏的 Skill。

## Phase 1：运行基础、数据目录与 SQLite 核心

### 目标

建立所有后续功能共享的运行基础、数据库、迁移、路径解析和仓储测试。此阶段不改资产库主界面。

### 1.1 固定运行版本与类型检查

实现内容：

- 在 `package.json` 增加 `engines.node: ">=22.22"`。
- 将 `@types/node` 固定到与 Node 22 匹配的主版本，禁止使用 Node 25 类型推断运行能力。
- 更新 `README.md` 的最低 Node 版本和单文件 HTML 降级说明。
- 新增 `tsconfig.server.json`，让 `server/**/*.ts` 纳入严格类型检查。
- 新增 `typecheck:server` 和总 `typecheck` 脚本。

文档参考：

- `package.json:5-13`
- `README.md` 的“本地运行”章节
- `tsconfig.json:3-25`

验证：

- `npm run typecheck`
- `npm test`
- 在 Node 20 上启动时给出明确版本错误，而不是运行到 SQLite 导入才失败。

反模式保护：

- 不通过 `skipLibCheck` 掩盖服务端 API 与运行时不匹配。
- 不采用 Node 22 实际不存在的 `createTagStore`、`setAuthorizer` 或 `enableDefensive`。

### 1.2 抽取共享 API 装配

实现内容：

- 新建 `server/createApiApp.ts`，集中装配 JSON 中间件和全部路由。
- `server/index.ts` 与 `vite.config.ts` 调用同一装配函数。
- 保留静态文件服务只在生产入口安装。

复制参考：

- 生产装配：`server/index.ts:14-19`
- 开发装配：`vite.config.ts:17-24`

验证：

- 开发和生产模式访问同一健康检查端点，返回完全一致。
- 新增路由只需要在一个文件注册。

反模式保护：

- 不再在 Vite 与生产入口分别手工维护路由列表。

### 1.3 LibraryPaths 与原子写入

实现内容：

- 把 `server/storageGateway.ts:35-54` 的设置读取逻辑提取为 `server/storageSettings.ts`。
- 新建 `server/libraryPaths.ts`，统一生成数据库、缓存、任务、临时目录和备份路径。
- 新建 `server/atomicFile.ts`，实现同文件系统临时写入、flush 和 rename。
- 所有用户输入相对路径使用 `path.resolve`、`path.relative` 做根目录包含检查。

目标目录：

```text
<dataDirectory>/
├── library.sqlite
├── thumbnails/
├── video-proxies/
├── ppt-previews/
├── extracted-text/
├── derived-assets/
├── task-temp/
└── backups/
```

验证：

- 临时目录测试中创建完整目录树。
- `../`、绝对路径逃逸和符号链接逃逸测试失败。
- 模拟写入异常后最终文件保持旧版本或不存在，不出现半写文件。

反模式保护：

- 不复制 Higgsfield 的“直接写最终 JSON”方式。
- 不使用 `execFile('mkdir')`，使用 `fs.mkdir({ recursive: true })`。

### 1.4 SQLite 连接、迁移和核心 schema

实现内容：

- 新建 `server/database.ts`。
- 初始化 `WAL`、`foreign_keys=ON`、`busy_timeout=5000`。
- 新建版本化 SQL 迁移目录 `server/migrations/`。
- 第一版 schema 包含：
  - `assets`
  - `file_references`
  - `preview_artifacts`
  - `folders`
  - `tags`
  - `asset_tags`
  - `smart_collections`
  - `asset_relations`
  - `tasks`
  - `schema_migrations`
  - `asset_fts` FTS5 虚表
- 使用 STRICT tables、外键、唯一索引和查询索引。
- 新建 `AssetRepository`、`FolderRepository`、`TagRepository`、`RelationRepository`、`TaskRepository`。

复制参考：

- `DatabaseSync` 和 `StatementSync`：`node_modules/@types/node/sqlite.d.ts:241-766`
- 现有 `node:test` 风格：`server/providerGateway.test.ts:1-62`

验证：

- 临时数据库迁移可重复运行。
- 事务失败会回滚。
- 外键、唯一指纹、标签合并和关系反向查询有测试。
- FTS5 可以按标题、描述和提取文字检索。
- 10 万条合成数据分页查询基准记录在测试报告中。
- 在当前开发机上，10 万条数据的常用标题搜索、单类型筛选和标签组合筛选以每页 100 项计，热缓存 p95 目标低于 300ms；超出目标必须先补索引或查询计划证据再进入 Phase 2。

反模式保护：

- 不创建 `db.transaction()` 等不存在的 API。
- 不把排序字段直接接收为 SQL；使用显式 allowlist。
- 不在 SQLite 中保存图片、视频、PPT 或代理文件 BLOB。

## Phase 2：持久任务、文件引用与导入中心

### 目标

实现原文件引用、目录扫描、去重、确认式导入和可恢复后台任务。

### 2.1 TaskRunner

实现内容：

- 新建 `server/tasks/TaskRunner.ts` 和任务处理器注册表。
- 状态严格使用 `queued/running/waiting_for_user/completed/failed/cancelled`。
- 每项任务记录类型、输入、进度、当前步骤、错误、输出、重试次数和时间戳。
- 启动时把遗留 `running` 任务恢复为 `queued` 或 `failed_recoverable`。
- 提供 start/list/get/retry/cancel API。
- UI 复用现有轮询形状，但按任务 ID 查询。

复制参考：

- 服务端启动/查询/取消交互：`server/higgsfieldGateway.ts:510-545`
- 客户端轮询：`src/components/projects/ProjectGallery.tsx:298-323`

验证：

- 任务重启恢复、取消、失败重试和进度持久化测试。
- 同一资产的重复预览任务可去重。
- 任务失败不留下最终缓存文件或半写数据库记录。

反模式保护：

- 不复用进程级单例 audit 状态。
- 不在 fire-and-forget Promise 中吞掉异常。

### 2.2 文件/目录选择与扫描

实现内容：

- 抽象 `FilePickerProvider`，首期实现 `MacOsFilePickerProvider`。
- 使用 `osascript` 参数数组选择文件或目录，保留 `storageGateway.ts:74-92` 的取消处理方式。
- 目录扫描使用 `fs.opendir`/`readdir`，支持取消、进度和文件数量上限。
- 保存卷标、设备 ID、绝对路径、stat 信息和最近成功访问时间。

验证：

- 单文件、目录、空目录、无权限目录、外置卷离线和用户取消测试。
- 扫描不会跟随导致根目录逃逸的符号链接。

反模式保护：

- 不依赖浏览器 `<input type=file>` 提供永久绝对路径。
- 不把文件内容 base64 放进 JSON。

### 2.3 流式指纹与导入会话

实现内容：

- `FingerprintService` 使用 `createReadStream` 和 SHA-256。
- 大文件先计算快速候选键（大小＋mtime＋首尾采样），确认重复时再全量哈希。
- `ImportSession` 保存发现项、重复冲突、建议分类和用户决策。
- 重复项支持合并路径、保留独立资产或跳过。
- 用户确认后在单个事务中写入资产、文件引用和初始关系。

验证：

- 同文件不同路径、同名不同内容、大文件取消和扫描期间修改文件测试。
- waiting_for_user 会保留会话，重启后仍可继续确认。

反模式保护：

- 不在请求处理器里同步读取整个大文件。
- 不以文件名或扩展名作为重复判断。

## Phase 3：基础资产库、分类、搜索与图片预览

### 目标

用真实资产服务替换当前内存 `Inspiration` 页面，实现第一版可用的个人资产库。

### 3.1 依赖准入

实现前先把 Sharp 作为显式项目依赖安装并锁定版本。安装后阅读其随包类型/README，记录本项目允许使用的 `sharp(input).metadata()`、`rotate()`、`resize()`、`webp()`/`jpeg()` 和 `toFile()` 签名。不得引用 Codex 私有缓存路径。

验证：

- CI/干净安装能够加载 Sharp。
- 用 JPEG、PNG、WebP、HEIC、超大像素图和损坏文件建立固定测试集。

### 3.2 PreviewService

实现内容：

- 定义 `PreviewProvider` 接口和 `ImagePreviewProvider`。
- 处理 EXIF orientation、色彩空间、透明通道和像素上限。
- 输出固定档位缩略图，记录生成器版本、来源指纹和缓存大小。
- 缓存文件先写 `task-temp`，成功后 rename。
- 实现 LRU 信息更新、永久保留和重建。

验证：

- 方向、透明图、动画图策略、损坏图、解压炸弹限制和缓存过期测试。
- 原文件修改后旧预览标记过期而不是静默继续使用。

### 3.3 资产 API 与查询

实现内容：

- 新建 `server/assetGateway.ts` 和 `src/services/assetService.ts`。
- 提供分页列表、详情、更新、软删除、恢复、批量标签、移动文件夹、收藏和评分 API。
- 搜索使用 FTS5；类型、文件夹、标签、日期、状态和评分使用结构化过滤。
- 智能集合规则由服务端 allowlist 编译为 SQL。

验证：

- CRUD、组合筛选、游标或稳定 offset 分页、软删除和批量操作测试。
- 任意规则 JSON 不能注入 SQL。

### 3.4 替换静态资产 UI

实现内容：

- 新建 `AssetLibraryPage`，替换 `src/App.tsx` 中 `assets -> Inspiration`。
- 保留当前统一左侧导航，目录数量改为 API 数据。
- 中间区域实现网格/列表、搜索、类型筛选、多选和批量操作。
- 右侧 `AssetDetailPanel` 使用受控表单并真实保存。
- 新建 `ImportCenter` 和任务抽屉。
- SourceCenter 改为真实文件异常概览，删除固定示例数据。

参考替换点：

- `src/components/inspiration/Inspiration.tsx:32-77`
- `src/components/inspiration/InspirationDetailPanel.tsx`
- `src/components/delivery/DeliveryCenter.tsx:31-50`

验证：

- 刷新后资产、标签和收藏仍存在。
- 键盘导航、空状态、加载、错误、离线盘和批量选择可用。
- 不再出现硬编码 `1,284/42/18` 数量。

反模式保护：

- 不在组件中维护 canonical `cards` 数组。
- 不用静态 toast 代替文件修复动作。

## Phase 4：AI 图片元数据与 AI 知识库

### 目标

完成三层生成元数据、生成关系以及统一知识资产。

### 4.1 MetadataExtractorRegistry

实现内容：

- 定义按 MIME/来源注册的 extractor 接口。
- 首批支持：
  - 同名 `.json/.txt` sidecar
  - PNG `tEXt/iTXt` 文本块
  - Mboard 图片生成返回数据
  - Higgsfield 已公开参数映射
- 输出 `rawMetadata/normalizedMetadata/userMetadata`。
- 人工校正只写 user 层。

验证：

- A1111/ComfyUI 风格参数、未知字段、损坏 JSON、多语言 Prompt 和超长元数据测试。
- 原始字段导入后不可被普通更新 API 覆盖。

反模式保护：

- 不假设所有平台共享一个生成响应格式。
- 不丢弃未知原始字段。

### 4.2 生成回流与关系

实现内容：

- 图片生成成功后由服务端下载结果或引用本地输出，并注册资产。
- 保存 Prompt 快照、模型、尺寸、质量、任务 ID 和来源 Provider。
- 建立 `generated_from/member_of_batch/reference_of` 关系。
- 画板节点增加 `assetId`，保存时同步 `used_in_canvas`。

参考：

- 图片真实请求：`src/components/image-gen/ImageGeneration.tsx:44-68`
- 画板项目快照：`src/stores/useCanvasStore.ts:177-186`

验证：

- 一次多图生成形成一个批次。
- 删除画板节点不删除资产，只删除关系。

### 4.3 KnowledgeService

实现内容：

- Prompt、Skill、Workflow、Tutorial、CaseStudy 使用 Asset 基表和类型扩展表。
- 实现收件箱、状态、原文/翻译/个人版本、附件和示例关系。
- Prompt 支持变量 schema、使用快照和测试记录。
- Skill 状态严格区分收藏、下载、安装和禁用；首期只实现收藏与文件审查，不执行外部代码。
- 支持 TXT、MD、JSON 和链接元数据导入。

验证：

- Prompt 版本、变量填充、知识全文搜索、附件关系和 Skill 状态测试。
- 导出知识时不包含 Provider API Key 或浏览器密钥状态。

反模式保护：

- 不为知识库另建孤立的搜索和标签系统。
- 不因为 Skill 被收藏就执行安装脚本。

## Phase 5：PPT 资产与逐页预览

### 目标

实现 deck/slide 虚拟资产、逐页预览、全文检索和媒体来源关系。

### 5.1 渲染器准入基准（阻塞门）

使用固定 PPT 测试集比较以下提供者：

1. 外部 LibreOffice headless 转 PDF，再由受控 PDF 渲染器转页图。
2. 经过许可证和可分发性确认的 OOXML/Artifact 渲染器。
3. macOS QuickLook 仅作为封面降级提供者。

测试集必须包含缺失字体、图表、备注、嵌入媒体、宏、加密、旧 `.ppt` 和损坏文件。评估页面数量正确性、文字提取、视觉相似度、耗时、内存、许可证和跨机器安装。

默认实施路径：

- OOXML 文本、备注、关系和媒体由自有 `PptxPackageReader` 解析。
- 页面渲染首期使用用户配置的 LibreOffice/soffice 能力；未配置时仍导入文本和媒体，但预览状态为 `renderer_unavailable`。
- QuickLook 只生成封面，不能被当作逐页渲染器。
- `.ppt` 先经明确配置的 LibreOffice 转换；无转换器时标记 unsupported，不伪造预览。

文档参考：

- OOXML/媒体枚举原型：`inspect_template_deck.mjs:43-207`
- 现有安全子进程方式：`server/workspaceGateway.ts:1-38`

验证：

- 把基准结果和选定 provider 版本写入 `docs/engineering/ppt-renderer-benchmark.md`。
- 未通过阻塞门不得进入 5.2。

反模式保护：

- 不硬编码 Codex 缓存中的 soffice 或 Artifact Tool。
- 不用 PowerPoint GUI 自动化作为后台任务。
- 不盲解压 ZIP；限制条目数、总解压大小、路径和 XML 实体。

### 5.2 PptIngestionService

实现内容：

- 创建 `ppt_deck` 和按页排序的 `ppt_slide` 虚拟资产。
- 解析 slide rels，确保媒体关系是 `deck → slide → object`，不是全局媒体目录。
- 提取标题、正文、备注、字体、配色、尺寸和嵌入媒体。
- 渲染结果写 PreviewArtifact，文字写 FTS。
- 用户主动“注册提取素材”时才把内嵌对象写入 `derived-assets`。

验证：

- 页数、顺序、备注、文字搜索、单页收藏和媒体来源关系测试。
- 父 PPT 指纹变化会使子页预览过期并触发重建。
- 加密、缺字、旧 PPT 和渲染器缺失都有明确状态。

### 5.3 PPT 浏览工作台

实现内容：

- 封面网格、悬停翻页、缩略图栏、单页大图、多页平铺和全屏预览。
- 搜索结果定位具体页面。
- 页面支持收藏、评分、标签、导出预览和注册提取图片。
- 不显示编辑文字、换图、动画或母版能力。

验证：

- 100 页 deck 使用虚拟列表，不一次渲染全部 DOM。
- 原文件离线时仍可浏览已有页面预览和文字。

## Phase 6：视频代理、视频项目与分镜

### 目标

实现真实视频元数据/代理、项目建议分组、分镜候选和简单时间线。

### 6.1 VideoPreviewProvider

实现内容：

- 新增 FFmpeg 设置和能力检测，允许用户选择 `ffmpeg/ffprobe` 路径。
- 首期不捆绑当前 Homebrew GPL 构建；打包策略必须另行通过许可证审查。
- 使用 `execFile` 参数数组运行：
  - `ffprobe -show_format -show_streams -of json`
  - 代表帧
  - 固定间隔时间轴帧
  - 首尾帧
  - 720p 代理
  - 波形图
- 每个进程设置超时、取消、并发、CPU/输出上限并捕获 stderr。
- 在 PreviewArtifact 记录 FFmpeg 完整版本。

验证：

- MP4/MOV、VFR、无音轨、损坏视频、超长视频、HDR 和取消任务测试。
- FFmpeg 缺失时资产仍可导入，预览状态明确降级。

反模式保护：

- 不复用 `src/lib/videoUtils.ts` 的浏览器抽帧作为批量后端。
- 不使用 `AudioNode.tsx` 的随机波形作为事实数据。
- 不通过 shell 执行不可信路径。

### 6.2 视频项目 schema 与服务

实现内容：

- 迁移新增 `video_projects/sequences/shots/shot_candidates`。
- Shot 保存首尾帧关系、Prompt 快照、生成参数和连续性备注。
- Candidate 只引用视频资产，状态为待查看、备选、已选用、需重做或已淘汰。
- 项目、情节、分镜和候选 CRUD 使用事务与排序字段。

验证：

- 一个视频可以被多个项目引用但不重复资产。
- 每个 Shot 最多一个当前选用 Candidate。
- 删除项目只删除关系和结构，不删除原视频资产。

### 6.3 建议分组

实现内容：

- 第一版使用可解释规则：目录层级、scene/shot/take 文件名、时间窗口、任务 ID、Prompt 和参考图关系。
- 结果写入 ImportSession 建议，不直接写项目。
- UI 支持接受全部、局部接受、拖拽调整、合并、拆分和待整理。
- 语义画面聚类后置，不阻塞第一版。

验证：

- 固定命名数据集产生确定结果。
- 用户确认前项目表没有变化。

### 6.4 视频项目工作台

实现内容：

- 项目树、分镜板、候选同步对比和简单组合时间线。
- 复用 Higgsfield 的项目/文件夹/候选信息表达，但读取本地领域 API。
- 显示首尾帧、Prompt、生成参数、候选状态和选用版本。
- 不加入剪切、调色、复杂转场等 NLE 能力。

验证：

- 从成片可以追溯到 Shot、Candidate、首尾帧和 Prompt。
- 外置硬盘离线时代理和项目结构仍可浏览。

## Phase 7：异常修复、导出、备份与发布验收

### 目标

完成本地库长期可维护性、三种资产包和第一版发布验证。

### 7.1 RepairService

实现内容：

- 检测设备离线、路径失效、移动、修改、重复、预览过期和解析失败。
- 支持单个重定位、根目录批量替换、指纹搜索和接受为新版本。
- 原文件状态更新不删除资产元数据。

验证：

- 外置卷卸载/挂载、目录整体移动、同名错误文件和指纹匹配测试。
- 设备离线不被显示为文件删除。

### 7.2 PackageService 包格式

第一版资产包明确采用版本化目录格式，而不是 ZIP：

```text
Example.mboard-package/
├── manifest.json
├── database/
├── previews/
└── originals/
```

目录先生成到同一父目录下的临时名称，manifest 和所有选择文件验证完成后再原子 rename 为最终 `.mboard-package`。这避免尚未验证的 ZIP64、超大视频、ZIP bomb 和解压路径穿越问题。压缩封装作为后续兼容层，只有在流式、ZIP64、许可证和安全测试通过后才能加入。

验证：

- 超大文件、重复目标名、取消、磁盘不足、路径逃逸和不完整临时目录测试。
- 文件清单中的每个相对路径都通过包根目录包含检查。

### 7.3 三种资产包

实现内容：

- 统一目录包 manifest 包含 schema 版本、资产、关系、文件清单、哈希和脱敏策略。
- 仅知识索引不含媒体。
- 预览包包含被选择的缓存预览。
- 完整包经用户确认后流式复制原文件并改写相对路径。
- 导入包先验证 manifest、容量、路径和哈希，再事务写库。

验证：

- 三种包导出后可在全新临时库导入。
- manifest 不包含绝对路径、API Key 或私人笔记。
- 取消导出只留下可识别并可清理的临时目录，不留下可误认为完成的 `.mboard-package`。

### 7.4 数据库备份与恢复

实现内容：

- 使用已验证的 `node:sqlite backup` 创建数据库备份。
- 备份清单记录数据库版本、时间、容量和预览范围。
- 恢复前关闭写任务、验证备份、建立当前库安全快照，再替换并重开连接。

验证：

- 运行中备份、损坏备份、旧 schema 迁移和恢复失败回滚测试。

### 7.5 发布验收

执行：

- `npm run typecheck`
- `npm test`
- 前端生产构建
- 全部迁移从空库执行
- 10 万合成资产性能测试
- 图片、视频、PPT 和知识固定数据集集成测试
- 外置硬盘离线/恢复测试
- 三种包往返测试
- 路径、SQL、ZIP 和 Skill 安全测试
- 键盘和无障碍检查

发布门槛：

- 规格 §19 的 10 项验收标准全部有测试或人工证据。
- 资产库中不再显示静态计数或模拟进度。
- 所有后台任务可取消、可重试，并在重启后有明确状态。
- 完整产品文档明确要求本地服务；`Mboard-standalone.html` 标注为交互演示，不宣称具备文件系统和 SQLite 能力。

## 跨阶段依赖图

```text
Phase 1 运行/SQLite
   ↓
Phase 2 任务/文件引用/导入
   ↓
Phase 3 基础资产库/预览/搜索
   ├── Phase 4 图片元数据/知识
   ├── Phase 5 PPT
   └── Phase 6 视频项目
             ↓
Phase 7 修复/导出/备份/验收
```

## 会话切分建议

每个粗体小节应作为独立实现任务。一个任务只拥有明确文件范围，并在结束时提交测试证据。新任务开始时先阅读：

1. 本实施计划对应阶段
2. 产品规格相关章节
3. 该阶段列出的现有源码和本地文档

禁止跨阶段提前制作静态页面来冒充底层能力完成。
