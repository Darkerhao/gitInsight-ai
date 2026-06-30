# GitInsight AI 产品化优化计划

## 背景

当前项目已经具备日报生成、仓库管理、飞书同步、同步任务、历史日志、系统设置等核心模块，工程侧 `npm run typecheck` 已通过。下一阶段重点不再是补齐基础功能，而是提升配置成功率、任务语义一致性、操作闭环和长期可维护性，让产品从“功能可用”走向“稳定好用”。

本计划基于以下文件与链路梳理：

- `src/renderer/src/App.vue`
- `src/renderer/src/composables/useAssistant.ts`
- `src/renderer/src/views/ReportGenerateView.vue`
- `src/renderer/src/views/SyncTasksView.vue`
- `src/renderer/src/views/HistoryLogsView.vue`
- `src/renderer/src/views/DashboardView.vue`
- `src/renderer/src/views/SystemSettingsView.vue`
- `src/renderer/src/components/panels/AdvancedConfigPanels.vue`
- `electron/main.ts`

## 优先级总览

| 优先级 | 方向 | 目标 |
| --- | --- | --- |
| P0 | 飞书配置向导 | 让新用户能完整配置并成功测试提交 |
| P0 | 同步任务语义收敛 | 避免“单任务编辑”实际修改全局配置的误导 |
| P1 | 配置保存状态 | 明确哪些修改已保存、哪些修改待保存 |
| P1 | 历史记录闭环 | 支持恢复编辑、复制、导出、重新发布 |
| P1 | 工作台前置检查 | 快捷操作先诊断，再引导用户补齐配置 |
| P2 | 路由状态化 | 支持刷新恢复、深链、返回/前进 |
| P2 | 首次引导 | 将欢迎页升级为配置 onboarding |
| P2 | 系统设置分区 | 让 tabs 真正承载不同设置域 |
| P2 | 质量保障 | 补齐 lint、单测、基础 e2e 冒烟流 |

## P0：飞书配置向导

### 当前问题

主进程在自动同步和飞书提交时要求以下字段：

- `questionId`
- `dateFieldId`
- `userFieldId`
- `projectFieldId`
- `hoursFieldId`
- `contentFieldId`

但渲染层目前没有完整的可视化配置入口。用户即使填写了飞书登录态、`shareToken`、`endpoint`，也可能因为字段映射缺失而无法完成自动同步或测试提交。

相关位置：

- `electron/main.ts`：`validateAutoSyncConfig`、`buildFeishuFormData`
- `src/renderer/src/components/panels/AdvancedConfigPanels.vue`
- `src/renderer/src/composables/useAssistant.ts`

### 调整建议

新增“飞书配置向导”，建议分为四步：

1. 登录飞书或填写 Cookie、CSRF Token。
2. 填写表单地址、`shareToken`，拉取飞书表单元数据。
3. 从解析出的字段列表中选择日期、汇报人、所属项目、工时、工作内容、明细表问题字段。
4. 执行测试提交，并展示成功结果或精确错误定位。

### 验收标准

- 新用户不需要手工猜字段 ID。
- 自动同步启用前能明确看到缺失项。
- 测试提交失败时能指出是登录态、字段映射、项目选项还是接口返回异常。
- 成功测试后保存配置，并刷新项目选项。

## P0：同步任务语义收敛

### 当前问题

同步任务页中的任务由 `selectedRepos + config.autoSync` 投影生成，并非独立任务数据。用户在表格里编辑某一行任务时，实际修改的是全局自动同步时间和启用状态；删除任务则会从已选仓库中移除该仓库。

相关位置：

- `src/renderer/src/views/SyncTasksView.vue`
- `src/renderer/src/composables/useAssistant.ts`
- `src/shared/types.ts`

### 方案 A：收敛为全局自动同步配置

适合短期快速产品化。

- 将“同步任务”重命名为“自动同步”或“同步计划”。
- 表格改为“参与同步的项目列表”。
- 编辑弹窗只展示全局同步设置，不暗示每个仓库可独立配置。
- 删除按钮文案改为“从同步范围移除”。

### 方案 B：引入真实同步任务模型

适合中长期扩展。

- 新增 `SyncTask` 数据结构和持久化表。
- 支持每个任务独立配置项目、时间、频率、状态、目标飞书项目。
- 自动同步调度器按任务维度执行。
- 同步日志关联具体 `taskId`。

### 建议路径

先执行方案 A，快速降低误导；后续再评估是否升级到方案 B。

## P1：配置保存状态统一

### 当前问题

项目中存在三种保存行为：

- 添加仓库后自动保存。
- 配置页修改后需要手动保存。
- 生成、测试、同步前会隐式保存配置。

用户容易不确定当前修改是否已经生效。

相关位置：

- `src/renderer/src/composables/useAssistant.ts`
- `src/renderer/src/components/panels/BasicConfigCard.vue`
- `src/renderer/src/views/SystemSettingsView.vue`

### 调整建议

