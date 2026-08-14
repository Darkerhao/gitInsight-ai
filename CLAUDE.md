# VibeCoding Athena v9.9.6 — PACE Router & State Harness

INTJ 风格工程 Agent。CC 做事, Athena 把关。主 agent 对结果负责; 写入按红黄绿区; 大功能 worktree 隔离。

- 收任务 → PACE stage 路由 (4 核心 plan/impl/review/ship + 5 条件 brainstorm/roadmap/design/runtime-verify/polish); 每轮面包屑提示当前 stage 义务, 全景按需 Read pace skill
- 同一路径工具失败三次后附 stderr 与已试方案, 再报告阻塞
- 输出结果优先, 使用完成理解所需的最少结构; 保持自然、清晰, 不暴露私有推理过程

## 铁律 (9 条)

1. **门禁即律法** — 设计先行·TDD red→green·tasks 全绿 (Sisyphus)·Review 三件套·runtime-verify→review→polish·architecture/ 更新, 全由 spec-gate (impl-entry+ship) 与 delivery-gate fail-closed 强制, 违者 block; 义务细节看面包屑与 stages.md, 宪法不复述; Hotfix 唯一免审议
2. **零写入·按区路由** — 绿区 (≤3 文件且合计≤150行, 或 Hotfix/Quick/Bugfix): 主 agent 直做; 黄区 (单模块 Feature): Agent subagent; 红区 (Refactor/System 或 ≥2 并行写者): subagent + 原生 `isolation: worktree` 强制; 改动对象在 repo 外 (安装态 harness 等) worktree 无隔离效果 → 免 worktree, 设 `_index.harness_target_outside_repo: true` + 逐文件备份
3. **分诊先行** — 路由前检查状态与变更面, 比较候选路径, 结论记 `_index.route_history` 一行 (复杂 re-route 才单立 route-note); 不落盘私有思维链; 写不出验收标准=模糊→brainstorm; ≥2 个可独立验收交付的切片→roadmap (模块数只定风险等级, 不单独强制拆); re-route 只升不降, 降级仅限用户显式批准
4. **文档即真相·索引先行** — .ai_state/ 单一真相源, 唯一入口 `_index.md`; 决策前读索引, 禁 glob 全扫; 状态同步只在 ship 前做一次 (不逐 stage 同步 — 逐段同步实测产出的是文档不是状态)
5. **证据与出处** — 完成度由 delivery-gate 现场核验, 不在对话里复述验证过程; API/配置/协议必引官方文档或源码 URL
6. **复利颗粒化** — `compound/{date}-{type}-{slug}.md`, type ∈ learning/trick/decision/explore, ≤100 行一事一档
7. **反过度工程** — 禁过度设计与过度防御: 无第二消费者不抽象; 无现实需求不加配置项/参数/扩展点; 防御只设信任边界 (用户输入/外部 IO/跨进程/权限面), 边界内 fail-fast — 禁吞异常/静默降级/blanket try-catch; 判据: 删掉后测试仍全绿且无真实调用方=删; harness 门禁与防御纵深除外 (约束对象: 产出代码与新增机制)
8. **Hook 是进化器** — 门禁 block 或用户纠偏时写 proposals.md; 不逐 Stop 反思 (产出优先于记账)
9. **四原语** — Workflow 统领 (PACE; 超大规模切片用 CC 当前可用机制; 长任务 /goal 承载 Sisyphus), SubAgent 执行 (谁做·红黄绿区), Skill 赋能 (做什么/知识·热路径精简 + references/ 下沉), MCP 连接 (够得着外部·产出落 .ai_state 才算数, 不承载流程/门禁)。CC/CX 只对齐语义, 不伪造对称工具; 引用铁律用 `铁律[名称]` 不用编号

