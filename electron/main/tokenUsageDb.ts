import type { ApiUsageRecord, ModelPricing, TokenScanRecord, UsageFilter, UsageStats } from '../../src/shared/types.js';
import { loadConfig } from './config.js';
import { getDatabase, persistDatabase } from './database.js';

type ApiUsagePayload = {
  source: 'proxy' | 'report';
  projectName?: string | null;
  projectPath?: string | null;
  model: string;
  provider?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  requestPath?: string | null;
  durationMs?: number | null;
};

type NormalizedUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

function toNonNegativeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value.toFixed(8).replace(/0+$/u, '').replace(/\.$/u, '');
}

function stripModelDateSuffix(model: string) {
  return model
    .replace(/-\d{4}-\d{2}-\d{2}$/u, '')
    .replace(/-\d{8}$/u, '')
    .replace(/-\d{6}$/u, '');
}

function cleanModelIdForPricing(model: string) {
  return stripModelDateSuffix(
    model
      .trim()
      .toLowerCase()
      .replace(/\[1m\]$/u, '')
      .split('/')
      .pop()!
      .split(':')[0]
      .replace(/@/gu, '-')
      .replace(/\./gu, '-'),
  );
}

function getModelPricingCandidates(model: string) {
  const cleaned = cleanModelIdForPricing(model);
  const candidates = new Set([model.trim().toLowerCase(), cleaned, stripModelDateSuffix(cleaned)]);
  const withoutReasoning = cleaned.replace(/-(low|medium|high|xhigh|minimal)$/u, '');
  if (withoutReasoning !== cleaned) candidates.add(withoutReasoning);
  return [...candidates].filter(Boolean);
}

function findPricing(model: string, pricingList: ModelPricing[]) {
  const candidates = getModelPricingCandidates(model);
  const normalizedPricing = pricingList.map((pricing) => ({
    pricing,
    model: cleanModelIdForPricing(pricing.model),
  }));

  for (const candidate of candidates) {
    const exact = normalizedPricing.find((item) => item.model === candidate);
    if (exact) return exact.pricing;
  }

  return normalizedPricing.find((item) =>
    candidates.some((candidate) => candidate.includes(item.model) || item.model.includes(candidate)),
  )?.pricing;
}

function normalizeUsagePayload(payload: ApiUsagePayload): NormalizedUsage {
  const cacheReadTokens = toNonNegativeNumber(payload.cacheReadTokens ?? payload.cachedTokens);
  const cacheCreationTokens = toNonNegativeNumber(payload.cacheCreationTokens);
  const promptTokens = toNonNegativeNumber(payload.promptTokens ?? ((payload.inputTokens ?? 0) + cacheReadTokens));
  const completionTokens = toNonNegativeNumber(payload.completionTokens ?? payload.outputTokens);
  const inputTokens =
    payload.inputTokens == null
      ? Math.max(promptTokens - cacheReadTokens, 0)
      : toNonNegativeNumber(payload.inputTokens);
  const outputTokens = toNonNegativeNumber(payload.outputTokens ?? completionTokens);
  const computedTotalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
  const fallbackTotalTokens = toNonNegativeNumber(payload.totalTokens);
  const totalTokens = computedTotalTokens || fallbackTotalTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens: cacheReadTokens,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
  };
}

