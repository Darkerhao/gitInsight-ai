import type {
  AppConfig, DailyReportRecord, FeishuProjectOption, GenerateReportParams,
  RepoInfo, ReportResult, ReportTimeRange, SaveDailyReportPayload,
  SyncFeishuDailyPayload, SyncFeishuDailyResult,
} from '../../../shared/types.js';
import { countWeeklyReportFiles } from '../../../shared/weeklyReport.js';
import { shiftLocalDate } from './assistant/dateUtils.js';
import { projectGenerationInput } from './assistant/projectGeneration.js';
import { toPlainRawInput, toPlainReportTimeRange, toPlainStructuredJson } from './assistant/reportIpcPayload.js';

export interface ProjectReportDraft {
  key: string;
  repo: RepoInfo;
  report: string;
  manualWorkContent: string;
  reportId: number | null;
  lastReportResult: ReportResult | null;
  projectOptionId: string;
  workHours: number;
  workHoursSource: 'default' | 'estimated' | 'manual' | 'unresolved';
  generateStatus: 'idle' | 'generating' | 'success' | 'failed' | 'cancelled';
  generateMessage: string;
  publishStatus: 'idle' | 'publishing' | 'success' | 'failed';
  publishMessage: string;
  dirty: boolean;
}

export interface WeeklyReportDraft extends ProjectReportDraft { date: string }

export interface ProjectReportApi {
  generateReport(params: GenerateReportParams): Promise<ReportResult>;
  saveDailyReport(payload: SaveDailyReportPayload): Promise<DailyReportRecord>;
  syncFeishuDaily(payload: SyncFeishuDailyPayload): Promise<SyncFeishuDailyResult>;
}

interface ReportScope { date: string; timeRange?: ReportTimeRange }
interface ActionContext<T extends ProjectReportDraft> {
  api: ProjectReportApi;
  config: AppConfig;
  getProjectOptions: () => FeishuProjectOption[];
  displayRepoName: (repo: RepoInfo) => string;
  getScope: (draft: T) => ReportScope;
}
interface GenerationOptions {
  requestId?: string;
  signal?: AbortSignal;
  promptStyle?: GenerateReportParams['promptStyle'];
}

export function fullDayReportScope(draft: { date: string }): ReportScope {
  const startDateTime = `${draft.date}T00:00:00`;
  const endDateTime = `${shiftLocalDate(draft.date, 1)}T00:00:00`;
  return { date: draft.date, timeRange: { startDateTime, endDateTime, label: `${draft.date} 全天` } };
}

export function createProjectReportActions<T extends ProjectReportDraft>(ctx: ActionContext<T>) {
  async function generateDraft(draft: T, options: GenerationOptions = {}) {
    if (options.signal?.aborted) return false;
    draft.generateStatus = 'generating';
    draft.generateMessage = '';
    const scope = ctx.getScope(draft);
    try {
      const result = await ctx.api.generateReport({
        ...projectGenerationInput(draft), date: scope.date,
        startDateTime: scope.timeRange?.startDateTime, endDateTime: scope.timeRange?.endDateTime,
        reporterName: ctx.config.reporterName, gitAuthorEmail: ctx.config.gitAuthorEmail,
        aiProfileId: ctx.config.activeAiProfileId,
        requestId: options.requestId, promptStyle: options.promptStyle,
      });
      // A completed request may already be persisted, even if cancellation raced with it.
      draft.lastReportResult = result;
      draft.reportId = result.historyId ?? null;
      draft.report = result.report;
      draft.generateStatus = 'success';
      draft.publishStatus = 'idle';
      draft.publishMessage = '';
      draft.dirty = false;
      return true;
    } catch {
      draft.generateStatus = options.signal?.aborted ? 'cancelled' : 'failed';
      draft.generateMessage = options.signal?.aborted ? '已取消生成，原有日报已保留' : '生成日报失败，请稍后重试';
      return false;
    }
  }

  async function saveDraft(draft: T) {
    if (!draft.report.trim()) {
      draft.publishMessage = '当前日报没有可保存的内容';
      return false;
    }
    const result = draft.lastReportResult;
    const scope = ctx.getScope(draft);
    try {
      const record = await ctx.api.saveDailyReport({
        id: draft.reportId ?? undefined, date: scope.date,
        timeRange: toPlainReportTimeRange(scope.timeRange),
        reporterName: ctx.config.reporterName,
        repoNames: [ctx.displayRepoName(draft.repo)], repoPaths: [draft.repo.path],
        report: draft.report.trim(), status: result?.commits.length ? 'success' : 'draft',
        commitsCount: result?.commits.length ?? 0, filesCount: countWeeklyReportFiles(result),
        generatedAt: result?.generatedAt,
        rawInput: {
          ...(toPlainRawInput(result?.rawInput) ?? { gitLogs: '', files: '', diff: '' }),
          manualWorkContent: draft.manualWorkContent.trim() || undefined,
        },
        structuredJson: toPlainStructuredJson(result?.structuredJson),
      });
      draft.reportId = record.id;
      draft.dirty = false;
      if (draft.publishStatus !== 'success') draft.publishMessage = '';
      return true;
    } catch {
      draft.publishMessage = '保存日报失败，请稍后重试';
      return false;
    }
  }

  function buildFeishuConfig(draft: T) {
    return {
      ...ctx.config.feishuForm,
      projectOptionId: draft.projectOptionId,
      projectName: ctx.getProjectOptions().find((item) => item.id === draft.projectOptionId)?.name ?? '',
      defaultWorkHours: draft.workHours,
      projectWorkHours: { ...ctx.config.feishuForm.projectWorkHours, [draft.projectOptionId]: draft.workHours },
    };
  }

  async function publishDraft(draft: T) {
    const scope = ctx.getScope(draft);
    const message = !scope.date ? '请选择发布日期'
      : !draft.report.trim() ? '请先生成或编辑日报'
      : !draft.projectOptionId.trim() ? '请选择飞书所属项目'
      : draft.workHoursSource === 'unresolved' ? '请先重新估算或手动确认工作时长' : '';
    if (message) {
      draft.publishStatus = 'failed';
      draft.publishMessage = message;
      return false;
    }
    draft.publishStatus = 'publishing';
    draft.publishMessage = '正在提交飞书';
    if ((draft.dirty || !draft.reportId) && !(await saveDraft(draft))) {
      draft.publishStatus = 'failed';
      return false;
    }
    try {
      const result = await ctx.api.syncFeishuDaily({
        config: buildFeishuConfig(draft), report: draft.report.trim(), date: scope.date,
        reporterName: ctx.config.reporterName, workHours: draft.workHours,
        reportId: draft.reportId ?? undefined, triggerType: 'manual',
      });
      draft.publishStatus = 'success';
      draft.publishMessage = result.warning || '已提交飞书日报';
      return true;
    } catch {
      draft.publishStatus = 'failed';
      draft.publishMessage = '提交结果未确认，请先核对飞书提交记录';
      return false;
    }
  }

  return { generateDraft, saveDraft, publishDraft, buildFeishuConfig };
}

export async function runProjectPublishBatch<T extends ProjectReportDraft>(
  drafts: T[], publishDraft: (draft: T) => Promise<boolean>,
) {
  let successCount = 0;
  let failedCount = 0;
  for (const draft of drafts) {
    if (draft.publishStatus === 'success') continue;
    if (await publishDraft(draft)) successCount += 1;
    else failedCount += 1;
  }
  return { successCount, failedCount };
}