设计原则: 第一性原理·先WHY后HOW

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GitInsight AI (中文界面 "AI日报助手") is an Electron desktop app that scans local Git repositories, summarizes a time range of commits into a Chinese work report via an OpenAI-compatible chat API, and syncs it to a Feishu daily report form — manually or on a daily auto-sync schedule. Report/sync/error history is persisted locally in SQLite. Around that core it also ships a "时间长河" annual engineering-timeline view and a 甲币 check-in/reward-effect system. Stack: Electron + Vue 3 (`<script setup>`) + Vue Router + Element Plus + TypeScript, bundled with electron-vite.

The app ships as two **editions**, Lite (简洁版) and Standard (标准版). Editions are resolved at build time from the `APP_EDITION` env var (`electron.vite.config.ts` turns it into `__APP_EDITION__`/`__APP_EDITION_LABEL__`/`__APP_PRODUCT_NAME__` defines, read by [src/shared/edition.ts](src/shared/edition.ts); `electron-builder.config.cjs` picks appId/productName/output dir from it). Currently the editions differ **only in branding and packaging** — there is no feature gating in code.

## Commands

```bash
npm run dev        # electron-vite dev with HMR (renderer served at 127.0.0.1:5174, strictPort)
npm run build      # bundle main + preload + renderer into out/
npm start          # electron . — runs the already-built out/main/main.js (run build first)
npm run typecheck  # vue-tsc --noEmit (the only static check; there is no ESLint/Prettier)
npm run check      # typecheck + build
npm test           # all four unit suites
```

Tests are hand-rolled `node:test` suites in [tests/](tests/), run one at a time via per-suite scripts — there is **no** test runner (no vitest/jest) and no watch mode. Each script `tsc`-compiles just the files under test into a throwaway `.<name>-test-dist/` dir, runs `node --test`, then deletes the dir. To run a single suite: `npm run test:timeline`, `npm run test:repo-names`, `npm run test:ai-client`, or `npm run test:auto-sync`. Adding a suite means adding a matching `test:<name>` script with its own explicit file list and appending it to `test`. The auto-sync suite covers the pure migration, key, window, work-hour, and scheduling helpers in `electron/main/autoSyncCore.ts`; anything touching Electron APIs can't be tested this way. [tests/ui-shell.smoke.mjs](tests/ui-shell.smoke.mjs) asserts on renderer source text (regex over `.vue`/`.scss` files) and is **not** wired into any npm script.

`npm run dev` requires TCP port **5174** to be free (`strictPort: true`). On Windows this commonly fails with `listen EACCES ... 127.0.0.1:5174` when the port is in an excluded/reserved range (see `dev.stderr.log`); change the port in `electron.vite.config.ts` if so.

### Packaging & release

`npm run dist:<win|mac|linux>:<lite|standard>` (or `npm run dist -- --edition lite --win`) runs [scripts/dist-edition.mjs](scripts/dist-edition.mjs), which builds then invokes electron-builder with `APP_EDITION` set; artifacts land in `release/<version>/<edition>/`. `npm run release:tag` tags `v<package.json version>` (refuses on dirty tree or existing tag) and pushes it; GitHub Actions (`.github/workflows/release.yml`) then builds both editions as Release assets. sql.js's wasm is `asarUnpack`ed — keep `node_modules/sql.js/**` in the builder `files` list.

## Architecture

Three Electron processes, each a separate bundle target in `electron.vite.config.ts`:

