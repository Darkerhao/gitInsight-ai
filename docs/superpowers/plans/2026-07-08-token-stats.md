# Token 统计功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 gitInsight-ai 新增「Token 统计」功能，包含代码 Token 扫描、AI API 消耗追踪（反向代理网关 + 日报生成记录）、统计展示页面。

**Architecture:** Main 进程新增 `tokenScan.ts`（js-tiktoken 扫描项目代码 token 量）和 `tokenProxy.ts`（HTTP 反向代理网关拦截 AI 请求记录 usage），数据存入 SQLite 两张新表（`token_scan_results` + `api_usage_logs`）。Renderer 新增 `TokenStatsView.vue` 独立页面（三个 Tab），通过 IPC 与 Main 通信。`callAiReport` 同步记录 usage 作为副作用。

**Tech Stack:** Electron + Vue 3 + Element Plus + TypeScript + js-tiktoken + Node.js http.createServer

## Global Constraints

- 用户界面全中文
- 路径别名：`@` → `src/renderer/src`，`@shared` → `src/shared`；main/preload 用相对路径 + `.js` 扩展名
- IPC 变更需同步四处：`ipc.ts`、`preload.ts`、`env.d.ts`、`types.ts`
- 无测试框架，验证方式为 `npm run typecheck` + 手动运行 `npm run dev`
- 组件使用全局 CSS class，不用 scoped style
- `<script setup lang="ts">` + Composition API

## 文件变更总览

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/shared/types.ts` | 修改 | 新增 Token 统计相关类型 |
| `electron/main/tokenScan.ts` | 新建 | 代码 Token 扫描逻辑 |
| `electron/main/tokenProxy.ts` | 新建 | 反向代理网关 |
| `electron/main/tokenUsageDb.ts` | 新建 | Token 统计数据库操作 |
| `electron/main/database.ts` | 修改 | 新增两张表的 DDL |
| `electron/main/aiClient.ts` | 修改 | callAiReport 记录 usage |
| `electron/main/ipc.ts` | 修改 | 注册新 IPC 通道 |
| `electron/main.ts` | 修改 | 启动/停止代理 |
| `electron/preload.ts` | 修改 | 暴露新 API |
| `src/renderer/src/env.d.ts` | 修改 | 新增 window.api 类型 |
| `src/renderer/src/router.ts` | 修改 | 新增 tokens 路由 |
| `src/renderer/src/composables/assistant/tokenStatsState.ts` | 新建 | 前端 Token 统计状态 |
| `src/renderer/src/composables/useAssistant.ts` | 修改 | 接入 tokenStatsState |
| `src/renderer/src/views/TokenStatsView.vue` | 新建 | Token 统计页面 |
| `src/renderer/src/components/AppSidebar.vue` | 修改 | 新增导航项 |
| `src/renderer/src/App.vue` | 修改 | 注册新视图 |

---

### Task 1: 类型定义 + 数据库表

**Files:**
- Modify: `src/shared/types.ts`（追加新类型）
- Modify: `electron/main/database.ts`（新增两张表 DDL）
- Create: `electron/main/tokenUsageDb.ts`（Token 统计数据库操作）

**Interfaces:**
- Produces: `TokenScanRecord`, `ApiUsageRecord`, `TokenProxyConfig`, `ProxyTarget`, `ModelPricing`, `TokenScanProgress`, `TokenProxyStatus`, `UsageFilter`, `UsageStats` 类型供所有后续 Task 使用
- Produces: `recordTokenScan()`, `listTokenScans()`, `recordApiUsage()`, `listApiUsage()`, `getUsageStats()` 函数供 Task 2/3/4 调用

- [ ] **Step 1: 在 `src/shared/types.ts` 末尾追加类型定义**

```ts
// ─── Token 统计 ─────────────────────────────────────

export interface TokenScanRecord {
  id: number;
  repoPath: string;
  repoName: string;
  totalFiles: number;
  totalTokens: number;
  breakdown: Record<string, number>;  // { "ts": 12000, "vue": 8000 }
  scannedAt: string;
}

export interface ApiUsageRecord {
  id: number;
  source: 'proxy' | 'report';
  projectName: string | null;
  projectPath: string | null;
  model: string;
  provider: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  requestPath: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface ProxyTarget {
  id: string;
  name: string;
  targetBaseUrl: string;
  apiKey: string;
  pathPrefix: string;
}

export interface TokenProxyConfig {
  enabled: boolean;
  port: number;
  targets: ProxyTarget[];
}

export const DEFAULT_TOKEN_PROXY_CONFIG: TokenProxyConfig = {
  enabled: false,
  port: 18921,
  targets: [],
};

export interface ModelPricing {
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  cachedPer1M?: number;
}

export const DEFAULT_MODEL_PRICING: ModelPricing[] = [
  { model: 'gpt-4o', inputPer1M: 2.5, outputPer1M: 10 },
  { model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.6 },
  { model: 'claude-sonnet', inputPer1M: 3, outputPer1M: 15 },
  { model: 'claude-opus', inputPer1M: 15, outputPer1M: 75 },
  { model: 'deepseek-chat', inputPer1M: 0.27, outputPer1M: 1.1 },
  { model: 'deepseek-v4-flash', inputPer1M: 0.1, outputPer1M: 0.4 },
];

export interface TokenScanProgress {
  repoName: string;
  scannedFiles: number;
  totalFiles: number;
  currentTokens: number;
}

export interface TokenProxyStatus {
  running: boolean;
  port: number;
  requestCount: number;
}

export interface UsageFilter {
  projectName?: string;
  model?: string;
  startDate?: string;
  endDate?: string;
  source?: 'proxy' | 'report';
  limit?: number;
}

export interface UsageStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  requestCount: number;
  byProject: { projectName: string; totalTokens: number; requestCount: number }[];
  byModel: { model: string; totalTokens: number; requestCount: number }[];
  byDate: { date: string; totalTokens: number; requestCount: number }[];
}
```

- [ ] **Step 2: 在 `src/shared/types.ts` 中扩展 `AppConfig`，新增 `tokenProxy` 和 `modelPricing` 字段**

在 `AppConfig` interface 的 `autoSync: AutoSyncConfig;` 行后追加：

```ts
  tokenProxy: TokenProxyConfig;
  modelPricing: ModelPricing[];
```

- [ ] **Step 3: 在 `electron/main/database.ts` 的 `getDatabase()` 中追加两张表的 DDL**

在 `CREATE INDEX IF NOT EXISTS idx_checkin_coin_transactions_created_at` 之后、闭合的反引号 `` ` `` 之前追加：

```sql
    CREATE TABLE IF NOT EXISTS token_scan_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_path TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      total_files INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      breakdown_json TEXT NOT NULL,
      scanned_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_token_scan_repo ON token_scan_results(repo_path);
    CREATE INDEX IF NOT EXISTS idx_token_scan_time ON token_scan_results(scanned_at);

    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      project_name TEXT,
      project_path TEXT,
      model TEXT NOT NULL,
      provider TEXT,
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

- [ ] **Step 4: 创建 `electron/main/tokenUsageDb.ts`**

```ts
import type { ApiUsageRecord, TokenScanRecord, UsageFilter, UsageStats } from '../../src/shared/types.js';
import { getDatabase, parseJsonArray, persistDatabase } from './database.js';


