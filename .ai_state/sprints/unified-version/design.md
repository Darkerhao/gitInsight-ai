# main 与简洁版功能整合

## Scope

用户明确要求在新分支整合 `main` 与 `feature/simple-version` 的功能。工作分支为 `codex/unified-version`，基线分别为 `07abbac` 与 `800e5ce`；原分支不移动，不推送或发布。

候选为直接 Git 合并或以新版实现为基础恢复缺失功能。直接合并有大量重复签到特效和布局冲突，选择后者，并在最终整合提交记录两个父版本。路径 Refactor，置信度 0.96。

## Implementation

- 保留简洁版 3.8.9 的日报编辑发布、周报、复盘、时间长河、签到、可靠性和更新流程。
- 恢复 main 的工作台、仓库中心、消息中心、使用帮助，复用现有组件、样式和 useAssistant。
- 任务中心复用 AutoSyncCard 的多任务编辑与执行；日历基于真实任务和日志，不恢复旧版从仓库推导任务的实现。
- 恢复项目经理/产品经理素材日报：分区素材、按角色/日期存取、生成、编辑、保存、复制、导出、发布和历史续编。读取 main 原始实现确定数据契约，沿用现有 AI 网络客户端、SQLite 持久化和飞书发布防重逻辑。
- 素材日报事实来源不读取 Git；保持旧 role_materials 表数据可读，不引入新依赖。
- 素材编辑上下文按 role + date 标识；切换时素材、输出和 reportId 一起切换，异步结果只写入发起上下文。优先在操作期间禁用切换并保护未保存编辑。
- 历史续编必须恢复素材角色与日期，不使用伪造 Git 路径；发布前保存最新编辑失败时禁止提交。
- role_materials 对旧简洁版 v1 备份为可选表，存在时校验结构；缺表在正常启动时创建。覆盖旧备份恢复和素材备份往返。
- 新版 AboutView 替代旧 AboutUsView；新版编辑器替代旧 ReportPreviewCard；不恢复旧整块 style.css 和重复特效。
- 更新导航和旧地址，使新旧功能均可访问。保留 main-only 发布规则及现有 Lite/Standard 包身份。
- 完整功能核对补充：保留多仓库合成一篇研发日报、来源明细预览、跨页未读提示和复制本地数据目录。合篇与逐项目生成共用当前编辑/保存/发布链路，并保留真实仓库身份与历史续编语义。

## Acceptance Criteria

- [x] AC1: 当前分支为 codex/unified-version，原 main 和 feature/simple-version SHA 不变，合并结果包含两者历史。
- [x] AC2: 工作台、仓库、消息、帮助与现有日报/周报/复盘/时间长河/关于路由可访问，入口使用同一导航。
- [x] AC3: 同步任务编辑、手动执行和日历读取同一多任务模型；无旧全局 time/lastStatus 写入。
- [x] AC4: 两类素材日报可不选 Git 仓库完成素材保存、生成、编辑、保存、发布、历史续编；生成失败与保存失败不丢内容，不错误提交。
- [x] AC5: 原 role_materials 素材可读，现有日报和新素材日报都纳入备份；数据持久化不绕过原子写入。
- [x] AC6: typecheck、build、全量单测、新增功能及现有日报/关于 E2E 通过；完成隔离 Electron 冒烟。
- [x] AC7: 多仓库合篇的生成、保存、发布及历史续编维持一篇且保留所有来源仓库；现有逐项目生成不变，来源明细与未读/路径复制能力可用。

## Done Contract

- git status/merge-base/branch 验证 AC1；无冲突标记。
- npm run typecheck、npm run build、npm test 退出码 0。
- 新增有意义的素材和多任务/消息回归，使用现有 node:test 与 Playwright。
- npm run test:e2e -- --workers=2 通过；node tests/desktopRuntime.smoke.cjs 通过。
- 记录实际验证结果与未覆盖的外部服务边界；不声称真实飞书或 GitHub 发布已验证。
- 素材回归包含两角色/两日期切换、异步状态隔离、旧备份无 role_materials 恢复与新增素材备份往返。
- 合篇回归验证两仓库一次生成、一次保存/发布、历史恢复不拆成重复内容，且原有项目/周报测试仍通过。

## Ownership

- UI writer: App.vue、router.ts、AppSidebar.vue、新恢复四页面、SyncTasksView.vue、useMessages.ts、必要样式与 UI E2E。
- Material writer: 素材模块、共享类型、IPC/preload/env、SQLite、MaterialReportsView.vue、HistoryLogsView.vue、必要素材测试。
- Report writer: 当前日报生成页、草稿状态和共享生成动作中多仓库合篇的最小扩展与回归。
- 主线程: 分支整合、共享测试 fixture/package 脚本、状态文档、最终验证与必要冲突处理。

## Round 1 · Critic Findings

NEEDS_REVISION：P1 角色/日期切换导致素材与 reportId 串用；P1 将素材表直接列为必需项会拒绝旧 v1 备份。已将上下文隔离和可选旧表迁移加入 Implementation 与 Done Contract。

## Round 2 · Critic Findings

PASS：上述两个缺口已在设计和 Done Contract 中明确覆盖。
