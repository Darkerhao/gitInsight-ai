# 码迹AI 审计问题修复文档

日期：2026-10-26  
范围：当前 `dev` 分支工作区（不包含未提交的用户改动）  
原则：优先修复真实缺陷和安全边界；不为假设场景引入复杂架构；能用现有依赖解决的，不新增依赖。

## 1. 审计基线

本轮审计的实际结果：

- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npm test`：当前 Windows 环境未完整结束，`releaseArtifacts` 的 Git shell fixture 等待并超时。
- `npm audit --omit=dev`：2 critical、6 high。
- 生产构建体积：默认页面 JavaScript 约 1.27 MB；`vendor-echarts` 约 1.13 MB；`vendor-element-plus` 约 769 KB；`vendor-3d` 约 553 KB。

## 2. 修复项与验收标准

### A1. 本地日期与 UTC 混用

**问题**

`toISOString().slice(0, 10)` 返回 UTC 日期。在 Asia/Shanghai 时区凌晨 00:00-07:59 会得到前一天，影响周报默认范围、时间长河今日标记和备份文件名。

**涉及位置**

- `src/renderer/src/composables/useWeeklySummary.ts`
- `src/renderer/src/views/JiaziTimelineView.vue`
- `electron/main/backup.ts`

**修复**

- 在 `src/shared/` 建立唯一的本地日期工具。
- 主进程和渲染进程都复用该工具。
- 禁止用 `toISOString().slice(0, 10)` 生成本地日历日期。

**验收**

- 新增本地日期单元测试，覆盖凌晨日期和跨日偏移。
- 周报本周/上一周、时间线 `TODAY`、备份默认文件名均使用本地日期。

### A2. 依赖安全告警

**问题**

当前 lockfile 中 `simple-git@3.36.0` 和 `vue@3.5.38` 被审计工具标记；`simple-git` 仅用于两次固定参数的 Git 命令。

**修复**

- 移除 `simple-git`，改为 Node 自带 `child_process.execFile`，不拼接 shell 命令。
- 更新 `vue` 到已修复版本。
- 对可安全更新的传递依赖执行更新。
- 重新运行 `npm audit --omit=dev`，记录剩余风险。

**验收**

- 代码和 lockfile 不再直接依赖 `simple-git`。
- Git 采集专项测试通过。
- 不新增运行时依赖。

### A3. ECharts 全量引入

**问题**

`JiaziTimelineView.vue` 使用 `import * as echarts from 'echarts'`，导致共享 `vendor-echarts` 包含完整图表库，工作台也承担该体积。

**修复**

- 时间长河改为 `echarts/core`。
- 只注册 Calendar、Heatmap、Tooltip、VisualMap 和 CanvasRenderer。

**验收**

- 时间长河热力图正常构建和加载。
- 构建后的 `vendor-echarts` 体积明显下降。

### A4. 奖励特效静态全量加载

**问题**

`RewardEffectOverlay.vue` 静态 import 63 个特效，打开任意特效都会加载所有特效代码和 Three.js。

**修复**

- 将特效映射改为按键懒加载。
- 保持现有特效 key、元数据和播放行为不变。

**验收**

- 构建产生按特效拆分的异步 chunk。
- `RewardEffectOverlay` 主 chunk 不再包含全部特效实现。

### A5. Element Plus 全量注册

**问题**

`main.ts` 使用默认导入注册整个 Element Plus，默认页面承担约 769 KB JS。

**修复**

- 改为显式注册项目实际使用的组件和 Loading 指令。
- 不新增自动导入插件，避免增加新的构建依赖和维护层。

**验收**

- 所有现有 Element Plus 组件仍可正常渲染。
- 构建通过，`vendor-element-plus` 体积下降。

### A6. Git 采集顺序低效

**问题**

当前先对所有提交执行 `git show`，再按汇报人过滤。多作者仓库和长时间范围会执行大量无用 Git 子进程。

**修复**

- 把汇报人过滤前移到 `collectGitData`。
- 只对匹配提交执行 `git show`。
- 保留匹配前总提交数，用于无匹配时的提示。

**验收**

- 多作者临时仓库测试中，只返回目标作者提交。
- 总提交数提示仍准确。
- 不改变作者名/邮箱大小写不敏感匹配规则。

### A7. sql.js 每次写入重写整库

**问题**

`sql.js` 的 `export()` 会导出整个内存数据库。当前每次保存都原子重写数据库文件，数据增长后会放大写入成本。

**修复**

- 不切换原生 SQLite，避免提高跨平台打包复杂度。
- 合并相邻/并发持久化请求：同一轮写盘期间的新修改会触发下一轮快照，避免丢写，同时减少重复导出。

**验收**

- 现有持久化、备份恢复、发布状态测试通过。
- 并发保存后重新加载仍能读到最后一次修改。

### A8. preload API 重复定义与类型缺口

**问题**

`electron/preload.ts` 和 `src/renderer/src/env.d.ts` 各自维护 `window.api` 签名；`localDataState` 使用 `ctx: any`。

**修复**

- 新增共享 `GitInsightApi` 接口。
- preload 使用该接口约束实现，renderer 使用同一接口声明 `window.api`。
- 为 `createLocalDataState` 增加显式上下文类型。

**验收**

- typecheck 能发现 preload 与 renderer API 契约不一致。
- 项目业务代码不再使用 `ctx: any`。

### A9. Electron 安全边界不统一

**问题**

主窗口当前 `sandbox: false`；多数 IPC 处理器没有统一校验来源窗口。

**修复**

- 主窗口开启 sandbox。
- 所有 IPC 注册统一经过主窗口来源校验包装器。
- 更新窗口、更新检查等现有行为保持不变。

**验收**

- 真实 Electron 启动 smoke 通过。
- typecheck、build 通过。

### A10. 测试门禁与本地测试稳定性

**问题**

- CI 的浏览器 E2E 使用 mock `window.api`，没有覆盖真实 preload、IPC、SQLite、safeStorage。
- `releaseArtifacts` 依赖 Git Bash 的版本同步 fixture 在 Windows 本地会超时。

**修复**

- 测试命令给 Node test runner 设置明确超时。
- 仅对依赖 Ubuntu Bash 的版本同步 fixture 在 Windows 跳过；Linux CI 仍执行。
- CI 增加 Windows 真实 Electron smoke。

**验收**

- Windows 本地 `npm test` 可以结束。
- Linux CI 中 release fixture 仍执行。
- 新增 Electron smoke job 有明确超时。

### A11. 未使用设计资源

**问题**

`src/assets/images/design-draw/` 中 8 张设计图约 8.73 MB，源码未引用。

**修复**

- 删除这些未引用资源。

**验收**

- 全仓搜索无引用。
- 构建不受影响。

### A12. 死代码与未使用符号

**问题**

`vue-tsc --noUnusedLocals --noUnusedParameters` 发现多处未使用导入、变量和解构。

**修复**

- 清理已确认无用的符号。
- 在 `tsconfig.json` 开启 `noUnusedLocals` 和 `noUnusedParameters`。

**验收**

- `npm run typecheck` 通过，且未使用符号会使检查失败。

## 3. 明确不做

- 不把 `sql.js` 换成原生 SQLite。当前跨平台安装包收益不足以抵消原生模块构建、签名和更新复杂度。
- 不重写奖励特效组件，只做按需加载。
- 不拆分现有业务模块为多套新抽象。修复优先落在现有调用链上。

## 4. 验证清单

1. `npm run typecheck`
2. `npm run test:git-collect`
3. 新增本地日期测试
4. 相关持久化、备份恢复测试
5. `npm run build`
6. 构建体积对比
7. `npm audit --omit=dev`
8. `npm run test:desktop`（Windows）
9. `npm test`（确认本地可结束）

## 5. 实施结果（2026-10-26）

| 编号 | 状态 | 结果 |
| --- | --- | --- |
| A1 | 已完成 | 主进程和渲染进程复用 `src/shared/localDate.ts`；周报、时间长河、备份文件名已改用本地日期 |
| A2 | 已完成 | 移除 `simple-git`；升级 Vue、Electron、Electron Builder、Electron Vite、Vite 和 Vue 插件；全量 `npm audit` 为 0 |
| A3 | 已完成 | 时间长河改为 ECharts Core 按需注册，`vendor-echarts` 从约 1.13 MB 降至约 572 KB |
| A4 | 已完成 | 63 个奖励特效改为异步加载，覆盖层主 chunk 从约 351 KB 降至约 30 KB |
| A5 | 已完成 | Element Plus 改为显式组件注册，JS chunk 从约 769 KB 降至约 414 KB；同时修正 Radio 父组件注册和 Checkbox `value` 用法 |
| A6 | 已完成 | `collectGitData` 先按作者过滤，再读取 `git show`，并保留总提交数用于提示 |
| A7 | 已完成 | 持久化请求改为版本化合并循环；写盘期间的新修改会触发下一轮快照，避免丢写 |
| A8 | 已完成 | 新增 `GitInsightApi` 共享接口；preload 和 renderer 使用同一契约，`localDataState` 不再使用 `any` 上下文 |
| A9 | 已完成 | 主窗口开启 sandbox；所有 IPC handler 统一经过主窗口来源校验 |
| A10 | 已完成 | Windows 跳过仅依赖 Bash 的 release fixture；增加测试超时和 Windows Electron smoke CI |
| A11 | 已完成 | 删除 8 张未引用设计图，共约 8.73 MB |
| A12 | 已完成 | 清理未使用符号并在 `tsconfig.json` 开启未使用检查 |

### 验证结果

- `npm run typecheck`：通过。
- `npm test`：通过；Windows 下 9 个依赖 Bash 的 release fixture 按设计跳过，Linux CI 仍执行。
- `npm run test:desktop`：通过，Electron 45.0.0 真实启动、preload IPC、sandbox、加密凭据、数据库和备份流程均已跑通。
- Playwright：60 个浏览器回归全部通过。
- `npm audit`：0 vulnerabilities。
- `git diff --check`：通过。
- 默认页面 JavaScript 从约 1.27 MB 降至约 864 KB；shell JavaScript 从约 1.21 MB 降至约 799 KB。

### 未覆盖边界

- 未执行三平台安装包构建和签名发布。
- 未调用真实 AI 服务、真实飞书账号或线上飞书表单。
- GitHub Actions 的新增 Windows job 需要在推送后由 CI 实际运行确认。