function parseBreakdownJson(value: unknown): Record<string, number> {
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, val]) => [key, Number(val) || 0])
        .filter(([, val]) => (val as number) > 0),
    );
  } catch {
    return {};
  }
}


function rowToTokenScanRecord(row: Record<string, unknown>): TokenScanRecord {
  return {
    id: Number(row.id) || 0,
    repoPath: String(row.repo_path || ''),
    repoName: String(row.repo_name || ''),
    totalFiles: Number(row.total_files) || 0,
    totalTokens: Number(row.total_tokens) || 0,
    breakdown: parseBreakdownJson(row.breakdown_json),
    scannedAt: String(row.scanned_at || ''),
  };
}


function rowToApiUsageRecord(row: Record<string, unknown>): ApiUsageRecord {
  const durationMs = Number(row.duration_ms);
  return {
    id: Number(row.id) || 0,
    source: row.source === 'proxy' ? 'proxy' : 'report',
    projectName: row.project_name ? String(row.project_name) : null,
    projectPath: row.project_path ? String(row.project_path) : null,
    model: String(row.model || ''),
    provider: row.provider ? String(row.provider) : null,
    promptTokens: Number(row.prompt_tokens) || 0,
    completionTokens: Number(row.completion_tokens) || 0,
    totalTokens: Number(row.total_tokens) || 0,
    cachedTokens: Number(row.cached_tokens) || 0,
    requestPath: row.request_path ? String(row.request_path) : null,
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    createdAt: String(row.created_at || ''),
  };
}


export async function recordTokenScan(payload: {
  repoPath: string;
  repoName: string;
  totalFiles: number;
  totalTokens: number;
  breakdown: Record<string, number>;
}): Promise<TokenScanRecord> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO token_scan_results (repo_path, repo_name, total_files, total_tokens, breakdown_json, scanned_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [payload.repoPath, payload.repoName, payload.totalFiles, payload.totalTokens, JSON.stringify(payload.breakdown), now],
  );
  const idResult = db.exec('SELECT last_insert_rowid() AS id');
  const id = Number(idResult[0]?.values[0]?.[0]) || 0;
  await persistDatabase();
  return {
    id,
    ...payload,
    scannedAt: now,
  };
}


export async function listTokenScans(limit = 50): Promise<TokenScanRecord[]> {
  const db = await getDatabase();
  const statement = db.prepare('SELECT * FROM token_scan_results ORDER BY scanned_at DESC LIMIT ?');
  const records: TokenScanRecord[] = [];
  try {
    statement.bind([Math.max(1, Math.min(Number(limit) || 50, 200))]);
    while (statement.step()) {
      records.push(rowToTokenScanRecord(statement.getAsObject()));
    }
  } finally {
    statement.free();
  }
  return records;
}


export async function recordApiUsage(payload: {
  source: 'proxy' | 'report';
  projectName?: string | null;
  projectPath?: string | null;
  model: string;
  provider?: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  requestPath?: string | null;
  durationMs?: number | null;
}) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO api_usage_logs
      (source, project_name, project_path, model, provider, prompt_tokens, completion_tokens, total_tokens, cached_tokens, request_path, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.source,
      payload.projectName ?? null,
      payload.projectPath ?? null,
      payload.model,
      payload.provider ?? null,
      payload.promptTokens,
      payload.completionTokens,
      payload.totalTokens,
      payload.cachedTokens ?? 0,
      payload.requestPath ?? null,
      payload.durationMs ?? null,
      now,
    ],
  );
  await persistDatabase();
}


export async function listApiUsage(filter?: UsageFilter): Promise<ApiUsageRecord[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.projectName) {
    conditions.push('project_name = ?');
    params.push(filter.projectName);
  }
  if (filter?.model) {
    conditions.push('model = ?');
    params.push(filter.model);
  }
  if (filter?.source) {
    conditions.push('source = ?');
    params.push(filter.source);
  }
  if (filter?.startDate) {
    conditions.push('created_at >= ?');
    params.push(filter.startDate);
  }
  if (filter?.endDate) {
    conditions.push('created_at <= ?');
    params.push(filter.endDate);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(Number(filter?.limit) || 100, 1000));
  params.push(limit);

  const statement = db.prepare(`SELECT * FROM api_usage_logs ${where} ORDER BY created_at DESC LIMIT ?`);
  const records: ApiUsageRecord[] = [];
  try {
    statement.bind(params);
    while (statement.step()) {
      records.push(rowToApiUsageRecord(statement.getAsObject()));
    }
  } finally {
    statement.free();
  }
  return records;
}


export async function getUsageStats(filter?: UsageFilter): Promise<UsageStats> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.projectName) {
    conditions.push('project_name = ?');
    params.push(filter.projectName);
  }
  if (filter?.model) {
    conditions.push('model = ?');
    params.push(filter.model);
  }
  if (filter?.source) {
    conditions.push('source = ?');
    params.push(filter.source);
  }
  if (filter?.startDate) {
    conditions.push('created_at >= ?');
    params.push(filter.startDate);
  }
  if (filter?.endDate) {
    conditions.push('created_at <= ?');
    params.push(filter.endDate);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // 总计
  const totalResult = db.exec(
    `SELECT
       COALESCE(SUM(total_tokens), 0) AS total_tokens,
       COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
       COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
       COALESCE(SUM(cached_tokens), 0) AS cached_tokens,
       COUNT(*) AS request_count
     FROM api_usage_logs ${where}`,
    params,
  );
  const totalRow = totalResult[0]?.values[0] ?? [0, 0, 0, 0, 0];

  // 按项目
  const byProjectResult = db.exec(
    `SELECT COALESCE(project_name, '未分类') AS project_name, SUM(total_tokens) AS total_tokens, COUNT(*) AS request_count
     FROM api_usage_logs ${where}
     GROUP BY COALESCE(project_name, '未分类')
     ORDER BY total_tokens DESC`,
    params,
  );

  // 按模型
  const byModelResult = db.exec(
    `SELECT model, SUM(total_tokens) AS total_tokens, COUNT(*) AS request_count
     FROM api_usage_logs ${where}
     GROUP BY model
     ORDER BY total_tokens DESC`,
    params,
  );

  // 按日期
  const byDateResult = db.exec(
    `SELECT substr(created_at, 1, 10) AS date, SUM(total_tokens) AS total_tokens, COUNT(*) AS request_count
     FROM api_usage_logs ${where}
     GROUP BY substr(created_at, 1, 10)
     ORDER BY date ASC`,
    params,
  );

  return {
    totalTokens: Number(totalRow[0]) || 0,
    promptTokens: Number(totalRow[1]) || 0,
    completionTokens: Number(totalRow[2]) || 0,
    cachedTokens: Number(totalRow[3]) || 0,
    requestCount: Number(totalRow[4]) || 0,
    byProject: (byProjectResult[0]?.values ?? []).map((row) => ({
      projectName: String(row[0]),
      totalTokens: Number(row[1]) || 0,
      requestCount: Number(row[2]) || 0,
    })),
    byModel: (byModelResult[0]?.values ?? []).map((row) => ({
      model: String(row[0]),
      totalTokens: Number(row[1]) || 0,
      requestCount: Number(row[2]) || 0,
    })),
    byDate: (byDateResult[0]?.values ?? []).map((row) => ({
      date: String(row[0]),
      totalTokens: Number(row[1]) || 0,
      requestCount: Number(row[2]) || 0,
    })),
  };
}
```

- [ ] **Step 5: 在 `electron/main/config.ts` 中同步 `DEFAULT_CONFIG` 和 `normalizeConfig`**

在 `DEFAULT_CONFIG` 的 `autoSync` 行后追加：

```ts
  tokenProxy: { ...DEFAULT_TOKEN_PROXY_CONFIG },
  modelPricing: [...DEFAULT_MODEL_PRICING],
