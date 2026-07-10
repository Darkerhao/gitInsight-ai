# GitInsight AI 产品化优化计划

本次更新日期：2026-07-10

## 背景

当前项目已经具备 AI 日报生成、仓库扫描、多项目草稿、飞书同步、自动同步、历史日志、AI 多配置、系统设置、甲币签到与甲子农场等能力。项目已经不处在“补齐基础功能”阶段，下一步重点应放在配置成功率、数据查询闭环、自动同步可靠性、日报质量、长期可维护性和企业级使用体验上。

本计划基于当前代码状态重新梳理，避免沿用早期文档中已经过期的判断。

## 本次评估范围

- `package.json`
- `electron/main.ts`
- `electron/main/autoSync.ts`
- `electron/main/config.ts`
- `electron/main/database.ts`
- `electron/main/gitCollect.ts`
- `electron/main/report.ts`
- `src/renderer/src/router.ts`
- `src/renderer/src/App.vue`
- `src/renderer/src/composables/useAssistant.ts`
- `src/renderer/src/composables/assistant/*`
- `src/renderer/src/views/ReportGenerateView.vue`
- `src/renderer/src/views/HistoryLogsView.vue`
- `src/renderer/src/views/ReportConfigView.vue`
- `src/renderer/src/views/SystemSettingsView.vue`
- `src/renderer/src/views/JiaziFarmView.vue`
- `src/renderer/src/components/panels/*`
- `src/renderer/src/components/report-generate/*`
- `src/renderer/src/components/rewards/CheckinRewardCenter.vue`

## 当前已具备能力

- 已支持 hash 路由和上次访问页面恢复。
- 已支持配置 dirty 状态提示和顶部保存入口。
- 已支持 `safeStorage` 不可用时阻断敏感配置保存，避免 AI Key、飞书 Cookie、CSRF Token 丢失。
- 已支持飞书字段解析和字段映射选择，不再完全依赖手工猜字段 ID。
- 已支持飞书接入向导基础版，并在测试提交失败时展示登录态、字段映射、项目选项、接口返回四类诊断。
- 已支持多项目日报草稿、单项目生成、批量生成、单项目发布和批量发布。
- 已支持历史日报继续编辑、重新发布、复制、导出。
- 已支持历史日志服务端查询基础版，渲染进程不再只对最近固定 50 条记录做本地过滤分页。
- 已支持 renderer vendor 分包。
- 已支持系统设置分区展示。

## 优先级总览

| 优先级 | 方向 | 目标 |
| --- | --- | --- |
| P0 | 飞书配置向导 | 降低新用户配置失败率，让连接、字段映射、测试提交形成闭环 |
| P0 | 历史日志服务端查询 | 避免只拉最近固定条数导致查询不完整，支撑长期使用 |
| P1 | 自动同步可靠性 | 支持错过补偿、失败重试、状态解释和更清晰的执行语义 |
| P1 | 日报生成质量增强 | 提升作者匹配、模块归纳、长 diff 摘要和降级日报质量 |
| P1 | 项目级草稿持久化 | 保护未发布日报，减少切页、重启、批量发布失败后的内容丢失 |
| P2 | 路由深链完善 | 支持历史详情、生成页日期/仓库、配置分区等业务级定位 |
| P2 | AI 配置体验 | 增加连接测试、模型列表拉取、可用性校验和场景级模型选择 |
| P2 | 本地数据管理 | 支持备份、恢复、清理、打开数据目录和日志维护 |
| P2 | 甲币与农场一致性 | 修正前后端奖励展示不一致，补齐甲币流水和消费确认 |
| P2 | 质量保障 | 补齐 lint、单测、e2e 冒烟流和 CI 检查 |

## P0：飞书配置向导

### 当前状态

`AdvancedConfigPanels.vue` 已经支持飞书接入向导基础版，按连接飞书、字段映射、人员与项目、提交前检查组织配置状态；测试提交失败时会给出登录态、字段映射、项目选项、接口返回四类诊断，并自动展开对应配置面板。

### 问题

