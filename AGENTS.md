# 栗作 LIZUO 程序仓库协作规则

> 完整的产品上下文与长期规则位于上两级目录 `../../AGENTS.md`。在本目录开始任务时，先读取该文件，再读取 `../../01-项目管理/项目总览.md`、`../../01-项目管理/工作台.md` 和相关决策/任务记录。

- 技术栈：React + TypeScript + 本机 Node 网关 + Node 22.22+ `node:sqlite`。
- 代码仓库保持标准 GitHub 结构：`src/`、`server/`、`scripts/` 和根配置。本地项目管理资料不进入 GitHub。
- 当前工作区可能存在大量未提交修改；不回退、覆盖、清理或重排无关文件。只修改用户指定的模块。
- UI 规范入口：`../../02-产品与设计/原始文档/ui-design-system.md`。正式图标使用 Remix Icon 或项目适配层，不新增 Lucide、emoji、Unicode 或临时 SVG。
- 真实模型链路按文本/生图/视频及具体供应商协议适配；不用虚构统一格式伪装已接通。
- 小型 UI 调整：`npm run typecheck:client`；模块完成：`npm run lint`；阶段完成：相关测试 + `npm run build`。
- 所有 API、导入导出、数据迁移和鉴权变更都要验证错误路径，且不在日志或回复中暴露 API Key。