```

需在 config.ts 顶部 import 中添加 `DEFAULT_TOKEN_PROXY_CONFIG`, `DEFAULT_MODEL_PRICING`。

在 `normalizeConfig` 函数返回对象的 `autoSync` 行后追加：

```ts
    tokenProxy: {
      ...DEFAULT_TOKEN_PROXY_CONFIG,
      ...(config?.tokenProxy ?? {}),
      enabled: Boolean(config?.tokenProxy?.enabled),
      port: Number(config?.tokenProxy?.port) || DEFAULT_TOKEN_PROXY_CONFIG.port,
      targets: Array.isArray(config?.tokenProxy?.targets) ? config.tokenProxy.targets : [],
    },
    modelPricing: Array.isArray(config?.modelPricing) && config.modelPricing.length
      ? config.modelPricing
      : [...DEFAULT_MODEL_PRICING],
```

- [ ] **Step 6: 运行 typecheck 验证**

```bash
npm run typecheck
```

Expected: 通过（可能有前端 `AppConfig` 缺少新字段的编译错误——这在 Task 5 的 `useAssistant.ts` 修改中修复，此时忽略前端类型错误即可，只要 main/shared 层没有错误）。

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts electron/main/database.ts electron/main/tokenUsageDb.ts electron/main/config.ts
git commit -m "feat(token-stats): 新增 Token 统计类型定义、数据库表和数据操作层"
```

---

### Task 2: 代码 Token 扫描模块

**Files:**
- Create: `electron/main/tokenScan.ts`

**Interfaces:**
- Consumes: `recordTokenScan()` from `tokenUsageDb.ts`；`IGNORED_DIRS` from `repoScan.ts`
- Produces: `scanProjectTokens(repoPaths: string[], onProgress: (p: TokenScanProgress) => void): Promise<TokenScanRecord[]>`

**Dependencies:** 需要先安装 `js-tiktoken`。

- [ ] **Step 1: 安装 js-tiktoken**

```bash
npm install js-tiktoken
```

- [ ] **Step 2: 创建 `electron/main/tokenScan.ts`**

```ts
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { encodingForModel } from 'js-tiktoken';
import type { TokenScanProgress, TokenScanRecord } from '../../src/shared/types.js';
import { IGNORED_DIRS } from './repoScan.js';
import { recordTokenScan } from './tokenUsageDb.js';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.svelte',
  '.py', '.go', '.rs', '.java', '.kt', '.c', '.cpp', '.h',
  '.css', '.scss', '.less', '.html',
  '.json', '.yaml', '.yml', '.toml',
  '.md', '.txt',
  '.sql', '.sh', '.bat', '.ps1',
]);

const SCAN_IGNORED_DIRS = new Set([
  ...IGNORED_DIRS,
  '__pycache__', '.next', '.nuxt', 'vendor', '.venv', 'target',
  '.cache', '.parcel-cache', '.turbo', 'tmp', 'temp',
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB


async function collectCodeFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SCAN_IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          stack.push(join(current, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          files.push(join(current, entry.name));
        }
      }
    }
  }

  return files;
}


let cachedEncoder: ReturnType<typeof encodingForModel> | null = null;

function getEncoder() {
  if (!cachedEncoder) {
    cachedEncoder = encodingForModel('gpt-4o');
  }
  return cachedEncoder;
}


async function countFileTokens(filePath: string): Promise<number> {
  try {
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_FILE_SIZE) return 0;
    const content = await readFile(filePath, 'utf-8');
    const encoder = getEncoder();
    return encoder.encode(content).length;
  } catch {
    return 0;
  }
}


export async function scanProjectTokens(
  repoPaths: string[],
  onProgress?: (progress: TokenScanProgress) => void,
): Promise<TokenScanRecord[]> {
  const results: TokenScanRecord[] = [];

  for (const repoPath of repoPaths) {
    const repoName = basename(repoPath);
    const codeFiles = await collectCodeFiles(repoPath);
    const breakdown: Record<string, number> = {};
    let totalTokens = 0;

    for (let i = 0; i < codeFiles.length; i++) {
      const filePath = codeFiles[i];
      const ext = extname(filePath).toLowerCase().replace('.', '');
      const tokens = await countFileTokens(filePath);
      totalTokens += tokens;
      breakdown[ext] = (breakdown[ext] || 0) + tokens;

      onProgress?.({
        repoName,
        scannedFiles: i + 1,
        totalFiles: codeFiles.length,
        currentTokens: totalTokens,
      });
    }

    const record = await recordTokenScan({
      repoPath,
      repoName,
      totalFiles: codeFiles.length,
      totalTokens,
      breakdown,
    });
    results.push(record);
  }

  return results;
}
```

- [ ] **Step 3: 运行 typecheck 验证**

```bash
npm run typecheck
```

Expected: tokenScan.ts 无类型错误。

- [ ] **Step 4: Commit**

```bash
git add electron/main/tokenScan.ts package.json package-lock.json
git commit -m "feat(token-stats): 新增代码 Token 扫描模块（js-tiktoken）"
```

---

### Task 3: 反向代理网关模块

**Files:**
- Create: `electron/main/tokenProxy.ts`

**Interfaces:**
- Consumes: `recordApiUsage()` from `tokenUsageDb.ts`；`loadConfig()` from `config.ts`
- Produces: `startTokenProxy(config: TokenProxyConfig): Promise<{ port: number }>`，`stopTokenProxy(): void`，`getTokenProxyStatus(): TokenProxyStatus`

- [ ] **Step 1: 创建 `electron/main/tokenProxy.ts`**

```ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { ProxyTarget, RepoInfo, TokenProxyConfig, TokenProxyStatus } from '../../src/shared/types.js';
import { recordApiUsage } from './tokenUsageDb.js';
import { loadConfig } from './config.js';

let proxyServer: ReturnType<typeof createServer> | null = null;
let proxyRequestCount = 0;
let proxyPort = 0;


export function getTokenProxyStatus(): TokenProxyStatus {
  return {
    running: proxyServer !== null && proxyServer.listening,
    port: proxyPort,
    requestCount: proxyRequestCount,
  };
}


function matchTarget(pathname: string, targets: ProxyTarget[]): { target: ProxyTarget; remainingPath: string } | null {
  for (const target of targets) {
    const prefix = target.pathPrefix.replace(/\/+$/, '');
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const remainingPath = pathname.slice(prefix.length) || '/';
      return { target, remainingPath };
    }
  }
  return null;
}


function matchProject(requestBody: string, knownRepos: RepoInfo[]): { name: string; path: string } | null {
  for (const repo of knownRepos) {
    const forwardSlashPath = repo.path.replace(/\\/g, '/');
    if (requestBody.includes(forwardSlashPath) || requestBody.includes(repo.path)) {
      return repo;
    }
  }
  for (const repo of knownRepos) {
    if (requestBody.includes(`${repo.name}/`)) {
      return repo;
    }
  }
  return null;
}


function extractUsage(data: any): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
} {
  const usage = data?.usage;
  if (!usage) return { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 };

  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens) || 0;
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens) || 0;
  const totalTokens = Number(usage.total_tokens) || (promptTokens + completionTokens);

  // 多供应商缓存字段兼容
  const cachedTokens = Number(
    usage.prompt_tokens_details?.cached_tokens  // OpenAI
    ?? usage.cache_read_input_tokens            // Anthropic
    ?? usage.prompt_cache_hit_tokens            // DeepSeek
  ) || 0;

  return { promptTokens, completionTokens, totalTokens, cachedTokens };
}


function extractStreamingUsage(chunks: string): ReturnType<typeof extractUsage> {
  const lines = chunks.split('\n').filter((line) => line.startsWith('data: '));
  for (let i = lines.length - 1; i >= 0; i--) {
    const jsonStr = lines[i].slice(6).trim();
    if (jsonStr === '[DONE]') continue;
    try {
      const data = JSON.parse(jsonStr);
      const usage = extractUsage(data);
      if (usage.totalTokens > 0) return usage;
    } catch {
      continue;
    }
  }
  return { promptTokens: 0, completionTokens: 0, totalTokens: -1, cachedTokens: 0 };
}


function getProviderHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}


async function handleProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  targets: ProxyTarget[],
  knownRepos: RepoInfo[],
) {
  const pathname = req.url || '/';

  const matched = matchTarget(pathname, targets);
  if (!matched) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `无匹配的转发规则：${pathname}` }));
    return;
  }

  const { target, remainingPath } = matched;
  const targetUrl = `${target.targetBaseUrl.replace(/\/+$/, '')}${remainingPath}`;

  // 读取请求体
  const bodyChunks: Buffer[] = [];
  for await (const chunk of req) {
    bodyChunks.push(chunk as Buffer);
  }
  const bodyBuffer = Buffer.concat(bodyChunks);
  const bodyStr = bodyBuffer.toString('utf-8');

  // 提取模型名和匹配项目
  let model = '';
  try {
    const parsed = JSON.parse(bodyStr);
    model = String(parsed?.model || '');
  } catch { /* non-JSON body */ }

  const project = matchProject(bodyStr, knownRepos);
  const startTime = Date.now();

  // 构建转发 headers
  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key === 'host' || key === 'connection') continue;
    if (typeof value === 'string') forwardHeaders[key] = value;
    else if (Array.isArray(value)) forwardHeaders[key] = value.join(', ');
  }
  if (target.apiKey) {
    forwardHeaders['authorization'] = `Bearer ${target.apiKey}`;
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method || 'POST',
      headers: forwardHeaders,
      body: bodyBuffer,
    });

    // 透传响应 headers
    const responseHeaders: Record<string, string> = {};
    upstreamResponse.headers.forEach((value, key) => {
      if (key !== 'transfer-encoding' && key !== 'content-encoding') {
        responseHeaders[key] = value;
      }
    });

    const isStreaming = upstreamResponse.headers.get('content-type')?.includes('text/event-stream');

    if (isStreaming && upstreamResponse.body) {
      res.writeHead(upstreamResponse.status, responseHeaders);

      const reader = upstreamResponse.body.getReader();
      const decoder = new TextDecoder();
      let allChunks = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          allChunks += text;
          res.write(value);
        }
      } finally {
        res.end();
      }

      const usage = extractStreamingUsage(allChunks);
      const durationMs = Date.now() - startTime;
      proxyRequestCount++;

      await recordApiUsage({
        source: 'proxy',
        projectName: project?.name,
        projectPath: project?.path,
        model,
        provider: getProviderHost(target.targetBaseUrl),
        ...usage,
        requestPath: remainingPath,
        durationMs,
      });
    } else {
      const responseBody = await upstreamResponse.arrayBuffer();
      const responseBuffer = Buffer.from(responseBody);
      responseHeaders['content-length'] = String(responseBuffer.length);

      res.writeHead(upstreamResponse.status, responseHeaders);
      res.end(responseBuffer);

      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 };
      try {
        const data = JSON.parse(responseBuffer.toString('utf-8'));
        usage = extractUsage(data);
      } catch { /* non-JSON response */ }

      const durationMs = Date.now() - startTime;
      proxyRequestCount++;

      await recordApiUsage({
        source: 'proxy',
        projectName: project?.name,
        projectPath: project?.path,
        model,
        provider: getProviderHost(target.targetBaseUrl),
        ...usage,
        requestPath: remainingPath,
        durationMs,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `代理转发失败：${message}` }));
  }
}


export async function startTokenProxy(proxyConfig: TokenProxyConfig): Promise<{ port: number }> {
  if (proxyServer?.listening) {
    await stopTokenProxy();
  }

  const config = await loadConfig();
  const knownRepos: RepoInfo[] = [
    ...config.selectedRepoPaths.map((path) => ({
      name: path.replace(/\\/g, '/').split('/').pop() || path,
      path,
    })),
  ];

  const port = proxyConfig.port || 18921;

  return new Promise((resolve, reject) => {
    proxyServer = createServer((req, res) => {
      // CORS 预检
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        });
        res.end();
        return;
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      handleProxyRequest(req, res, proxyConfig.targets, knownRepos).catch((error) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
    });

    proxyServer.on('error', (error) => {
      reject(new Error(`代理启动失败（端口 ${port}）：${error.message}`));
    });

    proxyServer.listen(port, '127.0.0.1', () => {
      proxyPort = port;
      proxyRequestCount = 0;
      resolve({ port });
    });
  });
}


export async function stopTokenProxy() {
  return new Promise<void>((resolve) => {
    if (!proxyServer) {
      resolve();
      return;
    }
    proxyServer.close(() => {
      proxyServer = null;
      resolve();
    });
  });
}
```

- [ ] **Step 2: 运行 typecheck 验证**

```bash
npm run typecheck
```

Expected: tokenProxy.ts 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add electron/main/tokenProxy.ts
git commit -m "feat(token-stats): 新增反向代理网关模块（HTTP 转发 + usage 记录）"
```

---

### Task 4: callAiReport 集成 usage 记录 + IPC 注册

**Files:**
- Modify: `electron/main/aiClient.ts`（callAiReport 记录 usage）
- Modify: `electron/main/ipc.ts`（注册新 IPC 通道）
- Modify: `electron/main.ts`（启动/停止代理生命周期）
- Modify: `electron/preload.ts`（暴露新 API）
- Modify: `src/renderer/src/env.d.ts`（window.api 类型）

**Interfaces:**
- Consumes: `recordApiUsage()` from `tokenUsageDb.ts`；`scanProjectTokens()` from `tokenScan.ts`；`startTokenProxy()`, `stopTokenProxy()`, `getTokenProxyStatus()` from `tokenProxy.ts`；`listTokenScans()`, `listApiUsage()`, `getUsageStats()` from `tokenUsageDb.ts`
- Produces: 完整的 IPC 通道，供 Task 5 的前端调用

- [ ] **Step 1: 修改 `electron/main/aiClient.ts` 的 `callAiReport` 函数**

在 `callAiReport` 函数的 `return content.trim();` 之前，插入 usage 记录逻辑。将该函数末尾部分（从 `const data = await response.json();` 开始）替换为：

```ts
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('AI接口未返回有效内容');
  }

  // 记录 usage（副作用，不影响返回值）
  try {
    const usage = data?.usage;
    if (usage) {
      const { recordApiUsage } = await import('./tokenUsageDb.js');
      await recordApiUsage({
        source: 'report',
        model: config.aiModel,
        provider: (() => { try { return new URL(config.aiBaseUrl).hostname; } catch { return ''; } })(),
        promptTokens: Number(usage.prompt_tokens) || 0,
        completionTokens: Number(usage.completion_tokens) || 0,
        totalTokens: Number(usage.total_tokens) || 0,
        cachedTokens: Number(usage.prompt_tokens_details?.cached_tokens ?? usage.cache_read_input_tokens ?? 0) || 0,
        requestPath: '/v1/chat/completions',
      });
    }
  } catch {
    // usage 记录失败不影响主流程
  }

  return content.trim();