- 向导仍是嵌入式状态区，不是完整分步式 wizard。
- 自动同步启用失败时，还可以继续复用这套诊断模型。
- 诊断分类主要基于错误信息推断，后续可升级为 IPC 结构化错误对象。

### 建议

继续深化“飞书配置向导”，按步骤组织现有能力：

1. 登录飞书或自动同步登录凭据。
2. 填写或解析表单地址、`shareToken`、提交接口地址。
3. 拉取表单字段，完成日期、汇报人、明细表、项目、工时、内容字段映射。
4. 拉取项目选项，配置默认项目、项目工时和汇报人 userId。
5. 执行测试提交，成功后保存配置并刷新同步状态。

### 涉及文件

- `src/renderer/src/components/panels/AdvancedConfigPanels.vue`
- `src/renderer/src/components/panels/BasicConfigCard.vue`
- `src/renderer/src/composables/assistant/feishuState.ts`
- `electron/main/feishuAuth.ts`
- `electron/main/feishuForm.ts`
- `electron/main/autoSync.ts`

### 验收标准

- 新用户不需要手工猜字段 ID。
- 每一步都能看到当前是否完成、失败原因和修复入口。
- 测试提交失败时能明确指出失败阶段。
- 成功测试后自动保存配置，并刷新飞书项目选项和自动同步校验状态。

## P0：历史日志服务端查询

### 当前状态

已新增 `HistoryLogQuery`、`HistoryLogRecord`、`HistoryLogPage` 共享类型，并通过 `history-log:query` IPC 接入主进程查询。`HistoryLogsView.vue` 已切换为调用 `window.api.queryHistoryLogs` 获取分页结果，支持关键字、项目、类型、状态、时间范围和分页参数。

### 问题

- 基础版已避免“只查询最近固定 50 条”的问题，但关键字、项目、状态等部分过滤仍在主进程合并三类记录后完成，后续可继续下推到 SQL。
- 同步日志可通过 `reportId` 关联日报项目名，但详情抽屉还未支持从同步日志跳转到对应日报内容。
- 历史详情深链定位尚未完成。

### 建议

- 继续把关键字、项目、状态过滤下推到 SQL，使用 `WHERE`、`ORDER BY`、`LIMIT`、`OFFSET` 查询，并返回 `total`。
- 支持 `/history?id=report-123` 或 `/history?type=error` 定位详情。
- 同步日志详情中如果存在 `reportId`，支持跳转到对应日报内容。

### 涉及文件

- `electron/main/database.ts`
- `electron/main/ipc.ts`
- `electron/preload.ts`
- `src/renderer/src/env.d.ts`
- `src/renderer/src/composables/assistant/localDataState.ts`
- `src/renderer/src/views/HistoryLogsView.vue`

### 验收标准

- 大量历史数据下查询结果完整。
- 分页总数来自数据库。
- 详情页可通过路由参数直达。
- 日报、同步日志、错误日志能互相关联追踪。

## P1：自动同步可靠性

### 当前状态

自动同步基于应用内 `setTimeout` 调度，并在页面文案中明确“仅在应用打开时生效”。主进程支持手动触发、定时触发、运行中互斥、定时去重和恢复后刷新调度。

### 问题

- 应用关闭期间不会执行自动同步。
- 如果错过计划时间，当前机制需要更明确的补偿策略。
- 失败后缺少自动重试、失败原因分级和一键重试入口。
- 当前自动同步仍是全局计划，不能按项目配置独立目标、时间和重试策略。

### 建议

- 增加“错过计划”检测：应用启动或系统恢复时提示是否补跑。
- 增加失败重试策略：登录态失败、字段缺失、AI 失败、无提交记录分别处理。
- 增加“强制再执行一次”语义和确认弹窗。
- 中长期引入 `SyncTask` 模型，支持项目级任务、目标项目、工时、频率、状态和日志关联。

### 涉及文件

- `electron/main/autoSync.ts`
- `electron/main.ts`
- `src/renderer/src/components/panels/AutoSyncCard.vue`
- `src/renderer/src/composables/assistant/autoSyncState.ts`
- `src/shared/types.ts`

