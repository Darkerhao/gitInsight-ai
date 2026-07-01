# 项目问题复查报告（2026-07-01）

## 结论摘要

本轮复查覆盖 Electron 主进程、Vue 渲染层、关键页面交互、自动同步链路、历史日志链路、构建产物和浏览器抽检。整体类型检查与生产构建通过，但仍存在若干产品化风险，优先级最高的是敏感配置在 `safeStorage` 不可用时可能保存后丢失，以及“简洁版日报”编辑内容不会被保存到历史记录。

已确认上一轮部分问题已经闭环：欢迎页 localStorage key 已统一为 `gitinsight:welcome-finished`；日报时间段已写入 `daily_reports.start_datetime/end_datetime/time_range_label` 并支持历史回填；自动同步也已支持“昨日固定时间至执行时刻”的窗口。

## 验证记录

- `npm run typecheck`：通过。
- `npm run build`：通过；产物提示 renderer JS 约 `4,201.82 kB`，并出现第三方 `@vueuse/core` PURE 注释告警。
- `git diff --check`：通过。
- Playwright 浏览器抽检：通过 mock `window.api` 打开构建后的 `out/renderer`，首屏和日报生成页可渲染；控制台有 1 个 GSAP selector warning 和 1 个 `favicon.ico` 404。
- codebase-memory：当前图谱仅列出其他项目，本仓库索引命令未成功接收 `repo_path` 参数；本轮主要基于源码阅读、`rg` 检索、构建和浏览器抽检判断。

## 问题清单

### P0 敏感配置在加密不可用时可能保存后丢失

位置：`electron/main.ts:164`、`electron/main.ts:283`、`src/renderer/src/views/SystemSettingsView.vue:178`

现象：`saveSensitiveConfig()` 在 `safeStorage.isEncryptionAvailable()` 为 false 时直接 return；随后 `saveConfig()` 仍会把 `stripSensitiveConfig()` 后的普通配置写入 `config.json`，其中 `aiApiKey`、`cookie`、`csrfToken` 都被清空。界面只显示“密钥保护不可用”，没有阻断保存或提供明文降级确认。

影响：在不支持 Electron `safeStorage` 的系统环境中，用户可能以为保存成功，实际重启后 AI Key 和飞书登录态丢失，导致 AI 生成、字段解析、自动同步全部失效。

建议：保存前若加密不可用且存在敏感字段，应阻断并提示；或提供二次确认的明文降级方案，并在配置结构中明确标记降级状态。

### P1 简洁版日报编辑内容不会被保存

位置：`src/renderer/src/views/ReportGenerateView.vue:68`、`src/renderer/src/views/ReportGenerateView.vue:595`、`src/renderer/src/composables/useAssistant.ts:858`

现象：生成页默认编辑的是 `conciseReportDraft`，复制、导出、发布使用 `activeReportContent`；但“保存修改”直接调用 `saveCurrentReport()`，实际保存的是 `report.value` 完整版内容。

影响：用户在简洁版文本框里修改后点击“保存修改”，历史记录不会保存这些修改，后续继续编辑或归档会出现内容不一致。

建议：把 `saveCurrentReport(content?: string)` 改为可接收当前模式内容；或在保存前同步 `conciseReportDraft` 到一个独立字段，并在历史记录中标识保存版本。

### P1 简洁版日报存在状态残留风险

位置：`src/renderer/src/views/ReportGenerateView.vue:43`、`src/renderer/src/views/ReportGenerateView.vue:189`、`src/renderer/src/views/HistoryLogsView.vue:175`

现象：只要用户编辑过简洁版，`conciseDirty` 就会阻止后续 `report` 变化自动重建 `conciseReportDraft`。从历史日志“继续编辑”加载另一份日报时，只设置 `report.value = record.report`，没有重置 `conciseDirty`。

影响：页面可能加载了新的完整日报，但简洁版文本框仍显示上一次手改的旧内容；若直接发布简洁版，会发布错内容。

建议：加载历史记录、重新生成、清空报告时统一重置 `conciseDirty` 和 `conciseReportDraft`；更稳妥的是把简洁版草稿纳入助手状态，并随当前报告 ID 绑定。

### P1 手动“立即执行一次”会被当天去重逻辑跳过

位置：`electron/main.ts:1781`、`electron/main.ts:1797`、`src/renderer/src/components/panels/AutoSyncCard.vue:51`

