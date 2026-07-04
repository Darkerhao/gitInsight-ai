# 产品化优化修复任务计划

## 目标

按照 `docs/productization-optimization-plan.md` 中列出的产品化问题，逐项完成可落地修复，并通过类型检查、构建或关键验证确认改动可用。

## 任务状态

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 建立基线 | complete | 读取现有代码、确认变更范围、建立跟踪文件 |
| 2. P0 飞书配置向导 | complete | 补齐字段映射配置入口与校验提示 |
| 3. P0 同步任务语义收敛 | complete | 将任务页改为全局同步计划语义，避免单任务误导 |
| 4. P1 配置保存状态 | complete | 增加 dirty 状态、统一保存反馈与执行前保存提示 |
| 5. P1 历史记录闭环 | complete | 支持历史日报加载、复制、导出、重新发布、跳转 |
| 6. P1 工作台前置检查 | complete | 快捷操作复用统一检查并引导补齐 |
| 7. P2 路由状态化 | complete | 引入 vue-router，支持刷新恢复和参数导航 |
| 8. P2 首次引导 | complete | 欢迎页改为首次/配置缺失时展示 |
| 9. P2 系统设置分区 | complete | 让设置 tabs 实际控制内容分区 |
| 10. 质量保障 | complete | 补齐脚本、运行验证并修复发现的问题 |
| 11. 2026-07-01 审计修复基线 | complete | 基于 `docs/project-issue-audit-2026-07-01.md` 梳理本轮修复范围 |
| 12. P0/P1 数据正确性 | complete | 修复敏感配置保存降级、简洁版日报保存与状态残留、手动同步去重 |
| 13. P2 体验闭环 | complete | 修复历史查询反馈、小屏导航占位、教程入口闭环 |
| 14. P2/P3 维护优化 | complete | 清理 GSAP 残留、补 favicon、修正文案、拆分 renderer vendor chunk |
| 15. 本轮质量验证 | complete | `npm run typecheck`、`npm run build`、`git diff --check`、残留字符串检索均通过 |

## 执行原则

- 不删除用户已有变更。
- 优先改现有文件，除必要类型或测试外不新增无关文件。
- 每完成一个阶段更新本文件和 `progress.md`。
- 遇到错误记录到 `findings.md`，并更换修复方案。

## 2026-07-04 奖励特效扩展任务

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 现状确认 | complete | 已确认奖励特效通过 `RewardEffectKey`、`RewardEffectOverlay.vue` 映射和 `CheckinRewardCenter.vue` 商店配置接入 |
| 2. 新增 15 个组件 | complete | 为用户列出的 15 种特效分别新增独立 Vue 组件 |
| 3. 接入入口 | complete | 扩展 effect key、持续时间、overlay component map、商店入口和背景氛围 |
| 4. 质量验证 | complete | `npm run typecheck`、`npm run build`、`git diff --check`、rewards 尾随空白扫描均通过 |

## 2026-07-04 奖励特效视觉增强任务

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 视觉审片 | complete | 确认主要短板在全局电影感层、商店高级感和少数代表特效爆点 |
| 2. 全局增强 | complete | 增加开场白闪、中心冲击波、动态光晕、扫描线、暗角和按特效变色的舞台变量 |
| 3. 商店增强 | complete | 增加卡片扫光、图标能量环、特级卡片高亮和 popover 氛围背景 |
| 4. 单体强化 | complete | 强化 Crown、CyberDataFlow、SpaceJump、EnergyRing、RainGlass 的光圈、扫光、冲击波和环境效果 |
| 5. 质量验证 | complete | `npm run typecheck`、`npm run build`、`git diff --check`、rewards 尾随空白扫描均通过 |

## 2026-07-04 飞书提交记录入口任务

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 发布流程定位 | complete | 已定位右侧“发布研发日报到飞书”按钮、飞书配置来源和现有飞书登录窗口复用逻辑 |
| 2. 主进程跳转能力 | complete | 新增 `feishu:open-submission-records` IPC，复用 `persist:feishu` 登录态打开飞书表单并自动点击“我的提交记录” |
| 3. 页面入口 | complete | 在发布按钮下方新增“查看日报提交记录”按钮，缺少飞书连接配置时引导到配置页 |
| 4. 质量验证 | complete | `npm run typecheck`、`npm run build`、`git diff --check` 均通过 |
