# 码币工坊运行验证

## 完成条件与停止条件

实际运行专项测试、类型检查、构建、相关浏览器回归和隔离 Electron 真实 preload/IPC/重启/备份恢复；全部通过并完成独立代码与规格审查后交付。实现范围只覆盖本轮设计；所有测试使用临时 profile 或 mock IPC，不变更真实账本。失败按根因修正并复跑，未知结果不能记为通过。

## 测试场景

- 正常：购买装扮、装备全局配色/花盆、购买种子、真实日报日期成长、成熟收藏、收支统计和分页。
- 边界：余额不足、重复购买、并发钱包写入、三个种植位、同日多日报、未来/空日报。
- 失败：持久化失败、页面读取和写入错误、重试。
- 持久化：隔离真实 Electron IPC、重新启动、完整备份恢复和再次启动；旧备份缺少新表仍能加载。

## 自测自改记录

- `node --test tests/persistencePublication.test.mjs tests/backupRestore.test.mjs`：15/15 通过。
- `npm run test:coins`：初次 8 项因未实现失败，实现后 8/8 通过；补充换行/Tab 空正文后先复现 `3 !== 0`，修正 SQL 空白判断后 9/9 通过。
- 隔离工作区 `npm test`：219 tests，210 pass，0 fail，9 skipped。跳过项是既有发布 Git 操作测试，非本轮工坊测试。
- 隔离工作区 `npm run check`：类型检查和生产构建通过；工坊独立懒加载 chunk，未新增依赖。
- `node tests/desktopRuntime.smoke.cjs`：初次被沙箱 Windows ACL 拒绝访问 Electron 目录，未运行断言；随后使用批准的本地执行重跑通过。使用隐藏窗口、禁网、临时 profile，通过真实 preload/IPC 验证 20000000 测试币购买主题/花盆/植物后余额 18300000，重启保留；导出后再消费/换装，恢复和再次重启回到原余额、资产、装备、花园与四笔流水。保留原有素材、凭据和单实例断言。
- 已目视检查 1366px 最终商店浅色和花园深色截图，布局无横向溢出；最终截图已移除操作提示并复核植物与生长位展示。

- 浏览器专项 `coin-workshop.spec.ts`：6/6 通过，最终截图用例复跑 1/1 通过；当前匹配 Chromium 可用，未额外安装浏览器。
- 全量浏览器 `npx playwright test --config=.cache/coin-playwright.config.ts --workers=2`：67 passed (2.2m)。临时配置仅关闭自动 webServer，复用既有隔离 Vite；临时缓存位于工作区 `.cache`，真实 renderer 配合 mock IPC 验证交互。包含种植/收藏、主题切换、消费失败、余额不足、明细筛选分页以及原日报/导航/仓库回归。
- 最终源码 23 个文件按实际 git diff/新增文件清单同步至当前 codex/coin-workshop，逐文件 SHA-256 相同；保留原未跟踪 .claude/settings.local.json。
- 当前分支最终 `npm test`：220 tests，211 pass，0 fail，9 skipped（既有发布 Git 测试）；新工坊专项 9/9。
- 当前分支最终 `npm run check`：类型检查及生产构建通过；原有大 chunk 提示保留，没有构建失败。
- 当前分支最终 `node tests/desktopRuntime.smoke.cjs`：通过，真实 Electron 45.0.0 隔离验证重启、购买与装备、植物和账本、备份恢复及再次重启。输出：`coin purchases/equipment/garden/ledger persisted across restart and backup restoration`。
- 截图：`output/playwright/coin-workshop/shop-light.png`、`shop-dark.png`、`garden-dark.png`、`garden-detail-dark.png`。最终版本展示幼芽、成长和成熟阶段，无图片或新增依赖。

独立代码审查与规格审查均 PASS，未发现可操作的 P1/P2/P3 或 MISSING / EXTRA / DEVIATED；完整结果见 `reviews/pass1.md`。审查者另独立运行工坊专项 9/9 通过。独立 evaluator 核对四份原始日志与 23 个同步文件后，Evidence Cross-Check / VERDICT 均 PASS；收敛检查与架构记录已完成，见 `polish.md`。

## Reflect

核心账本、资产、真实持久化和最终集成都已验证；不使用真实用户数据。浏览器验证覆盖真实页面配合 mock IPC，Electron 验证覆盖真实 preload/IPC/SQLite/重启恢复。未验证真实安装包、跨平台安装或线上发布。

## VERDICT

PASS（运行验证）。代码/规格独立审查另记 reviews/passN.md。