```

- [ ] **Step 2: 修改 `electron/main/ipc.ts`，注册新 IPC 通道**

在文件顶部添加 import：

```ts
import type { TokenProxyConfig, UsageFilter } from '../../src/shared/types.js';
import { scanProjectTokens } from './tokenScan.js';
import { startTokenProxy, stopTokenProxy, getTokenProxyStatus } from './tokenProxy.js';
import { listTokenScans, listApiUsage, getUsageStats } from './tokenUsageDb.js';
```

在 `registerIpcHandlers()` 函数体末尾（`auto-sync:run-now` 之后）追加：

```ts
  // Token 统计
  ipcMain.handle('token-scan:run', async (_event, repoPaths: string[]) => {
    const mainWindow = getMainWindow();
    return scanProjectTokens(repoPaths, (progress) => {
      mainWindow?.webContents.send('token-scan:progress', progress);
    });
  });
  ipcMain.handle('token-scan:list', async (_event, limit?: number) => listTokenScans(limit));
  ipcMain.handle('token-proxy:start', async (_event, proxyConfig: TokenProxyConfig) => startTokenProxy(proxyConfig));
  ipcMain.handle('token-proxy:stop', async () => stopTokenProxy());
  ipcMain.handle('token-proxy:status', async () => getTokenProxyStatus());
  ipcMain.handle('api-usage:list', async (_event, filter?: UsageFilter) => listApiUsage(filter));
  ipcMain.handle('api-usage:stats', async (_event, filter?: UsageFilter) => getUsageStats(filter));
