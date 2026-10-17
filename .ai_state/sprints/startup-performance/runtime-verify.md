# 第一轮启动优化验证（2026-10-17）

## 环境与边界

- 源码基线 `6a633d0`；实施位于 `.cache/worktrees/startup-performance`，未提交或推送。
- Windows 11 / 10.0.22631，x64，Intel Core i9-13900H，20 逻辑处理器，32 GiB RAM；Node 22.21.1、Electron 37.10.3、Vue 3.5.38、electron-vite 3.1.0、Vite 5.4.21。
- 浏览器使用已安装 Google Chrome 155.0.8059.80；Playwright 自带 Chromium 未安装，复用本地 `.cache/playwright.local.config.ts` 选择 Chrome，未修改 CI 配置。
- 浏览器仅 mock IPC；Electron 使用真实 preload、IPC、隔离用户数据和生产构建，阻断网络并保持窗口隐藏。数据库种子为 1 条旧素材，测试中写入 3 条日报，再执行重启、备份、恢复；没有大规模历史数据或真实安装包的可见冷启动证据。

## 已执行检查

| 检查 | 结果 | 本地日志 |
| --- | --- | --- |
| `node --test tests/assistantInitialization.test.mjs tests/repositoryFeishu.test.mjs tests/autoSyncEditing.test.mjs` | 21/21 通过，属于可靠性套件的子集 | 本轮工具输出 |
| `npm run test:reliability` | 最终 91/91 通过，含新增扫描进度回归 | `output/startup-reliability.log` |
| `npm run check` | 最终类型检查、主进程/preload/renderer 生产构建通过 | `output/startup-check-final.log` |
| `npx playwright test --config .cache/playwright.local.config.ts --workers=2` | 审查前全量 58/58 通过，包含首屏请求、延迟扫描、失败恢复与全部导航回归 | `output/startup-e2e.log` |
| 上述浏览器命令加 `startup.spec.ts reports.spec.ts` | 审查修正后 26/26 通过，含正常/减少动态效果两种切换首帧回归；不与全量数量相加 | `output/startup-e2e-final.log` |
| `node scripts/measure-startup.mjs` | 最终资源闭包断言通过，默认页不含 ECharts/3D | `output/startup-assets-final.log` |
| `node tests/desktopRuntime.smoke.cjs`（最终生产构建之后） | 真实 Electron 启动、单实例、加密持久化、素材与备份恢复通过 | `output/startup-desktop-final.log` |

已查看 Chrome 深色 1366px 仓库中心截图，布局与控件正常。构建仍报告已有 VueUse PURE 注释和大型 vendor chunk 提示；未新增依赖。

## 资源结果

- 重新读取主工作区 2026-10-15 20:05:54（Asia/Shanghai）的原生产构建，按 HTML 的 JS 引用递归遍历静态 import/export：5,986,293 bytes。
- 最终应用壳静态 JS：1,207,272 bytes；包含默认日报页及其静态依赖：1,263,712 bytes，比原首屏减少 78.89%。
- 新包的 ECharts 与 3D 仅在使用对应页面或功能时加载。Element Plus 仍沿用全局注册；组件库进一步按需引入不在这一轮。
- 统计为磁盘 JS 字节数，包含共享依赖且去重，不包含 CSS/图片，不是 gzip 或启动时长。

## 启动分段计时

`npm run measure:startup` 顺序执行生产构建、资源闭包检查与现有隔离 Electron 冒烟。已有构建时可分别运行后两条命令。应用仅使用 Performance API，不新增业务 IPC、不上传数据、不记录路径或账号。

| 隔离启动阶段 | 父进程发起启动到首个业务页 DOM 挂载 | renderer 文档起点到业务页挂载 | renderer 本地初始化 |
| --- | ---: | ---: | ---: |
| write（旧素材种子，第一次进程启动） | 5315 ms | 1107 ms | 63 ms |
| read（重启读取） | 1036 ms | 582 ms | 54 ms |
| restored（应用待恢复备份） | 1074 ms | 552 ms | 28 ms |
| restored-again（恢复后再启动） | 1091 ms | 606 ms | 50 ms |

