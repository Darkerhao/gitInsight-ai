# GitInsight AI · AI日报助手

一款 Electron 桌面应用:扫描本地 Git 仓库 → 调用 OpenAI 兼容接口将当天提交汇总成中文工作日报 → 同步到飞书日报表单。

技术栈:Electron + Vue 3(`<script setup>`)+ Element Plus + TypeScript,使用 electron-vite 打包。

> 面向 Claude Code 的英文工作说明见 [CLAUDE.md](CLAUDE.md),本文件与其内容对应。

## 功能

- 选择工作目录,自动递归扫描其中所有 Git 仓库
- 选定仓库与日期,提取当天提交记录、改动文件与代码变更
- 调用 OpenAI 兼容的 `/chat/completions` 接口生成正式中文日报(今日工作 / 工作成果 / 明日计划)
- 未配置密钥或接口失败时,自动降级为本地模板日报,界面不会报错中断
- 一键同步日报到飞书日报表单

## 命令

```bash
npm run dev        # electron-vite 开发模式(热更新);渲染层运行在 127.0.0.1:5174,strictPort
npm run build      # 打包 main + preload + renderer 到 out/
npm start          # electron . —— 运行已构建的 out/main/main.js(需先 build)
npm run preview    # electron-vite preview
npm run typecheck  # vue-tsc --noEmit(唯一的静态检查;没有 ESLint/Prettier)
```

**没有配置测试框架**——没有 `test` 脚本,也没有测试运行器。

`npm run dev` 需要 TCP 端口 **5174** 空闲(`strictPort: true`)。Windows 上若端口处于系统保留/排除区间,会报 `listen EACCES ... 127.0.0.1:5174`(见 `dev.stderr.log`),此时在 `electron.vite.config.ts` 中改端口即可。

## 架构

三个 Electron 进程,在 `electron.vite.config.ts` 中各自是独立的打包目标:

- **主进程(Main)**—— [electron/main.ts](electron/main.ts):所有 Node / 文件系统 / Git / 网络逻辑都在这里,负责窗口与全部 IPC 处理。
- **预加载(Preload)**—— [electron/preload.ts](electron/preload.ts):用 `contextBridge` 暴露一个收窄且带类型的 `window.api`(开启了 contextIsolation,关闭 nodeIntegration)。渲染层**无法**直接访问 Node。
- **渲染层(Renderer)**—— [src/renderer/src/App.vue](src/renderer/src/App.vue):整个界面就是这一个 Vue 组件,无路由、无状态库,UI 组件只用 Element Plus。

### IPC 是主进程与渲染层之间唯一的契约

任何跨进程的功能改动,都要**同步修改四处**,否则类型与运行时会悄悄不一致:

1. [electron/main.ts](electron/main.ts) 里的 `ipcMain.handle('频道名', ...)`(注册在 `app.whenReady()` 内)。
2. [electron/preload.ts](electron/preload.ts) 里对应的 `ipcRenderer.invoke('频道名', ...)` 封装。
3. [src/renderer/src/env.d.ts](src/renderer/src/env.d.ts) 里 `window.api` 的方法签名。
4. [src/shared/types.ts](src/shared/types.ts) 里共享的入参/返回类型。

现有频道:`app:load-config`、`app:save-config`、`dialog:select-directory`、`repo:scan`、`report:generate`、`feishu:login`、`feishu:list-projects`、`feishu:test-submit`、`report:sync-feishu`。

### 日报生成流程(核心业务,全在 main.ts)

`generateReport` → 对每个选中仓库执行 `collectGitData(repoPath, date)`:

- 对当天执行 `git log`(`--since`/`--until` 覆盖当日零点到次日零点,`--no-merges`),用 `__COMMIT__` 标记 + `%x09` 制表符格式,逐行解析为 `CommitEntry[]`。
- 对每个提交执行 `git show --stat`;单个 diff 截断到 4000 字符,合并后的 diff 截断到 12000 字符(给 LLM 留上下文预算——改动时请保留这些上限)。
- 拼接固定的中文 Prompt,调用 OpenAI 兼容的 `/chat/completions` 接口(`callAiReport`)。

容错:当 `config.aiApiKey` 为空、或 AI 调用抛错时,`generateReport` 返回本地模板的 `fallbackReport`,并追加一条 `AI提示:...`,永远不会把异常抛给界面。改日报逻辑时,请保证 **AI 路径和降级路径都能正常工作**。

`aiBaseUrl` 会被规范化:既支持填基础地址(如 `https://api.openai.com/v1`,自动补 `/chat/completions`、`/models`),也支持填完整的 `.../chat/completions`。当遇到 404「不支持的模型」错误时,会查询 `/models` 给出可用模型建议。

### 配置持久化

`AppConfig`(工作目录、汇报人、AI 接口地址/密钥/模型、飞书表单配置)以 `config.json` 存放在 Electron 的 `app.getPath('userData')` 目录里,**不在仓库内**。`loadConfig` 始终在 `DEFAULT_CONFIG` 上展开,所以新增字段天然向后兼容。

### 仓库扫描

`scanRepositories` 从工作目录做迭代式 DFS:把任何含 `.git` 的目录视为一个仓库(并停止深入),跳过 `IGNORED_DIRS`(`node_modules`、`.git`、`dist`、`out` 等)和点开头的目录。

## 约定

- 路径别名(`electron.vite.config.ts` + `tsconfig.json`):`@` → `src/renderer/src`,`@shared` → `src/shared`。渲染层用 `@shared/types` 引入共享类型;主进程/预加载用相对路径 `../src/shared/types.js`(注意打包配置要求带 `.js` 后缀)。
- 渲染层样式集中在全局的 [src/renderer/src/style.css](src/renderer/src/style.css),`App.vue` 没有 scoped `<style>`。
- 预加载文件路径在 `createWindow()` 运行时解析,并带回退(先 `../preload/index.js`,再 `../preload/preload.cjs`),因为开发与生产产出的预加载文件名不同。
- 面向用户的文案、Prompt、生成的日报全部是中文——改 UI 或 AI Prompt 文本时保持一致。
