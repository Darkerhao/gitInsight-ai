# 产品化优化修复发现记录

## 初始发现

- codebase-memory MCP 图谱资源当前不可用，本轮基于源码阅读、`rg` 检索和工程命令验证推进。
- 当前项目为 Electron + Vue 3 + Element Plus + TypeScript。
- `npm run typecheck` 在前一轮审阅中通过，初始问题主要是产品逻辑和交互闭环。

## 错误与处理

| 时间 | 问题 | 处理 |
| --- | --- | --- |
| 2026-06-30 | `/usr/bin/bash` 在当前执行器不可用 | 使用 PowerShell 执行只读和验证命令 |
| 2026-06-30 | PowerShell `Get-Content` 输出中文出现终端编码乱码 | 使用 `rg` 和精确代码片段确认源文件内容，未按乱码文本改写 |
| 2026-06-30 | 同步任务页并没有独立任务数据模型 | 采用短期方案 A，将页面语义收敛为全局自动同步计划和同步范围 |
| 2026-07-01 | 当前会话没有暴露 codebase-memory MCP 图谱工具或资源 | 已尝试 `list_mcp_resources`，结果为空；本轮基于审计文档定位、源码阅读和 `rg` 检索推进 |
| 2026-07-01 | `cmd.exe` 执行 `node -e` 空白检查时双引号被传入脚本导致语法错误 | 改用 `git diff --no-index --check -- NUL docs\multi-role-ai-daily-assistant-plan.md` 检查新文档尾随空白 |

## 2026-07-01 审计修复发现

- `electron/main.ts` 的 `saveConfig()` 会在 `safeStorage` 不可用时继续写入剥离敏感字段后的 `config.json`，需要在存在 `aiApiKey`、飞书 `cookie` 或 `csrfToken` 时阻断保存。
- `ReportGenerateView.vue` 的“保存修改”没有把 `activeReportContent` 传给 `saveCurrentReport()`，导致简洁版草稿不会写入历史记录。
- `ReportGenerateView.vue` 的 `conciseDirty` 是局部状态，从历史日志加载新日报时共享 `report.value` 会变化，但 dirty 状态可能阻止简洁版草稿重建。
- `runAutoSync('manual')` 与定时任务共用 `lastSuccessKey` 去重；手动触发应允许补发或重试。

## 2026-07-01 假数据与未完成功能扫描

### 扫描范围

- 扫描命令覆盖 `src/renderer/src`、`electron`、`src/shared`、`docs` 和 `README.md`。
- 重点检索 `TODO`、`FIXME`、`mock`、`fake`、`demo`、`sample`、`placeholder`、`暂未`、`未实现`、`测试提交`、静态数组、硬编码指标和用户可点击但未闭环的操作。
- codebase-memory MCP 图谱工具当前未暴露可用接口，本轮基于源码检索、关键文件阅读和既有构建结果判断。

### 用户可见的假数据或展示型数据

| 优先级 | 位置 | 现象 | 判断 | 建议 |
| --- | --- | --- | --- | --- |
| P1 | `src/renderer/src/components/WelcomeGate.vue` | 开屏动画固定展示 `repos=12`、`commits=486`、`confidence=96`、`syncTasks=8`，还包含 `feature/report-pipeline` 等伪分支名和固定柱状图高度 | 纯视觉演示数据，非真实仓库/任务统计；新用户可能误以为系统已完成真实扫描 | 将指标改为中性加载文案，或接入 `storageInfo`/仓库扫描结果后再展示数值 |
| P1 | `src/renderer/src/views/DashboardView.vue` | “使用建议”输入框按关键词返回固定文案，未调用 AI，也没有基于当前错误日志做语义分析 | 功能形态像 AI 助手，但实际是规则回复 | 页面文案改成“规则建议”，或接入真实 AI/日志分析接口 |
| P1 | `electron/main.ts` / `BasicConfigCard.vue` | “测试提交”会向飞书表单写入固定文本 `测试提交管道：Electron persist:feishu 登录态验证。` | 这是测试数据，且会落到真实飞书目标表单 | 增加二次确认、测试标记、自动清理能力，或改为 dry-run 校验 |
| P2 | `src/renderer/src/views/DashboardView.vue` | 任务分布图没有数据时使用 `暂无数据` 占位扇区；趋势筛选下拉只有固定 `近7天` | 占位行为合理，但筛选控件没有真实可选范围 | 改为纯文本空状态，或补齐 7/14/30 天真实筛选 |
| P2 | `src/renderer/src/views/DashboardView.vue` | 快捷操作包含“新建日报任务”“批量生成日报”，实际分别跳转日报生成或执行当前选中仓库的一次生成 | 文案大于真实能力，没有独立任务创建或批量任务队列 | 改名为“生成日报”“按当前范围生成”，或实现任务队列 |
| P3 | `src/renderer/src/components/aside/UsageGuide.vue` | “查看详细教程”按钮只弹出提示，不跳转也不展示教程详情 | 功能入口未闭环 | 跳转 `UsageHelpView`，或移除按钮 |

