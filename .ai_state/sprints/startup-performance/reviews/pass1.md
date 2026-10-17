# 启动优化审查 Pass 1（2026-10-17）

## Code Review — CONCERNS

独立只读 reviewer 确认一项 P2：仅删除 out-in 与 CSS leave 样式，Vue 3.5.38 仍在两次 requestAnimationFrame 后才移除旧页。旧日报页高 1742px 时，已缓存关于页在离场完成前位于 top=1854px，完成后跳到 top=112px。新旧页面同时占据文档流，违背立即切换目标。

建议：在 Transition 的 leave 钩子立即调用 done，并补充首次 DOM 更新就移除旧页的布局回归。其余代码未发现可行动问题。reviewer 另外验证聚焦测试 21/21、资源闭包与 diff check；未重建产物或验证可见安装包冷启动。

## Spec Compliance — PASS

独立只读 spec agent 对 AC1–AC6 未发现 MISSING/EXTRA/DEVIATED：后台扫描不写配置、不覆盖选择，失效扫描不回写；懒加载映射与错误恢复完整；资源闭包和阶段计时存在，验证边界准确。额外内存探针证明显式刷新完成后，旧后台扫描不能覆盖新结果。

后续复核维持 PASS：后台扫描成功文案仅由显式刷新写入，符合状态责任边界；可靠性日志已更新为 91/91。

## 主会话验证与修正

- 复现另一处共享状态问题：后台扫描完成把正在生成日报的 status 替换为仓库数量。新增回归先失败，再将成功文案移入现有 !background 分支；不新增状态，可靠性 91/91。
- 对页面离场问题，正常动画与 reduced-motion 两个首帧回归均在修复前失败，见 `output/startup-transition-red.log`。已添加立即 done 离场钩子，等待复验与 Pass 2。

本轮不以首次审查 PASS 代替最终代码复验；最终结论见后续数字 pass。
