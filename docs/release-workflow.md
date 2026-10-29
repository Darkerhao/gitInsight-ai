# 发布与打包工作流

项目使用 `electron-vite` 构建应用代码，所有打包命令统一通过 `scripts/dist.mjs` 加载唯一的 `electron-builder.config.cjs`，生成统一的码迹AI 桌面安装包。

## 分支分工

日常开发在 `dev`，验证通过后合入 `main` 发布。

| 事件 | 检查 | 安装包 | 升版与发布 |
| --- | --- | --- | --- |
| 推送 `dev` | 不触发 | 不生成 | 不执行 |
| PR 目标为 `dev` 或 `main` | 同上 | 不生成 | 不执行 |
| 推送 `main` | 由发布流程统一执行 | 三平台统一安装包 | 自动执行 |
| 在 `main` 手动运行打包流程 | 同上 | 三平台统一安装包 | 不执行 |

`dev` 和其他分支的推送不触发这些流程；PR 按目标分支筛选，其他分支向 `dev/main` 提 PR 时仍会检查。手动打包选择非 `main` 分支或标签时，所有任务跳过。

## 推送 main 自动发布

把代码提交并推送到 `main`，即可触发 `.github/workflows/release.yml`：

1. 复用 `checks.yml` 执行业务测试、类型检查、构建与浏览器回归。
2. 检查通过后，由 `scripts/release-version.mjs` 根据上个版本以来的提交内容与代码规模选择 `major/minor/patch`，递增 `package.json`；同时更新 `package-lock.json` 的根版本和项目版本。
3. 自动提交 `chore(release): v<新版本>`，原子推送版本提交到 `main` 并创建对应标签。
4. `sync-dev` 从最新 `origin/dev` 开始，使用 `git cherry-pick -x` 同步这一个版本提交并推送到 `dev`；提交信息保留来源 SHA。
5. 与版本同步并行，三个打包任务使用同一个 main 版本提交，分别构建 Windows、macOS、Linux 安装包。
6. 全部打包任务成功后，创建 Release 草稿，上传安装包、blockmap 与更新清单；全部上传成功后公开 Release 并标记为最新版本，客户端才会发现该版本。

`main` 的检查统一由发布流程调用，避免重复执行；目标为 `dev/main` 的 PR 独立执行检查。

```bash
# 在 main 上提交代码后
git push origin main
```

不再需要手动修改版本、创建标签或运行 `release:tag`；推送标签不再触发发布。

### 自动版本规则

从高到低匹配，命中后只升级一次：

| 级别 | 条件 | 示例（当前为 `3.8.19`） |
| --- | --- | --- |
| 主版本 `major` | 提交头使用 `feat!:`、`refactor(api)!:` 等 `!` 标记，或正文有 `BREAKING CHANGE:` / `BREAKING-CHANGE:` | `4.0.0` |
| 次版本 `minor` | 有 `feat:` / `feat(模块):` 新功能，或有效代码新增与删除合计 ≥ 500 行，或涉及 ≥ 20 个有效代码文件 | `3.9.0` |
| 补丁 `patch` | 其余修复、小调整及维护变更 | `3.8.20` |

主版本表示明确的不兼容变更，不能仅凭代码量判定。规模阈值用于识别未写 `feat` 的较大迭代，是固定工程规则，不使用 AI 或远端服务猜测功能。次版本升级会清零补丁位，主版本升级会清零后两位。

分析优先使用当前 `package.json` 对应的稳定版本标签；该标签不存在时使用 HEAD 可达的最高稳定标签，无标签时分析全部历史。读取整个范围内每条提交的完整正文，支持多提交推送及 squash；通过 Git 稳定补丁标识排除已经发布的等价提交，避免 dev 预览和合入 main 后重复统计。已经撤回的功能再次引入时仍正常识别。未提交的工作区改动不参与判断。

