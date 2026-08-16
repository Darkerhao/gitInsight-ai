# Review Pass 2

## Reviewer

### Findings

1. P0：非强制重算未从当天容量扣除手动工时，可能突破每日总工时。
2. P0：容量不足时草稿保留默认工时且仍可提交飞书。
3. P0：`useWeeklyReports.ts` 超过 300 行，同时承担草稿建模、生成、工时、保存、提交和页面状态。
4. P1：页面 smoke 只做源码正则匹配，未验证保存、提交和批量失败继续等关键行为。

### VERDICT

REWORK

## Spec Compliance

- MISSING：无。
- EXTRA：无。
- DEVIATED：无。
- 总评：PASS。

## Pass 2 修复

- 新增 `allocateWeeklyDayWorkHours`，先扣除手动工时，再从剩余容量分配自动工时；补充手动容量和超容量测试。
- 新增 `unresolved` 工时状态，容量不足或已估算正文被修改时阻止飞书提交，直到手动确认或重新估算。
- 将保存/飞书动作拆到 `weeklyReportActions.ts`，草稿展示辅助拆到 `weeklyReportDrafts.ts`；`useWeeklyReports.ts` 收敛为页面编排入口。
- 新增 IPC mock 行为测试，覆盖历史 ID 覆盖保存、保存失败阻断发布、未确认工时阻断发布和批量失败继续。

