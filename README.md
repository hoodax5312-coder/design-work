# Mboard

Mboard 是一个本地优先的 AI 创作工作台，包含真实模型对话、Agent 广场、图像生成、魔法画布、素材库和电商视觉工作流。

## 本地运行

要求 Node.js 20 以上版本。

```bash
npm install
npm run dev
```

开发地址为 `http://127.0.0.1:5173`。

生产模式：

```bash
npm run build
npm start
```

生产地址默认为 `http://localhost:4173`，可通过 `PORT` 修改。

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

视频生成、第三方图像服务和画布中的模型路由需要各供应商不同的任务提交、轮询和鉴权协议，当前仍保留对应界面，后续应按具体供应商添加适配器，不能用一个虚构的统一返回格式代替。

## 工程命令

```bash
npm run build
npm run lint
```
