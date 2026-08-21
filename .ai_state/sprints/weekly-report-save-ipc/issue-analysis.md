# 根因分析

## 调用链

`WeeklyReportsView.vue` → `weeklyReportActions.ts::saveWeeklyDraft` → preload `saveDailyReport` → IPC `daily-report:save` → `database.ts::saveDailyReport`。

## 候选与验证

1. 数据库或时间线写入异常：读取真实 `gitinsight.db` 后 `PRAGMA integrity_check = ok`，截图对应日报记录与时间线快照均可重放，排除。
2. 历史 ID 失配：截图对应日报 ID 均存在，时间线更新可成功执行，未复现。
3. Vue 响应式对象无法跨 Electron IPC：对响应式 `timeRange/rawInput` 执行 `structuredClone` 稳定抛出 `DataCloneError`，与保存调用发生在 IPC 前一致。

## 根因

一周日报草稿由 Vue 深度响应式状态维护。保存 payload 直接引用 `draft.result.timeRange/rawInput/structuredJson`，这些值是 Proxy；Electron IPC 使用结构化克隆，不能克隆 Proxy，因此请求未到达主进程数据库保存逻辑。单日日报已经对 `rawInput` 做普通对象转换，一周日报遗漏了同一边界处理。

## 最小修复

在 renderer 的日报 IPC payload 边界统一将时间范围、原始输入和结构化元数据复制为普通对象。一周日报与单日日报复用同一组转换函数，不修改数据库 schema、飞书 payload 或页面状态模型。