- **Main** — [electron/main.ts](electron/main.ts) is a thin lifecycle entry. Domain logic lives in [electron/main/](electron/main/): windows, config+secrets persistence, sql.js database, repo scanning, Git collection, AI report generation, Feishu auth/form submission, auto-sync scheduling, and IPC registration.
- **Preload** — [electron/preload.ts](electron/preload.ts): `contextBridge` exposes a narrow, typed `window.api` (contextIsolation on, nodeIntegration off). The renderer has **no** direct Node access.
- **Renderer** — [src/renderer/src/App.vue](src/renderer/src/App.vue) is a layout shell (sidebar + topbar + active view) plus a first-launch `WelcomeGate` animation. Navigation uses vue-router with hash history ([src/renderer/src/router.ts](src/renderer/src/router.ts)), but routes render nothing themselves — the route param is just nav state; `App.vue` maps it to one of four views in `src/renderer/src/views/` (`config`→ReportConfigView, `generate`→ReportGenerateView, `history`→HistoryLogsView, `system`→SystemSettingsView) and persists the last route in localStorage. [src/renderer/src/composables/useAssistant.ts](src/renderer/src/composables/useAssistant.ts) remains the module-level singleton facade; state/actions are split by domain under [src/renderer/src/composables/assistant/](src/renderer/src/composables/assistant/). Views and components consume only `useAssistant()`. No store library.

### IPC is the only main↔renderer contract

To add or change a feature that crosses the process boundary, edit **four** places in lockstep, or types and runtime drift silently:

1. `ipcMain.handle('channel', ...)` in [electron/main/ipc.ts](electron/main/ipc.ts) via `registerIpcHandlers()`.
2. The matching `ipcRenderer.invoke('channel', ...)` wrapper in [electron/preload.ts](electron/preload.ts).
3. The `window.api` method signature in [src/renderer/src/env.d.ts](src/renderer/src/env.d.ts).
4. Any shared payload/return shapes in [src/shared/types.ts](src/shared/types.ts).

Invoke channels: `app:load-config`, `app:save-config`, `dialog:select-directory`, `repo:scan`, `report:generate`, `daily-report:list`, `daily-report:save`, `sync-log:list`, `error-log:list`, `storage:info`, `feishu:login`, `feishu:list-fields`, `feishu:list-projects`, `feishu:test-submit`, `report:sync-feishu`, `auto-sync:get-state`, `auto-sync:validate`, `auto-sync:run-now`. Auto-sync validation and execution accept an optional `taskId`; omitted execution targets all enabled tasks, while a task-specific manual run is allowed even when that task or the global schedule switch is disabled. The pushed `auto-sync:updated` payload includes per-task state plus the global and next-task scheduling fields.

Main also **pushes** two events via `webContents.send` — `auto-sync:updated` (AutoSyncState) and `feishu:auth-updated` (FeishuAuthSnapshot) — exposed in preload as `onAutoSyncUpdated`/`onFeishuAuthUpdated` subscription functions that return an unsubscribe. Pushed payloads must be structured-cloneable (`toCloneable` strips reactivity/functions).

### Report generation pipeline (the core domain logic in electron/main modules)

`generateReport` → normalize the time range (a single day by default; `startDateTime`/`endDateTime` allow custom windows) → for each selected repo `collectGitData(repoPath, timeRange)`:

- `git log` via **simple-git** with a `__COMMIT__` marker + `%x09` tab format parsed line-by-line into `CommitEntry[]`. Filtering is deliberately two-phase: a coarse `--since` at *committer* date (range start minus 2 days, no `--until`), then a precise JS filter on *author* date (`%ad`) against the range — because rebase/merge refreshes committer date while author date keeps the original authoring time. Don't "simplify" this back to `--since`/`--until`.
- Commits are then filtered to those whose git author matches `reporterName` (case-insensitive).
- `git show --stat --summary` per commit; each capped at 4000 chars, the combined diff at 12000 chars (LLM context budgeting — preserve these caps).
- A fixed Chinese prompt goes to `callAiReport` against the OpenAI-compatible `/chat/completions` endpoint.
- Every generated report is recorded into the local DB (`recordGeneratedReport`), returning a `historyId` the renderer uses for later saves/syncs.

Resilience: if `config.aiApiKey` is empty, or the AI call throws, `generateReport` returns a locally-templated `fallbackReport` instead and appends an `AI提示：...` note — it never rejects to the UI. When changing report logic, keep both the AI path and the fallback path working.

