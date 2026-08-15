import { ElMessage } from 'element-plus';
import type { AppConfig, RepoInfo, ReportResult, ReportTimeRange } from '@shared/types';
import type { ComputedRef, Ref } from 'vue';
import { buildDateTime, shiftLocalDate } from './dateUtils';
import { normalizeWorkHours } from './normalizers';

type ReportRangeForm = { startDateTime: string; endDateTime: string };

type ReportStateContext = {
  config: AppConfig;
  form: { date: string; startDateTime: string; endDateTime: string; manualWorkContent: string };
  loading: Ref<boolean>;
  pushing: Ref<boolean>;
  report: Ref<string>;
  currentReportId: Ref<number | null>;
  lastReportResult: Ref<ReportResult | null>;
  selectedRepoPaths: Ref<string[]>;
  selectedRepos: ComputedRef<RepoInfo[]>;
  status: Ref<string>;
  persistConfigBeforeAction: (actionLabel: string) => Promise<AppConfig>;
  getConfigPayload: () => AppConfig;
  refreshLocalData: () => Promise<void>;
};

export function countResultFiles(result: ReportResult | null) {
  if (!result) return 0;
  return Array.from(new Set(result.commits.flatMap((commit) => commit.files))).length;
}

export function getReportRangePayloadFromForm(form: ReportRangeForm) {
  const startMs = new Date(form.startDateTime).getTime();
  const endMs = new Date(form.endDateTime).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) return null;
  return {
    startDateTime: form.startDateTime,
    endDateTime: form.endDateTime,
  };
}

export function resolveReportTimeRange(
  payload: { startDateTime: string; endDateTime: string } | null,
  label: string,
  previousRange?: ReportTimeRange,
): ReportTimeRange | undefined {
  if (!payload) return undefined;
  if (previousRange?.startDateTime === payload.startDateTime && previousRange.endDateTime === payload.endDateTime) {
    return toPlainReportTimeRange(previousRange);
  }

  return {
    ...payload,
    label,
  };
}

export function toPlainReportTimeRange(timeRange?: ReportTimeRange): ReportTimeRange | undefined {
  if (!timeRange) return undefined;
  return {
    startDateTime: timeRange.startDateTime,
    endDateTime: timeRange.endDateTime,
    label: timeRange.label,
  };
}

export function toPlainRawInput(rawInput?: ReportResult['rawInput']): ReportResult['rawInput'] | undefined {
  if (!rawInput) return undefined;
  return {
    gitLogs: rawInput.gitLogs,
    files: rawInput.files,
    diff: rawInput.diff,
    ...(rawInput.manualWorkContent ? { manualWorkContent: rawInput.manualWorkContent } : {}),
  };
}

export function createReportState(ctx: ReportStateContext) {
  const {
    config,
    form,
    loading,
    pushing,
    report,
    currentReportId,
    lastReportResult,
    selectedRepoPaths,
    selectedRepos,
    status,
    persistConfigBeforeAction,
    getConfigPayload,
    refreshLocalData,
  } = ctx;

  function formatDateTime(value?: string) {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无';
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }


  function applyFullDayReportRange(date: string) {
    form.date = date;
    form.startDateTime = buildDateTime(date, '00:00');
    form.endDateTime = buildDateTime(shiftLocalDate(date, 1), '00:00');
  }


  function applyReportTimeRange(date: string, timeRange?: ReportTimeRange) {
    form.date = date;
    if (timeRange?.startDateTime && timeRange.endDateTime) {
      form.startDateTime = timeRange.startDateTime;
      form.endDateTime = timeRange.endDateTime;
      return;
    }
    applyFullDayReportRange(date);
  }


  function getReportRangePayload() {
    return getReportRangePayloadFromForm(form);
  }


  function getCurrentReportTimeRange(): ReportTimeRange | undefined {
    const payload = getReportRangePayload();
    const label = payload ? `${formatDateTime(payload.startDateTime)} 至 ${formatDateTime(payload.endDateTime)}` : '';
    return resolveReportTimeRange(payload, label, lastReportResult.value?.timeRange);
  }


  async function generate() {
    if (!selectedRepos.value.length) {
      ElMessage.warning('请至少选择一个项目');
      return;
    }
    if (!config.reporterName) {
      ElMessage.warning('请先填写汇报人');
      return;
    }
    const reportRange = getReportRangePayload();
    if (!reportRange) {
      ElMessage.warning('请选择有效的提交时间段');
      return;
    }

    loading.value = true;
    try {
      await persistConfigBeforeAction('生成日报');
      const result = await window.api.generateReport({
        repoPaths: [...selectedRepoPaths.value],
        date: form.date,
        ...reportRange,
        reporterName: config.reporterName,
        gitAuthorEmail: config.gitAuthorEmail,
        aiProfileId: config.activeAiProfileId,
        manualWorkContent: form.manualWorkContent.trim() || undefined,
      });
      lastReportResult.value = result;
      currentReportId.value = result.historyId ?? null;
      report.value = result.report;
      status.value = `已汇总 ${result.repos.length} 个仓库，生成 ${result.commits.length} 条记录`;
      await refreshLocalData();
      if (!result.commits.length && !form.manualWorkContent.trim()) {
        ElMessage.warning('未匹配到可用于生成日报的提交记录');
        return;
      }
      ElMessage.success('日报已生成');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '生成失败');
    } finally {
      loading.value = false;
    }
  }


  async function generateAndPush() {
    await generate();
    if (!report.value) return;
    await push();
  }


  async function push(reportContent = report.value) {
    const content = reportContent.trim();
    if (!content) {
      ElMessage.warning('请先生成日报');
      return;
    }

    pushing.value = true;
    try {
      await persistConfigBeforeAction('同步飞书');
      await window.api.syncFeishuDaily({
        config: getConfigPayload().feishuForm,
        report: content,
        date: form.date,
        reporterName: config.reporterName,
        workHours: normalizeWorkHours(config.feishuForm.defaultWorkHours),
        reportId: currentReportId.value ?? undefined,
        triggerType: 'manual',
      });
      ElMessage.success('已同步到飞书日报表');
      await refreshLocalData();
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '同步飞书失败');
    } finally {
      pushing.value = false;
    }
  }


  async function saveCurrentReport(reportContent = report.value) {
    const content = reportContent.trim();
    if (!content) {
      ElMessage.warning('当前没有可保存的日报内容');
      return null;
    }

    const selected = selectedRepos.value;
    const result = lastReportResult.value;
    const record = await window.api.saveDailyReport({
      id: currentReportId.value ?? undefined,
      date: form.date,
      reporterName: config.reporterName,
      repoNames: result?.repos.map((item) => item.name) ?? selected.map((item) => item.name),
      repoPaths: result?.repos.map((item) => item.path) ?? selected.map((item) => item.path),
      report: content,
      status: result?.commits.length ? 'success' : 'draft',
      commitsCount: result?.commits.length ?? 0,
      filesCount: countResultFiles(result),
      generatedAt: result?.generatedAt,
      timeRange: getCurrentReportTimeRange(),
      rawInput: toPlainRawInput(result?.rawInput),
    });
    currentReportId.value = record.id;
    await refreshLocalData();
    ElMessage.success('日报已保存');
    return record;
  }



  return {
    countResultFiles,
    formatDateTime,
    applyFullDayReportRange,
    applyReportTimeRange,
    getReportRangePayload,
    getCurrentReportTimeRange,
    generate,
    generateAndPush,
    push,
    saveCurrentReport,
  };
}