### 未完成或半实现功能

| 优先级 | 模块 | 现状 | 影响 | 建议 |
| --- | --- | --- | --- | --- |
| P0 | 日报时间段持久化 | `ReportResult` 已有 `timeRange`，但 `daily_reports` 表、`DailyReportRecord`、`SaveDailyReportPayload` 未保存时间段；历史记录加载时只能恢复为整天范围 | 用户按“昨日9点至今天12点10分”生成后，历史记录无法还原真实筛选窗口，重新发布/编辑会丢上下文 | 给 DB 增加 `start_datetime`、`end_datetime` 或把 `timeRange` 写入 `raw_input_json` 并在历史页展示/回填 |
| P0 | 自动同步时间段 | `runAutoSync` 仍只传 `date`，依赖 `generateReport` 默认整天 `[00:00, 次日00:00)` | 定时同步无法覆盖“昨天9点到今天某时间”的日常工作窗口 | 为自动同步增加独立时间窗口配置，如“上次同步后至本次执行”“昨日固定开始至执行时刻” |
| P0 | 配置页日期与生成范围 | `BasicConfigCard.vue` 仍只修改 `form.date`，不会同步 `form.startDateTime/endDateTime` | 从配置页改日报日期后，再由工作台触发生成时可能仍使用旧时间段 | 复用 `applyFullDayReportRange`，或隐藏配置页日期入口，统一在日报生成页维护范围 |
| P1 | 同步任务模型 | `SyncTasksView.vue` 的每行任务由 `selectedRepos` 派生，编辑弹窗大多字段禁用；保存时只写全局 `config.autoSync.time/enabled` | UI 像多任务管理，实际只有一个全局计划和项目范围，没有独立任务、独立周期、独立目标 | 明确命名为“同步范围”，或新增真实 `sync_tasks` 数据表与 CRUD |
| P1 | 同步频率/星期 | `frequencyLabel` 固定为“每日”，`weekdays` 固定全周，弹窗中执行频率和执行日期禁用 | 用户无法配置工作日、周末、不同项目频率 | 将频率/星期写入配置或任务表，并接入调度器 |
| P1 | 同步任务复制 | `copyTask()` 仅提示“当前为全局同步计划，不创建独立任务副本” | 操作按钮存在但没有实际能力 | 移除复制按钮，或实现任务复制 |
| P1 | 飞书测试提交 | 测试提交与正式提交走真实接口，但缺少“测试记录清理/撤销/标记测试数据”能力 | 测试数据会污染日报表，需要人工删除 | 增加测试数据标记、删除记录能力或只做字段校验 |
| P1 | 开屏动画开关 | `App.vue` 和 `SystemSettingsView.vue` 使用 `gitinsight:welcome-finished`，`WelcomeGate.vue` 使用 `gitinsight-ai:welcome-gate-played`；`finishWelcome()` 不写入 `gitinsight:welcome-finished` | 设置项和动画播放状态存在双 key，关闭/开启体验可能不符合预期 | 统一 localStorage key，并在动画完成时写入设置所读 key |
| P1 | 系统设置重置 | `resetSettings()` 仅重置自动同步启用状态、同步时间、默认工时和项目工时；文案为“恢复默认配置” | 用户可能误以为 AI、飞书、仓库等配置也会重置 | 改文案为“重置同步默认值”，或实现完整配置重置并要求二次确认 |
| P2 | 工作台项目统计 | 项目统计把所有仓库都作为“待处理”，只按当日日报成功记录扣减；没有真实项目任务状态表 | 统计可用于概览，但不是严格任务进度 | 文案改为“仓库日报覆盖情况”，或建立任务状态模型 |
| P2 | 消息阅读状态 | 消息中心内容来自真实同步/错误日志，但已读状态只保存在 localStorage | 换设备、清缓存或多窗口时阅读状态不一致 | 如需企业级审计，把阅读状态写入本地数据库 |
| P2 | 安全存储降级 | `safeStorage` 不可用时 `saveSensitiveConfig()` 直接返回，随后明文配置会剥离敏感字段 | 在不支持系统加密的环境中，AI Key/Cookie/CSRF 可能无法持久化 | 增加明确告警、用户确认的明文降级方案，或阻止保存敏感配置 |
| P3 | 旧预览组件 | `ReportPreviewCard.vue` 当前未被页面引用 | 死代码增加维护成本，且没有适配新时间段能力 | 删除旧组件，或重新接入并同步新范围逻辑 |

