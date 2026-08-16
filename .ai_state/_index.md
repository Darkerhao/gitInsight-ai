# AI State Index

本轮唯一入口：项目周反思 v1——基于指定项目最多 7 天的有效日报生成证据化反思。

## 当前路由

- stage: ship
- route: 红区 / 跨数据库、AI、IPC 与 renderer 的 Feature
- design: 通用 project_reflections 表；周反思严格 JSON、证据校验和 Markdown 投影
- writer: 主线程直做（保留现有未跟踪 worktree 元数据）
- confidence: 1.0
- current_roadmap_slug: project-reflection
- current_sprint_slug: project-weekly-reflection-v1

## route_history

- 2026-07-25 Signal Atelier UI：黄区 renderer Feature，已 ship（14 测试+smoke+typecheck+build 全绿）
- 2026-08-04 多任务自动同步：分诊确认现状为全局单例配置（autoSync.ts 单跑单提交）→ 提供 A（单条多明细行）/B（多任务调度）两案 → 用户选 B → 红区 worktree 写者；升级日幂等靠运行键格式不变
- 2026-08-10 多任务自动同步：写者完成多任务核心/调度/IPC/UI/迁移并集成；核心测试、typecheck、build、npm test、diff check 全绿；UI smoke 与未改造基线同因既有奖励组件 emoji 断言失败
- 2026-08-16 日报配置 Git 边界：将基础配置拆为 Git 提交采集与日报/同步两组，并在自动同步的统计窗口/统计仓库处补充 Git 标记；未改动配置模型或业务调用链
- 2026-08-16 Git 作者邮箱匹配：Git 日志采集 author email，筛选支持名称或邮箱命中；邮箱纳入自动同步运行键，避免切换邮箱后复用旧成功状态
- 2026-08-16 一周日报批量工作台：独立 renderer 模块编排现有生成/保存/飞书单条接口，按日期×项目维护可编辑草稿并按工作内容估算工时；不新增数据库/飞书协议
- 2026-08-16 项目周反思 v1：跨数据库、AI、IPC 与 renderer；采用通用反思表和日期范围，为已确认的月/年扩展避免迁表，但本轮只实现周反思

## 验收入口

- `npm run test:weekly-reflection`（8/8 + 页面 smoke 通过）
- `npm run typecheck`（通过）
- `npm run build`（通过）
- `npm test`（44/44 + 两个页面 smoke 通过）
- `git diff --check`（通过，仅行尾转换提示）

## 变更边界

- 允许：周反思共享契约/纯函数、通用反思表、AI 调用、IPC/preload、页面、样式和专项测试
- 禁止：修改飞书 payload、现有单日/一周日报与自动同步语义；实现月反思或年度总结

## 交付证据

- 自动化证据：周反思 8/8、全量 44/44、两个页面 smoke、typecheck、build、diff check 全部通过
- 运行证据：Electron preload/IPC、7 天边界、来源筛选、真实 AI 生成、证据抽屉、历史冷启动恢复和复制均通过
- 运行记录：`.ai_state/sprints/project-weekly-reflection-v1/runtime-verify.md`