四行均是同一次冒烟的不同数据/恢复阶段，不是四次同条件冷启动，保留首次 5315 ms 结果。窗口隐藏且包含测试引导代码，不能用于宣称真实可见冷启动达标、计算优化倍数或评价已运行窗口的唤起耗时。日志还输出 main entry、app ready、restore/config/updates/IPC/window，以及 renderer entry、shell、config/local、page 的阶段标记。仓库扫描有独立 measure，空工作区不执行扫描。

审查修正后重建产物，再次执行完整隔离 Electron 冒烟，四阶段数据如下。重跑用于验证最后代码，不能选择较低数值作为冷启动承诺。

| 阶段 | 父进程到业务页 DOM 挂载 | renderer 文档到业务页挂载 | renderer 本地初始化 |
| --- | ---: | ---: | ---: |
| write | 1637 ms | 802 ms | 76 ms |
| read | 1332 ms | 740 ms | 51 ms |
| restored | 1343 ms | 707 ms | 37 ms |
| restored-again | 1235 ms | 665 ms | 49 ms |

## 审查修正

- 后台扫描原本会覆盖日报生成 status。内存回归先红，成功文案收回显式刷新分支后变绿；未增加额外状态。
- Vue 在没有离场 CSS 时仍等待两次动画帧才移除旧 DOM，导致新页先被旧页挤到视口外。独立审查实证后，正常动画与 reduced-motion 两项首帧回归均先红；为原 Transition 添加立即 done 的离场钩子后变绿。
- 最终代码/规格审查及评价见 `reviews/pass2.md`。Git/AI/数据库逻辑保持本轮边界；最终同步状态见项目索引。

## 验收对应

- AC1/AC2：延迟、失败、取消选择、删除、dispose、工作区变化、未保存编辑均有回归；初始化不保存配置，扫描不占用生成 loading。
- AC3/AC4：58 项浏览器测试覆盖导航、首屏依赖、资源失败恢复、路由恢复与日报行为；退出等待已移除，进入淡入为 80 ms，保留 reduced-motion。
- AC5：生产资源显著下降，计时命令可复跑；未认定任何安装包可见冷启动或大数据性能目标已达成。
- AC6：上述类型、构建、可靠性、浏览器及真实隔离 Electron 检查通过；最终代码/规格/evaluator 均 PASS，收敛检查通过，已同步当前工作区。

## 当前工作区集成验证

- 13 个实现/测试文件已同步至 `D:/MyWork/project/SHUZHI/gitInsight-ai`，逐文件 SHA-256 与隔离 worktree 一致；保留原有项目状态文档内容，未暂存、提交或推送。
- 当前工作区执行 `npm run build` 成功，日志 `output/startup-final-workspace-build.log`。在该构建执行 `node scripts/measure-startup.mjs` 与 `node tests/desktopRuntime.smoke.cjs` 均通过，日志分别为 `output/startup-workspace-assets.log`、`output/startup-workspace-desktop.log`。
- 当前工作区资源闭包仍为 shell 1,207,272 bytes / 默认日报页 1,263,712 bytes。各目录构建 chunk 哈希可以不同，最终指标使用当前工作区实际产物。

## 依赖依据

- 已检查本机 Vue 3.5.38 `@vue/runtime-core/dist/runtime-core.esm-bundler.js` 的 `defineAsyncComponent`、`createInnerComp` 与挂载钩子传播；electron-vite 3.1.0 renderer 默认 `minify: false` 及配置合并实现；Vite 5.4.21 的 `BuildOptions.minify` 公共类型。
- 官方文档：<https://vuejs.org/guide/components/async.html>、<https://vuejs.org/guide/built-ins/transition.html>、<https://electron-vite.org/guide/build>。实现依据安装版本源码，没有升级依赖。
