# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GitInsight AI (中文界面 "AI日报助手") is an Electron desktop app that scans local Git repositories, summarizes a time range of commits into a Chinese work report via an OpenAI-compatible chat API, and syncs it to a Feishu daily report form — manually or on a daily auto-sync schedule. Report/sync/error history is persisted locally in SQLite. Around that core it also ships a "时间长河" annual engineering-timeline view and a 甲币 check-in/reward-effect system. Stack: Electron + Vue 3 (`<script setup>`) + Vue Router + Element Plus + TypeScript, bundled with electron-vite.

The app ships as one product, **码迹 AI**, with one package per platform. `electron-builder.config.cjs` owns the display name and installer identity. Preserve `package.name = gitinsight-ai` (no productName in package metadata), appId `com.shuzhi.gitinsight-ai`, and the existing `standard` updater channel. The channel is a stable machine identifier, not an edition selector. Old Lite installations require backup, uninstall while retaining data, then manual installation; see [release workflow](docs/release-workflow.md).

## Commands

```bash
npm run dev        # electron-vite dev with HMR (renderer served at 127.0.0.1:15174, strictPort)
npm run build      # bundle main + preload + renderer into out/
npm start          # electron . — runs the already-built out/main/main.js (run build first)
npm run typecheck  # vue-tsc --noEmit (the only static check; there is no ESLint/Prettier)
npm run check      # typecheck + build
npm test           # all unit and source-level regression suites
```

Tests in [tests/](tests/) use Node's built-in `node:test` runner and source-level smoke scripts. Per-suite npm scripts either compile TypeScript into test output directories or run `.mjs`/`.cjs` tests directly; see `package.json` for the current suite list. To run one suite, use its `test:<name>` script, such as `test:auto-sync`, `test:material`, or `test:reliability`. Add new unit suites to the `test` script. Browser flows run separately with `npm run test:e2e` (Playwright), and `npm run test:desktop` builds the app and runs the isolated Electron smoke test. [tests/ui-shell.smoke.mjs](tests/ui-shell.smoke.mjs) asserts on renderer source text and is not wired into an npm script.

`npm run dev` requires TCP port **15174** to be free (`strictPort: true`). If Windows reports `listen EACCES`, check `netsh interface ipv4 show excludedportrange protocol=tcp` and choose a port outside the excluded ranges in `electron.vite.config.ts`.

### Packaging & release

`npm run dist:<win|mac|linux>` (or `npm run dist -- --win`) runs [scripts/dist.mjs](scripts/dist.mjs), which builds then invokes electron-builder; artifacts land in `release/<version>/`. Develop on `dev`; [checks.yml](.github/workflows/checks.yml) verifies `dev` pushes and PRs targeting `dev` or `main`. GitHub Actions ([release.yml](.github/workflows/release.yml)) runs on `main` pushes or manual dispatch on `main`; other manual refs skip all jobs. After verification, a current `main` push increments the patch version, commits and tags it, builds all three platforms, then publishes the completed GitHub Release. Manual dispatch builds artifacts without creating a version commit, tag, or Release. After preparing the version commit, the independent `sync-dev` job cherry-picks that exact SHA onto the latest `origin/dev` and pushes normally. Conflicts/protection/concurrent pushes fail visibly without blocking packaging; rerun failed jobs after resolving conflicts. Empty retries are dropped. The bot push does not trigger another checks run. Other branch pushes trigger neither workflow. sql.js's wasm is `asarUnpack`ed — keep `node_modules/sql.js/**` in the builder `files` list.

## Architecture

The integrated navigation includes dashboard, repository management, multi-task sync with calendar, messages, and help alongside the current daily/weekly/reflection/timeline/update pages. `ProjectReportDraft.sourceRepos` identifies combined reports; generation, save, and publication still use `projectReportActions.ts`. Historical combined reports remain one draft with their original inputs and counts.

Project/product manager reports use `MaterialReportsView.vue` and `useMaterialReports.ts`, with `electron/main/materialReport.ts` for material storage and AI generation. Existing `role_materials` data remains keyed by role/date; outputs use `daily_reports.raw_input_json` for material identity. The material editor shares the current save/publication/backup paths. `daily_reports.status` is generation state; successful publication is derived from `sync_logs`, never inferred from generation success.

Three Electron processes, each a separate bundle target in `electron.vite.config.ts`:

- **Main** — [electron/main.ts](electron/main.ts) is a thin lifecycle entry. Domain logic lives in [electron/main/](electron/main/): windows, config+secrets persistence, sql.js database, repo scanning, Git collection, AI report generation, Feishu auth/form submission, auto-sync scheduling, and IPC registration.
- **Preload** — [electron/preload.ts](electron/preload.ts): `contextBridge` exposes a narrow, typed `window.api` (contextIsolation on, nodeIntegration off). The renderer has **no** direct Node access.
- **Renderer** — [src/renderer/src/App.vue](src/renderer/src/App.vue) is a layout shell (sidebar + topbar + active view) plus a first-launch `WelcomeGate` animation. Navigation uses vue-router with hash history ([src/renderer/src/router.ts](src/renderer/src/router.ts)); routes carry navigation state, and `App.vue` maps each `navKeys` entry to its view in `src/renderer/src/views/`. This covers the integrated pages above plus configuration, history, settings, and About; `config` and `ai` share `ReportConfigView`. The router persists the last route in localStorage. Shared application state uses the module-level [useAssistant.ts](src/renderer/src/composables/useAssistant.ts) facade, with state/actions split by domain under [composables/assistant/](src/renderer/src/composables/assistant/) and dedicated composables for individual features. No store library.

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
- Shared renderer styles enter through [src/renderer/src/styles/index.scss](src/renderer/src/styles/index.scss), imported by `src/renderer/src/main.ts`. Its SCSS modules define CSS-variable design tokens, shared layouts, and Element Plus theme overrides (light/dark via the root theme attribute and `dark` class); views and components also use local `<style scoped>` blocks where needed.
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
