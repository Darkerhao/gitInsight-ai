# 一周日报批量工作台运行时验证

## 完成条件与停止条件

- checker：`npm run test:weekly-report`、`npm test`、`npm run typecheck`、`npm run build`、`git diff --check`、新页面静态契约检查。
- 停止条件：上述本机可重复 checker 全部通过；真实飞书提交不在无授权账号/测试数据条件下执行。
- 修改范围：本 sprint 新增的一周日报页面、共享工时函数、导航/样式和测试；禁止修改飞书后端协议与无关奖励组件。

## 测试场景

| 场景 | 类型 | 命令/环境 | 实际输出 | 结论 |
| --- | --- | --- | --- | --- |
| 日期范围、内容权重、动态日工时、0.5 小时分配及发布行为 | 正常/边界/失败 | `npm run test:weekly-report`，Node 20 本机 | 12/12 tests pass，页面 smoke pass | PASS |
| 全仓库回归 | 正常 | `npm test`，Node 20 本机 | timeline 3、repo names 4、AI 7、Git 2、weekly 12、auto-sync 7，共 35 tests pass | PASS |
| Vue 类型契约 | 正常 | `npm run typecheck` | exit code 0 | PASS |
| Electron 生产构建 | 正常 | `npm run build` | main/preload/renderer build complete；仅既有 Element Plus PURE 注释告警 | PASS |
| 菜单/路由/页面关键交互静态契约 | 正常/边界 | `node tests/weeklyReportPage.smoke.mjs` | weekly route/menu、覆盖保存、发布前保存、顺序批量执行、成功项跳过、未确认工时阻断、范围锁定全部存在 | PASS |
| 新页面尾随空白与 diff | 质量 | `git diff --check` + 新文件 `rg '[ \\t]+$'` | 无失败输出 | PASS |
| 实际 renderer 路由与页面结构 | 正常 | 复用本项目 `electron-vite dev` 的 `http://127.0.0.1:5174/#/weekly` | DOM 显示“一周日报”、7 天范围、项目选择、草稿编辑、单条提交与批量提交区域 | PASS |
| 页面视觉截图 | 环境 | in-app browser | 非 Electron 浏览器环境缺少 preload API，既有启动遮罩覆盖正文 | BLOCKED（环境） |
| 既有 UI shell smoke | 回归 | `node tests/ui-shell.smoke.mjs` | 在既有 `CodeMaterializeEffect.vue` emoji 断言失败 | BLOCKED（基线） |
| 真实飞书单条/批量提交 | 外部依赖 | 未执行 | 需要用户已登录飞书、有效字段映射和可写测试数据 | BLOCKED（授权/外部状态） |

## 自测自改记录

- 首次 focused test 因 NodeNext 要求缺少 `.js` 扩展名；将 `weeklyReport.ts` 类型导入改为 `./types.js` 后 3/3 通过。
- 首次静态契约命令因 PowerShell/`node -e` 引号转义失败；改用 PowerShell 调用 `rg --fixed-strings` 后检查通过。
- 拆分动作模块后，页面 smoke 仍在 `useWeeklyReports.ts` 查找已迁移实现而失败；改为从 `weeklyReportActions.ts` 验证保存、发布和批量执行契约后，10/10 行为与纯函数测试及页面 smoke 全部通过。
- 最终 review 要求函数与文件继续收敛；拆分页面状态、命令、工时编排和样式后，AST 检查无超过 40 行函数，周报代码/样式文件均小于 300 行。
- 外部错误改为稳定脱敏文案，并新增行为测试；工时重算新增动态配置测试，确认每次调用读取当前默认日工时。
- UI shell smoke 失败位置与本 sprint 新页面无关，未修改奖励组件以掩盖基线失败。

## Reflect

- 已覆盖：多日期（连续最多 7 天）、多项目、项目/日期草稿编辑、历史记录覆盖保存、单独飞书提交、失败后继续的逐条批量提交、按工作内容估算工时、手动工时占用容量及容量不足发布阻断。
- 已通过实际 renderer DOM 验证新菜单和 `/weekly` 页面结构；未覆盖 Electron preload 环境内的完整视觉交互和飞书 POST，原因是浏览器环境缺少 preload API，且没有用户授权的飞书账号与可写测试数据。
- 新缺口：无；既有 UI smoke 基线失败不由本 sprint 引入。

## VERDICT

PASS（本机可重复门禁通过；真实飞书链路保留为授权后验收项；既有 UI smoke 基线失败已明确隔离）。
