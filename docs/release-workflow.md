# 发布与打包工作流

项目使用 `electron-vite` 构建应用代码，所有打包命令统一通过 `scripts/dist-edition.mjs` 加载唯一的 `electron-builder.config.cjs`，生成 Lite、Standard 两个发行版的桌面安装包。

## 推送 main 自动发布

把代码提交并推送到 `main`，即可触发 `.github/workflows/release.yml`：

1. 复用 `checks.yml` 执行业务测试、类型检查、构建与浏览器回归。
2. 检查通过后自动递增 `package.json` 的补丁版本，例如 `3.8.6 → 3.8.7`；同时更新 `package-lock.json` 的根版本和项目版本。
3. 自动提交 `chore(release): v3.8.7`，原子推送版本提交到 `main` 并创建 `v3.8.7` 标签。
4. 六个打包任务使用同一个版本提交，构建三平台的 Lite、Standard 安装包。
5. 全部打包任务成功后，统一创建 GitHub Release、生成发布说明并上传安装包。

`main` 的检查统一由发布流程调用，避免重复执行；PR 与 `master` 推送仍独立执行检查。

```bash
# 在 main 上提交代码后
git push origin main
```

不再需要手动修改补丁版本、创建标签或运行 `release:tag`；推送标签不再触发发布。需要调整主版本或次版本时，可先在代码中同步修改两个清单，自动流程仍会在该版本上递增一次 patch。

CI 会向 `main` 写入版本提交，下一次修改或合并前先同步：

```bash
git pull --rebase origin main
```

### 并发与失败处理

- 同一分支的发布串行执行，不取消正在构建的版本。连续快速推送时，GitHub 只保留一个等待中的最新运行；升版前发现 `main` 已前进的旧运行会跳过打包，由新提交对应的运行发布。
- 版本提交和标签使用原子推送：升版过程中如有人推送了新代码，或标签已存在，整个推送失败，不覆盖远端代码，也不留下半次推送。
- 测试失败不会升级版本。升版后打包失败会保留版本提交和标签，但不会创建正式 Release；在失败运行中选择 **Re-run failed jobs**，复用原版本继续打包/发布。
- **Re-run all jobs** 会重新检查源提交是否仍是 `main` 最新提交；已完成升版的旧运行会被跳过。需要补齐失败版本时使用 **Re-run failed jobs**。

### 仓库权限

流程使用仓库自带的 `GITHUB_TOKEN`，无需额外 PAT。只有升版和发布 job 请求 `contents: write`。使用该 token 回写的提交和标签不会再次触发 push 工作流，因此不会循环升级。[GitHub 官方说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)

仓库规则需要允许 GitHub Actions 向 `main` 写入版本提交并创建 `v*` 标签。如果分支保护要求所有写入必须通过 PR，或组织策略禁止 Actions 写入，版本推送会失败；需要仓库管理员调整对应规则，流程不会强推或绕过保护。

## 手动与本地构建

GitHub Actions 页面选择 **Build desktop packages → Run workflow**，可以构建所选分支/标签当前版本，只上传 workflow artifacts，不升级版本、不创建 Release。

```bash
npm run typecheck
npm run build
npm run pack
npm run dist:win:lite
npm run dist:win:standard
npm run dist:mac:lite
npm run dist:mac:standard
npm run dist:linux:lite
npm run dist:linux:standard
```

本地安装包保存到 `release/<version>/<lite|standard>/`。`npm run dist` 和未指定发行版的 `dist:win/mac/linux` 默认构建 Lite。

- Windows：`nsis` 安装包、`portable`、`zip`
- macOS：`dmg`、`zip`
- Linux：`AppImage`、`deb`、`rpm`、`tar.gz`

每个成功的打包任务都会上传 artifacts，保留 30 天。本流程负责版本升级与安装包发布；当前客户端没有接入自动下载、安装新版本的更新流程。

## Windows 代码签名

在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中添加：

- `WIN_CSC_LINK`：Windows 代码签名证书。可以是 base64 编码后的 `.p12/.pfx` 内容，也可以是可下载的私有 HTTPS 地址。
- `WIN_CSC_KEY_PASSWORD`：证书密码。

配置后，Windows 打包 job 会自动把签名信息传给 `electron-builder`。没有配置这两个 secrets 时，Windows 包仍会生成，但不会签名。
