# 重构设计：拆分 main.ts 与 useAssistant.ts（2026-07-03）

## 背景与目标

[electron/main.ts](../../../electron/main.ts)（2082 行）承载了主进程全部逻辑，[src/renderer/src/composables/useAssistant.ts](../../../src/renderer/src/composables/useAssistant.ts)（1032 行）承载了渲染层全部状态与动作。两个文件均已超出单文件可维护的规模。本次重构将二者按功能域拆分为职责单一的模块，**不改变任何运行时行为**。

用户已确认的决策：

- 方案：按领域完整拆分（非分层架构、非最小拆分）。
- 范围：仅 main.ts 与 useAssistant.ts；WelcomeGate.vue（1487 行）**不在本次范围内**。
- 不引入测试框架、ESLint、Pinia 等新基础设施。

## 不变量（验收红线）

1. **IPC 契约零改动**：18 个 invoke 通道、2 个推送事件不增不减不改名；[electron/preload.ts](../../../electron/preload.ts)、[src/renderer/src/env.d.ts](../../../src/renderer/src/env.d.ts)、[src/shared/types.ts](../../../src/shared/types.ts) 三个文件不修改。
2. **`useAssistant()` 返回对象逐 key 不变**：4 个视图与 `src/renderer/src/components/` 下全部组件零改动。
3. **运行时行为不变**，尤其是：
   - Git 采集的两阶段过滤（粗 `--since` 按 committer date、精过滤按 author date）；
   - 单 commit 4000 字符、合并 diff 12000 字符上限；
   - AI 失败/无 Key 时的 `fallbackReport` 降级路径（`generateReport` 永不向 UI reject）；
   - 自动同步 run key 去重语义（scheduled 去重、manual 的现有行为原样保留）；
   - `safeStorage` 不可用时 `saveConfig` 抛错的语义；
   - `aiBaseUrl` 两种输入形态的规范化与 404 时的 `/models` 建议。
4. **构建产物结构不变**：主进程仍打包为单个 `out/main/main.js`，preload/renderer 产物不变，electron-builder 配置不动。
5. 现有已知缺陷（见 `docs/project-issue-audit-2026-07-01.md`）**原样保留**，本次不顺手修复——修复与重构混在一起会破坏"行为不变"的可验证性。

## 第一部分：主进程拆分

### 目标结构

`electron/main.ts` 缩减为约 70 行薄入口，只保留：app 生命周期钩子（`whenReady` / `window-all-closed` / `before-quit` / `activate`）、powerMonitor 监听、对 `registerIpcHandlers()` 与 `createMainWindow()` 的调用、退出清理的编排。其余代码迁入 `electron/main/` 下 13 个模块。

tsconfig 的 `include` 已含整个 `electron` 目录，新子目录自动被 `vue-tsc` 覆盖；electron-vite 主进程为 Rollup lib 模式（入口 `electron/main.ts`），多文件仍打包为单产物，无构建配置改动。

### 模块清单与函数归属

以下行号为当前 main.ts 中的位置，作为迁移时的定位依据。个别工具函数在不破坏依赖方向的前提下允许 ±1 个模块的调整。

**`electron/main/paths.ts`**（约 25 行）
`getConfigPath`(106)、`getSecretsPath`(110)、`getDatabasePath`(114)、`ensureConfigDir`(122)，以及 `CONFIG_FILE`/`SECRETS_FILE`/`DB_FILE` 常量。

**`electron/main/dateUtils.ts`**（约 70 行）
`toLocalDateString`(672)、`shiftDateString`(861)、`nextDateString`(870)、`parseLocalDateTimeMs`(879)、`normalizeDateTimeValue`(893)、`formatDateTimeForDisplay`(900)、`formatDateTimeForGit`(904)。

**`electron/main/windows.ts`**（约 110 行）
`mainWindow` 模块状态与新增访问器 `getMainWindow()`、`createMainWindow()`（现 `createWindow`(1999)）、`getWindowIconPath`(75)、`getWindowOptionsIcon`(102)、`toCloneable`(118)，以及新增 `sendToMainWindow(channel, payload)`（封装 null 检查 + `toCloneable` + `webContents.send`，供 autoSync 与 feishuAuth 推送事件复用）。

