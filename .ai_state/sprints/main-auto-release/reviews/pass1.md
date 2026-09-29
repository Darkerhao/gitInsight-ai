# main 自动发布独立审查

审查 agent：`/root/release_review`，只读；范围为发布工作流、版本入口清理、发布测试与文档。原 critic 两次因服务繁忙失败，改由此 agent 完成代码与规格复核，未伪记前置设计审查。

## Findings

原 P1 已解决：upload-artifact 保留版本/发行版目录，最终 Release 上传规则已改为 `release-assets/**/MajiAI-*`，产物回归测试已覆盖该实际路径。最终独立审查未发现待处理问题。

## Spec Compliance

| 标准 | 结论 | 依据 |
| --- | --- | --- |
| AC1 | SATISFIED | 自动入口仅 main push；手动不升版、不发布。 |
| AC2 | SATISFIED | checks 成功才升版，两个清单同步，main/tag 原子推送同一提交。 |
| AC3 | SATISFIED | 六矩阵固定 SHA；唯一 release job 依赖整个矩阵成功，递归 glob 覆盖下载产物。 |
| AC4 | SATISFIED | 过期快照跳过；非强制原子推送；GITHUB_TOKEN 不递归触发。 |
| AC5 | SATISFIED | 旧脚本/命令已删除；文档包含并发、失败重跑、同步与权限。 |

## Evidence Cross-Check

主 agent 最终复跑：发布专项 7/7、actionlint、npm run check、git diff --check 全部通过，命令结果见本轮工具输出和 runtime-verify.md。独立 agent 已复读修复代码与回归断言；未声称执行真实远端发布。

VERDICT: PASS

## 最终独立评估

评估 agent：`/root/release_evaluation`。确认最终 AC1–AC5 满足、发布专项 7/7、actionlint/diff check/npm run check 通过。追加检查入口去重保留 PR/master 与 main 的完整验证；递归产物匹配已覆盖。真实 GitHub 和跨平台执行边界与 Done Contract 一致，无需继续修改。

VERDICT: PASS
