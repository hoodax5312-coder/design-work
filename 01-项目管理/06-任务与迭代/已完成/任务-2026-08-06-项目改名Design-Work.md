# 任务：项目改名为 Design Work

- 状态：#已完成
- 负责人：Codex
- 优先级：P1
- 创建日期：2026-08-06
- 截止日期：2026-08-06

## 目标

将项目对外展示名称从 Mboard 改为 Design Work。

## 范围

- 浏览器标题、顶部品牌、侧栏品牌提示。
- package name、Vite 插件标识、README 和用户可见提示。

## 不在范围内

- mboard localStorage key、事件名、CSS class、下载文件前缀及本地目录名等兼容性技术标识。

## 验收标准

- [x] 页面顶部显示 Design Work。
- [x] 浏览器标题显示 Design Work。
- [x] 用户可见的导入、素材目录和版本提示同步更新。
- [x] 通过 npm run typecheck:client。
- [x] 已推送 GitHub 分支。

## 记录

- 保留 mboard 技术 key，避免升级后丢失已有本地数据和事件监听。
- GitHub 提交：1884905 rename product to Design Work。
- Vercel 新构建产物已生成，但项目保护状态为 BLOCKED，正式生产别名暂未切换。

## 关联决策/资料

- 02-产品与设计/原始文档/ui-design-system.md

## 交接与下一步

- GitHub：https://github.com/HuYbio9566/design-work/tree/codex/unified-assets-phase-1
- 需在 Vercel 控制台解除部署保护或手动批准部署，线上正式地址才会显示新名称。
