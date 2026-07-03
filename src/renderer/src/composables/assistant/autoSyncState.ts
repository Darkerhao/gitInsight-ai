import { computed } from 'vue';
import type { Ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { AppConfig, AutoSyncState, ReportResult, ReportTimeRange } from '@shared/types';

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


  const autoSyncStatusType = computed(() => {
    const statusValue = autoSyncState.value?.lastStatus ?? config.autoSync.lastStatus;
    if (statusValue === 'success') return 'success';
    if (statusValue === 'failed') return 'danger';
    if (statusValue === 'running') return 'warning';
    if (statusValue === 'skipped') return 'info';
    return 'info';
  });


  const autoSyncStatusLabel = computed(() => {
    const statusValue = autoSyncState.value?.lastStatus ?? config.autoSync.lastStatus;
    const statusMap: Record<string, string> = {
      idle: '未执行',
      running: '执行中',
      success: '成功',
      failed: '失败',
      skipped: '已跳过',
    };
    return statusMap[statusValue] ?? '未执行';
  });


  function applyAutoSyncState(state: AutoSyncState) {
    autoSyncState.value = state;
    Object.assign(config.autoSync, {
      enabled: state.enabled,
      time: state.time,
      timeWindowMode: state.timeWindowMode,
      windowStartTime: state.windowStartTime,
      lastRunAt: state.lastRunAt,
      lastSuccessAt: state.lastSuccessAt,
      lastStatus: state.lastStatus,
      lastMessage: state.lastMessage,
      lastRunKey: state.lastRunKey,
      lastScheduledRunKey: state.lastScheduledRunKey,
      lastSuccessKey: state.lastSuccessKey,
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


  async function runAutoSyncNow() {
    const payload = getConfigPayload();
    if (!(await validateAutoSyncBeforeSave(payload))) return;

    autoSyncLoading.value = true;
    try {
      await persistConfigBeforeAction('执行自动同步');
      const result = await window.api.runAutoSyncNow(getConfigPayload());
      status.value = result.message;
      if (result.report) {
        report.value = result.report;
        lastReportResult.value = null;
        currentReportId.value = null;
        if (result.date) {
          applyReportTimeRange(result.date, result.timeRange);
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
    applyAutoSyncState,
    refreshAutoSyncState,
    validateAutoSyncBeforeSave,
    runAutoSyncNow,
  };
}
