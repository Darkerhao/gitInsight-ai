# Review Pass 3

## Reviewer

### Findings

1. P0：`createWeeklyReportActions` 与 `useWeeklyReports` 函数体仍超过编码规范的 40 行限制，职责需要继续拆分。
2. P1：生成、保存和飞书提交会将原始 IPC 错误消息直接展示给用户，可能暴露上游响应、内部路径或敏感详情。

### VERDICT

REWORK

## Spec Compliance

- MISSING：无。
- EXTRA：无。
- DEVIATED：无。
- 总评：PASS。

## Pass 3 修复

- `weeklyReportActions.ts` 改为小函数实现生成、保存与发布，工厂只绑定依赖。
- 新增 `useWeeklyReportState.ts` 和 `weeklyReportCommands.ts`，分别承担页面状态/工时变更与用户命令；`useWeeklyReports.ts` 只做装配。
- 生成、保存和飞书提交统一使用稳定的用户可见失败文案，不再透传原始外部错误。
- 新增错误脱敏行为测试；TypeScript AST 检查确认周报模块无超过 40 行的函数，所有模块均小于 300 行。
- 工时重算通过 getter 在调用时读取最新配置，避免状态拆分后捕获陈旧的默认日工时。

