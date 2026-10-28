# Runtime verification · 2026-10-28

- npm run test:coins: 13/13 passed (SQL.js real database persistence; Electron boundary mocked).
- npm run check: vue-tsc and production Electron/renderer build passed. Existing large chunk warning remains.
- Chrome E2E: 8/8 passed in 33.4s (6 existing workshop + 2 memory cards). Existing fixtures mock IPC; actual browser SVG download contents checked. Screenshots: output/playwright/work-memory-cards/.
- node tests/desktopRuntime.smoke.cjs: real Electron 45/preload/IPC passed. Isolated profile and hidden windows; card-paper purchased twice but charged once, persisted across restart and full backup restoration. No live profile or network used.
- Sandbox runs hit temporary cache permissions / browser teardown and Electron executable ACL failures; reruns outside sandbox passed without changing ACLs. Temporary Playwright config uses installed Chrome and workspace TEMP.
- git diff --check passed.

Not covered: installation packages, real user data, visible desktop SVG save dialog. SVG download exercised in Chrome, ownership and backup exercised through real Electron IPC.

## 视觉迭代（2026-10-28）

用户反馈原卡面缺乏购买吸引力。重画三款内嵌 SVG：纸笺的纸纹/山形藏印、蓝图的精密网格/立体构筑、星轨的渐变星体/虹彩轨道。强化活跃天数主排版、数据栏和底部纪念信息；统计口径继续保留。

商品区改为完整卡面缩略图，标明价格和永久解锁权益，选中卡面在独立背景中预览；无记录时展示零值卡面样式，仍禁止购买/导出。无新依赖、IPC 或存储变更。

本轮验证：test:coins 13/13、typecheck、build、diff check 通过；Chrome 卡片专项 2/2 通过（含真实下载内容核对）。查看三款独立 SVG 渲染及实际商品区截图，未发现文字裁切和图形缺失。示例合集 output/playwright/work-memory-cards-v2/collection.png；实际商品区 output/playwright/work-memory-cards/shop.png。前轮 Electron 持久化证据未重跑，交易逻辑未变。

## PNG 导出补齐（2026-10-28）

核对当前提交 9335970 已具备纪念卡主体。本轮仅增加原生 Canvas PNG 导出，与 SVG 共用数据、解锁检查和下载入口逻辑；异步生成期间禁止重复导出，失败恢复按钮并提示重试。

- `npm run test:coins`：13/13 通过；`npm run typecheck`、`npm run build`、`git diff --check` 通过。构建仍有既有大分块提示。
- Chrome 工坊及纪念卡回归：9/9，28.9 秒，退出码 0。核对 PNG 文件签名、2400 × 1640 尺寸、文件名、导出不扣币、未解锁禁用，以及 PNG 生成失败后重试成功。
- 初次沙箱执行 9 项断言通过但测试进程收尾未退出；沙箱外重跑正常完成。
- 浏览器测试模拟 IPC；本轮未重跑真实 Electron 重启、备份恢复或安装包验证，钱包和持久化代码未改动。未提交或发布。