代码量按基线到 HEAD 的净差异计算，不累加每次提交的重复修改。统计 `src/`、`electron/`、`scripts/`、`build/` 中的代码文件和根级 `electron.vite.config.ts`、`electron-builder.config.cjs`、`tsconfig.json`；排除测试、文档、锁文件、构建产物和二进制资源。纯重命名不计入代码量，重命名时实际修改的内容正常统计。文件数量只计算存在有效增删的代码文件。

建议提交信息明确区分 `feat`（新增能力）、`fix`（修复）和 `refactor`（内部调整）。CI 日志和运行摘要会显示分析基线、提交数、代码行数、文件数及升版原因。可在本地只读预览：

```bash
node scripts/release-version.mjs
```

预览不修改清单或创建 Git 提交、标签；真正的版本升级仍只在 main 发布流程中执行。

CI 写入 `main` 的版本提交后，会自动 cherry-pick 到 `dev`，只带入本次版本变更，不合并 main 的其他提交。开发前拉取即可：

```bash
git switch dev
git pull --ff-only origin dev
```

### 并发与失败处理

- 同一分支的发布串行执行，不取消正在构建的版本。连续快速推送时，GitHub 只保留一个等待中的最新运行；升版前发现 `main` 已前进的旧运行会跳过打包，由新提交对应的运行发布。
- 版本提交和标签使用原子推送：升版过程中如有人推送了新代码，或标签已存在，整个推送失败，不覆盖远端代码，也不留下半次推送。
- 测试失败不会升级版本。升版后打包失败会保留版本提交和标签，但不会创建正式 Release；在失败运行中选择 **Re-run failed jobs**，复用原版本继续打包/发布。
- `sync-dev` 与打包相互独立；同步失败会使工作流报告失败，但不会中断正常打包和发布。同步使用普通 push，dev 并发提交或分支保护会拒绝写入；没有强推或自动解决冲突。
- 同步任务重新获取最新 dev，已包含的版本改动通过 `--empty=drop` 跳过，不重复创建提交。并发推送失败后选择 **Re-run failed jobs**；遇到版本冲突，先在 dev 手动 cherry-pick 日志中的版本 SHA、解决冲突并推送，再重跑失败任务。
- **Re-run all jobs** 会重新检查源提交是否仍是 `main` 最新提交；已完成升版的旧运行会被跳过。需要补齐失败版本时使用 **Re-run failed jobs**。

### 仓库权限

流程使用仓库自带的 `GITHUB_TOKEN`，无需额外 PAT。只有升版、版本同步和发布 job 请求 `contents: write`。使用该 token 回写的提交和标签不会再次触发 push 工作流，因此不会循环升级或触发重复检查。[GitHub 官方说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)

仓库规则需要允许 GitHub Actions 向 `main` 和 `dev` 写入版本提交并创建 `v*` 标签。如果分支保护要求所有写入必须通过 PR，或组织策略禁止 Actions 写入，版本推送会失败；需要仓库管理员调整对应规则，流程不会强推或绕过保护。

## 手动与本地构建

GitHub Actions 页面选择 **Build desktop packages → Run workflow → main**，构建 `main` 当前版本，只上传 workflow artifacts，不升级版本、不创建 Release。其他分支或标签会跳过全部任务。

```bash
npm run typecheck
npm run build
npm run pack
npm run dist:win
npm run dist:mac
npm run dist:linux
```

本地安装包保存到 `release/<version>/`，文件名形如 `MajiAI-3.8.10-Windows-x64.exe`。`npm run dist` 构建当前系统，`dist:win/mac/linux` 指定目标平台；不再支持 `--edition` 或 `dist:*:lite/standard`。

- Windows：`nsis` 安装包、`portable`、`zip`
- macOS：`dmg`、`zip`
- Linux：`AppImage`、`deb`、`rpm`、`tar.gz`

每个成功的打包任务都会上传 artifacts，保留 30 天。

## 应用内更新

客户端使用 `electron-updater`，从 `Darkerhao/gitInsight-ai` 的正式 GitHub Release 检测更新，不接受预发布或降级。`electron-builder` 生成随应用分发的 `resources/app-update.yml`，无需在客户端手写 feed URL。