function calculateCost(usage: NormalizedUsage, pricing?: ModelPricing) {
  if (!pricing) {
    return {
      inputCostUsd: '0',
      outputCostUsd: '0',
      cacheReadCostUsd: '0',
      cacheCreationCostUsd: '0',
      totalCostUsd: '0',
    };
  }

  const inputCost = (usage.inputTokens * pricing.inputPer1M) / 1_000_000;
  const outputCost = (usage.outputTokens * pricing.outputPer1M) / 1_000_000;
  const cacheReadCost = (usage.cacheReadTokens * (pricing.cacheReadPer1M ?? pricing.cachedPer1M ?? 0)) / 1_000_000;
  const cacheCreationCost = (usage.cacheCreationTokens * (pricing.cacheCreationPer1M ?? 0)) / 1_000_000;

  return {
    inputCostUsd: formatUsd(inputCost),
    outputCostUsd: formatUsd(outputCost),
    cacheReadCostUsd: formatUsd(cacheReadCost),
    cacheCreationCostUsd: formatUsd(cacheCreationCost),
    totalCostUsd: formatUsd(inputCost + outputCost + cacheReadCost + cacheCreationCost),
  };
}

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
  const promptTokens = Number(row.prompt_tokens) || 0;
  const completionTokens = Number(row.completion_tokens) || 0;
  const cachedTokens = Number(row.cached_tokens) || 0;
  const inputTokens = Number(row.input_tokens) || Math.max(promptTokens - cachedTokens, 0);
  const outputTokens = Number(row.output_tokens) || completionTokens;
  const cacheReadTokens = Number(row.cache_read_tokens) || cachedTokens;
  const cacheCreationTokens = Number(row.cache_creation_tokens) || 0;

  return {
    id: Number(row.id) || 0,
    source: row.source === 'proxy' ? 'proxy' : 'report',
    projectName: row.project_name ? String(row.project_name) : null,
    projectPath: row.project_path ? String(row.project_path) : null,
    model: String(row.model || ''),
    provider: row.provider ? String(row.provider) : null,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    promptTokens,
    completionTokens,
    totalTokens: Number(row.total_tokens) || inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens,
    cachedTokens,
    inputCostUsd: String(row.input_cost_usd ?? '0'),
    outputCostUsd: String(row.output_cost_usd ?? '0'),
    cacheReadCostUsd: String(row.cache_read_cost_usd ?? '0'),
    cacheCreationCostUsd: String(row.cache_creation_cost_usd ?? '0'),
    totalCostUsd: String(row.total_cost_usd ?? '0'),
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

export async function recordApiUsage(payload: ApiUsagePayload) {
  const db = await getDatabase();
  const config = await loadConfig();
  const usage = normalizeUsagePayload(payload);
  const cost = calculateCost(usage, findPricing(payload.model, config.modelPricing));
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO api_usage_logs
      (
        source, project_name, project_path, model, provider,
        prompt_tokens, completion_tokens, total_tokens, cached_tokens,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        input_cost_usd, output_cost_usd, cache_read_cost_usd, cache_creation_cost_usd, total_cost_usd,
        request_path, duration_ms, created_at
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.source,
      payload.projectName ?? null,
      payload.projectPath ?? null,
      payload.model,
      payload.provider ?? null,
      usage.promptTokens,
      usage.completionTokens,
      usage.totalTokens,
      usage.cachedTokens,
      usage.inputTokens,
      usage.outputTokens,
      usage.cacheReadTokens,
      usage.cacheCreationTokens,
      cost.inputCostUsd,
      cost.outputCostUsd,
      cost.cacheReadCostUsd,
      cost.cacheCreationCostUsd,
      cost.totalCostUsd,
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

  const totalResult = db.exec(
    `SELECT
       COALESCE(SUM(total_tokens), 0) AS total_tokens,
       COALESCE(SUM(input_tokens), 0) AS input_tokens,
       COALESCE(SUM(output_tokens), 0) AS output_tokens,
       COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
       COALESCE(SUM(cache_creation_tokens), 0) AS cache_creation_tokens,
       COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
       COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
       COALESCE(SUM(cached_tokens), 0) AS cached_tokens,
       COALESCE(SUM(CAST(total_cost_usd AS REAL)), 0) AS total_cost_usd,
       COUNT(*) AS request_count
     FROM api_usage_logs ${where}`,
    params,
  );
  const totalRow = totalResult[0]?.values[0] ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  const byProjectResult = db.exec(
    `SELECT
       COALESCE(project_name, '未分类') AS project_name,
       SUM(total_tokens) AS total_tokens,
       COALESCE(SUM(CAST(total_cost_usd AS REAL)), 0) AS total_cost_usd,
       COUNT(*) AS request_count
     FROM api_usage_logs ${where}
     GROUP BY COALESCE(project_name, '未分类')
     ORDER BY total_tokens DESC`,
    params,
  );

  const byModelResult = db.exec(
    `SELECT
       model,
       SUM(total_tokens) AS total_tokens,
       COALESCE(SUM(CAST(total_cost_usd AS REAL)), 0) AS total_cost_usd,
       COUNT(*) AS request_count
     FROM api_usage_logs ${where}
     GROUP BY model
     ORDER BY total_tokens DESC`,
    params,
  );

  const byDateResult = db.exec(
    `SELECT
       substr(created_at, 1, 10) AS date,
       SUM(total_tokens) AS total_tokens,
       COALESCE(SUM(CAST(total_cost_usd AS REAL)), 0) AS total_cost_usd,
       COUNT(*) AS request_count
     FROM api_usage_logs ${where}
     GROUP BY substr(created_at, 1, 10)
     ORDER BY date ASC`,
    params,
  );

  const inputTokens = Number(totalRow[1]) || 0;
  const outputTokens = Number(totalRow[2]) || 0;
  const cacheReadTokens = Number(totalRow[3]) || 0;
  const cacheCreationTokens = Number(totalRow[4]) || 0;
  const cacheableInputTokens = inputTokens + cacheReadTokens + cacheCreationTokens;

  return {
    totalTokens: Number(totalRow[0]) || 0,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    promptTokens: Number(totalRow[5]) || 0,
    completionTokens: Number(totalRow[6]) || 0,
    cachedTokens: Number(totalRow[7]) || 0,
    totalCostUsd: formatUsd(Number(totalRow[8]) || 0),
    cacheHitRate: cacheableInputTokens > 0 ? (cacheReadTokens / cacheableInputTokens) * 100 : 0,
    requestCount: Number(totalRow[9]) || 0,
    byProject: (byProjectResult[0]?.values ?? []).map((row) => ({
      projectName: String(row[0]),
      totalTokens: Number(row[1]) || 0,
      totalCostUsd: formatUsd(Number(row[2]) || 0),
      requestCount: Number(row[3]) || 0,
    })),
    byModel: (byModelResult[0]?.values ?? []).map((row) => ({
      model: String(row[0]),
      totalTokens: Number(row[1]) || 0,
      totalCostUsd: formatUsd(Number(row[2]) || 0),
      requestCount: Number(row[3]) || 0,
    })),
    byDate: (byDateResult[0]?.values ?? []).map((row) => ({
      date: String(row[0]),
      totalTokens: Number(row[1]) || 0,
      totalCostUsd: formatUsd(Number(row[2]) || 0),
      requestCount: Number(row[3]) || 0,
    })),
  };
}