**`electron/main/config.ts`**（约 220 行）
`DEFAULT_CONFIG`(41)、`pickSensitiveConfig`(126)、`hasSensitiveConfig`(136)、`stripSensitiveConfig`(141)、`mergeSensitiveConfig`(153)、`loadSensitiveConfig`(165)、`saveSensitiveConfig`(176)、`normalizeConfig`(188) 及 normalize 系列(212-278)、`loadConfig`(280)、`saveConfig`(291，见下方"解耦点")。

**`electron/main/database.ts`**（约 320 行）
`getDatabase`(309)、`persistDatabase`(368)、`parseJsonArray`(374)、`ensureDailyReportTimeRangeColumns`(384)、行映射函数(391-453)、`getDailyReportById`(455)、`saveDailyReport`(466)、`listDailyReports`(537)、`listSyncLogs`(552)、`listErrorLogs`(567)、`countTableRows`(582)、`getFileSize`(588)、`getStorageInfo`(596)、`recordGeneratedReport`(617)、`recordSyncLog`(633)、`recordErrorLog`(659)、`countRawInputFiles`(184)、`sqlDatabase` 模块状态。

**`electron/main/repoScan.ts`**（约 50 行）
`IGNORED_DIRS`(57)、`hasGitMetadata`(823)、`scanRepositories`(832)。

**`electron/main/gitCollect.ts`**（约 90 行）
`collectGitData`(936)、`normalizeAuthorName`(992)、`filterCommitsByReporter`(996)、`formatCollectedGitData`(1002)。

**`electron/main/aiClient.ts`**（约 170 行）
`normalizeAiBaseUrl`(1016)、`getChatCompletionsUrl`(1020)、`getModelsUrl`(1025)、`parseAiError`(1030)、`isUnsupportedModelError`(1046)、`fetchAvailableModels`(1051)、`buildAiErrorMessage`(1068)、`callAiReport`(1080)。

**`electron/main/report.ts`**（约 160 行）
`normalizeReportTimeRange`(914)、`formatNumbered`(1156)、`fallbackReport`(1160)、`generateReport`(1202)。依赖 gitCollect + aiClient + database + config。

**`electron/main/autoSync.ts`**（约 340 行）
`getScheduledDate`(679)、`buildAutoSyncTaskKey`(685)、`buildAutoSyncReportWindow`(703)、`getNextAutoSyncRunDate`(722)、`getAutoSyncState`(740)、`emitAutoSyncState`(749)、`clearAutoSyncTimer`(754)、`scheduleAutoSync`(760)、`refreshAutoSyncSchedule`(773)、`updateAutoSyncStatus`(777)、`buildAutoSyncRunResult`(801)、`validateAutoSyncConfig`(1541)、`validateAutoSync`(1563)、`runAutoSync`(1924)、`autoSyncTimer`/`autoSyncRunning` 模块状态。

**`electron/main/feishuAuth.ts`**（约 240 行）
`FEISHU_PARTITION`/`FEISHU_LOGIN_HOME_URL`/`FEISHU_SHARE_SUBMIT_PATH` 常量、`getFeishuRequestContext`(1356)、`getFeishuFormPageUrl`(1364)、`extractFeishuShareToken`(1371)、`getFeishuShareToken`(1390)、`getCurrentFeishuWindowShareToken`(1394)、`getCurrentFeishuWindowOrigin`(1399)、`inferFeishuSubmitEndpoint`(1409)、`getFeishuLoginTargetUrl`(1413)、`getFeishuCookieHeader`(1436)、`getCookieValue`(1443)、`getFeishuCsrfToken`(1458)、`readFeishuAuthSnapshot`(1462)、`shouldEmitFeishuAuthSnapshot`(1486)、`emitFeishuAuthSnapshot`(1490)、`scheduleFeishuAuthSync`(1499)、`watchFeishuAuthSession`(1513)、`resolveFeishuAuth`(1524)、`openFeishuLogin`(1754)、`feishuWindow`/`feishuAuthSyncTimer`/`removeFeishuAuthSessionWatcher`/`lastFeishuAuthSignature` 模块状态，并新增导出 `disposeFeishuAuthWatchers()` 供入口 `before-quit` 调用（替代入口直接操作这些内部状态）。

**`electron/main/feishuForm.ts`**（约 410 行）
`requireFeishuConfigValue`(1270)、`dateToFeishuDateValue`(1278)、`extractReportSection`(1286)、`buildFeishuFormData`(1302)、`getFeishuContentMetaUrl`(1426)、`parseFeishuSnapshot`(1572)、`getFeishuFieldTypeLabel`(1594)、`parseFeishuFieldOptions`(1606)、`parseFeishuProjectOptions`(1625)、`fetchFeishuContentMeta`(1641)、`listFeishuFieldOptions`(1684)、`listFeishuProjectOptions`(1693)、`buildFeishuTestFormData`(1703)、`testSubmitFeishuForm`(1799)、`syncFeishuDaily`(1856)。

