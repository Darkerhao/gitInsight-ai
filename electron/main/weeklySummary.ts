import type {
  SaveWeeklySummaryPayload,
  WeeklySummaryParams,
  WeeklySummaryRecord,
} from '../../src/shared/types.js';
import {
  buildWeeklySummaryPrompt,
  buildWeeklySummarySourceSnapshot,
  normalizeWeeklySummaryParams,
  validateWeeklySummaryEvidence,
} from '../../src/shared/weeklySummary.js';
import { callAiWeeklySummary, resolveAiConfig } from './aiClient.js';
import { loadConfig } from './config.js';
import { getDatabase, persistDatabase, recordErrorLog, rowToDailyReportRecord } from './database.js';
import {
  queryWeeklySummaryById,
  queryWeeklySummaryRecords,
  queryWeeklySummarySources,
  saveWeeklySummaryContent,
  upsertWeeklySummary,
} from './weeklySummaryStore.js';

export async function getWeeklySummarySources(params: WeeklySummaryParams) {
  return queryWeeklySummarySources(await getDatabase(), normalizeWeeklySummaryParams(params), rowToDailyReportRecord);
}

export async function getWeeklySummaryHistory(limit = 20) {
  return queryWeeklySummaryRecords(await getDatabase(), limit);
}

export async function getWeeklySummary(id: number) {
  return queryWeeklySummaryById(await getDatabase(), id);
}

export async function saveWeeklySummary(payload: SaveWeeklySummaryPayload): Promise<WeeklySummaryRecord> {
  const record = saveWeeklySummaryContent(await getDatabase(), payload);
  await persistDatabase();
  return record;
}

export async function generateWeeklySummary(params: WeeklySummaryParams): Promise<WeeklySummaryRecord> {
  const normalized = normalizeWeeklySummaryParams(params);
  const db = await getDatabase();
  const sources = queryWeeklySummarySources(db, normalized, rowToDailyReportRecord);
  if (!sources.length) throw new Error('所选周期内没有可用于生成周报的日报');
  const config = await loadConfig();
  const aiConfig = resolveAiConfig(config, normalized.aiProfileId);
  if (!aiConfig.aiApiKey.trim()) throw new Error('请先在 AI 设置中配置 API Key，再生成周报');
  try {
    const metadata = await callAiWeeklySummary(aiConfig, buildWeeklySummaryPrompt(normalized, sources));
    validateWeeklySummaryEvidence(metadata, sources);
    const projectName = normalized.projectPath ? sources[0]?.projectName || '当前项目' : '全部项目';
    const record = upsertWeeklySummary(db, {
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      scopeType: normalized.projectPath ? 'project' : 'all',
      projectPath: normalized.projectPath,
      projectName,
      sourceReports: buildWeeklySummarySourceSnapshot(sources),
      structuredJson: metadata,
      aiProfileId: normalized.aiProfileId || config.activeAiProfileId,
      generatedAt: new Date().toISOString(),
    });
    await persistDatabase();
    return record;
  } catch (error) {
    await recordErrorLog('generateWeeklySummary', error);
    throw error;
  }
}
