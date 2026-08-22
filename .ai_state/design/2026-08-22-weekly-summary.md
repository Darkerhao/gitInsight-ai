# 会议汇报周报模块设计

日期：2026-08-22

## 1. 目标

新增独立的“周报”模块：用户快速选择一个工作周，系统从已有日报中汇总工作内容，生成一份适合周一会议直接汇报的简洁周报。周报支持人工编辑、保存、复制、导出和历史查看。

本模块是汇报产物，不替代现有“一周日报”和“周反思”：

| 模块 | 职责 |
| --- | --- |
| 一周日报 | 按日期和项目批量生成、编辑、提交每天的日报 |
| 周报 | 将一周工作压缩成会议汇报内容 |
| 周反思 | 分析问题、不足、改进动作和下周重点 |

## 2. 用户流程

1. 进入周报页面，默认选中最近一个完整工作周。
2. 通过“上一周 / 本周 / 下一周”快速切换周期，也可以使用日期选择器调整范围。
3. 选择汇报范围：全部项目或单个项目。
4. 查看当前周期的数据概览：有效日报天数、项目数、提交数和影响文件数。
5. 点击“生成周报”，系统读取有效日报并生成结构化周报。
6. 用户在编辑器中确认或修改内容。
7. 保存周报，或复制文本、复制 Markdown、导出 Markdown。
8. 需要核对依据时打开“来源日报”，查看本次生成使用的日报。
9. 历史列表可以重新打开已经保存的周报，不重新调用 AI。

## 3. 日期和范围规则

- 工作周固定为周一至周日。
- 默认周期为最近一个已结束的完整工作周；“本周”表示当前周一至当前日期，不自动补造未来内容。
- 上一周和下一周按 7 天移动。
- 第一版限制一个周报最多覆盖 7 个自然日。
- 汇报范围支持“全部项目”和单项目；默认使用全部项目。
- 同一项目同一天存在多条日报时，优先单项目日报，再按 `updatedAt` 和 `id` 选择最新记录。
- 只纳入现有日报有效性规则认定的记录：有正文、手工补充内容或有效 Git 工作记录的日报。
- 没有日报的日期可以缺失，周报显示实际覆盖天数，不补写空白日期。

## 4. 周报内容

周报采用固定的短结构，避免把日报简单拼接成流水账：

```markdown
# 本周工作汇报

## 一句话总结
完成 xxx，推进 xxx，解决 xxx。

## 本周完成
- 不超过 5 条

## 重点产出
- 不超过 3 条

## 当前问题
- 有证据的问题；没有明显阻塞时显示“暂无明显阻塞”

## 下周计划
- 只使用日报中明确出现的计划或用户补充内容
```

生成约束：

- 总长度控制在 300～500 字，适合 1～2 分钟口头汇报。
- 每条内容必须能追溯到本次生成使用的日报。
- 不向 AI 发送本机绝对项目路径，只发送项目显示名、日期和日报快照。
- AI 不得凭空推断下周计划、风险或完成状态。
- AI 返回结构、字段类型或来源引用不合法时，直接失败，不保存伪结果。
- 用户编辑后的正文以用户内容为准，重新生成前明确覆盖提示或保留当前编辑内容。

## 5. 页面设计

### 5.1 顶部周期区

```text
周报

[‹ 上一周] [2026-08-17 至 2026-08-23] [下一周]

汇报范围：[全部项目 ▼]                         [生成周报]
已读取 5 天日报 · 3 个项目 · 12 条工作记录
```

### 5.2 主编辑区

左侧为可编辑周报正文，右侧为数据概览和来源入口：

```text
┌───────────────────────────────┬─────────────────────┐
│ 周报正文编辑区                 │ 本周期数据           │
│                               │ 有效日报：5 天       │
│ 一句话总结                     │ 项目数：3 个         │
│ 本周完成                       │ 提交数：42           │
│ 重点产出                       │ 影响文件：86         │
│ 当前问题                       │                     │
│ 下周计划                       │ [查看来源日报]       │
└───────────────────────────────┴─────────────────────┘
```

底部操作：

```text
[重新生成] [保存周报] [复制文本] [复制 Markdown] [导出 Markdown]
```

“来源日报”使用只读抽屉展示日期、项目和日报正文摘要，不在周报页面直接修改日报。

### 5.3 历史区

按周期倒序显示已保存周报：

```text
2026-08-17 至 2026-08-23 · 全部项目
2026-08-10 至 2026-08-16 · 项目 A
```

点击记录后恢复保存时的正文和结构化内容。

## 6. 数据模型

新增独立 `weekly_reports` 表，不复用 `project_reflections`。两者的业务语义、内容结构和生命周期不同，复用会使数据模型混乱。

