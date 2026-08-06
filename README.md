# Design Work

Design Work 是一个本地优先的 AI 创作工作台，包含真实模型对话、Agent 广场、图像生成、魔法画布、素材库和电商视觉工作流。

## 视频工程素材库

“项目”入口现在包含一个本地优先的 AI 视频工程浏览器：

- 运行时读取 Higgsfield Community 公开项目元数据
- 按“项目 → 情节 → 片段 → 生成候选”浏览工程
- 查看 Prompt、模型、Seed、分辨率、时长和风格参数
- 将候选片段加入底部镜头组合轨道
- 将项目目录和生成元数据同步到 `.design-work/higgsfield/`
- 扫描全部公开项目的文件数和容量，生成归档清单

容量盘点使用 HTTP `HEAD` 或 `bytes=0-0` Range 请求获取文件大小。HLS 视频会解析最高码率播放清单并累加分片大小。扫描过程不会下载或写入原始图片和视频。

盘点结果保存在：

```text
.design-work/higgsfield-audit/
├── status.json
├── manifest.json
└── projects/
    └── <project-slug>.json
```

Higgsfield 公开项目的授权条款不一定等同于开源软件许可证。软件代码可以独立开源，但归档或再分发第三方素材前应确认对应的使用授权。

## 本地运行

要求 Node.js 22.22 以上版本。Design Work 的本地资产数据库将使用该版本提供的 `node:sqlite`，启动脚本会在版本过低时直接给出升级提示。

```bash
npm install
npm run dev
```

开发地址为 `http://127.0.0.1:5173`。

“无限画板”使用项目内置的轻量 ReactFlow 实现，不需要额外的 Python 服务。
节点直接读取“设置 → API 与模型”中的统一模型配置，并随项目自动保存。

生产模式：

```bash
npm run build
npm start
```

生产地址默认为 `http://localhost:4173`，可通过 `PORT` 修改。

### 关于单文件 HTML

`npm run build:html` 生成的 `output/Design Work-standalone.html` 仅用于界面预览。浏览器直接打开单文件时没有 Node.js、SQLite、文件扫描或媒体处理能力；完整的本地资产管理功能必须通过 `npm run dev` 或 `npm start` 运行本地服务。

## 配置模型

1. 打开右上角“设置”。
2. 进入“API 配置”。
3. 选择 OpenAI Compatible、Google Gemini 或 Anthropic。
4. 填写 Base URL、API Key 和模型 ID。
5. 点击“测试连接”。成功后会保存延迟、健康状态和供应商返回的模型列表。
6. 点击“保存 Provider”，随后可在新建对话和 Agent 对话中使用。

Provider 配置和会话历史保存在当前浏览器的本地存储中。API 请求统一发送到本机 Node 网关，再由网关请求模型供应商，避免浏览器跨域限制。

## 已接通的真实流程

- 多 Provider 配置、切换、删除与本地持久化
- Provider 连通性与模型健康检查
- OpenAI 兼容、Gemini、Anthropic 文本对话
- Agent 角色提示词注入与真实对话
- 会话历史保存、标题生成和侧栏恢复
- OpenAI 兼容图像生成、重新生成和下载
- 魔法画布 JSON 导入、导出、撤销、重做和清空
- 素材库本地创建、收藏、导入和导出
- Higgsfield 公开项目、情节目录和生成参数浏览
- 项目元数据归档和全站容量盘点

视频生成、第三方图像服务和画布中的模型路由需要各供应商不同的任务提交、轮询和鉴权协议，当前仍保留对应界面，后续应按具体供应商添加适配器，不能用一个虚构的统一返回格式代替。

## 工程命令

```bash
npm run build
npm run lint
```
