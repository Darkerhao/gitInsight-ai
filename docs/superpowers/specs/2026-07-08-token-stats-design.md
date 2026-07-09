# Token 统计功能设计

## 概述

为 gitInsight-ai 新增「Token 统计」功能，包含两大子系统：

1. **代码 Token 扫描** — 扫描本地 Git 项目源文件，用 tiktoken 精确计算每个项目的代码 token 量
2. **AI 消耗追踪** — 通过内嵌反向代理网关拦截 AI 工具（Claude Code、Cursor 等）的 API 请求，记录每次调用的 token 消耗；同时从日报生成的 `callAiReport` 捕获 usage

统计维度：按项目、按模型、按时间趋势、费用估算。

## 架构

```
┌──────────────────────────────────────────────────────┐
│                   Renderer（新页面）                    │
│  TokenStatsView.vue                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ 代码Token面板 │  │ AI消耗面板    │  │ 代理设置面板  │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  │
└──────────────────────┬───────────────────────────────┘
                       │ IPC
┌──────────────────────┴───────────────────────────────┐
│                   Main 进程                           │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ tokenScan.ts     │  │ tokenProxy.ts            │  │
│  │ 扫描项目文件      │  │ 本地反向代理网关           │  │
│  │ tiktoken 计算     │  │ 转发 AI 请求 + 记录 usage │  │
│  └────────┬─────────┘  └────────────┬─────────────┘  │
│           │                         │                 │
│  ┌────────┴─────────────────────────┴─────────────┐  │
│  │ database.ts (token_scan_results + api_usage)   │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

三层分工：
- **Renderer**：TokenStatsView.vue 新独立页面，侧边栏导航项「Token 统计」，路由 `/tokens`
- **Main**：新增 `tokenScan.ts`（代码扫描）和 `tokenProxy.ts`（API 网关）两个模块
- **Database**：新增 `token_scan_results` 和 `api_usage_logs` 两张表

## 数据库表结构

### token_scan_results — 代码 Token 扫描结果

```sql
CREATE TABLE IF NOT EXISTS token_scan_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_path TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  total_files INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  breakdown_json TEXT NOT NULL,   -- {"ts": 12000, "vue": 8000, ...}
  scanned_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_token_scan_repo ON token_scan_results(repo_path);
CREATE INDEX IF NOT EXISTS idx_token_scan_time ON token_scan_results(scanned_at);
```

每次扫描产生一行记录，不覆盖历史，可对比趋势。

### api_usage_logs — AI API 消耗记录

```sql
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,              -- "proxy" | "report"
  project_name TEXT,                 -- 匹配到的项目名（null = 未分类）
  project_path TEXT,
  model TEXT NOT NULL,
  provider TEXT,                     -- 供应商域名
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  request_path TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_usage_project ON api_usage_logs(project_name);
CREATE INDEX IF NOT EXISTS idx_api_usage_model ON api_usage_logs(model);
CREATE INDEX IF NOT EXISTS idx_api_usage_time ON api_usage_logs(created_at);
```

`source = "report"` 来自日报生成，`source = "proxy"` 来自反向代理拦截。

## 模块 1：代码 Token 扫描（tokenScan.ts）

### 依赖

[js-tiktoken](https://www.npmjs.com/package/js-tiktoken)：纯 JS 实现，无 WASM/native 依赖，Electron 打包友好。默认使用 `cl100k_base` 编码。

### 扫描范围

纳入扫描的代码文件扩展名：
`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.vue`, `.svelte`, `.py`, `.go`, `.rs`, `.java`, `.kt`, `.c`, `.cpp`, `.h`, `.css`, `.scss`, `.less`, `.html`, `.json`, `.yaml`, `.yml`, `.toml`, `.md`, `.txt`, `.sql`, `.sh`, `.bat`, `.ps1`

跳过的目录：复用现有 `IGNORED_DIRS`（`node_modules`, `.git`, `dist`, `out`, `build`, `coverage`…）+ 补充 `__pycache__`, `.next`, `.nuxt`, `vendor`, `.venv`, `target`。

单文件上限 1MB，超过跳过。

### 扫描流程

1. 用户选择一个或多个已扫描的 Git 仓库
2. 递归遍历仓库文件，按扩展名过滤
3. 逐文件读取内容，tiktoken 编码计算 token 数
4. 按扩展名分组汇总
5. 写入 `token_scan_results`
6. 通过 IPC 推送进度

### 进度反馈

扫描期间通过 `webContents.send('token-scan:progress', ...)` 推送进度：

```ts
interface TokenScanProgress {
  repoName: string;
  scannedFiles: number;
  totalFiles: number;
  currentTokens: number;
}
```

### IPC 通道

| 通道 | 方向 | 签名 |
|------|------|------|
| `token-scan:run` | invoke | `(repoPaths: string[]) → TokenScanResult[]` |
| `token-scan:list` | invoke | `(limit?: number) → TokenScanRecord[]` |
| `token-scan:progress` | push | `TokenScanProgress` |

## 模块 2：反向代理网关（tokenProxy.ts）

### 工作原理

在 Main 进程中启动 `http.createServer`，AI 工具将 base URL 配为 `http://localhost:PORT/<prefix>/v1`，代理根据路径前缀匹配转发目标，转发请求到真实 API，读取响应中的 `usage` 字段记录到 `api_usage_logs`，再将完整响应原样返回客户端。

### 配置

存放在 `AppConfig` 中：

