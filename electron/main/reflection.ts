import type {
  WeeklyReflectionMetadata,
  WeeklyReflectionParams,
  WeeklyReflectionProject,
  WeeklyReflectionRecord,
  WeeklyReflectionSource,
} from '../../src/shared/types.js';
import {
  buildWeeklyReflectionPrompt,
  buildWeeklyReflectionSourceSnapshot,
  normalizeWeeklyReflectionParams,
  validateWeeklyReflectionEvidence,
} from '../../src/shared/weeklyReflection.js';
import { callAiWeeklyReflection, resolveAiConfig } from './aiClient.js';
import { loadConfig } from './config.js';
import { getDatabase, persistDatabase, recordErrorLog, rowToDailyReportRecord } from './database.js';
import {
  queryWeeklyReflectionProjects,
  queryWeeklyReflectionSources,
  queryWeeklyReflections,
  upsertWeeklyReflection,
  type SaveWeeklyReflectionPayload,
} from './reflectionStore.js';

export async function getWeeklyReflectionProjects(): Promise<WeeklyReflectionProject[]> {
  return queryWeeklyReflectionProjects(await getDatabase(), rowToDailyReportRecord);
}


export async function getWeeklyReflectionSources(params: WeeklyReflectionParams): Promise<WeeklyReflectionSource[]> {
  return queryWeeklyReflectionSources(await getDatabase(), normalizeWeeklyReflectionParams(params), rowToDailyReportRecord);
}


export async function getWeeklyReflectionHistory(limit = 20): Promise<WeeklyReflectionRecord[]> {
  return queryWeeklyReflections(await getDatabase(), limit);
}


export async function generateWeeklyReflection(params: WeeklyReflectionParams): Promise<WeeklyReflectionRecord> {
  const normalized = normalizeWeeklyReflectionParams(params);
  const db = await getDatabase();
  const sources = queryWeeklyReflectionSources(db, normalized, rowToDailyReportRecord);
  if (!sources.length) {
    throw new Error('所选项目和日期范围内没有可用于反思的日报');
  }

  const config = await loadConfig();
  const aiConfig = resolveAiConfig(config, normalized.aiProfileId);
  if (!aiConfig.aiApiKey.trim()) {
    throw new Error('请先在 AI 设置中配置 API Key，再生成项目周反思');
  }

  try {
    const prompt = buildWeeklyReflectionPrompt(normalized, sources);
    const metadata: WeeklyReflectionMetadata = await callAiWeeklyReflection(aiConfig, prompt);
    validateWeeklyReflectionEvidence(metadata, sources);
    const payload: SaveWeeklyReflectionPayload = {
      projectPath: normalized.projectPath,
      projectName: sources[0]?.projectName || '当前项目',
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      sourceScope: normalized.sourceScope || 'all',
      sourceReports: buildWeeklyReflectionSourceSnapshot(sources),
      structuredJson: metadata,
      aiProfileId: normalized.aiProfileId || config.activeAiProfileId,
      generatedAt: new Date().toISOString(),
    };
    const record = upsertWeeklyReflection(db, payload);
    await persistDatabase();
    return record;
  } catch (error) {
    await recordErrorLog('generateWeeklyReflection', error);
    throw error;
  }
}
