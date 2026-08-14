import { computed } from 'vue';
import type { Ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { AppConfig, AutoSyncState, AutoSyncStatus, AutoSyncTaskState, ReportResult, ReportTimeRange } from '@shared/types';

type AutoSyncStateContext = {
  config: AppConfig;
  status: Ref<string>;
  autoSyncLoading: Ref<boolean>;
  autoSyncState: Ref<AutoSyncState | null>;
  report: Ref<string>;
  lastReportResult: Ref<ReportResult | null>;
  currentReportId: Ref<number | null>;
  getConfigPayload: () => AppConfig;
  persistConfigBeforeAction: (actionLabel: string) => Promise<AppConfig>;
  applyReportTimeRange: (date: string, timeRange?: ReportTimeRange) => void;
  applyFullDayReportRange: (date: string) => void;
  refreshLocalData: () => Promise<void>;
  today: string;
};

export const AUTO_SYNC_STATUS_LABELS: Record<AutoSyncStatus, string> = {
  idle: '未执行',
  running: '执行中',
  success: '成功',
  failed: '失败',
  skipped: '已跳过',
};

export function getAutoSyncStatusType(statusValue: AutoSyncStatus | undefined) {
  if (statusValue === 'success') return 'success';
  if (statusValue === 'failed') return 'danger';
  if (statusValue === 'running') return 'warning';
  return 'info';
}

export function getAutoSyncStatusLabel(statusValue: AutoSyncStatus | undefined) {
  return (statusValue && AUTO_SYNC_STATUS_LABELS[statusValue]) || '未执行';
}

export function createAutoSyncState(ctx: AutoSyncStateContext) {
  const {
    config,
    status,
    autoSyncLoading,
    autoSyncState,
    report,
    lastReportResult,
    currentReportId,
    getConfigPayload,
    persistConfigBeforeAction,
    applyReportTimeRange,
    applyFullDayReportRange,
    refreshLocalData,
    today,
  } = ctx;

  const autoSyncRunning = computed(() => autoSyncLoading.value || Boolean(autoSyncState.value?.isRunning));


  function aggregateAutoSyncStatus(): AutoSyncStatus {
    if (autoSyncState.value?.isRunning) return 'running';
    const tasks = autoSyncState.value?.tasks ?? config.autoSync.tasks ?? [];
    const statuses = tasks.map((task) => task.lastStatus);
    if (statuses.includes('running')) return 'running';
    if (statuses.includes('failed')) return 'failed';
    if (statuses.includes('success')) return 'success';
    if (statuses.includes('skipped')) return 'skipped';
    return 'idle';
  }


  const autoSyncStatusType = computed(() => getAutoSyncStatusType(aggregateAutoSyncStatus()));


  const autoSyncStatusLabel = computed(() => getAutoSyncStatusLabel(aggregateAutoSyncStatus()));


  function getAutoSyncTaskState(taskId: string): AutoSyncTaskState | null {
    return (autoSyncState.value?.tasks ?? []).find((task) => task.id === taskId) ?? null;
  }


  function applyAutoSyncState(state: AutoSyncState) {
    const tasks = state.tasks ?? [];
    autoSyncState.value = { ...state, tasks };
    config.autoSync.enabled = Boolean(state.enabled);
    config.autoSync.tasks = tasks.map((task) => {
      const { nextRunAt: _nextRunAt, isRunning: _isRunning, ...taskConfig } = task;
      return { ...taskConfig, repoPaths: [...(taskConfig.repoPaths ?? [])] };
    });
  }


  async function refreshAutoSyncState() {
    applyAutoSyncState(await window.api.getAutoSyncState());
  }


  async function validateAutoSyncBeforeSave(payload: AppConfig) {
    if (!payload.autoSync.enabled) return true;
    const result = await window.api.validateAutoSync(payload);
    if (result.valid) return true;
    ElMessage.warning(result.message);
    return false;
  }


  async function runAutoSyncNow(taskId?: string) {
    const payload = getConfigPayload();
    if (taskId) {
      const validation = await window.api.validateAutoSync(payload, taskId);
      if (!validation.valid) {
        ElMessage.warning(validation.message);
        return;
      }
    } else if (!(await validateAutoSyncBeforeSave(payload))) {
      return;
    }

    autoSyncLoading.value = true;
    try {
      await persistConfigBeforeAction('执行自动同步');
      const result = await window.api.runAutoSyncNow(getConfigPayload(), taskId);
      status.value = result.message;
      const reportedTask = (result.taskResults ?? []).find((task) => task.report);
      if (reportedTask?.report) {
        report.value = reportedTask.report;
        lastReportResult.value = null;
        currentReportId.value = null;
        if (reportedTask.date) {
          applyReportTimeRange(reportedTask.date, reportedTask.timeRange);
        } else {
          applyFullDayReportRange(today);
        }
      }

      if (result.status === 'success') ElMessage.success(result.message);
      else if (result.status === 'skipped') ElMessage.warning(result.message);
      else if (result.status === 'failed') ElMessage.error(result.message);
      else ElMessage.info(result.message);

      await refreshAutoSyncState();
      await refreshLocalData();
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '自动同步执行失败');
    } finally {
      autoSyncLoading.value = false;
    }
  }



  return {
    autoSyncRunning,
    autoSyncStatusType,
    autoSyncStatusLabel,
    getAutoSyncTaskState,
    applyAutoSyncState,
    refreshAutoSyncState,
    validateAutoSyncBeforeSave,
    runAutoSyncNow,
  };
}