```text
weekly_reports
--------------
id
start_date
end_date
scope_type              -- all | project
scope_project           -- project path or null
content_json            -- 结构化周报
content_markdown        -- 当前可编辑 Markdown
source_snapshot_json    -- 生成时使用的日报摘要和来源 ID
created_at
updated_at
```

唯一键：

```text
start_date + end_date + scope_type + scope_project
```

重复生成同一周期、同一范围时更新原记录，不产生重复历史。

共享类型：

```ts
type WeeklySummary = {
  summary: string
  completed: string[]
  highlights: string[]
  blockers: string[]
  nextWeek: string[]
  sourceReportIds: number[]
}
```

页面展示、保存和 Markdown 导出都基于结构化内容，避免维护多套结果来源。

## 7. 调用链和接口

```text
WeeklySummaryView
  → useWeeklySummary
    → window.api.generateWeeklySummary
      → electron/main/weeklySummary.ts
        → daily_reports 查询
        → AI Client
        → weekly_reports 持久化
```

建议新增 IPC：

```ts
listWeeklySummaries(params)
getWeeklySummary(id)
generateWeeklySummary(params)
saveWeeklySummary(params)
```

生成参数：

```ts
type WeeklySummaryParams = {
  startDate: string
  endDate: string
  projectPath?: string
}
```

页面只通过 `window.api` 调用，不直接访问数据库或 HTTP 客户端。AI 调用复用现有 AI Client 和配置，不新增第三方依赖。

## 8. 空数据和失败处理

| 情况 | 行为 |
| --- | --- |
| 周期内完全没有有效日报 | 禁止生成，提示先生成日报或补充工作内容 |
| 只有部分日期有日报 | 正常生成，并显示实际覆盖天数 |
| 日报正文为空但有手工内容 | 将手工内容作为有效来源 |
| AI 返回非法结构 | 显示失败原因，不保存结果 |
| 保存失败 | 保留编辑器内容，提示用户重试 |
| 复制或导出失败 | 不清空当前内容，显示可重试提示 |

错误提示应使用面向用户的简短文案，不暴露本机路径、SQL 或内部堆栈。

## 9. 实现范围

预计新增或修改：

```text
src/renderer/src/views/WeeklySummaryView.vue
src/renderer/src/composables/useWeeklySummary.ts
src/shared/weeklySummary.ts
src/shared/weeklySummaryMarkdown.ts
src/renderer/src/styles/_weekly-summary.scss
electron/main/weeklySummary.ts
electron/main/database.ts
electron/preload.ts
src/renderer/src/env.d.ts
src/renderer/src/router.ts
src/renderer/src/App.vue
src/renderer/src/components/AppSidebar.vue
tests/weeklySummary.test.ts
tests/weeklySummaryPage.smoke.mjs
```

复用现有日报读取、项目选择、日期处理和 AI Client；不修改“一周日报”的生成、保存、飞书提交和工时语义，也不修改“周反思”的分析逻辑。

## 10. 非目标

- 不自动发送飞书。
- 不自动创建任务或提醒。
- 不增加周报审批流或多人协作编辑。
- 不实现月报、季报和年度总结。
- 不增加复杂图表和新的统计系统。
- 不根据历史数据猜测下周计划。

## 11. 验收标准

### 功能

- 进入页面默认定位最近完整工作周。
- 上一周、本周、下一周切换后日期准确。
- 全部项目和单项目范围均能正确生成。
- 周报可编辑、保存、重新打开和历史恢复。
- 支持查看来源日报、复制文本、复制 Markdown 和导出 Markdown。
- 无有效日报时不会生成虚假内容。
- AI 非法返回不会写入数据库。

### 内容

- 输出是归纳后的周报，不是日报原文拼接。
- 一句话总结、本周完成、重点产出、当前问题、下周计划结构稳定。
- 下周计划和问题均有日报依据。
- 正常结果控制在约 300～500 字，适合周一会议直接汇报。

### 质量

- 纯函数测试覆盖日期切换、日报去重、有效性判断、结构校验和 Markdown 投影。
- 页面 smoke 覆盖周期选择、生成入口、编辑器、保存和来源抽屉。
- 通过 `npm run typecheck`、`npm run build` 和 `git diff --check`。
- 不新增第三方依赖，不改变现有单日报、一周日报、周反思和自动同步测试。

## 12. 设计结论

采用“独立周报表 + 复用日报数据 + 结构化 AI 输出 + 可编辑保存”的单一方案。该方案实现链路短、模块边界清晰，能满足快速选周和会议汇报，同时为后续月报或季度总结保留日期范围和结构化摘要的复用空间。