### 已确认不是假数据的部分

- `MessageCenterView.vue` 的消息来源是 `syncLogs`、`errorLogs` 和 `autoSyncState`，不是静态假消息。
- `HistoryLogsView.vue` 记录来自 `daily_reports`、`sync_logs`、`error_logs`，主要问题是时间段元数据没有持久化。
- `AboutUsView.vue`、`SystemSettingsView.vue` 的运行统计来自 `repos`、`dailyReports`、`syncLogs`、`errorLogs`、`storageInfo`，不是模拟指标。

### 建议处理顺序

1. 先补 `timeRange` 持久化和历史回填，避免新时间段能力无法审计。
2. 再决定同步任务页的产品方向：继续收敛为全局同步范围，或正式实现独立任务表。
3. 清理/降级用户可见假数据：开屏固定指标、工作台规则助手、测试提交污染。
4. 最后处理文案和死代码：工作台快捷操作、系统设置重置文案、未引用组件。

## 2026-07-01 AI日报助手多角色设计发现

- 当前项目已具备日报助手的事实底座：仓库扫描、选中项目、时间段、AI 生成、`rawInput` 原始证据、历史记录、飞书发布、同步日志和错误日志。
- 现有工作台更偏研发执行态，适合展示“生成/同步/失败/最近日报”；若要同时服务项目经理和产品经理，需要把同一份 Git 事实转换成不同角色的表达层。
- `ReportGenerateView.vue` 已有“简洁版/完整版”日报模式，可以扩展为“研发日报/项目日报/产品摘要”等角色视图。
- `DashboardView.vue` 的“规则建议”目前是关键词规则，不应包装成 AI；新设计应升级为基于日报、日志和原始证据的 AI 问答，或保留为规则建议。
- 多角色日报的核心风险是 AI 过度推断需求、进度或业务价值；设计上需要证据面板、置信度、待确认项和发布前人工审阅。

## 2026-07-01 多角色日报 MVP 实现发现

- 本次按 MVP 方案实现，不新增 IPC、不改 `daily_reports` 表结构、不改飞书字段结构。
- 三角色正文在 `ReportGenerateView.vue` 前端本地生成：研发日报使用基础 AI/模板日报，项目经理日报和产品经理摘要基于同一份日报正文、提交数和影响文件改写。
- 每个角色使用独立草稿和 dirty 状态；重新生成后只刷新未手动编辑的角色，避免覆盖用户修改。
- 产品经理摘要对业务价值、上线状态、验收结论只输出待确认项，避免从 Git 数据过度推断。
