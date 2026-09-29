# main 自动发布验证（2026-09-29）

## 测试场景

`node --test tests/releaseArtifacts.test.cjs`：7/7 通过。直接执行 release.yml 中的 bash 步骤，使用临时 bare Git 远端与 detached checkout，验证：

- 3.8.6 → 3.8.7，两个清单三处版本一致，main/tag 指向同一提交。
- 手动构建不修改清单或 refs；旧源提交重跑不重复升版。
- main 已有新提交时跳过，不覆盖代码；已有版本标签时拒绝升版。
- 远端 update hook 拒绝标签写入时，原子 push 同时撤销 main 更新。
- 六矩阵的产物名唯一、排除 unpacked 文件；下载保留版本/发行版目录后仍能匹配 Release 上传规则。
- main 只从 release.verify 调用检查，PR/master 检查保留，避免 main 重复运行。

`actionlint 1.7.12 .github/workflows/release.yml .github/workflows/checks.yml`：通过。

`npm run check`：类型检查、Electron main/preload/renderer 构建通过；仅依赖包 PURE 注解警告。

`git diff --check`：通过。

## 验证边界

未向真实 origin 推送，未触发 GitHub Release，也未实跑 macOS/Linux 安装包。首次将这些改动合入 main 后，由 GitHub 验证平台打包和仓库实际写权限。

未修改既有三处 renderer 在途改动，无新依赖；测试仓库自动清理。旧手动 release-tag 脚本和 npm 入口已移除。
