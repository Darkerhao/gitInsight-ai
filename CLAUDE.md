# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GitInsight AI (中文界面 "AI日报助手") is an Electron desktop app that scans local Git repositories, summarizes a time range of commits into a Chinese work report via an OpenAI-compatible chat API, and syncs it to a Feishu daily report form — manually or on a daily auto-sync schedule. Report/sync/error history is persisted locally in SQLite. Stack: Electron + Vue 3 (`<script setup>`) + Vue Router + Element Plus + TypeScript, bundled with electron-vite.

The app ships as two **editions**, Lite (简洁版) and Standard (标准版). Editions are resolved at build time from the `APP_EDITION` env var (`electron.vite.config.ts` turns it into `__APP_EDITION__`/`__APP_EDITION_LABEL__`/`__APP_PRODUCT_NAME__` defines, read by [src/shared/edition.ts](src/shared/edition.ts); `electron-builder.config.cjs` picks appId/productName/output dir from it). Currently the editions differ **only in branding and packaging** — there is no feature gating in code.

## Commands

```bash
npm run dev        # electron-vite dev with HMR (renderer served at 127.0.0.1:5174, strictPort)
npm run build      # bundle main + preload + renderer into out/
npm start          # electron . — runs the already-built out/main/main.js (run build first)
npm run typecheck  # vue-tsc --noEmit (the only static check; there is no ESLint/Prettier)
npm run check      # typecheck + build
```

There is **no test framework** configured — no `test` script, no test runner. Do not assume one exists.

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

Invoke channels: `app:load-config`, `app:save-config`, `dialog:select-directory`, `repo:scan`, `report:generate`, `daily-report:list`, `daily-report:save`, `sync-log:list`, `error-log:list`, `storage:info`, `feishu:login`, `feishu:list-fields`, `feishu:list-projects`, `feishu:test-submit`, `report:sync-feishu`, `auto-sync:get-state`, `auto-sync:validate`, `auto-sync:run-now`.

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

A `setTimeout`-based daily scheduler in [electron/main/autoSync.ts](electron/main/autoSync.ts) (`scheduleAutoSync`), re-armed on config save, app start, and `powerMonitor` resume. Idempotency across restarts is enforced with run keys (`lastRunKey`/`lastScheduledRunKey`/`lastSuccessKey` in `AutoSyncConfig`, derived from date + config fingerprint). A run generates the report for the configured time window (`full-day` or `yesterday-start-to-run`) and submits to Feishu, recording sync/error logs and emitting `auto-sync:updated`.

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
