# 版本策略审查

## Code Review

- 独立 reviewer 首轮发现 P2：dev 合入 main 后，`--cherry-pick` 对称差集无法排除已发布功能。实际临时仓库回归先失败（minor != patch），改为批量 stable patch-id 比较基线历史后通过。
- 追加已撤回功能重引入回归，先失败（patch != minor）。正反补丁统一 `--no-prefix`，按拓扑顺序处理取消记录后通过；不是以源码审查代替实跑。
- 最终只读复审无未关闭问题；正文语义、numstat 重命名与二进制过滤、CI 清单和原子推送边界均通过。

## Spec Compliance

| 标准 | 独立核对 |
| --- | --- |
| AC1 语义和优先级 | SATISFIED |
| AC2 代码规模与排除项 | SATISFIED |
| AC3 基线与完整范围 | SATISFIED |
| AC4 CI 和原发布行为 | SATISFIED |
| AC5 本地只读预览 | SATISFIED |

## Evidence Cross-Check

最终专项 40 项中 29 通过、0 失败、11 项 Windows shell 跳过；额外 Git Bash 初轮全部 15/15，最终修改后复跑三种升级与产物合同为 7/7。merge 和重引入场景最终为 2/2。actionlint、语法、diff check 通过，见 runtime-verify.md。

独立 evaluator 核对 AC1–AC5、三份实际测试日志及 Windows skip 边界，并独立执行 actionlint、脚本语法及 diff check，全部通过。本地证据不代表真实 GitHub 发布或三平台打包。

VERDICT: PASS。无未关闭问题。
