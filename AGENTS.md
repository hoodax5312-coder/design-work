# 仓库协作规则

- 项目技术栈为 React + TypeScript；UI 规范入口为 `docs/ui-design-system.md`。
- 中文界面优先使用苹方（PingFang SC），回退到系统无衬线字体。
- 视觉基调使用中性黑、白、浅灰；语义色只用于明确的状态反馈。
- 每轮只修改用户指定的模块，不回退、覆盖或顺手整理无关修改。
- 修改前先阅读目标组件及 UI 规范；避免无目的遍历整个 `src`。
- 小型 UI 调整只运行 `npm run typecheck:client`。
- 模块完成后再运行 `npm run lint`；阶段完成后才运行测试和 `npm run build`。
- 不要在每个像素级调整后执行全量验证。
