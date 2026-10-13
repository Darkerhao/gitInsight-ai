# 单一发行版运行验证

环境：Windows，Electron 37.10.3，electron-builder/app-builder-lib 26.15.3，electron-updater 6.8.9；隔离 worktree，依赖复用主工作区。

## 完成条件与停止条件

发布契约、npm test、类型检查/构建、关于页 E2E、真实 Electron 更新与桌面回归通过；Windows NSIS 构建并检查包内元数据及更新清单。最多三轮针对性修复；不接触真实用户数据，不运行安装程序，不向 GitHub 推送或发布。

## 测试场景

- PASS：`node --test tests/releaseArtifacts.test.cjs`，9/9，覆盖单一产品身份、三个矩阵、更新清单哈希/macOS 双架构、版本原子推送、旧提交/冲突拒绝、手动构建。
- PASS：`npm test` 完整退出 0；所有配置的业务、持久化、备份恢复、更新和发布测试通过。
- PASS：`npm run check` 类型检查和 Electron build 退出 0。Rollup 输出第三方 PURE 注释位置警告，不影响构建。
- PASS：`npx playwright test tests/e2e/about.spec.ts --workers=2`，9/9，统一名称与无 edition 标签、更新交互、900/1366 宽度、明暗主题；已查看 1366 亮色截图。
- PASS：`node tests/desktopRuntime.smoke.cjs`，真实 Electron/preload/renderer、数据库与密钥持久化、备份恢复和单实例；数据隔离，窗口隐藏。
- PASS：`node tests/appUpdateRuntime.smoke.cjs`，manual/automatic/disabled/exit-disabled/checksum 五场景；真实 HTTP、SHA-512、IPC，标准渠道指向统一包名，安装执行被拦截。
- PASS：actionlint 两个 workflow，`git diff --check`。
- PASS：`npm run dist -- --win nsis --publish never --config.electronDist=D:/MyWork/project/SHUZHI/gitInsight-ai/node_modules/electron/dist`；安装包 119173156 bytes，包内 name=gitinsight-ai，无 productName/appEdition/appEditionLabel；exe 为码迹 AI.exe；app-update.yml 渠道 standard，缓存名 gitinsight-ai-updater；standard.yml 指向 MajiAI-3.8.10-Windows-x64.exe，实际 SHA-512 与清单一致，blockmap 存在。

## 自测自改记录

先增加单一产品回归，旧实现触发 3 个预期失败（旧命令、旧名称、6 个矩阵）；实现后 9/9 通过。两个 edition 的运行时分支和定义完全删除，不新增迁移状态或渠道别名。旧 Lite 的安装 GUID 与默认目录冲突风险通过真实 builder 源码确认，文档要求先卸载再安装。

## Reflect

旧 Lite 3.8.8 真实 app.asar 元数据 name=gitinsight-ai，无 productName。Electron v37.10.3 官方 init.ts 依据 packageJson.productName/name 设置 app.name；默认 userData=appData/app.name。新版本保留包名，不改 profile 路径。

真实 GitHub 发布、旧版本覆盖安装、macOS/Linux 安装与签名未执行，不以本地测试替代这些证据。

## VERDICT

PASS：本地运行回归和 Windows 包内检查完成；未执行真实安装或 GitHub 发布。

包内检查最初使用正斜杠调用 Windows asar.extractFile 未找到路径；改用 node:path.join 后通过。归档本身包含正确入口，未改生产代码。


## 增量：main 版本提交自动同步 dev

- `node --test tests/releaseArtifacts.test.cjs`：13/13 PASS，48633 ms。运行 workflow 内真实 Bash 步骤，全部操作在临时 bare Git 仓库。
- 新增四项：版本提交定点 cherry-pick + 重试幂等；版本冲突 abort 后工作树干净、远端不变；pre-push 中推进 dev 模拟并发写入并确认拒绝覆盖；dev 保护拒绝时保留 main/tag。
- 正常场景 dev/main 各有独有代码，确认 dev 父提交保留且仅变更 package.json/package-lock.json，main 独有代码未进入 dev，提交信息记录来源 SHA。
- actionlint 两个工作流与 diff check PASS。应用源码和打包内容未改，未重复前一节已通过的 UI/build/安装包验证。
- 真实 GitHub token 权限、保护规则与远程同步尚未运行。增量本地验证 VERDICT: PASS。
