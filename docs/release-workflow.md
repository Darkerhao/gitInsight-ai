# 发布与打包工作流

项目使用 `electron-vite` 构建应用代码，使用 `electron-builder` 生成桌面安装包。

## 本地命令

```bash
npm run typecheck
npm run build
npm run pack
npm run dist
npm run dist:win
npm run dist:mac
npm run dist:linux
```

`release/<version>/` 会保存打包产物。

## GitHub Actions

工作流文件：`.github/workflows/release.yml`

触发方式：

- 手动触发：GitHub Actions 页面选择 `Build desktop packages` 后点击 `Run workflow`
- 发布触发：推送 `v*` tag，例如 `v1.0.0`

产物：

- Windows：`nsis` 安装包、`portable`、`zip`
- macOS：`dmg`、`zip`
- Linux：`AppImage`、`deb`、`rpm`、`tar.gz`

每次运行都会上传 workflow artifacts。推送 `v*` tag 时，还会自动创建 GitHub Release 并上传产物。

## Windows 代码签名

在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中添加：

- `WIN_CSC_LINK`：Windows 代码签名证书。可以是 base64 编码后的 `.p12/.pfx` 内容，也可以是可下载的私有 HTTPS 地址。
- `WIN_CSC_KEY_PASSWORD`：证书密码。

配置后，Windows 打包 job 会自动把签名信息传给 `electron-builder`。没有配置这两个 secrets 时，Windows 包仍会生成，但不会签名。

## 发版示例

```bash
git tag v1.0.0
git push origin v1.0.0
```

版本号来自 `package.json`，tag 名建议和 `package.json` 的 `version` 保持一致。
