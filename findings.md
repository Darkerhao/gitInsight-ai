# 产品化优化修复发现记录

## 2026-07-11 时间长河最终版

- 用户明确允许新增时间长河数据库 schema。
- 最终版应保留旧农场数据库数据，但移除前端模拟数据与农场产品语义。
- TDD 只覆盖已确认的两个公共领域接口，避免测试 CSS 动画和内部 SQL 细节。
- 项目目前没有 Vitest/Jest 等测试框架；使用现有 TypeScript 编译器 + Node 内置 `node:test`，避免引入外部依赖。
- `database.ts` 直接依赖 Electron `app/safeStorage`，领域测试应通过可注入的 `sql.js` 内存数据库运行，避免测试依赖 Electron 启动环境。
- 首轮 Green 发现 `rawInput.gitLogs` 的旧提交关键词会覆盖用户编辑后的日报语义；主工作类型必须以日报正文为准，原始 Git 数据仅用于标签和证据提取。
- 真实数据库包含 56 条日报，7 月成功日报可补建出 33 条成长记录；领域查询正常，截图空状态来自运行中的 Electron main/preload 未加载新 IPC，而前端此前未捕获错误。
- 历史快照补建原本只修改 `sql.js` 内存数据库，没有立即持久化；现改为 IPC 查询成功后调用 `persistDatabase()`。

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
| 2026-07-01 | `cmd.exe` 执行 `node -e` 空白检查时双引号被传入脚本导致语法错误 | 改用 `git diff --no-index --check -- NUL` 检查新增文档尾随空白 |

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

## 2026-07-04 奖励特效扩展发现

- 当前会话未暴露 codebase-memory MCP 图工具资源，`list_mcp_resources` 返回空；本轮基于源文件阅读和工程命令验证推进。
- 奖励特效现有实现未要求组件 props，组件由 overlay 重新挂载触发 CSS 动画；新增组件应保持无 props、局部样式、`pointer-events: none` 语义。
- `CheckinRewardCenter.vue` 的商店配置和 `RewardEffectOverlay.vue` 的映射都需要同步更新，否则新增 key 会出现可购买但无法渲染或类型不完整的问题。
- 当前 `src/renderer/src/components/rewards/` 目录在 `git status` 中为 untracked；本轮新增和接入文件位于该目录，构建已实际引用并通过。
- 二次视觉增强优先采用全局 overlay 舞台层，收益覆盖全部特效；局部强化集中在视觉记忆点最强的 Crown、CyberDataFlow、SpaceJump、EnergyRing、RainGlass，避免把所有组件都堆到同一种光效风格。

## 2026-07-04 飞书提交记录入口发现

- 飞书外部表单提交记录页没有在现有配置中单独保存稳定深链；更稳妥的方案是复用已有 `endpoint/shareToken` 打开表单页，并通过页面文案自动点击“我的提交记录/提交记录”入口。
- 新入口复用 `persist:feishu` 分区，能共享“登录飞书”窗口的登录态；如果飞书页面 DOM 或文案变化导致自动点击失败，会保留表单页打开并提示用户手动点击“我的提交记录”。