现象：`runAutoSync('manual')` 和定时任务共用 `lastSuccessKey === runKey` 的去重逻辑。当天相同配置成功同步后，用户再点“立即执行一次”也会返回“今日相同配置已成功同步，本次跳过”。

影响：用户无法通过手动按钮进行补发、重试验证或重新同步当前内容，按钮语义和实际行为不一致。

建议：去重仅作用于 `scheduled`；手动触发增加 `force` 语义，或弹窗提示“今日已同步，是否强制再次执行”。

### P2 历史日志“查询”按钮反馈弱

位置：`src/renderer/src/views/HistoryLogsView.vue:140`、`src/renderer/src/views/HistoryLogsView.vue:249`、`src/renderer/src/views/HistoryLogsView.vue:255`

现象：“查询”只调用 `focusFirstLog()` 设置 `selectedLog`，但不打开右侧详情；只有点击表格行时才设置 `detailVisible = true`。

影响：用户点击“查询”后视觉上可能没有明显变化，容易误以为查询无效。

建议：查询命中时同步打开详情面板；或把按钮改为“定位首条”，并增加高亮/滚动反馈。

### P2 小屏首屏被完整侧边栏占用

位置：`src/renderer/src/style.css:2998`、`src/renderer/src/style.css:3019`

现象：`max-width: 920px` 时 `.app-layout` 变为单列，`.sidebar` 改为静态块，完整导航和提示卡先于主内容渲染。390px 宽度抽检时，首屏几乎都被导航占据。

影响：移动端或窄窗口下进入业务页面成本高，日报生成、历史日志等核心内容需要向下滚动后才能看到。

建议：小屏改为顶部抽屉、底部导航或折叠侧边栏；隐藏/折叠 `sidebar-tip`，保留当前页面标题和主操作入口。

### P2 “查看详细教程”没有闭环

位置：`src/renderer/src/components/aside/UsageGuide.vue:26`

现象：日报配置页右侧的“查看详细教程”只弹出 `ElMessage.info`，不跳转帮助页，也不展开具体教程内容。

影响：入口看起来是强动作按钮，但实际没有信息增量。

建议：组件向外 emit `navigate('help')`，或内联打开详细教程抽屉；若只提示，应改成普通文本提示而非按钮。

### P2 欢迎动画存在残留 GSAP 选择器

位置：`src/renderer/src/components/WelcomeGate.vue:403`、`src/renderer/src/components/WelcomeGate.vue:1310`

现象：浏览器抽检控制台提示 `GSAP target .donut-progress not found`。源码中 timeline 设置了 `.donut-progress`，但模板里没有对应元素。

影响：不影响主流程，但会污染控制台，降低动画维护可信度。

建议：删除残留动画设置和对应 CSS，或补回真实 donut SVG 元素。

### P3 缺少 favicon

位置：`src/renderer/index.html`

现象：浏览器抽检出现 `favicon.ico` 404，HTML 未声明 favicon。

影响：桌面浏览器预览和部分壳环境会产生无意义 404。

建议：复用 `src/renderer/src/assets/logo.png` 或 build icon，补充 `<link rel="icon" ...>`。

### P3 设置页“重置基础配置”文案不够精确

位置：`src/renderer/src/views/SystemSettingsView.vue:79`、`src/renderer/src/views/SystemSettingsView.vue:211`

现象：按钮文案为“重置基础配置”，实际只重置自动同步时间窗口、默认工时和项目工时。

影响：用户可能误以为工作目录、AI、飞书字段等基础配置也会重置。

建议：按钮改为“重置同步默认值”，或实现完整配置重置并做更强确认。

### P3 Renderer 构建体积偏大

位置：`electron.vite.config.ts:38`

现象：生产构建中 renderer 单个 JS 产物约 `4.2 MB`，当前未配置 `manualChunks`。

影响：首次渲染和更新包体积会偏大，尤其是 `echarts`、`element-plus`、`lucide`、`gsap` 同包时更明显。

建议：按依赖拆分 vendor chunk，例如 `element-plus`、`echarts`、`animation`、`icons`；同时确认 Electron 加载性能是否已满足目标机器。

## 建议修复顺序

1. 先修 P0 敏感配置保存降级，避免配置数据丢失。
2. 再修简洁版日报保存/状态残留，避免发布或历史记录内容错乱。
3. 调整手动自动同步去重逻辑，让“立即执行一次”符合用户预期。
4. 收敛体验问题：历史查询反馈、移动端导航、教程入口。
5. 清理低风险维护项：GSAP 残留选择器、favicon、重置文案、构建分包。
