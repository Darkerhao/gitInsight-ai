# 会议汇报周报实现任务

## 目标

实现 `.ai_state/design/2026-08-22-weekly-summary.md` 定义的独立周报模块：按工作周和项目范围读取有效日报，生成可编辑的结构化周报，保存、历史恢复、来源查看、复制和 Markdown 导出闭环完成。

## 约束

- 保留工作树中已有的一周日报保存修复及其他无关改动。
- 不修改单日报、一周日报、周反思和自动同步的既有语义。
- 不新增第三方依赖，不自动发送飞书，不实现月报/年度总结。
- AI 只接收项目显示名、日期和日报快照，不接收本机绝对路径。
- AI 结构或来源校验失败时不保存结果。

## 阶段

| 阶段 | 状态 | 验收 |
| --- | --- | --- |
| 1. 领域模型与存储测试 | complete | 日期范围、日报有效性/去重、结构校验、Markdown 投影和 `weekly_reports` 持久化测试 |
| 2. 主进程与 IPC | complete | 查询、生成、保存、历史读取和来源快照通过 preload 暴露 |
| 3. 页面闭环 | complete | 路由、侧栏、周期切换、编辑保存、历史、来源抽屉、复制导出完成 |
| 4. 质量验证 | complete | 周报 6/6、周反思 11/11、全量测试、typecheck、build、diff check 通过 |

## 当前发现

- 当前项目已经有 `daily_reports`、`project_reflections`、AI Client、IPC/preload 和 Vue 页面基础设施可复用。
- 周报应新增独立 `weekly_reports` 表，避免与周反思结构混用。
- quantum-codegen 所需 `docs/ai/convention-pack` 不存在，按真实仓库结构实施。
