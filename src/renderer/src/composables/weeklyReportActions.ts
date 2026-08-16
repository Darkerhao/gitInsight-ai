import type {
  AppConfig,
  DailyReportRecord,
  FeishuProjectOption,
  GenerateReportParams,
  RepoInfo,
  ReportResult,
  SaveDailyReportPayload,
  SyncFeishuDailyPayload,
} from '../../../shared/types.js';
import { countWeeklyReportFiles } from '../../../shared/weeklyReport.js';
import { shiftLocalDate } from './assistant/dateUtils.js';

export type WeeklyGenerateStatus = 'idle' | 'generating' | 'success' | 'failed';
export type WeeklyPublishStatus = 'idle' | 'publishing' | 'success' | 'failed';
export type WeeklyWorkHoursSource = 'default' | 'estimated' | 'manual' | 'unresolved';

export interface WeeklyReportDraft {
  key: string;
  date: string;
  repo: RepoInfo;
  report: string;
  reportId: number | null;
  result: ReportResult | null;
  projectOptionId: string;
  workHours: number;
  workHoursSource: WeeklyWorkHoursSource;
  generateStatus: WeeklyGenerateStatus;
  publishStatus: WeeklyPublishStatus;
  dirty: boolean;
  message: string;
}

export interface WeeklyReportApi {
  generateReport(params: GenerateReportParams): Promise<ReportResult>;
  saveDailyReport(payload: SaveDailyReportPayload): Promise<DailyReportRecord>;
  syncFeishuDaily(payload: SyncFeishuDailyPayload): Promise<boolean>;
}

interface WeeklyReportActionContext {
  api: WeeklyReportApi;
  config: AppConfig;
  getProjectOptions: () => FeishuProjectOption[];
  displayRepoName: (repo: RepoInfo) => string;
}

async function generateWeeklyDraft(ctx: WeeklyReportActionContext, draft: WeeklyReportDraft) {
  draft.generateStatus = 'generating';
  draft.publishStatus = 'idle';
  draft.message = '';
  try {
    const result = await ctx.api.generateReport({
      repoPaths: [draft.repo.path], date: draft.date,
      startDateTime: `${draft.date}T00:00:00`, endDateTime: `${shiftLocalDate(draft.date, 1)}T00:00:00`,
      reporterName: ctx.config.reporterName, gitAuthorEmail: ctx.config.gitAuthorEmail,
      aiProfileId: ctx.config.activeAiProfileId,
    });
    draft.result = result;
    draft.reportId = result.historyId ?? null;
    draft.report = result.report;
    draft.generateStatus = 'success';
    draft.dirty = false;
    return true;
  } catch {
    draft.generateStatus = 'failed';
    draft.message = '生成日报失败，请稍后重试';
    return false;
  }
}

function getDraftTimeRange(draft: WeeklyReportDraft) {
  return draft.result?.timeRange ?? {
    startDateTime: `${draft.date}T00:00:00`,
    endDateTime: `${shiftLocalDate(draft.date, 1)}T00:00:00`,
    label: `${draft.date} 00:00 至 ${shiftLocalDate(draft.date, 1)} 00:00`,
  };
}

function buildSavePayload(ctx: WeeklyReportActionContext, draft: WeeklyReportDraft): SaveDailyReportPayload {
  const result = draft.result;
  return {
    id: draft.reportId ?? undefined,
    date: draft.date,
    timeRange: getDraftTimeRange(draft),
    reporterName: ctx.config.reporterName,
    repoNames: [ctx.displayRepoName(draft.repo)],
    repoPaths: [draft.repo.path],
    report: draft.report.trim(),
    status: result?.commits.length ? 'success' : 'draft',
    commitsCount: result?.commits.length ?? 0,
    filesCount: countWeeklyReportFiles(result),
    generatedAt: result?.generatedAt,
    rawInput: result?.rawInput,
    structuredJson: result?.structuredJson,
  };
}

async function saveWeeklyDraft(ctx: WeeklyReportActionContext, draft: WeeklyReportDraft) {
  if (!draft.report.trim()) {
    draft.message = '当前日报没有可保存的内容';
    return false;
  }
  try {
    const record = await ctx.api.saveDailyReport(buildSavePayload(ctx, draft));
    draft.reportId = record.id;
    draft.dirty = false;
    draft.message = '';
    return true;
  } catch {
    draft.message = '保存日报失败，请稍后重试';
    return false;
  }
}

function buildFeishuConfig(ctx: WeeklyReportActionContext, draft: WeeklyReportDraft) {
  return {
    ...ctx.config.feishuForm,
    projectOptionId: draft.projectOptionId,
    projectName: ctx.getProjectOptions().find((item) => item.id === draft.projectOptionId)?.name ?? '',
    defaultWorkHours: draft.workHours,
    projectWorkHours: { ...ctx.config.feishuForm.projectWorkHours, [draft.projectOptionId]: draft.workHours },
  };
}

function getPublishValidationMessage(draft: WeeklyReportDraft) {
  if (!draft.report.trim()) return '请先生成或编辑日报';
  if (!draft.projectOptionId.trim()) return '请选择飞书所属项目';
  if (draft.workHoursSource === 'unresolved') return '请先重新估算或手动确认工作时长';
  return '';
}

function buildSyncPayload(ctx: WeeklyReportActionContext, draft: WeeklyReportDraft): SyncFeishuDailyPayload {
  return {
    config: buildFeishuConfig(ctx, draft), report: draft.report.trim(), date: draft.date,
    reporterName: ctx.config.reporterName, workHours: draft.workHours,
    reportId: draft.reportId ?? undefined, triggerType: 'manual',
  };
}

async function publishWeeklyDraft(ctx: WeeklyReportActionContext, draft: WeeklyReportDraft) {
  const validationMessage = getPublishValidationMessage(draft);
  if (validationMessage) {
    draft.publishStatus = 'failed';
    draft.message = validationMessage;
    return false;
  }
  draft.publishStatus = 'publishing';
  draft.message = '正在提交飞书';
  if ((draft.dirty || !draft.reportId) && !(await saveWeeklyDraft(ctx, draft))) {
    draft.publishStatus = 'failed';
    return false;
  }
  try {
    await ctx.api.syncFeishuDaily(buildSyncPayload(ctx, draft));
    draft.publishStatus = 'success';
    draft.message = '已提交飞书日报';
    return true;
  } catch {
    draft.publishStatus = 'failed';
    draft.message = '提交飞书失败，请稍后重试';
    return false;
  }
}

export function createWeeklyReportActions(ctx: WeeklyReportActionContext) {
  return {
    generateDraft: (draft: WeeklyReportDraft) => generateWeeklyDraft(ctx, draft),
    saveDraft: (draft: WeeklyReportDraft) => saveWeeklyDraft(ctx, draft),
    publishDraft: (draft: WeeklyReportDraft) => publishWeeklyDraft(ctx, draft),
  };
}

export async function runWeeklyPublishBatch(
  drafts: WeeklyReportDraft[],
  publishDraft: (draft: WeeklyReportDraft) => Promise<boolean>,
) {
  let successCount = 0;
  let failedCount = 0;
  for (const draft of drafts) {
    if (await publishDraft(draft)) successCount += 1;
    else failedCount += 1;
  }
  return { successCount, failedCount };
}