**`electron/main/ipc.ts`**（约 70 行）
新函数 `registerIpcHandlers()`，集中现 2028-2053 行的全部 `ipcMain.handle` 注册。`dialog:select-directory` 处理器通过 `getMainWindow()` 取窗口。

### 依赖规则（单向无环）

```text
paths / dateUtils / windows          ← 底层，不依赖任何领域模块
config      → paths
database    → paths
repoScan    → (无)
gitCollect  → dateUtils
aiClient    → (无)
report      → config, database, gitCollect, aiClient, dateUtils
feishuAuth  → windows
feishuForm  → feishuAuth, database
autoSync    → config, report, feishuForm, windows, dateUtils
ipc         → 以上全部
main.ts 入口 → windows, ipc, autoSync, feishuAuth
```

共享类型与默认值统一从 `../../src/shared/types.js` / `edition.js` 导入（沿用现有"相对路径 + `.js` 扩展名"惯例）。

### 唯一解耦点：saveConfig 与调度器

现状：`saveConfig(config, { reschedule, notify })` 在持久化后内部调用 `scheduleAutoSync` / `emitAutoSyncState`，形成 config → autoSync 的反向依赖（autoSync 的 `updateAutoSyncStatus` 又调用 `saveConfig`，构成环）。

解法：`config.ts` 的 `saveConfig` 退化为**纯持久化**（写 config.json + secrets.json，保留 safeStorage 抛错语义）。"保存后重排调度 + 推送状态"上移到调用方：

- `autoSync.ts` 新增并导出 `saveConfigAndReschedule(config)`（持久化 → `scheduleAutoSync` → `emitAutoSyncState`），供 `ipc.ts` 的 `app:save-config` 使用，与现 `saveConfig` 默认行为逐项等价；注意现 `saveConfig` **返回 `normalizeConfig` 后的配置**且 IPC 处理器将其回传渲染层，包装函数必须保持相同返回值；
- `autoSync.ts` 内部的 `updateAutoSyncStatus` 改调纯 `saveConfig`，自行按现有逻辑决定是否 reschedule/notify（与现 `{ reschedule: false, notify: ... }` 调用点逐项等价）;
- `auto-sync:run-now` 处理器现调 `saveConfig(config, { reschedule: false })`，改为纯 `saveConfig(config)` 后跟 `runAutoSync('manual')`，行为等价。

实施时须先枚举 `saveConfig` 的**全部**调用点及其 options 组合，逐点映射到新形态，任何一点无法等价映射则停下重新评估。

## 第二部分：渲染层拆分

### 门面模式

`useAssistant.ts` 保留为门面：模块级单例机制（`instance` + `useAssistant()`）不变，`createAssistant()` 改为按序组装领域工厂并把结果 spread 进**逐 key 相同**的返回对象。新增 `src/renderer/src/composables/assistant/` 目录：

