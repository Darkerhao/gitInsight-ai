# AI State Index

本轮唯一入口：Git 作者邮箱匹配——让提交筛选支持作者名称或 author email。

## 当前路由

- stage: ship（shared/main/renderer 改动已完成并通过全量测试与构建）
- route: 红区 / 跨 shared、main、renderer 的 Git 作者筛选 Feature
- design: 采用单一 `gitAuthorEmail` 配置；名称或邮箱命中即可保留提交
- writer: 主线程直做（无独立并行写者，保留现有未跟踪 worktree 元数据）
- confidence: 0.92

## route_history

- 2026-07-25 Signal Atelier UI：黄区 renderer Feature，已 ship（14 测试+smoke+typecheck+build 全绿）
- 2026-08-04 多任务自动同步：分诊确认现状为全局单例配置（autoSync.ts 单跑单提交）→ 提供 A（单条多明细行）/B（多任务调度）两案 → 用户选 B → 红区 worktree 写者；升级日幂等靠运行键格式不变
- 2026-08-10 多任务自动同步：写者完成多任务核心/调度/IPC/UI/迁移并集成；核心测试、typecheck、build、npm test、diff check 全绿；UI smoke 与未改造基线同因既有奖励组件 emoji 断言失败
- 2026-08-16 日报配置 Git 边界：将基础配置拆为 Git 提交采集与日报/同步两组，并在自动同步的统计窗口/统计仓库处补充 Git 标记；未改动配置模型或业务调用链
- 2026-08-16 Git 作者邮箱匹配：Git 日志采集 author email，筛选支持名称或邮箱命中；邮箱纳入自动同步运行键，避免切换邮箱后复用旧成功状态

## 验收入口

- `npm run typecheck`（通过）
- `npm run build`（通过；仅有既有 Element Plus PURE 注释告警）
- `npm test`（23/23 通过，含 Git 采集筛选测试）
- `git diff --check`（通过）

## 变更边界

- 允许：`gitAuthorEmail` 共享配置、Git 日志 author email 解析、名称/邮箱筛选、配置页输入和自动同步运行键
- 禁止：修改飞书 payload、数据库 schema、AI 提示词和仓库扫描范围

## 交付证据

- 变更文件：shared 类型、main Git/report/auto-sync、renderer 配置/生成调用、Git 采集测试
- 运行验证：`npm run typecheck`、`npm run build`、`npm test`、`git diff --check`
- 业务范围：负责人名称仍用于日报归属，Git 邮箱作为额外作者匹配条件