### 验收标准

- 应用启动后能清楚说明是否错过自动同步。
- 失败后用户能知道是否可重试、如何修复。
- 手动触发永远符合“立即执行一次”的预期。
- 自动同步日志能关联生成的日报记录。

## P1：日报生成质量增强

### 当前状态

日报生成使用 Git 提交、文件列表和 diff 摘要构造 Prompt。主进程会按汇报人名称匹配 Git 作者，AI 失败或未配置 API Key 时降级成本地模板日报。

### 问题

- `filterCommitsByReporter` 当前使用汇报人和 Git 作者名精确匹配，容易漏掉英文名、邮箱名、大小写以外的别名。
- 长 diff 仍使用固定截断，可能截掉关键上下文。
- Prompt 已要求模块标签，但复杂变更仍可能需要二次归并和质量校验。
- 本地模板日报可用，但对企业日报风格的表达仍可继续增强。

### 建议

- 增加 Git 作者别名配置：中文名、英文名、邮箱、常用 Git author。
- 支持 `Co-authored-by` 和多作者识别。
- 对长 diff 做文件级摘要和模块级分组，而不是只按字符截断。
- 增加生成后结构校验：是否包含今日工作内容、工作成果、明日计划、模块标签。
- 支持 Prompt 模板配置和企业风格模板。

### 涉及文件

- `electron/main/gitCollect.ts`
- `electron/main/report.ts`
- `electron/main/aiClient.ts`
- `src/shared/types.ts`
- `src/renderer/src/views/ReportGenerateView.vue`

### 验收标准

- 用户可配置多个 Git 作者别名。
- 无匹配提交时能提示可能的作者名候选。
- 长变更的日报不因截断丢失关键模块。
- AI 输出不合规时能自动修正或提示重试。

## P1：项目级草稿持久化

### 当前状态

生成页已经支持多项目草稿、单项目发布、批量发布、项目工时和飞书目标选择。草稿主要存在于渲染层内存，保存后才进入历史记录。

### 问题

- 切页、刷新、重启或异常退出时，未保存草稿可能丢失。
- 批量发布部分失败后，用户需要依赖当前页面状态继续处理。
- 每个仓库与飞书项目之间的默认映射还不够稳定。

### 建议

- 增加本地草稿表或草稿缓存，按 `repoPath + date + timeRange` 保存。
- 支持“恢复上次未发布草稿”。
- 支持项目默认发布目标和默认工时映射。
- 批量发布失败后保留失败队列，并支持只重试失败项目。

### 涉及文件

- `src/renderer/src/views/ReportGenerateView.vue`
- `src/renderer/src/components/report-generate/ReportEditorCard.vue`
- `src/renderer/src/components/report-generate/ReportPublishSidebar.vue`
- `electron/main/database.ts`
- `src/shared/types.ts`

### 验收标准

- 未发布草稿不会因重启丢失。
- 批量发布失败后能继续处理失败项。
- 每个仓库可记住默认飞书项目和工时。

## P2：路由深链完善

### 当前状态

项目已使用 `vue-router` hash history，当前路由主要作为一级导航状态，例如 `/generate`、`/history`、`/config`。

### 建议

- 支持 `/history?id=report-123` 打开指定日志详情。
- 支持 `/generate?date=2026-07-10&repo=...` 回到指定生成上下文。
- 支持 `/config?panel=fields` 或 `/system?tab=security` 直达配置分区。
- 导航事件从字符串升级为结构化 route intent。

### 涉及文件

- `src/renderer/src/router.ts`
- `src/renderer/src/App.vue`
- `src/renderer/src/views/HistoryLogsView.vue`
- `src/renderer/src/views/ReportConfigView.vue`
- `src/renderer/src/views/SystemSettingsView.vue`

## P2：AI 配置体验

### 当前状态

项目已支持多 AI 配置档案，可在生成页临时选择配置。

### 建议

- 增加“测试连接”按钮，校验 Base URL、API Key、模型是否可用。
- 支持拉取 `/models` 并写入模型选项。
- 展示当前配置是否启用、是否有 API Key、是否可用于日报生成。
- 支持按场景选择模型，例如日报生成、日报润色、错误解释。