| 文件 | 内容（现 useAssistant.ts 行号） |
| --- | --- |
| `dateUtils.ts` | `formatLocalDate`(24)、`shiftLocalDate`(31)、`buildDateTime`(36)、`formatDateTime`(426) |
| `normalizers.ts` | `toPlainString`(93)、`normalizeOptions`(97)、`normalizeWorkspaceDirs`(101)、`normalizeRepoSelections`(105)、`normalizeWorkHours`(113)、`normalizeProjectWorkHours`(119)、`normalizeTimeValue`(128)、`normalizeAutoSyncTimeWindowMode`(152)、`mergeCurrentOption`(156) |
| `configState.ts` | `config` reactive、`savedConfigSignature`、`advancedConfigPanels`、选项 computed（`reporterOptions`/`aiBaseUrlOptions`/`aiModelOptions`）、`isConfigDirty`、`getConfigPayload`(232)、`getEditableConfigSignature`(293)、`markConfigSaved`(320)、`persistConfig`(326)、`persistConfigBeforeAction`(332)、`saveSettings`(600)、AI 选项 remember/remove 四函数(617-638) |
| `repoState.ts` | `repos`、`selectedRepoPaths`、`getRepoKey`(162)、`getWorkspaceDirs`(166)、`mergeRepos`(172)、`filterIgnoredRepos`(180)、`sortReposForDisplay`(185)、`scanWorkspaceDirs`(197)、`chooseWorkspace`(548)、`refreshRepos`(576)、`saveRepoSelection`(855)、`toggleRepo`(863)、`isRepoPinned`(873)、`toggleRepoPin`(877)、`removeRepo`(895)、`sortedRepos`/`selectedRepos` computed |
| `localDataState.ts` | `dailyReports`、`syncLogs`、`errorLogs`、`storageInfo`、`refreshDailyReports`(388)、`refreshLocalData`(392) |
| `feishuState.ts` | `feishuLoading`/`fieldLoading`/`projectLoading`、`projectOptions`、`feishuFieldOptions`、`applyFeishuAuthSnapshot`(341)、`loginFeishu`(639)、`loadFeishuFields`(653)、`loadFeishuProjects`(669)、`selectFeishuProject`(694)、`updateProjectWorkHours`(701)、`testSubmitFeishu`(712) |
| `autoSyncState.ts` | `autoSyncLoading`、`autoSyncState`、`applyAutoSyncState`(405)、`refreshAutoSyncState`(422)、`validateAutoSyncBeforeSave`(479)、`runAutoSyncNow`(821)、`autoSyncRunning`/`autoSyncStatusType`/`autoSyncStatusLabel` computed |
| `reportState.ts` | `loading`/`pushing`、`report`、`currentReportId`、`lastReportResult`、`status`、`form` reactive、`countResultFiles`(383)、`applyFullDayReportRange`(438)、`applyReportTimeRange`(444)、`getReportRangePayload`(454)、`getCurrentReportTimeRange`(464)、`generate`(746)、`generateAndPush`(787)、`push`(793)、`saveCurrentReport`(913) |

门面自身保留：`today` 常量、`init`(942)、`dispose`(953)、跨域编排函数 `loadConfig`(487)（它同时回填 config/repos/autoSync/form，属于组装层职责，且不在返回对象中）。

### 共享状态传递

不引入 Pinia、不用全局事件、不用 provide/inject。每个工厂形如 `createXxxState(ctx)`，`ctx` 是显式参数，只含它实际需要的先建切片（refs、reactive 对象、函数引用）。组装顺序：

```text
configState → repoState → localDataState → feishuState → autoSyncState → reportState
```

若实施中发现该顺序存在反向需求（如 configState 需要 report 的东西），以"函数引用后注入"（工厂暴露 setter）或把该函数上移门面解决，禁止工厂间相互 import 产生环。

## 第三部分：验证策略与实施方式

### 验证（无测试框架，三层保障）

1. **每迁移一个模块跑一次 `npm run typecheck`**，通过才提交。TypeScript strict 模式下，"纯搬家"重构的绝大多数错误（漏导出、循环引用、签名漂移）都会在此暴露。
2. 主进程拆完、渲染层拆完两个里程碑各跑 `npm run build`。
3. 收尾跑 `npm run dev` 冒烟：应用启动、欢迎页/主界面渲染、四个视图切换、配置表单回显、历史列表加载。（注意 Windows 上 5174 端口保留区问题，见 CLAUDE.md。）
4. 结构性自检：`git diff` 确认 preload.ts、env.d.ts、types.ts、views/、components/ 零改动。

### 实施顺序（每步一个 commit）

主进程自底向上：paths → dateUtils → windows → config → database → repoScan → gitCollect → aiClient → report → feishuAuth → feishuForm → autoSync（含 saveConfig 解耦）→ ipc → 入口瘦身。
渲染层：dateUtils/normalizers → configState → repoState → localDataState → feishuState → autoSyncState → reportState → 门面收尾。
最后：更新 CLAUDE.md 架构章节（main.ts"~2000 行无子模块"、useAssistant"单文件"的描述），提交。

### 分支与工作区

在独立 worktree 分支上实施（基于当前 `feature/simple-version` 的 HEAD）。**注意**：工作区存在未提交的 CLAUDE.md 本地修改，不属于本次重构，任何重构 commit 都不得包含它；重构分支对 CLAUDE.md 架构章节的更新在合并时可能与之冲突，需用户自行合并。

## 明确不做（Out of Scope）

- WelcomeGate.vue 拆分
- 引入 Vitest/ESLint/Prettier/Pinia
- 修复审计报告中的已知缺陷（safeStorage 降级丢失、简洁版草稿保存等）
- IPC 通道重命名或契约类型自动化
- 任何用户可感知的行为、文案、样式变化
