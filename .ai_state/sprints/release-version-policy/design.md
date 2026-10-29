# 按变更规模自动升版

## 方案

唯一版本策略脚本优先使用 package.json 当前版本对应的稳定标签，缺失时读取 HEAD 可达的最高稳定版本标签；没有标签时分析全部历史。分析标签至 HEAD 的完整提交与净差异，使用 Git stable patch-id 排除已经发布的等价提交（包括 dev 合入 main 后）；历史逆向补丁取消已发布标记，使已撤回的功能再次引入时正常升版。CI 保留当前检查、原子推送、三平台打包和同步 dev 流程，只替换固定 patch 判定。

优先级：Conventional Commits 的 `!` / `BREAKING CHANGE:` / `BREAKING-CHANGE:` → major；`feat` → minor；有效代码增删合计达到 500 行或有效代码文件达到 20 个 → minor；其他 → patch。major 不由代码量推断。阈值固定于脚本，不增加依赖或配置层。

有效代码统计 src、electron、scripts、build 中的代码文件及根构建配置，忽略文档、测试、锁文件、生成产物、二进制资源和纯重命名；新增/删除代码均计入。功能判断读取完整提交正文，涵盖多提交推送和 squash 提交。

## 验收标准

- AC1：小修复 patch、新功能 minor、显式不兼容 major，优先级稳定；完整正文可识别标记。
- AC2：500 行或 20 文件边界为 minor；测试、锁文件、文档和纯重命名不抬高代码规模。
- AC3：标签之后的完整范围参与分析，标签前功能不重复计入；无标签可首次分析。
- AC4：CI 使用唯一策略且日志输出基线、代码量、文件数和升版原因；清单同步、原子推送、过期运行/手动构建行为保留。
- AC5：只读本地预览不改版本、工作区或 Git 引用。

## Done Contract

- `node --test --test-timeout=60000 tests/releaseVersion.test.mjs tests/releaseArtifacts.test.cjs` 通过；实际临时 Git 仓库验证策略及工作流。
- `actionlint .github/workflows/release.yml .github/workflows/checks.yml` 通过。
- README、发布说明和架构说明采用同一规则，`git diff --check` 通过；不提交、推送或发布。

## Round 1 · Critic Findings

独立只读 critic：PASS，无 P0/P1。指出 dev 的 cherry-pick 同步使标签不一定可达；采用当前版本标签并排除已发布的等价提交，增加真实分叉历史回归。正文多行 Conventional Commit 与重命名差异均纳入测试。
