# main 自动发布

## 方案

发布入口收敛为 main push。复用现有 checks，通过后递增 patch，提交 package.json/package-lock.json 并原子推送 main 与版本标签；六个矩阵任务 checkout 同一版本提交，全部成功后统一发布 GitHub Release。保留手动构建任意 ref，不升版、不发布。

同一分支发布串行执行，不中断正在打包的版本；等待中的旧 push 可被 GitHub 合并淘汰。升版前检查远端 main，已过期快照跳过，推送窗口发生竞争则原子推送失败，不覆盖新提交。使用 GITHUB_TOKEN，机器人回写不再次触发 push 工作流。

只保留一套自动发布入口，删除旧手动 tag 脚本；本次不实现客户端安装更新。复用当前 checkout，保留已有三处前端修改。

## 验收标准

- AC1：main push 自动触发，其他分支/tag 不自动发布；手动触发仅打包。
- AC2：检查通过才升版；package.json 与 lock 两处版本同步 patch +1，main/tag 指向同一提交。
- AC3：全部安装包使用固定版本提交；六个矩阵成功才发布唯一 Release。
- AC4：过期 push 跳过；竞争/标签冲突不部分推送；机器人不递归触发。
- AC5：文档说明推送方式、回写后拉取、分支写权限和失败重跑；删除旧发布入口。

## Done Contract

- node --test tests/releaseArtifacts.test.cjs：产物契约和临时 Git 仓库实跑全部通过。
- actionlint 检查两个工作流，无错误；git diff --check 通过。
- npm run check 通过，验证应用仍可构建。
- 本地不触发真实 main 推送或 Release；跨平台 CI 执行结果需首次推送后确认。
