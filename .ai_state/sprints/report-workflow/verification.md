# 实现与验证

- `npm test` 最终全量 104/104 通过，另含 2 个既有页面 smoke；其中批量与共享操作 22 项、可靠性 30 项（含窗口边界 3 项）。
- `npm run check` 类型检查与构建通过。已有 Element Plus pure annotation 提示不影响构建。
- `npm run test:e2e -- --config .cache/playwright.local.config.ts --workers=2`：14/14 通过。
- 浏览器测试启动真实 Vue 应用，仅 mock Electron IPC 边界；覆盖单日/批量页生成失败重试、编辑发布前保存与保存失败拦截、部分成功后重试、100%/125%/150% 等效可用空间、欢迎配置状态与奖励未触发时无渲染模块请求。
- 最新 Chromium 下载因外部 CDN 超时未完成；本地临时配置使用既有 Chromium 1228，CI 使用 `playwright install --with-deps chromium` 安装锁定包对应版本。临时配置位于忽略的 `.cache`。
- 等效 viewport：1366×700、1092×560、910×466（预留任务栏及窗口边框）；单日/批量编辑、按钮点击、发布结果滚动访问通过。截图位于 `output/playwright/report-workflow/`。
- 窗口测试执行真实 windows.ts 构造逻辑，模拟 1366×728、910×485 和负坐标副屏工作区，窗口与最小尺寸均在 workArea 内。
- 构建确认 RewardEffectOverlay 独立 JS/CSS chunk；未测实际启动耗时，不声称启动更快。
- 未使用真实 AI/飞书账户或生产数据；未在真实 1366×768 设备上修改系统缩放。

## 结构清理

旧聚合 generate/generateAndPush/saveCurrentReport/push 已移除；HistoryLogsView 重新发布改用共享项目操作。孤立 ReportPreviewCard、useGlassReflection 及对应动画样式移除。weeklyReportActions 独立实现移除，保留唯一 projectReportActions。

## 官方文档依据

- https://vuejs.org/guide/components/async.html （按需组件；核对本地 runtime-core defineAsyncComponent）
- https://playwright.dev/docs/test-webserver 和 https://playwright.dev/docs/test-configuration （核对安装包 runner/webServer）
- https://www.electronjs.org/docs/latest/api/screen （workArea 为设备无关坐标，包含系统工作区限制）

## 最终复核

- 主线程核对实际调用方、共享 action 与历史单条重发，检查发布部分失败/生成失败保留/警告传播和已发布项过滤。
- `npm run check`、最终 `npm test`、最终 14 项 E2E、`git diff --check` 通过。
- 旧模块入口、鼠标跟踪和 GSAP 分块配置无残余调用。新增一个开发依赖 @playwright/test，删除无消费者的 GSAP 运行时依赖。
- 专用审查模型不可用/限流后，独立 final_review agent 完成代码与规格复核；发现的 P2 配置保存失败无反馈已修复，新增回归通过。最终无未解决 P1/P2，规格对照 PASS。
- 自动审批拒绝测试临时产物递归删除；保留并忽略产物，已有版本管理截图保持原状。

- 最终配置保存失败回归纳入 14 项 E2E 合跑，14/14 通过；修复后的 typecheck/build 再次通过。构建入口静态 import 不含奖励 Overlay，动态 import 存在。

- final_evaluation 独立核对最终日志与设计、审查记录，Evidence Cross-Check 一致，VERDICT PASS。
