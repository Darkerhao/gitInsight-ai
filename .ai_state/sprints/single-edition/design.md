# 单一发行版

2026-10-13；Refactor；工作区 `.cache/worktrees/single-edition`，基于 dev 并包含本轮已完成的 dev/main CI 调整。用户确认统一为“码迹 AI”。

## 方案与范围

只保留一个应用：productName 为 `码迹 AI`，package.name 仍为 `gitinsight-ai`，appId 仍为原标准版 `com.shuzhi.gitinsight-ai`。固定保留 `standard` 更新渠道这一已有机器标识，不再有发行版选择、双份安装包或渠道别名脚本。移除 edition 类型、构建注入、元数据、界面标签、旧命令与脚本分支。三个平台各一个打包任务；dev 检查、main 正式发布的规则保留。

旧标准版通过原渠道更新。旧 Lite 的 NSIS GUID 不同且默认安装目录相同，必须备份、退出、卸载 Lite（保留数据）、再安装统一版，必要时走现有备份恢复；不将标准安装包推给 Lite 自动安装。保持 package.name，现有 userData、SQLite、secrets 与登录会话路径不改变。不新增运行时数据搬迁。

## 验收标准

- [x] AC1：仅三个 CI 打包任务，名称与安装包不含 Lite/Standard，输出为 release/<version>/；main/dev 触发规则保留。
- [x] AC2：旧 edition 命令、分支、类型、注入和界面标签被清理；名称统一为码迹 AI。
- [x] AC3：标准安装身份、package.name、更新渠道保持；生成的更新清单引用统一安装包，包含正确 SHA-512 与 macOS 双架构。
- [x] AC4：发布回归、类型检查/构建、关于页 E2E、Electron HTTP 更新冒烟通过；实际 Windows 安装包构建并检查资源与清单。
- [x] AC5：README、发布说明与架构同步，明确旧 Lite 卸载后安装流程及真实 GitHub/跨平台安装的验证边界。

## 验证范围

在隔离目录中运行现有 releaseArtifacts、appUpdate、desktopRuntime、appUpdateRuntime、Playwright about 测试。安装包仅构建与检查，不安装到用户机器，不触碰真实数据，不推送或发布。先执行专项检查，出现失败定位后最多三轮针对性修复，不重复已通过且无后续改动的验证。

## 证据依据

app-builder-lib 26.15.3：platformPackager 合并 extraMetadata、fileTransformer 转换 package.json；NsisTarget 由 appId 计算 GUID，targetUtil 对中文产品名回退 package.name 作为安装目录。旧 Lite 3.8.8 的真实 app.asar 无 productName，仅 name=gitinsight-ai。electron-updater 6.8.9 GitHubProvider 按固定 channel 读取更新清单。只保留现有 standard 渠道避免新增兼容别名与客户端迁移状态。


## 追加范围：版本提交自动同步（2026-10-13）

用户要求 main 生成版本提交后，将这一个提交 cherry-pick 到 dev。选择独立 sync-dev job，依赖 prepare 输出的准确版本 SHA 和非空 tag，手动打包或旧源跳过。同步与打包并行，普通 push 拒绝并发覆盖；冲突中止并清理 cherry-pick；重复运行通过 --empty=drop 跳过冗余提交。GITHUB_TOKEN 推送不触发 dev 检查。

- [x] AC6：只把版本提交带入最新 dev，保留 dev 独有开发提交，不携带 main 独有代码；保留来源 SHA；重跑不重复提交；冲突、并发和分支保护拒绝时不覆盖 dev；main/tag 和打包来源不改变。

验证仅运行 workflow shell 的临时 bare Git 仓库回归和 actionlint，不执行远端 cherry-pick 或发布；原应用代码与构建产物未变化。