`aiBaseUrl` is normalized so the user may enter either a base like `https://api.openai.com/v1` (→ `/chat/completions`, `/models` appended) or a full `.../chat/completions` URL. On a 404 "unsupported model" error, it queries `/models` to suggest alternatives.

### Persistence (three files in `app.getPath('userData')`, none in the repo)

- **config.json** — `AppConfig` minus secrets. `normalizeConfig` always spreads over defaults, so new fields are backward-compatible automatically.
- **secrets.json** — `aiApiKey` + Feishu `cookie`/`csrfToken`, encrypted with Electron `safeStorage`. These fields are stripped from config.json on save and merged back on load. If OS-level encryption is unavailable, `saveConfig` **throws** rather than writing secrets in plaintext.
- **gitinsight.db** — SQLite via **sql.js** (in-memory, explicitly persisted to disk after writes by `persistDatabase`). Tables: `daily_reports`, `sync_logs`, `error_logs`. Schema is created with `CREATE TABLE IF NOT EXISTS` in `getDatabase()`; column additions are handled by ad-hoc migration helpers (e.g. `ensureDailyReportTimeRangeColumns`). In production the wasm loads from `app.asar.unpacked`.

### Auto-sync scheduler

A single `setTimeout`-based scheduler in [electron/main/autoSync.ts](electron/main/autoSync.ts) (`scheduleAutoSync`) selects the earliest enabled task and is re-armed on config save, app start, and `powerMonitor` resume. `AutoSyncConfig` stores a global `enabled` switch and independent task records; each task owns its repository set, Feishu project, execution time/window, work-hour override, status, and run keys. A scheduled wake runs all tasks currently due in array order, while a manual task run can target one task directly. Idempotency across restarts is enforced with task run keys (`lastRunKey`/`lastScheduledRunKey`/`lastSuccessKey` in `AutoSyncTaskConfig`, derived from date plus shared report configuration and deliberately excluding `task.id`). Each run generates its task's configured report window (`full-day` or `yesterday-start-to-run`) and submits to Feishu, recording sync/error logs and emitting `auto-sync:updated` after every task status change.

### Feishu integration

No official API — it drives the Feishu daily-report **web form**: `feishu:login` opens a dedicated `BrowserWindow` on the `persist:feishu` session partition; cookie changes and navigations trigger `readFeishuAuthSnapshot`, which harvests cookie + CSRF token and pushes `feishu:auth-updated` so the renderer can auto-fill auth config. Submissions POST the form endpoint with field IDs from `FeishuFormConfig` (every required value goes through `requireFeishuConfigValue`, which throws a labeled Chinese error).

### Repo scanning

`scanRepositories` does an iterative DFS from each workspace dir, treats any directory containing `.git` as a repo (and stops descending into it), skipping `IGNORED_DIRS` (`node_modules`, `.git`, `dist`, `out`, …) and dotfolders. Config supports multiple workspace dirs plus pinned/ignored repo lists.

## Conventions

- Path aliases (`electron.vite.config.ts` + `tsconfig.json`): `@` → `src/renderer/src`, `@shared` → `src/shared`. The renderer imports shared code as `@shared/types`; main/preload use relative `../src/shared/types.js` (note the `.js` extension required by the bundler config).
- Renderer styling is global in [src/renderer/src/style.css](src/renderer/src/style.css) (a CSS-variable design-token system + Element Plus theme overrides, light/dark via a root attribute); components use global class names and have **no** scoped `<style>`.
- The preload file is resolved at runtime in `createMainWindow()` with a fallback (`../preload/index.js` then `../preload/preload.cjs`) because dev and production emit different preload filenames.
- User-facing strings, prompts, error messages, and the generated report are all in Chinese — match that when touching UI, errors, or AI-prompt text.
- Design/plan documents live in `docs/` (in Chinese); `task_plan.md`/`findings.md`/`progress.md` at the repo root are working scratch files, not documentation.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `Darkerhao/gitInsight-ai`; external PRs are not treated as a triage request surface. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the default five-label triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain docs layout: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
