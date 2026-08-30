# 案例提示词来源管理设计

## 目标

为栗作案例模块增加可管理的公开提示词来源。用户可以维护多个 Manifest URL，服务端在本地同步并缓存数据，案例页从本地 API 读取，支持离线查看最近一次成功同步的数据。

## 范围

- 设置页新增“案例来源”分类。
- 来源支持新增、编辑、启用/停用、删除、单个同步和同步全部。
- 来源配置、同步状态写入 SQLite；Manifest 与提示词 JSON 写入本地数据目录。
- 案例页读取本地缓存并支持来源、模型、标签和关键词筛选。
- 同步失败时保留上一次成功缓存，并记录本次错误。

## 数据流

浏览器 -> 本机 Node API -> 远程 Manifest/JSON -> 本地缓存文件 -> SQLite 状态 -> 案例 API -> 案例页。

浏览器不直接请求第三方来源，不执行远程脚本，也不保存 API Key。远程图片保留 URL，不复制到栗作仓库。

## 数据模型

新增 `prompt_sources` 表：

- `id`：稳定来源 ID
- `name`：显示名称
- `manifest_url`：Manifest 地址
- `homepage_url`：来源主页
- `enabled`：是否参与同步和案例展示
- `last_attempt_at`、`last_success_at`
- `item_count`
- `error_message`
- `cache_path`
- `created_at`、`updated_at`

缓存按来源分目录保存，至少包含原始 Manifest、规范化提示词 JSON 和校验元数据。写入采用临时文件替换，避免中途中断破坏旧缓存。

## API

- `GET /api/prompt-sources`
- `POST /api/prompt-sources`
- `PATCH /api/prompt-sources/:id`
- `DELETE /api/prompt-sources/:id`
- `POST /api/prompt-sources/:id/sync`
- `POST /api/prompt-sources/sync`
- `GET /api/cases`

来源 API 返回配置和状态，不返回不必要的远程原始响应。案例 API 只合并启用来源的有效缓存，支持来源、模型、标签、关键词和分页参数。

## 校验与错误处理

- 仅允许 `https:` 和受控的 `http:` URL；拒绝 `file:`、`javascript:`、`data:` 等协议。
- 限制响应体大小、请求超时和重定向次数。
- 校验 Manifest 结构、来源 ID、记录字段和现有 Prompt Schema。
- 同步成功才替换缓存并更新成功状态。
- 同步失败保留旧缓存，更新失败状态；没有旧缓存时案例页显示空状态和错误提示。
- 删除来源同时删除其缓存；停用来源不删除缓存，但案例页不再展示。

## 界面

设置页展示来源列表、启用开关、编辑/删除、单个同步和同步全部，以及最近同步时间、条目数量和错误状态。编辑表单提供 URL 校验错误。

案例页保留现有模型 Tab，并增加来源、标签和关键词筛选。卡片展示标题、封面、Prompt、模型、作者和原始来源链接；覆盖加载中、无缓存、旧缓存同步失败和空结果状态。

## 验证

- SQLite 迁移和旧数据库兼容。
- 来源 CRUD、启停和删除缓存。
- 正常同步、超时、非 JSON、Schema 错误和超大响应。
- 失败保留旧缓存。
- 案例筛选、分页和无缓存状态。
- URL 协议安全校验。
- 客户端类型检查、服务端测试、Lint 和生产构建。

## 不在本版

- 自动定时同步。
- 来源配置导入导出。
- 账号权限和多用户隔离。
