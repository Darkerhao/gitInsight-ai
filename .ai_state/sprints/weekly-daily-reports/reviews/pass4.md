# Review Pass 4

## Reviewer

### Findings

1. P0：`_weekly-report.scss` 共 433 行，超过单文件 300 行的硬性规范。
2. P1：工时重算虽通过 getter 读取当前默认日工时，但缺少配置变化后的行为测试。

### VERDICT

REWORK

## Pass 4 修复

- 按职责将页面基础布局与编辑/发布/响应式样式拆为 `_weekly-report.scss`（247 行）和 `_weekly-report-editor.scss`（185 行）。
- 抽出 `weeklyReportHours.ts` 作为工时状态编排模块，并新增行为测试：第一次按 4 小时分配，配置变更后第二次按 8 小时分配。
- 周报专项 12/12 + 页面 smoke、全量 35/35、typecheck、build、AST 函数长度检查、文件长度检查与 diff check 全部通过。