```

- [ ] **Step 3: 修改 `electron/main.ts`，在应用启动和退出时管理代理生命周期**

在顶部添加 import：

```ts
import { startTokenProxy, stopTokenProxy } from './main/tokenProxy.js';
import { loadConfig } from './main/config.js';
```

在 `app.whenReady().then(async () => {` 回调中，`await refreshAutoSyncSchedule();` 之后追加：

```ts
  // 自动启动 Token 代理
  try {
    const config = await loadConfig();
    if (config.tokenProxy.enabled) {
      await startTokenProxy(config.tokenProxy);
    }
  } catch {
    // 代理启动失败不影响主应用
  }
```

在 `app.on('before-quit', () => {` 回调中追加：

```ts
  void stopTokenProxy();
```

- [ ] **Step 4: 修改 `electron/preload.ts`，暴露新 API**

在顶部 import 中添加类型：

```ts
import type {
  // ... 已有类型 ...
  TokenProxyConfig,
  TokenScanProgress,
  TokenScanRecord,
  TokenProxyStatus,
  ApiUsageRecord,
  UsageFilter,
  UsageStats,
} from '../src/shared/types.js';
```

在 `contextBridge.exposeInMainWorld('api', {` 对象中，`saveDailyReport` 之后追加：

```ts
  // Token 统计
  runTokenScan: (repoPaths: string[]) =>
    ipcRenderer.invoke('token-scan:run', repoPaths) as Promise<TokenScanRecord[]>,
  listTokenScans: (limit?: number) =>
    ipcRenderer.invoke('token-scan:list', limit) as Promise<TokenScanRecord[]>,
  startTokenProxy: (proxyConfig: TokenProxyConfig) =>
    ipcRenderer.invoke('token-proxy:start', proxyConfig) as Promise<{ port: number }>,
  stopTokenProxy: () =>
    ipcRenderer.invoke('token-proxy:stop') as Promise<void>,
  getTokenProxyStatus: () =>
    ipcRenderer.invoke('token-proxy:status') as Promise<TokenProxyStatus>,
  listApiUsage: (filter?: UsageFilter) =>
    ipcRenderer.invoke('api-usage:list', filter) as Promise<ApiUsageRecord[]>,
  getUsageStats: (filter?: UsageFilter) =>
    ipcRenderer.invoke('api-usage:stats', filter) as Promise<UsageStats>,
  onTokenScanProgress: (callback: (progress: TokenScanProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: TokenScanProgress) => callback(progress);
    ipcRenderer.on('token-scan:progress', listener);
    return () => ipcRenderer.removeListener('token-scan:progress', listener);
  },
```

- [ ] **Step 5: 修改 `src/renderer/src/env.d.ts`，新增 window.api 类型**

在 `Window['api']` interface 的 `saveDailyReport` 行之后追加：

```ts
      // Token 统计
      runTokenScan: (repoPaths: string[]) => Promise<import('@shared/types').TokenScanRecord[]>;
      listTokenScans: (limit?: number) => Promise<import('@shared/types').TokenScanRecord[]>;
      startTokenProxy: (proxyConfig: import('@shared/types').TokenProxyConfig) => Promise<{ port: number }>;
      stopTokenProxy: () => Promise<void>;
      getTokenProxyStatus: () => Promise<import('@shared/types').TokenProxyStatus>;
      listApiUsage: (filter?: import('@shared/types').UsageFilter) => Promise<import('@shared/types').ApiUsageRecord[]>;
      getUsageStats: (filter?: import('@shared/types').UsageFilter) => Promise<import('@shared/types').UsageStats>;
      onTokenScanProgress: (callback: (progress: import('@shared/types').TokenScanProgress) => void) => () => void;
```

- [ ] **Step 6: 运行 typecheck 验证**

```bash
npm run typecheck
```

Expected: 除前端 `useAssistant.ts` 中 `AppConfig` 初始值可能缺少 `tokenProxy`/`modelPricing` 字段外，不应有其他错误。该问题在 Task 5 修复。

- [ ] **Step 7: Commit**

```bash
git add electron/main/aiClient.ts electron/main/ipc.ts electron/main.ts electron/preload.ts src/renderer/src/env.d.ts
git commit -m "feat(token-stats): callAiReport 记录 usage + 注册所有 IPC 通道"
```

---

### Task 5: 前端页面 + 路由 + 侧边栏

**Files:**
- Modify: `src/renderer/src/router.ts`
- Modify: `src/renderer/src/components/AppSidebar.vue`
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/composables/useAssistant.ts`
- Create: `src/renderer/src/composables/assistant/tokenStatsState.ts`
- Create: `src/renderer/src/views/TokenStatsView.vue`

**Interfaces:**
- Consumes: 所有 `window.api` 新方法（Task 4 注册的）
- Produces: 完整的 Token 统计页面

- [ ] **Step 1: 修改 `src/renderer/src/router.ts`**

将 `navKeys` 数组修改为：

```ts
export const navKeys = ['config', 'generate', 'history', 'farm', 'ai', 'tokens', 'system'] as const;
```

将路由匹配模式修改为：

```ts
    path: '/:nav(config|generate|history|farm|ai|tokens|system)',
```

- [ ] **Step 2: 修改 `src/renderer/src/components/AppSidebar.vue`**

在 import 中添加 `BarChart3`（来自 `lucide-vue-next`）：

```ts
import { BarChart3, Bot, BrainCog, FileCog, FileText, FolderKanban, History, Settings, Sparkles, Sprout } from 'lucide-vue-next';
```

在 `navGroups` 数组中，`growth` 组之后、`settings` 组之前，新增一组：

```ts
  {
    id: 'analytics',
    label: '数据分析',
    icon: BarChart3,
    children: [
      { key: 'tokens', label: 'Token 统计', icon: BarChart3, enabled: true },
    ],
  },
```

- [ ] **Step 3: 创建 `src/renderer/src/composables/assistant/tokenStatsState.ts`**

```ts
import { ref } from 'vue';
import type {
  TokenScanRecord,
  TokenScanProgress,
  TokenProxyStatus,
  UsageStats,
  UsageFilter,
} from '@shared/types';

export function createTokenStatsState() {
  const tokenScans = ref<TokenScanRecord[]>([]);
  const scanProgress = ref<TokenScanProgress | null>(null);
  const scanning = ref(false);
  const proxyStatus = ref<TokenProxyStatus>({ running: false, port: 0, requestCount: 0 });
  const usageStats = ref<UsageStats | null>(null);
  const usageLoading = ref(false);

  let removeScanProgressListener: (() => void) | null = null;

  async function runTokenScan(repoPaths: string[]) {
    scanning.value = true;
    scanProgress.value = null;
    try {
      removeScanProgressListener = window.api.onTokenScanProgress((progress) => {
        scanProgress.value = progress;
      });
      const results = await window.api.runTokenScan(repoPaths);
      tokenScans.value = [...results, ...tokenScans.value];
      return results;
    } finally {
      scanning.value = false;
      scanProgress.value = null;
      removeScanProgressListener?.();
      removeScanProgressListener = null;
    }
  }

  async function loadTokenScans() {
    tokenScans.value = await window.api.listTokenScans(50);
  }

  async function refreshProxyStatus() {
    proxyStatus.value = await window.api.getTokenProxyStatus();
  }

  async function startProxy() {
    const config = await window.api.loadConfig();
    await window.api.startTokenProxy(config.tokenProxy);
    await refreshProxyStatus();
  }

  async function stopProxy() {
    await window.api.stopTokenProxy();
    await refreshProxyStatus();
  }

  async function loadUsageStats(filter?: UsageFilter) {
    usageLoading.value = true;
    try {
      usageStats.value = await window.api.getUsageStats(filter);
    } finally {
      usageLoading.value = false;
    }
  }

  function dispose() {
    removeScanProgressListener?.();
    removeScanProgressListener = null;
  }

  return {
    tokenScans,
    scanProgress,
    scanning,
    proxyStatus,
    usageStats,
    usageLoading,
    runTokenScan,
    loadTokenScans,
    refreshProxyStatus,
    startProxy,
    stopProxy,
    loadUsageStats,
    dispose,
  };
}
```

- [ ] **Step 4: 修改 `src/renderer/src/composables/useAssistant.ts`**

在顶部 import 中添加：

```ts
import { DEFAULT_TOKEN_PROXY_CONFIG, DEFAULT_MODEL_PRICING } from '@shared/types';
import { createTokenStatsState } from './assistant/tokenStatsState';
```

在 `config` reactive 对象中，`autoSync` 行后追加：

```ts
    tokenProxy: { ...DEFAULT_TOKEN_PROXY_CONFIG },
    modelPricing: [...DEFAULT_MODEL_PRICING],
```

在 `createAssistant()` 内，在 `reportState = createReportState(...)` 之后追加：

```ts
  const tokenStatsState = createTokenStatsState();
```

在 `dispose()` 函数中追加：

```ts
    tokenStatsState.dispose();
```

在 `return` 对象中追加：

```ts
    tokenScans: tokenStatsState.tokenScans,
    scanProgress: tokenStatsState.scanProgress,
    scanning: tokenStatsState.scanning,
    proxyStatus: tokenStatsState.proxyStatus,
    usageStats: tokenStatsState.usageStats,
    usageLoading: tokenStatsState.usageLoading,
    runTokenScan: tokenStatsState.runTokenScan,
    loadTokenScans: tokenStatsState.loadTokenScans,
    refreshProxyStatus: tokenStatsState.refreshProxyStatus,
    startProxy: tokenStatsState.startProxy,
    stopProxy: tokenStatsState.stopProxy,
    loadUsageStats: tokenStatsState.loadUsageStats,
```

- [ ] **Step 5: 修改 `src/renderer/src/App.vue`**

在 import 中添加：

```ts
import TokenStatsView from '@/views/TokenStatsView.vue';
```

在 `viewMap` 对象中追加：

```ts
  tokens: TokenStatsView,
```

- [ ] **Step 6: 创建 `src/renderer/src/views/TokenStatsView.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { BarChart3, Database, Play, RefreshCw, Settings, Square, Zap } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useAssistant } from '@/composables/useAssistant';
import PageHeader from '@/components/common/PageHeader.vue';
import type { UsageFilter } from '@shared/types';

const assistant = useAssistant();
const {
  config,
  repos,
  selectedRepoPaths,
  tokenScans,
  scanProgress,
  scanning,
  proxyStatus,
  usageStats,
  usageLoading,
  runTokenScan,
  loadTokenScans,
  refreshProxyStatus,
  startProxy,
  stopProxy,
  loadUsageStats,
  saveSettings,
} = assistant;

const activeTab = ref('code');
const scanRepoPaths = ref<string[]>([]);
const usageTimeRange = ref<'today' | 'week' | 'month' | 'all'>('today');

// 扫描结果 — 取每个仓库最新一次
const latestScans = computed(() => {
  const map = new Map<string, (typeof tokenScans.value)[0]>();
  for (const scan of tokenScans.value) {
    if (!map.has(scan.repoPath)) map.set(scan.repoPath, scan);
  }
  return [...map.values()].sort((a, b) => b.totalTokens - a.totalTokens);
});

const totalCodeTokens = computed(() => latestScans.value.reduce((sum, s) => sum + s.totalTokens, 0));

// 按扩展名合并统计
const aggregatedBreakdown = computed(() => {
  const merged: Record<string, number> = {};
  for (const scan of latestScans.value) {
    for (const [ext, tokens] of Object.entries(scan.breakdown)) {
      merged[ext] = (merged[ext] || 0) + tokens;
    }
  }
  return Object.entries(merged).sort((a, b) => b[1] - a[1]);
});

// 费用估算
const estimatedCost = computed(() => {
  if (!usageStats.value) return 0;
  let cost = 0;
  for (const modelStat of usageStats.value.byModel) {
    const pricing = config.modelPricing.find(
      (p) => modelStat.model.includes(p.model) || p.model.includes(modelStat.model),
    );
    if (pricing) {
      // 粗略按 prompt:completion ≈ 总量占比估算
      const ratio = usageStats.value.promptTokens / Math.max(usageStats.value.totalTokens, 1);
      const promptPart = modelStat.totalTokens * ratio;
      const completionPart = modelStat.totalTokens * (1 - ratio);
      cost += (promptPart * pricing.inputPer1M + completionPart * pricing.outputPer1M) / 1_000_000;
    }
  }
  return cost;
});

const cacheHitRate = computed(() => {
  if (!usageStats.value || !usageStats.value.promptTokens) return 0;
  return (usageStats.value.cachedTokens / usageStats.value.promptTokens) * 100;
});

function getUsageFilter(): UsageFilter {
  const now = new Date();
  const filter: UsageFilter = {};
  if (usageTimeRange.value === 'today') {
    filter.startDate = now.toISOString().slice(0, 10) + 'T00:00:00';
  } else if (usageTimeRange.value === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    filter.startDate = weekAgo.toISOString().slice(0, 10) + 'T00:00:00';
  } else if (usageTimeRange.value === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    filter.startDate = monthAgo.toISOString().slice(0, 10) + 'T00:00:00';
  }
  return filter;
}

function formatTokens(n: number) {
  if (n >= 10000_0000) return `${(n / 10000_0000).toFixed(1)} 亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`;
  return String(n);
}

async function handleScan() {
  if (!scanRepoPaths.value.length) {
    ElMessage.warning('请先选择要扫描的仓库');
    return;
  }
  try {
    await runTokenScan(scanRepoPaths.value);
    ElMessage.success('扫描完成');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '扫描失败');
  }
}

async function handleToggleProxy() {
  try {
    if (proxyStatus.value.running) {
      await stopProxy();
      ElMessage.success('代理已停止');
    } else {
      await startProxy();
      ElMessage.success(`代理已启动，端口：${proxyStatus.value.port}`);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败');
  }
}

async function handleAddTarget() {
  config.tokenProxy.targets.push({
    id: crypto.randomUUID(),
    name: '',
    targetBaseUrl: '',
    apiKey: '',
    pathPrefix: '',
  });
}

function handleRemoveTarget(index: number) {
  config.tokenProxy.targets.splice(index, 1);
}

watch(usageTimeRange, () => {
  void loadUsageStats(getUsageFilter());
});

onMounted(async () => {
  await loadTokenScans();
  await refreshProxyStatus();
  await loadUsageStats(getUsageFilter());
});
</script>

<template>
  <div class="token-stats-view">
    <PageHeader title="Token 统计" description="查看项目代码 Token 量与 AI 使用消耗统计" />

    <el-tabs v-model="activeTab" class="token-stats-tabs">
      <!-- Tab 1: 代码 Token -->
      <el-tab-pane label="代码 Token" name="code">
        <div class="token-scan-toolbar">
          <el-select
            v-model="scanRepoPaths"
            multiple
            placeholder="选择要扫描的仓库"
            style="flex: 1"
            collapse-tags
            collapse-tags-tooltip
          >
            <el-option
              v-for="repo in repos"
              :key="repo.path"
              :label="repo.name"
              :value="repo.path"
            />
          </el-select>
          <el-button type="primary" :loading="scanning" @click="handleScan">
            <Database :size="16" style="margin-right: 4px" />
            开始扫描
          </el-button>
        </div>

        <el-progress
          v-if="scanning && scanProgress"
          :percentage="Math.round((scanProgress.scannedFiles / Math.max(scanProgress.totalFiles, 1)) * 100)"
          :format="() => `${scanProgress!.repoName}: ${scanProgress!.scannedFiles}/${scanProgress!.totalFiles} 文件，${formatTokens(scanProgress!.currentTokens)} tokens`"
          style="margin-bottom: 16px"
        />

        <div v-if="latestScans.length" class="token-stats-cards">
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">项目总 Token 量</div>
            <div class="stat-value">{{ formatTokens(totalCodeTokens) }}</div>
          </el-card>
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">已扫描项目</div>
            <div class="stat-value">{{ latestScans.length }}</div>
          </el-card>
        </div>

        <!-- 项目排行 -->
        <el-table v-if="latestScans.length" :data="latestScans" stripe style="margin-top: 16px">
          <el-table-column prop="repoName" label="项目" />
          <el-table-column label="Token 量" align="right">
            <template #default="{ row }">{{ formatTokens(row.totalTokens) }}</template>
          </el-table-column>
          <el-table-column prop="totalFiles" label="文件数" align="right" />
          <el-table-column label="扫描时间">
            <template #default="{ row }">{{ row.scannedAt.slice(0, 16).replace('T', ' ') }}</template>
          </el-table-column>
        </el-table>

        <!-- 文件类型分布 -->
        <el-card v-if="aggregatedBreakdown.length" shadow="never" style="margin-top: 16px">
          <template #header>文件类型分布</template>
          <div class="breakdown-list">
            <div v-for="[ext, tokens] in aggregatedBreakdown" :key="ext" class="breakdown-item">
              <span class="breakdown-ext">.{{ ext }}</span>
              <el-progress
                :percentage="Math.round((tokens / Math.max(totalCodeTokens, 1)) * 100)"
                :stroke-width="14"
                :show-text="false"
                style="flex: 1; margin: 0 12px"
              />
              <span class="breakdown-tokens">{{ formatTokens(tokens) }}</span>
            </div>
          </div>
        </el-card>

        <el-empty v-if="!latestScans.length && !scanning" description="暂无扫描记录，选择仓库后点击扫描" />
      </el-tab-pane>

      <!-- Tab 2: AI 消耗 -->
      <el-tab-pane label="AI 消耗" name="usage">
        <div class="token-scan-toolbar">
          <el-radio-group v-model="usageTimeRange" size="default">
            <el-radio-button value="today">当天</el-radio-button>
            <el-radio-button value="week">本周</el-radio-button>
            <el-radio-button value="month">本月</el-radio-button>
            <el-radio-button value="all">全部</el-radio-button>
          </el-radio-group>
          <el-button :icon="RefreshCw" @click="loadUsageStats(getUsageFilter())">刷新</el-button>
        </div>

        <div v-if="usageStats" class="token-stats-cards">
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">
              <Zap :size="14" /> 真实消耗 Tokens
            </div>
            <div class="stat-value">{{ formatTokens(usageStats.totalTokens) }}</div>
          </el-card>
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">总请求数</div>
            <div class="stat-value">{{ usageStats.requestCount }}</div>
          </el-card>
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">缓存命中率</div>
            <div class="stat-value">{{ cacheHitRate.toFixed(1) }}%</div>
          </el-card>
          <el-card shadow="never" class="token-stat-card">
            <div class="stat-label">估算费用</div>
            <div class="stat-value">${{ estimatedCost.toFixed(4) }}</div>
          </el-card>
        </div>

        <div v-if="usageStats" style="display: flex; gap: 16px; margin-top: 16px">
          <el-card shadow="never" style="flex: 1">
            <template #header>Token 明细</template>
            <div class="breakdown-list">
              <div class="breakdown-item">
                <span class="breakdown-ext">输入</span>
                <span class="breakdown-tokens">{{ formatTokens(usageStats.promptTokens) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-ext">输出</span>
                <span class="breakdown-tokens">{{ formatTokens(usageStats.completionTokens) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-ext">缓存命中</span>
                <span class="breakdown-tokens">{{ formatTokens(usageStats.cachedTokens) }}</span>
              </div>
            </div>
          </el-card>
        </div>

        <!-- 按项目排行 -->
        <el-table v-if="usageStats?.byProject?.length" :data="usageStats.byProject" stripe style="margin-top: 16px">
          <el-table-column prop="projectName" label="项目" />
          <el-table-column label="消耗 Tokens" align="right">
            <template #default="{ row }">{{ formatTokens(row.totalTokens) }}</template>
          </el-table-column>
          <el-table-column prop="requestCount" label="请求数" align="right" />
        </el-table>

        <!-- 按模型排行 -->
        <el-table v-if="usageStats?.byModel?.length" :data="usageStats.byModel" stripe style="margin-top: 16px">
          <el-table-column prop="model" label="模型" />
          <el-table-column label="消耗 Tokens" align="right">
            <template #default="{ row }">{{ formatTokens(row.totalTokens) }}</template>
          </el-table-column>
          <el-table-column prop="requestCount" label="请求数" align="right" />
        </el-table>

        <!-- 按日期趋势 -->
        <el-table v-if="usageStats?.byDate?.length" :data="usageStats.byDate" stripe style="margin-top: 16px">
          <el-table-column prop="date" label="日期" />
          <el-table-column label="消耗 Tokens" align="right">
            <template #default="{ row }">{{ formatTokens(row.totalTokens) }}</template>
          </el-table-column>
          <el-table-column prop="requestCount" label="请求数" align="right" />
        </el-table>

        <el-empty v-if="!usageStats?.requestCount" description="暂无 AI 使用记录" />
      </el-tab-pane>

      <!-- Tab 3: 代理设置 -->
      <el-tab-pane label="代理设置" name="proxy">
        <el-card shadow="never">
          <template #header>代理状态</template>
          <div class="proxy-status-bar">
            <el-tag :type="proxyStatus.running ? 'success' : 'info'" size="large">
              {{ proxyStatus.running ? '● 运行中' : '○ 已停止' }}
            </el-tag>
            <span v-if="proxyStatus.running" style="margin-left: 12px; color: var(--el-text-color-secondary)">
              端口：{{ proxyStatus.port }} · 已处理 {{ proxyStatus.requestCount }} 次请求
            </span>
            <el-button
              :type="proxyStatus.running ? 'danger' : 'success'"
              style="margin-left: auto"
              @click="handleToggleProxy"
            >
              <component :is="proxyStatus.running ? Square : Play" :size="14" style="margin-right: 4px" />
              {{ proxyStatus.running ? '停止' : '启动' }}
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px">
          <template #header>
            <div style="display: flex; align-items: center; justify-content: space-between">
              <span>转发规则</span>
              <el-button size="small" @click="handleAddTarget">+ 添加规则</el-button>
            </div>
          </template>

          <div v-for="(target, index) in config.tokenProxy.targets" :key="target.id" class="proxy-target-row">
            <el-input v-model="target.name" placeholder="名称（如 OpenAI）" style="width: 120px" />
            <el-input v-model="target.pathPrefix" placeholder="路径前缀（如 /openai）" style="width: 150px" />
            <el-input v-model="target.targetBaseUrl" placeholder="目标地址（如 https://api.openai.com/v1）" style="flex: 1" />
            <el-input v-model="target.apiKey" placeholder="API Key（可选）" type="password" show-password style="width: 200px" />
            <el-button type="danger" text @click="handleRemoveTarget(index)">删除</el-button>
          </div>

          <el-empty v-if="!config.tokenProxy.targets.length" description="暂无转发规则，点击上方添加" :image-size="60" />

          <div style="margin-top: 12px; text-align: right">
            <el-button type="primary" @click="saveSettings">保存设置</el-button>
          </div>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px">
          <template #header>端口设置</template>
          <el-form label-width="100px">
            <el-form-item label="代理端口">
              <el-input-number v-model="config.tokenProxy.port" :min="1024" :max="65535" :step="1" />
            </el-form-item>
            <el-form-item label="自动启动">
              <el-switch v-model="config.tokenProxy.enabled" />
            </el-form-item>
          </el-form>
          <div style="text-align: right">
            <el-button type="primary" @click="saveSettings">保存设置</el-button>
          </div>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px">
          <template #header>使用说明</template>
          <div class="proxy-usage-guide">
            <p>将 AI 工具的 API Base URL 改为本地代理地址即可开始记录 Token 消耗：</p>
            <div v-for="target in config.tokenProxy.targets" :key="target.id" class="proxy-url-example">
              <strong>{{ target.name || '未命名' }}：</strong>
              <code>http://localhost:{{ config.tokenProxy.port }}{{ target.pathPrefix }}/v1</code>
            </div>
            <p v-if="!config.tokenProxy.targets.length" style="color: var(--el-text-color-secondary)">
              请先添加转发规则
            </p>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
```

- [ ] **Step 7: 运行 typecheck 验证**

```bash
npm run typecheck
```

Expected: 全部通过。

- [ ] **Step 8: 运行 dev 验证页面可访问**

```bash
npm run dev
```

在应用中点击侧边栏「Token 统计」，确认三个 Tab 页面都能正常显示，无白屏或控制台报错。

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/router.ts src/renderer/src/components/AppSidebar.vue src/renderer/src/App.vue src/renderer/src/composables/useAssistant.ts src/renderer/src/composables/assistant/tokenStatsState.ts src/renderer/src/views/TokenStatsView.vue
git commit -m "feat(token-stats): 新增 Token 统计页面（代码扫描 + AI 消耗 + 代理设置）"
```

---

### Task 6: 端到端集成验证 + CSS 样式

**Files:**
- Modify: `src/renderer/src/style.css`（追加 Token 统计页面样式）

**Interfaces:**
- Consumes: 全部前序 Task 的产物

- [ ] **Step 1: 在 `src/renderer/src/style.css` 末尾追加 Token 统计页面样式**

```css
/* ─── Token 统计 ─── */

.token-stats-view {
  max-width: 1000px;
  margin: 0 auto;
}

.token-stats-tabs {
  margin-top: 16px;
}

.token-scan-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.token-stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.token-stat-card {
  text-align: center;
}

.token-stat-card .stat-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.token-stat-card .stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breakdown-ext {
  min-width: 60px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  font-family: var(--el-font-family-mono, monospace);
}

.breakdown-tokens {
  min-width: 80px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.proxy-status-bar {
  display: flex;
  align-items: center;
}

.proxy-target-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.proxy-usage-guide {
  font-size: 13px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.proxy-usage-guide code {
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--el-font-family-mono, monospace);
  user-select: all;
}

.proxy-url-example {
  margin: 8px 0;
}
```

- [ ] **Step 2: 运行 dev 并执行端到端验证**

```bash
npm run dev
```

验证清单：

1. 侧边栏出现「数据分析 > Token 统计」导航项，点击跳转到 `/tokens` 页面
2. **代码 Token Tab**：选择仓库 → 点击扫描 → 进度条显示 → 扫描完成后表格和文件类型分布正常
3. **AI 消耗 Tab**：时间范围切换正常，概览卡片显示数据，表格有排行
4. **代理设置 Tab**：添加转发规则 → 保存 → 启动代理 → 状态变为运行中 → 停止代理
5. 生成一次日报 → 回到 AI 消耗 Tab → 刷新 → 能看到新增一条 source=report 的记录
6. 暗色/亮色主题切换后样式正常

- [ ] **Step 3: 运行 typecheck 最终确认**

```bash
npm run typecheck
```

Expected: 全部通过，零错误。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/style.css
git commit -m "feat(token-stats): 添加 Token 统计页面样式"
```

- [ ] **Step 5: 最终提交（如有遗漏修改）**

```bash
git status
# 确认无遗漏文件
git log --oneline -6
# 确认 6 个 commit 完整
```