```ts
interface TokenProxyConfig {
  enabled: boolean;
  port: number;              // 默认 18921
  targets: ProxyTarget[];
}

interface ProxyTarget {
  id: string;
  name: string;              // "OpenAI" / "Anthropic" / "DeepSeek"
  targetBaseUrl: string;     // https://api.openai.com/v1
  apiKey: string;            // 可选，也可让客户端自带
  pathPrefix: string;        // "/openai" → localhost:18921/openai/v1/...
}
```

### 项目自动匹配

从请求体 `messages` 内容中提取文件路径线索，与已扫描的仓库列表匹配：

1. **绝对路径匹配**：请求内容中包含仓库绝对路径片段
2. **仓库名匹配**：请求内容中包含 `<repoName>/` 模式

匹配不上的记录 `project_name = null`，前端归入「未分类」。

### Streaming 支持

- **非 streaming**：等完整响应后提取 `response.usage`
- **Streaming（SSE）**：逐块 pipe 给客户端（零额外延迟），同时解析每个 chunk，从最后一个携带 `usage` 的 chunk 提取 token 数据
- 无 usage 的 streaming 响应标记 `total_tokens = -1`

### 多供应商 usage 兼容

| 供应商 | usage 位置 | 缓存字段 |
|--------|-----------|---------|
| OpenAI | `response.usage` | `usage.prompt_tokens_details.cached_tokens` |
| Anthropic | `response.usage` | `usage.cache_read_input_tokens` |
| DeepSeek | `response.usage` | `usage.prompt_cache_hit_tokens` |

统一提取为 `prompt_tokens / completion_tokens / total_tokens / cached_tokens`。

### 生命周期

- 应用启动：`tokenProxy.enabled === true` 时自动启动
- 运行中可动态启停
- 应用退出时 `server.close()` 清理
- 端口冲突：记录 error_log 并通知前端

### IPC 通道

| 通道 | 方向 | 签名 |
|------|------|------|
| `token-proxy:start` | invoke | `() → { port: number }` |
| `token-proxy:stop` | invoke | `() → void` |
| `token-proxy:status` | invoke | `() → TokenProxyStatus` |
| `api-usage:list` | invoke | `(filter?: UsageFilter) → ApiUsageRecord[]` |
| `api-usage:stats` | invoke | `(filter?: StatsFilter) → UsageStats` |
| `token-proxy:updated` | push | `TokenProxyStatus` |

## 日报生成集成

修改 `callAiReport`（aiClient.ts）：在获取 AI 响应后，提取 `data.usage` 并调用 `recordApiUsage` 写入 `api_usage_logs`（source = "report"）。

`callAiReport` 返回签名不变（仍为 `string`），usage 记录是副作用。

## 前端页面

### 路由

- `navKeys` 新增 `'tokens'`
- 路由匹配模式扩展为 `/:nav(config|generate|history|farm|ai|tokens|system)`
- `viewMap` 新增 `tokens: TokenStatsView`

### TokenStatsView.vue

三个 Tab 面板：

**Tab 1 — 代码 Token**
- 仓库选择器 + 「开始扫描」按钮
- 扫描进度条
- 项目 Token 排行（柱状图 / 列表）
- 文件类型分布饼图
- 扫描历史列表

**Tab 2 — AI 消耗**
- 筛选器：项目、模型、时间范围（当天/本周/本月/自定义）
- 概览卡片：总消耗 tokens、请求数、缓存命中率、估算费用
- 使用趋势折线图（X=时间，Y=tokens 和费用双轴）
- 项目消耗排行表格

**Tab 3 — 代理设置**
- 代理开关 + 端口配置 + 运行状态指示
- 转发规则列表（CRUD）
- 使用说明（告知用户如何配置 AI 工具的 base URL）

### 费用估算

`AppConfig` 中增加 `modelPricing: ModelPricing[]`：

```ts
interface ModelPricing {
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  cachedPer1M?: number;
}
```

预置常见模型默认价格：
- gpt-4o: $2.5 / $10
- gpt-4o-mini: $0.15 / $0.6
- claude-sonnet: $3 / $15
- claude-opus: $15 / $75
- deepseek-chat: $0.27 / $1.1

用户可在代理设置 Tab 中编辑。费用计算公式：`(prompt_tokens × inputPer1M + completion_tokens × outputPer1M) / 1_000_000`

## IPC 变更汇总

新增 invoke 通道（需同步 ipc.ts + preload.ts + env.d.ts）：

| 通道 | 用途 |
|------|------|
| `token-scan:run` | 触发代码扫描 |
| `token-scan:list` | 查询扫描历史 |
| `token-proxy:start` | 启动代理 |
| `token-proxy:stop` | 停止代理 |
| `token-proxy:status` | 查询代理状态 |
| `api-usage:list` | 查询 API 用量列表 |
| `api-usage:stats` | 查询聚合统计 |

新增 push 通道（Main → Renderer）：

| 通道 | 用途 |
|------|------|
| `token-scan:progress` | 扫描进度 |
| `token-proxy:updated` | 代理状态变化 |

## 新增文件

| 文件 | 职责 |
|------|------|
| `electron/main/tokenScan.ts` | 代码 Token 扫描逻辑 |
| `electron/main/tokenProxy.ts` | 反向代理网关 |
| `src/renderer/src/views/TokenStatsView.vue` | Token 统计页面 |
| `src/renderer/src/composables/assistant/tokenStats.ts` | 前端状态管理 |
| `src/shared/types.ts` | 新增类型（追加） |

## 新增依赖

| 包 | 用途 |
|----|------|
| `js-tiktoken` | 代码 Token 精确计算 |

## 不变的

- `callAiReport` 返回签名不变，usage 记录为副作用
- 现有 IPC 通道不受影响
- 现有数据库表不修改
- 代理不改变 AI 请求/响应内容，纯透传
