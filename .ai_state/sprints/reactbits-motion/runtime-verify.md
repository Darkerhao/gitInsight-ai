# 动效运行验证

2026-11-12 按用户要求在当前 dev 重新完成完整单测、83项浏览器、类型/构建及真实隔离Electron验证，最新结果见 [最终工作区复核](revalidation-2026-11-12.md) 和 [第二轮评审](reviews/pass2.md)。下文保留实施阶段证据。

## 完成条件与停止条件

本地 renderer 的购买/导出/生成发布/减少动态效果/消息/装饰停播通过可重复场景；指定单测、类型构建和隔离 Electron 通过后进入独立审查。外部服务失败不通过虚构结果补齐。最多三轮完整复核，定点失败修正后复跑相关场景。

隔离 worktree：`D:/MyWork/project/SHUZHI/gitInsight-ai/.cache/worktrees/reactbits-motion`。无真实账户、AI、飞书或生产数据调用，无提交或发布。

## 测试场景

| 命令 / 场景 | 实际结果 | 结论 |
| --- | --- | --- |
| `npm run test:coins` | 17 pass / 0 fail：价格、购买幂等、失败回滚、永久资产、SVG 内容与专注计时 | PASS |
| `npm run test:reliability` | 98 pass / 0 fail：生成队列、取消、保存、真实来源、发布结果与本地持久化 | PASS |
| `npm run test:e2e -- --workers=2` | 82 passed (2.5m)：全部已有与新增浏览器集成 | PASS |
| `npm run test:e2e -- tests/e2e/work-memory-cards.spec.ts tests/e2e/coin-workshop.spec.ts tests/e2e/motion.spec.ts --workers=2` | 最终目标窗口截图场景加入后 17 passed (49.9s) | PASS |
| 当前 dev：`npm run test:e2e -- tests/e2e/motion.spec.ts tests/e2e/work-memory-cards.spec.ts --workers=2` | 同步后 11 passed (35.4s)，含最终目标窗口截图 | PASS |
| 当前 dev：`npm run check` | 同步后类型检查及完整生产构建退出 0 | PASS |
| `npm run check` | Vue TypeScript 检查及 Electron 主进程/preload/renderer 构建退出 0；仅既有大 chunk 提示 | PASS |
| `node tests/desktopRuntime.smoke.cjs` | Electron 45.0.0 隔离隐藏窗口、真实 preload/IPC、购买幂等/持久化/重启/备份恢复通过 | PASS |
| `node scripts/measure-startup.mjs` | 默认页依赖闭包无 ECharts / 3D；shell 814603 bytes，默认日报 881654 bytes | PASS |
| `git diff --check` | 修正两处新增文件末尾空行后无诊断 | PASS |

新增集成实际检查：三款卡面最大 ±5°、固定操作栏、pointercancel/触摸/实时 reduced-motion、切卡复位、卸载取消帧；倾斜后的 SVG 不含视觉 CSS，PNG 仍为 2400×1640；生成中/取消/发布失败状态，正文保留；欢迎按钮始终可用；隐藏专注装饰暂停、计时继续；真实消息一次入场、筛选和批量刷新不重播。

页面切换回归检查首帧立即移除旧页与 reduced-motion。现有小窗口/缩放/弹层集成通过，含 1366×768、1024×640、911×512 弹层，以及日报 100%/125%/150% 等效缩放。

## 自测自改记录

- 初轮动效及纪念卡专项 9 pass / 1 fail。失败来自测试夹具每次加载都强制 `welcome-animation-enabled=false`，并非产品逻辑。夹具增加显式 `?welcome` 测试入口，随后 82 项全部通过。
- 专注空间增加观察当前画面是否进入视口，滚出视口停止装饰；文档可见性由 App 派生到根属性，计时模型不受动画控制。
- 独立浏览器检查使用 Ego Lite，IPC 数据复用现有测试夹具。原站 Pro 受保护代码未复制或依赖。
- 截图检查发现旧深色钱包专用覆盖仍覆盖新主题材质；已删除该旧覆盖，统一小窗分隔线与焦点颜色，针对工坊及动效 17 项重新通过。

## 截图检查

真实浏览器已查看纪念卡深色星轨、浅色纸笺及蓝图全页面预览；卡面信息清晰，倾斜未裁切主体。目标窗口 1366×768、1440×900、1024×640 的深浅主题截图已生成且无横向溢出，导出控件可滚动到达。

产物：`output/playwright/motion/card-{width}-{mode}.png`、`workshop-{width}-{mode}.png`；Ego Lite 独立页面：`output/playwright/motion/ego-card-preview.png`；现有工坊及专注截图继续保存于相应 output 目录。

## 性能比较

同一工作区基线构建（`b756473`）与修改后构建：shell JS 813713 → 814603 bytes（+890）；默认日报 JS 878925 → 881654 bytes（+2729，约 0.31%）。共享倾斜单独分块，重型图表和 Three.js 仍不在日报首屏。

Electron 隐藏窗口挂载实测属于本地冒烟证据，不等同于可见安装包冷启动。本轮没有测出可用于承诺的稳定帧率；不把目标 60fps 标成已验证。

## Reflect

业务闭环、减少动态效果、生命周期清理、页面切换与本地真实 IPC 已覆盖。代码/规格独立审查 PASS，截图已查看。真实远端 AI/飞书、安装包发布与可见窗口最小化/恢复尚未执行；文档可见性及隐藏期间计时以集成场景验证，不替代可见安装包检查。

## VERDICT

本地自动与截图验证 PASS；代码和规格独立审查 PASS。最终评估及收敛检查见 `reviews/pass1.md` 与 `cleanup-pass.md`。

当前工作区同步37个文件均逐份校验，未覆盖其他工作。集成构建及11项动效/纪念卡回归通过；当前分支仍为 dev，未暂存、提交、推送或发布。隔离 worktree 保留为复核证据。