### 涉及文件

- `src/renderer/src/components/panels/AdvancedConfigPanels.vue`
- `src/renderer/src/views/ReportConfigView.vue`
- `electron/main/aiClient.ts`
- `electron/main/ipc.ts`
- `electron/preload.ts`

## P2：本地数据管理

### 当前状态

系统设置页已经展示本地配置、加密密钥、数据库路径和记录数量。

### 建议

- 增加打开 userData 目录入口。
- 增加导出备份、导入恢复。
- 增加日志清理策略：按日期、按类型、保留最近 N 条。
- 增加数据库健康检查和错误日志导出。

### 涉及文件

- `src/renderer/src/views/SystemSettingsView.vue`
- `electron/main/database.ts`
- `electron/main/ipc.ts`
- `electron/preload.ts`

## P2：甲币与甲子农场一致性

### 当前问题

前端签到奖励展示为 `88888-888888`，后端实际发放为 `8888-88888`，存在用户预期不一致。

### 建议

- 统一签到奖励范围，建议由后端返回奖励规则，前端只展示服务端配置。
- 增加甲币流水查询，展示签到、消费、农场收获、迁移记录。
- 对高额消费增加确认弹窗。
- 农场任务与日报生成、飞书同步、Git 提交记录之间增加“为什么可领取”的解释。

### 涉及文件

- `src/renderer/src/components/rewards/CheckinRewardCenter.vue`
- `electron/main/checkinWallet.ts`
- `electron/main/jiaziFarm.ts`
- `electron/main/database.ts`

### 验收标准

- 前后端展示的奖励范围一致。
- 用户能查看甲币来源和消费去向。
- 高额消费有确认，不会误触。

## P2：质量保障补强

### 当前状态

`package.json` 当前提供 `dev`、`build`、`typecheck`、`check` 和打包相关脚本，但没有 `lint`、单测和 e2e。

### 建议

- 增加 ESLint 和 Prettier，统一 Vue、TypeScript 和样式规范。
- 增加 Vitest 单测，优先覆盖：
  - 配置归一化。
  - `safeStorage` 不可用时的保存阻断。
  - 日报时间范围校验。
  - Git 作者过滤和别名匹配。
  - 飞书字段映射数据构造。
  - 自动同步跳过、失败、成功状态。
- 增加 Playwright 或 Electron e2e 冒烟流：
  - 启动应用。
  - 选择工作区并扫描仓库。
  - 生成日报。
  - 保存日报。
  - 查看历史日志。
  - 打开系统设置。
- CI 在 release 打包前执行 `npm run check`、`npm run lint`、`npm run test`。

### 涉及文件

- `package.json`
- `.github/workflows/release.yml`
- `electron/main/*`
- `src/renderer/src/**/*`

## 推荐实施顺序

1. 飞书配置向导：优先解决“新用户配不通”的问题。
2. 历史日志服务端查询：保证长期使用后仍能查全、查准。
3. 自动同步可靠性：补齐错过执行、失败重试和强制重跑语义。
4. 日报生成质量增强：提升作者匹配、模块归纳和模板质量。
5. 项目级草稿持久化：保护批量生成和批量发布过程中的内容。
6. AI 配置体验、本地数据管理、路由深链、甲币一致性同步推进。
7. 质量保障：补齐 lint、单测、e2e，并接入 CI。

## 阶段目标

### 第一阶段：配得通

- 飞书向导闭环。
- 测试提交可解释失败原因。
- 自动同步启用前完整校验。

### 第二阶段：用得稳

- 历史记录真实分页和深链定位。
- 自动同步错过补偿、失败重试和日志追踪。
- 项目级草稿可恢复。

### 第三阶段：报得准

- Git 作者别名和邮箱匹配。
- 长 diff 分模块摘要。
- AI 输出结构校验和企业风格模板。

### 第四阶段：可维护

- 本地数据备份、恢复、清理。
- 甲币和农场规则一致。
- lint、单测、e2e、CI 检查齐全。
