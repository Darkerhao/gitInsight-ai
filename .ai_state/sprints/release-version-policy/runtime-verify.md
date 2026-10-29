# 本地发布验证

## 测试场景

- 策略在临时真实 Git 仓库中执行，不模拟 Git 输出；覆盖 patch/minor/major、完整正文与多提交、499/500 行、19/20 文件、删除、测试/锁文件/文档过滤、纯重命名和重命名修改、首次发布、版本基线及只读预览。
- dev 等价历史在合并前及合并后都返回 patch；已撤回功能重新引入返回 minor。失败回归先复现，再修根因；最终 `node --test --test-name-pattern='already released cherry-picked|reverted feature' tests/releaseVersion.test.mjs` 为 2/2。
- Windows 既有 shellTest 默认 skip，额外通过本机 Git Bash 实跑原 workflow shell：初轮全部 15/15（包含同步 dev、重跑、冲突、保护拒绝、并发拒绝、手动构建和过期运行）。最终脚本重新执行三种版本升级、双清单同步及原子本地推送，加上产物检查 7/7。
- `actionlint .github/workflows/release.yml .github/workflows/checks.yml`、两个新增 mjs 的 `node --check`、`git diff --check` 通过。
- `node scripts/release-version.mjs` 在真实 dev 上以 v3.8.19 为基线，排除已发布等价内容，输出 commits=0/files=0/patch；清单仍为 3.8.19。

## 最终专项

最终 `npm run test:release`：40 项，29 通过、0 失败、11 项既有 Windows shell 跳过；这些 shell 场景按上一节单独实跑。原始本地日志：`.cache/release-version-final-tests.log`、`.cache/release-shell-version-final.log`、`.cache/release-history-final.log`。

## 边界

没有推送真实远端或发布 Release；未重跑业务 UI/Electron 或三平台打包，本轮没有修改这些运行逻辑。原有未跟踪本地配置保留，未暂存或提交。
