# AI State Index

本轮唯一入口：多任务自动同步（方案 B）—— 每任务独立仓库集合/飞书项目/执行时间/统计窗口/状态。

## 当前路由

- stage: ship（brainstorm/design/impl/review/runtime-verify 已完成：用户在 A/B 两案中选 B）
- route: 红区 / 跨 shared+main+preload+renderer 的调度核心系统改造
- design: [2026-08-04-multi-auto-sync-tasks.md](design/2026-08-04-multi-auto-sync-tasks.md)
- writer: 一个实现代理（原生 worktree 隔离）；主线程负责规格、审阅、验证与交付
- confidence: 0.85

## route_history

- 2026-07-25 Signal Atelier UI：黄区 renderer Feature，已 ship（14 测试+smoke+typecheck+build 全绿）
- 2026-08-04 多任务自动同步：分诊确认现状为全局单例配置（autoSync.ts 单跑单提交）→ 提供 A（单条多明细行）/B（多任务调度）两案 → 用户选 B → 红区 worktree 写者；升级日幂等靠运行键格式不变
- 2026-08-10 多任务自动同步：写者完成多任务核心/调度/IPC/UI/迁移并集成；核心测试、typecheck、build、npm test、diff check 全绿；UI smoke 与未改造基线同因既有奖励组件 emoji 断言失败

## 验收入口

- `npm run typecheck`
- `npm run build`
- `npm test`（既有 14 + 新 `test:auto-sync` 纯核心套件，实际 21 tests）
- `git diff --check`
- 迁移连续性：legacy lastSuccessKey 与迁移后任务新键逐字符相等（测试断言）

## 变更边界

- 允许：src/shared/types.ts（autoSync 相关）、electron/main/autoSync.ts、新 electron/main/autoSyncCore.ts、config.ts 的 autoSync normalize 迁移、ipc/preload/env.d.ts 的 auto-sync 三通道、assistant/autoSyncState.ts、configState.ts 校验钩子、AutoSyncCard.vue、package.json 测试脚本、CLAUDE.md/CONTEXT.md 对应段落
- 禁止：手动生成/发布链路、数据库 schema、飞书表单载荷协议（仍单明细行）、报告生成算法、按任务 AI Profile

## 交付证据

- 实现提交：`7253abe feat(auto-sync): support multiple scheduled tasks`
- 运行验证：`.ai_state/sprints/multi-auto-sync-tasks/runtime-verify.md`
- 审查结论：规格覆盖完整；无新增 correctness/security/test/design/quality 阻塞项
