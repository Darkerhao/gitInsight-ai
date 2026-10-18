# 修复与验证（2026-10-18）

- 根因：真实飞书记录页的“每日工作时长（h）”带单位，原正则只接受字段后直接出现数字/冒号，导致记录卡片全部被排除。
- 修复：记录识别与工时提取复用同一正则，支持实际单位格式；读取失败原因进入手动确认、自动任务错误与错误日志。保留重复确认、取消不提交、自动任务停止和发布互斥。
- `node --test tests/publicationGuard.test.mjs`：修改前 12 pass / 2 fail（单位格式返回 unavailable；失败原因缺失）；修改后 14/14 pass，含日期/项目/工时排除与错误日志内容断言。
- `node --test tests/publicationGuard.test.mjs tests/persistencePublication.test.mjs`：21/21 pass。
- `npm run test:reliability`：92/92 pass。
- `npm run typecheck`、`npm run build`、`git diff --check`：全部成功；构建仅有既有 Rollup 注释与 chunk 体积警告。
- `node .cache/feishu-records-runtime.cjs`：PASS。隔离隐藏 Electron 窗口运行实际页面脚本和发布函数；三种工时标签、无重复不弹窗、重复取消不 POST、不同工时排除均通过。使用合成 HTML，远端 POST 为 mock；脚本留在忽略目录供本地复跑，不含真实凭证。
- 独立只读审查 PASS，见 `reviews/pass1.md`。专用 reviewer 模型服务 503 后，改由继承当前模型的只读审查 agent 完成。
- 已只读查看用户当前真实飞书记录页，未真实发布日报，未提交、推送或制作安装包。当前本地构建需重启应用加载新主进程代码。保留原有 report-performance 改动与主任务状态。
- 清理两处隔离诊断目录时，自动审批策略拒绝执行（仅返回 `blocked by policy`）；保留 `C:\Users\haozi\AppData\Local\Temp\gitinsight-feishu-diagnose-79cdWk` 和 `C:\Users\haozi\AppData\Local\Temp\gitinsight-feishu-diagnose-zHiANo`，未尝试绕过。临时诊断源脚本已删除。