每个平台使用一个更新清单。保留原标准版的 `standard` 渠道名称，作为已有安装版的稳定更新标识；它不再代表可选发行版，不生成 Lite 安装包或渠道别名。

| 平台 | 更新清单 |
| --- | --- |
| Windows | `standard.yml` |
| macOS | `standard-mac.yml` |
| Linux | `standard-linux.yml` |

macOS 的同一清单由 builder 合并 x64/arm64 文件；所有清单均包含安装包的 SHA-512 校验信息。CI 先上传完整草稿再公开，避免更新清单先于安装包可用。

**设置 → 关于** 提供手动检查、下载进度、更新说明及重启安装。自动更新默认开启，启动 15 秒后检查，此后每 6 小时检查；下载完成后等待正常退出安装。关闭自动更新后停止后台检查与退出安装，已经开始的下载继续完成，可手动安装。开关即时保存到 `userData/updater-settings.json`，不保存或覆盖业务配置。

支持 Windows NSIS 安装版、Linux AppImage/deb/rpm。便携/解压运行方式不可原地安装，页面明确提示使用安装版。当前 macOS 配置为 `identity: null`，未满足官方自动更新签名要求，因此页面明确禁用更新；将来开启 macOS 更新前须完成签名配置及该平台运行验证。不会关闭签名或下载校验来绕过限制。[官方更新要求](https://www.electron.build/v26/docs/features/auto-update)

旧客户端没有更新入口，需要先安装一次包含该功能的新安装包。缺少更新清单的历史 Release 会显示可重试的错误；新流程发布完整版本后即可更新。检查和下载仍需能够访问 GitHub 的网络，但不需要用户打开网页手动下载。

## 旧版升级

- 旧标准版：保留安装身份 `com.shuzhi.gitinsight-ai` 和 `standard` 更新渠道；支持自动更新的安装方式沿用原流程。Windows 产品名改为“码迹AI”，安装程序通过原 GUID 识别并替换旧安装。
- 旧 Lite：Windows 安装身份是 `com.shuzhi.gitinsight-ai.lite`，与统一版不同，但两者默认安装目录可能相同。因此先在系统设置导出备份，完全退出应用，卸载旧 Lite 并保留应用数据，再安装统一版；不要先覆盖安装再卸载 Lite。必要时导入备份，重新配置密钥并登录飞书（备份不包含凭据，恢复后自动同步默认关闭）。其他平台使用系统正常卸载/替换应用流程，并保留数据。
- 包名始终为 `gitinsight-ai`，打包后的 package.json 不注入 productName；Electron 默认 userData 路径仍基于该包名。应用不搬迁或删除旧数据库、配置、密钥或会话。卸载时不要勾选清除数据，也不要使用清理工具删除应用数据目录。
- 本次仅保留一套安装包。旧 Lite 渠道不再发布新清单，需要上述一次手动迁移；迁移后使用统一更新流程。Windows 便携/解压版和未签名 macOS 仍需手动安装更新。

依据：[Electron app.getName/getPath](https://www.electronjs.org/docs/latest/api/app#appgetname)、[NSIS 安装身份](https://www.electron.build/nsis.html#guid-vs-application-name)。实际实现核对 app-builder-lib 26.15.3 与 electron-updater 6.8.9 源码。各平台最终升级安装效果以真实安装验证为准。

## Windows 代码签名

在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中添加：

- `WIN_CSC_LINK`：Windows 代码签名证书。可以是 base64 编码后的 `.p12/.pfx` 内容，也可以是可下载的私有 HTTPS 地址。
- `WIN_CSC_KEY_PASSWORD`：证书密码。

配置后，Windows 打包 job 会自动把签名信息传给 `electron-builder`。没有配置这两个 secrets 时，Windows 包仍会生成，但不会签名。

Windows 全新安装的默认目录名为英文 `MajiAI`，由 `build/installer.nsh` 设置；应用和快捷方式显示名为“码迹AI”；覆盖升级沿用注册表中的已有安装目录，用户仍可手动选择目录。安装包下载文件名继续使用 `MajiAI`，以保持跨平台发布文件名和更新链接稳定。
