# 关于与更新运行验证（2026-10-09）

## 测试场景

- `node --test tests/appUpdate.test.mjs`：13/13 通过。覆盖支持的安装方式、自动偏好读写失败、并发去重、检查/下载错误重试、安装前置条件及退出时使用最新开关。
- `npm test`：全量通过，包含 70 项原有可靠性回归、13 项更新回归和原有 7 项发布契约；随后新增的真实 builder 清单生成/哈希/双架构测试单独通过。
- `npm run check`：类型检查、main/preload/renderer 构建通过。仅既有 VueUse PURE 注释警告。
- Playwright 全量 27 项通过；新增乱序响应回归及最后的显示文案调整后，关于页专项 9/9 再通过。浅/深色、900/1366px 无横向溢出，截图已目视检查。
- 本机缺少 Playwright headless-shell；使用已安装的同版本完整 Chromium，通过临时 `.cache/playwright-updates.config.ts` 指定 channel=chromium，不修改 CI 的标准浏览器配置。
- `node tests/appUpdateRuntime.smoke.cjs`：真实 Electron 37.10.3 + electron-updater 6.8.9、本地 HTTP 清单和文件下载通过。五场景为手动重启、手动下载后开启退出安装、自动下载后关闭退出安装、备份恢复使用的 `app.exit(0)` 遵循关闭偏好、SHA-512 不匹配阻止安装。验证真实 preload、主窗口调用限制、链接白名单、关于页面挂载；安装调用被拦截，没有安装软件或重启用户应用。
- `node tests/desktopRuntime.smoke.cjs`：原有隔离 Electron 启动、单实例、加密配置、数据库持久化及备份恢复重启通过。
- Windows NSIS 本地打包通过。默认下载 Electron 发生 ECONNRESET，改用已安装的同版本 Electron：`npx electron-builder --config electron-builder.config.cjs --win nsis --publish never --config.electronDist=D:/MyWork/project/SHUZHI/gitInsight-ai/node_modules/electron/dist`。产物含 lite.yml、blockmap、正确 SHA-512 和 app-update.yml；asar 内确有 electron-updater。
- `actionlint 1.7.12` 检查两个 workflow 通过；`git diff --check` 通过。
- 独立审查的退出路径 P2 已真实复现（修复前 exit-disabled 安装次数 1，预期 0）。提前注册 `quit` 监听修复后，五场景全部通过；更新及启动生命周期专项 18/18 通过，重新构建通过。取消 `before-quit` 不再停止更新调度。

## 原工作区最终验收

- 25 个源码/测试/说明文件与审查后的 worktree 按内容比对一致；依赖锁文件哈希一致。
- `npm test`：165 项 node:test 全部通过，最终发布契约为 8/8；日志 `.cache/about-updates-tests.log`。
- `npm run check`：类型检查及构建通过；日志 `.cache/about-updates-check.log`。
- 原工作区全量 Playwright：28/28 通过；日志 `.cache/about-updates-browser-recheck.log`。首轮有一次导航前浏览器被关闭，未修改代码直接复跑后全部通过。
- 原工作区真实 updater 五场景及原有 desktop smoke 再次通过；日志 `.cache/about-updates-runtime.log`。
- 最终构建后重新生成 Windows NSIS 轻量版安装包：`release/3.8.8/lite/MajiAI-Lite-3.8.8-Windows-x64.exe`（约 114 MiB）。SHA-512、blockmap、lite feed、打包依赖均核对通过；asar 的 main 与 renderer 入口和最终 out/ 文件逐字节一致。日志 `.cache/about-updates-package.log`。
- 只读 GitHub latest 入口当前返回 v3.8.8；本轮没有发布远端版本。
- 临时 worktree 的删除被自动审批策略拒绝（blocked by policy）。未绕过策略，保留 `.cache/worktrees/about-updates`；源码与安装包均已完整交付至原工作区。

## 验证边界

- 本轮未提交、推送或发布 GitHub Release，未运行用户机器上的真实升级安装。
- 网络更新使用真实 updater 和本地测试服务器；GitHub 的实际发布、下载及跨平台安装需发布后观察。
- Windows 安装版有本机打包与运行证据；Linux 的安装方式分支、三个平台两个发行版的 builder 清单生成有自动测试，macOS/Linux 未在对应系统实装。当前 macOS 未签名包明确不支持自动更新。
- 所有运行数据和下载缓存隔离在临时目录，界面截图位于 `output/playwright/about-updates/`。
