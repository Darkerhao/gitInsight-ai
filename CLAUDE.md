# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GitInsight AI (中文界面 "AI日报助手") is an Electron desktop app that scans local Git repositories, summarizes a day's commits into a Chinese work report via an OpenAI-compatible chat API, and syncs it to a Feishu daily report form. Stack: Electron + Vue 3 (`<script setup>`) + Element Plus + TypeScript, bundled with electron-vite.

## Commands

```bash
npm run dev        # electron-vite dev with HMR (renderer served at 127.0.0.1:5174, strictPort)
npm run build      # bundle main + preload + renderer into out/
npm start          # electron . — runs the already-built out/main/main.js (run build first)
npm run preview    # electron-vite preview
npm run typecheck  # vue-tsc --noEmit (the only static check; there is no ESLint/Prettier)
```

There is **no test framework** configured — no `test` script, no test runner. Do not assume one exists.

`npm run dev` requires TCP port **5174** to be free (`strictPort: true`). On Windows this commonly fails with `listen EACCES ... 127.0.0.1:5174` when the port is in an excluded/reserved range (see `dev.stderr.log`); change the port in `electron.vite.config.ts` if so.

## Architecture

Three Electron processes, each a separate bundle target in `electron.vite.config.ts`:

- **Main** — [electron/main.ts](electron/main.ts): all Node/filesystem/Git/network work lives here. Owns the window and every IPC handler.
- **Preload** — [electron/preload.ts](electron/preload.ts): `contextBridge` exposes a narrow, typed `window.api` (contextIsolation is on, nodeIntegration off). The renderer has **no** direct Node access.
- **Renderer** — [src/renderer/src/App.vue](src/renderer/src/App.vue): the entire UI is one Vue component. No router, no store, no component library beyond Element Plus.

### IPC is the only main↔renderer contract

To add or change a feature that crosses the process boundary, edit **four** places in lockstep, or types and runtime drift silently:

1. `ipcMain.handle('channel', ...)` in [electron/main.ts](electron/main.ts) (registered inside `app.whenReady()`).
2. The matching `ipcRenderer.invoke('channel', ...)` wrapper in [electron/preload.ts](electron/preload.ts).
3. The `window.api` method signature in [src/renderer/src/env.d.ts](src/renderer/src/env.d.ts).
4. Any shared payload/return shapes in [src/shared/types.ts](src/shared/types.ts).

Current channels: `app:load-config`, `app:save-config`, `dialog:select-directory`, `repo:scan`, `report:generate`, `feishu:login`, `feishu:list-projects`, `feishu:test-submit`, `report:sync-feishu`.

### Report generation pipeline (the core domain logic, all in main.ts)

`generateReport` → for each selected repo `collectGitData(repoPath, date)`:
- Runs `git log` for the single day (`--since`/`--until` span midnight-to-midnight, `--no-merges`) with a `__COMMIT__` marker + `%x09` tab format that is parsed line-by-line into `CommitEntry[]`.
- Runs `git show --stat` per commit; each diff is truncated to 4000 chars, the combined diff to 12000 chars (LLM context budgeting — preserve these caps when editing).
- Builds a fixed Chinese prompt and calls `callAiReport` against the OpenAI-compatible `/chat/completions` endpoint.

Resilience: if `config.aiApiKey` is empty, or the AI call throws, `generateReport` returns a locally-templated `fallbackReport` instead and appends an `AI提示：...` note — it never rejects to the UI. When changing report logic, keep both the AI path and the fallback path working.

`aiBaseUrl` is normalized so the user may enter either a base like `https://api.openai.com/v1` (→ `/chat/completions`, `/models` are appended) or a full `.../chat/completions` URL. On a 404 "unsupported model" error, it queries `/models` to suggest alternatives.

### Config persistence

`AppConfig` (workspace dir, reporter name, AI base URL / key / model, Feishu form config) is stored as `config.json` in Electron's `app.getPath('userData')` — **not** in the repo. `loadConfig` always spreads over `DEFAULT_CONFIG`, so adding a field there makes it backward-compatible automatically.

### Repo scanning

`scanRepositories` does an iterative DFS from the workspace dir, treats any directory containing `.git` as a repo (and stops descending into it), and skips `IGNORED_DIRS` (`node_modules`, `.git`, `dist`, `out`, …) and dotfolders.

## Conventions

- Path aliases (`electron.vite.config.ts` + `tsconfig.json`): `@` → `src/renderer/src`, `@shared` → `src/shared`. The renderer imports shared types as `@shared/types`; main/preload use relative `../src/shared/types.js` (note the `.js` extension required by the bundler config).
- Renderer styling is global in [src/renderer/src/style.css](src/renderer/src/style.css); `App.vue` has no scoped `<style>`.
- The preload file is resolved at runtime in `createWindow()` with a fallback (`../preload/index.js` then `../preload/preload.cjs`) because dev and production emit different preload filenames.
- User-facing strings, prompts, and the generated report are all in Chinese — match that when touching UI or AI-prompt text.