- 在 `useAssistant` 中维护配置快照和 `isConfigDirty`。
- 顶部或配置页固定显示“有未保存修改”。
- 切页、关闭窗口、执行测试/同步前提示将先保存配置。
- 保存成功后统一刷新自动同步状态、飞书项目状态和本地数据状态。

### 验收标准

- 用户能明确知道当前配置是否已保存。
- 关键动作执行前不会静默保存导致困惑。
- 保存失败时不会覆盖用户输入。

## P1：历史记录闭环

### 当前问题

历史日志页能查看记录详情，但缺少继续操作能力；分页控件存在，但当前仍主要基于前端完整数据展示。生成页右侧“查看全部”按钮也未绑定跳转。

相关位置：

- `src/renderer/src/views/HistoryLogsView.vue`
- `src/renderer/src/views/ReportGenerateView.vue`
- `electron/main.ts`

### 调整建议

- 历史日报支持“加载到生成页继续编辑”。
- 日报详情支持复制、导出 Markdown、重新发布到飞书。
- 日志支持按服务端分页查询，而不是只在前端展示分页 UI。
- 生成页右侧“查看全部”跳转到历史日志，并可带筛选条件。

### 验收标准

- 用户能从历史记录直接完成复用、修订、发布。
- 大量日志不会造成界面卡顿。
- 日报记录、同步日志、错误日志之间能关联追踪。

## P1：工作台快捷操作前置检查

### 当前问题

工作台快捷操作可以直接触发生成或同步，但可能绕过日报生成页已有的前置检查，导致用户收到失败消息后才知道缺少仓库、汇报人或飞书配置。

相关位置：

- `src/renderer/src/views/DashboardView.vue`
- `src/renderer/src/views/ReportGenerateView.vue`

### 调整建议

- 抽取统一的 readiness checks。
- 工作台、日报生成页、同步任务页共用同一套检查结果。
- 快捷操作不满足条件时，直接跳转到对应配置页面或打开修复面板。

### 验收标准

- 工作台快捷操作不会制造无意义失败。
- 用户能看到“缺什么、去哪补、补完后做什么”。

## P2：路由状态化

### 当前问题

应用当前使用 `activeNav` 切换组件，没有真实路由。刷新恢复、浏览历史、深链定位、从通知进入详情等能力都受限。

相关位置：

- `src/renderer/src/App.vue`
- `src/renderer/src/components/AppSidebar.vue`
- `src/renderer/src/components/AppTopbar.vue`

### 调整建议

- 使用 `vue-router` 建立路由表。
- 支持 `/dashboard`、`/generate`、`/sync?tab=calendar`、`/history?id=xxx`。
- 保存上次访问页面，应用重启后恢复。
- 导航组件改为基于路由状态高亮。

## P2：首次引导与欢迎页优化

### 当前问题

欢迎页每次启动都会显示，适合展示品牌感，但不利于长期使用效率。

相关位置：

- `src/renderer/src/App.vue`
- `src/renderer/src/components/WelcomeGate.vue`

### 调整建议

- 首次安装或配置缺失时展示 onboarding。
- 配置完整后不再默认展示欢迎页。
- onboarding 包含选择工作区、填写汇报人、配置 AI、配置飞书、测试提交。

## P2：系统设置分区

### 当前问题

系统设置页有 tabs，但页面内容没有根据 tab 分区展示，容易让用户以为有更多分区能力。

相关位置：

- `src/renderer/src/views/SystemSettingsView.vue`

### 调整建议

- “基础设置”：系统名称、版本、工作目录、默认工时。
- “集成配置”：AI、飞书、自动同步入口。
- “安全设置”：密钥保护、敏感字段状态、重新登录飞书。
- “日志管理”：日志数量、清理、导出、打开数据目录。

## P2：质量保障补强

### 当前状态

`package.json` 目前提供：

- `dev`
- `build`
- `typecheck`
- 打包相关脚本

### 调整建议

- 增加 `lint`，统一 Vue、TypeScript、样式规范。
- 增加核心单测：
  - 配置归一化。
  - 日报生成降级逻辑。
  - 飞书字段映射数据构造。
  - 自动同步跳过与失败状态。
- 增加基础 e2e 冒烟流：
  - 启动应用。
  - 添加仓库。
  - 生成日报。
  - 保存日报。
  - 历史日志查看。

## 推荐实施顺序

1. 补齐飞书配置向导，优先解决“新用户配不通”的问题。
2. 收敛同步任务语义，避免任务列表误导用户。
3. 增加配置 dirty 状态，统一保存体验。
4. 打通历史记录的恢复编辑、复制、导出、重新发布。
5. 抽取统一前置检查，让工作台快捷操作更稳。
6. 再推进路由、首次引导、系统设置分区和质量脚本。

## 阶段目标

### 第一阶段：配得通

- 飞书字段映射可视化。
- 自动同步启用前完整校验。
- 测试提交可解释失败原因。

### 第二阶段：用得顺

- 生成、保存、发布、历史复用闭环。
- 工作台快捷操作不绕过检查。
- 配置保存状态明确。

### 第三阶段：像产品

- 路由状态化。
- 首次引导只在需要时出现。
- 系统设置按域组织。
- 基础自动化质量保障齐全。
