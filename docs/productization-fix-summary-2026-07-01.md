# 2026-07-01 产品化修复总结

## 背景

本次修改基于 `findings.md` 中对假数据、半实现功能和同步/历史链路的扫描结果推进，目标是减少用户可见误导、补齐日报时间段闭环，并让自动同步能力与页面语义更加一致。

## 已完成改动

### 1. 日报时间段持久化

- `DailyReportRecord` 和 `SaveDailyReportPayload` 增加 `timeRange` 字段。
- `daily_reports` 表新增 `start_datetime`、`end_datetime`、`time_range_label` 三个字段。
- 旧数据库启动时会自动补列，不需要用户手动迁移。
- 生成日报、手动保存日报都会把真实时间段写入历史记录。
- 历史日志详情新增“日报时间段”展示。
- 从历史记录“继续编辑”或“重新发布”时，优先回填原始 `startDateTime/endDateTime`，不再退化为整天范围。
- 配置页修改“日报日期”时，会同步重置为该日期全天时间段，避免日期和新版时间范围脱节。

### 2. 自动同步时间窗口

- `AutoSyncConfig` 新增 `timeWindowMode` 和 `windowStartTime`。
- 默认模式仍为“日报日期全天”，兼容旧配置。
- 新增“昨日固定时间至执行时刻”模式，支持类似“昨日 9 点到当前执行时间”的日常同步窗口。
- 自动同步执行时会显式传入 `startDateTime/endDateTime`，不再依赖 `generateReport` 的整天默认值。
- 自动同步成功消息会带上实际统计窗口。
- 手动立即执行自动同步后，如果返回日报内容，会同步回填对应日期和时间段。
- 自动同步计划页和配置卡片都展示/可配置统计窗口。

### 3. 开屏动画真实数据接入

- 开屏动画接收 `App.vue` 汇总的真实运行指标。
- 仓库总数、已选仓库数来自当前 `repos` 和 `selectedRepos`。
- 历史日报数、同步日志数、错误日志数优先来自本地存储统计。
- 近期提交数来自已加载日报记录的 `commitsCount` 汇总。
- 最近日报日期和最近同步时间来自本地历史记录与同步日志。
- 数据尚未初始化完成时显示“读取中”，不会展示固定假指标。
- 统一欢迎动画状态 key 为 `gitinsight:welcome-finished`，动画完成时写入同一个状态，和系统设置页保持一致。

### 4. 同步任务页语义收敛

- 页面继续定位为“自动同步计划”和“同步范围”，不再强化独立任务模型。
- 移除“复制任务”入口，避免用户误以为存在独立任务副本能力。
- 表格执行配置中展示统计窗口，例如“日报日期全天”或“昨日 09:00 至执行时刻”。
- 部分“任务”文案调整为“同步范围/同步计划”，降低误导。

### 5. 飞书测试提交风险降低

- 点击“测试提交”前增加二次确认。
- 确认文案明确说明会向真实飞书表单写入一条测试记录。
- 测试记录内容增加 `[GitInsight 测试记录]` 标记，并提示不要作为正式日报统计。

### 6. 工作台规则建议降级

- 原“使用建议”改为“规则建议”。
- 输入提示明确为按关键词给出排查方向，不再暗示真实 AI 分析。
- 快捷操作文案从“新建日报任务/批量生成日报”调整为“生成日报/按当前范围生成”，贴合实际能力。

### 7. 系统设置重置文案收窄

- “恢复默认配置”调整为“重置同步默认值”。
- 重置范围明确为自动同步时间窗口、启用状态和默认工时。
- 新增自动同步窗口字段也会随重置恢复默认值。

## 主要涉及文件

- `electron/main.ts`
- `src/shared/types.ts`
- `src/renderer/src/composables/useAssistant.ts`
- `src/renderer/src/components/WelcomeGate.vue`
- `src/renderer/src/components/panels/AutoSyncCard.vue`
- `src/renderer/src/components/panels/BasicConfigCard.vue`
- `src/renderer/src/views/DashboardView.vue`
- `src/renderer/src/views/HistoryLogsView.vue`
- `src/renderer/src/views/SyncTasksView.vue`
- `src/renderer/src/views/SystemSettingsView.vue`
- `src/renderer/src/App.vue`

## 验证结果

- `npm run typecheck` 通过。
- `npm run build` 通过。
- `git diff --check` 通过。
- 构建过程中仍存在 Element Plus 依赖内 `/* #__PURE__ */` 注释的 Rollup 提示，属于第三方依赖提示，不是本次改动引入的构建错误。
- Windows 环境下仍会出现 LF/CRLF 换行提示，属于当前 Git 配置行为。

## 本轮未实现的内容

- 未新增真正的 `sync_tasks` 独立任务表，也未实现按任务维度的 CRUD 和独立调度。
- 未接入真正 AI 助手或错误日志语义分析接口，工作台建议仍为规则建议。
- 飞书测试提交已增加确认和标记，但未实现测试记录自动清理或撤销。
- 消息已读状态仍保存在 `localStorage`，未迁移到本地数据库。
- 安全存储不可用时的明文降级策略本轮未扩展。

## 后续建议

1. 如果产品方向需要多任务管理，优先设计真实 `sync_tasks` 数据模型和调度器。
2. 为飞书测试记录补充清理能力，或增加 dry-run 字段校验模式。
3. 将工作台规则建议升级为基于真实日志和错误上下文的 AI 分析。
4. 为 `timeRange` 持久化和自动同步窗口补充主进程单元测试或端到端冒烟用例。
