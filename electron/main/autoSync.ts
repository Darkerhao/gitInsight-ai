import { DEFAULT_FEISHU_FORM_CONFIG } from '../../src/shared/types.js';
import type { AppConfig, AutoSyncConfig, AutoSyncRunResult, AutoSyncState, AutoSyncStatus, FeishuFormConfig, ReportTimeRange } from '../../src/shared/types.js';
import {
  loadConfig,
  normalizeConfig,
  normalizeAutoSyncTime,
  normalizeAutoSyncTimeWindowMode,
  normalizeRepoPaths,
  normalizeWorkHours,
  saveConfig,
} from './config.js';
import { formatDateTimeForGit, nextDateString, normalizeDateTimeValue, shiftDateString, toLocalDateString } from './dateUtils.js';
import { syncFeishuDaily } from './feishuForm.js';
import { requireFeishuConfigValue, resolveFeishuAuth } from './feishuAuth.js';
import { normalizeAuthorName } from './gitCollect.js';
import { generateReport } from './report.js';
import { sendToMainWindow, toCloneable } from './windows.js';

export let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

export let autoSyncRunning = false;

export let autoSyncStarting = false;

export function getScheduledDate(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = normalizeAutoSyncTime(time).split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}


export function buildAutoSyncTaskKey(config: AppConfig, date: string) {
  const repoKey = normalizeRepoPaths(config.selectedRepoPaths)
    .map((item) => item.toLocaleLowerCase())
    .sort()
    .join('|');
  const timeWindowKey = [
    normalizeAutoSyncTimeWindowMode(config.autoSync.timeWindowMode),
    normalizeAutoSyncTime(config.autoSync.windowStartTime),
  ].join('@');
  return [
    date,
    normalizeAuthorName(config.reporterName),
    config.feishuForm.projectOptionId.trim(),
    timeWindowKey,
    repoKey,
  ].join('::');
}


export function buildAutoSyncReportWindow(config: AppConfig, now = new Date()) {
  const date = toLocalDateString(now);

  if (normalizeAutoSyncTimeWindowMode(config.autoSync.timeWindowMode) === 'yesterday-start-to-run') {
    const startDate = shiftDateString(date, -1);
    return {
      date,
      startDateTime: normalizeDateTimeValue(`${startDate}T${normalizeAutoSyncTime(config.autoSync.windowStartTime)}:00`),
      endDateTime: normalizeDateTimeValue(formatDateTimeForGit(now).replace(' ', 'T')),
    };
  }

  return {
    date,
    startDateTime: normalizeDateTimeValue(`${date}T00:00:00`),
    endDateTime: normalizeDateTimeValue(`${nextDateString(date)}T00:00:00`),
  };
}


export function getNextAutoSyncRunDate(config: AppConfig, now = new Date()) {
  if (!config.autoSync.enabled) return null;

  const today = toLocalDateString(now);
  const scheduledToday = getScheduledDate(today, config.autoSync.time);
  const todayTaskKey = buildAutoSyncTaskKey(config, today);

  if (now.getTime() < scheduledToday.getTime()) {
    return scheduledToday;
  }

  if (config.autoSync.lastSuccessKey === todayTaskKey || config.autoSync.lastScheduledRunKey === todayTaskKey) {
    return getScheduledDate(nextDateString(today), config.autoSync.time);
  }

  return now;
}


export function getAutoSyncState(config: AppConfig): AutoSyncState {
  const nextRunDate = getNextAutoSyncRunDate(config);
  return {
    ...config.autoSync,
    isRunning: autoSyncRunning,
    nextRunAt: nextRunDate ? nextRunDate.toISOString() : '',
  };
}


export function emitAutoSyncState(config: AppConfig) {
  sendToMainWindow('auto-sync:updated', getAutoSyncState(config));
}


export function clearAutoSyncTimer() {
  if (!autoSyncTimer) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = null;
}


export function scheduleAutoSync(config: AppConfig) {
  clearAutoSyncTimer();
  const nextRunDate = getNextAutoSyncRunDate(config);
  emitAutoSyncState(config);

  if (!nextRunDate) return;

  const delay = Math.max(0, nextRunDate.getTime() - Date.now());
  autoSyncTimer = setTimeout(() => {
    void runAutoSync('scheduled');
  }, Math.min(delay, 2_147_483_647));
}


export async function refreshAutoSyncSchedule() {
  scheduleAutoSync(await loadConfig());
}


export async function updateAutoSyncStatus(
  status: AutoSyncStatus,
  message: string,
  options: {
    runKey: string;
    ranAt: string;
    scheduled: boolean;
    success?: boolean;
  },
) {
  const latestConfig = await loadConfig();
  const autoSync: AutoSyncConfig = {
    ...latestConfig.autoSync,
    lastRunAt: options.ranAt,
    lastStatus: status,
    lastMessage: message,
    lastRunKey: options.runKey,
    lastScheduledRunKey: options.scheduled ? options.runKey : latestConfig.autoSync.lastScheduledRunKey,
    lastSuccessAt: options.success ? options.ranAt : latestConfig.autoSync.lastSuccessAt,
    lastSuccessKey: options.success ? options.runKey : latestConfig.autoSync.lastSuccessKey,
  };
  const savedConfig = await saveConfig({ ...latestConfig, autoSync });
  emitAutoSyncState(savedConfig);
  return savedConfig;
}


export function buildAutoSyncRunResult(
  config: AppConfig,
  status: AutoSyncStatus,
  message: string,
  ranAt: string,
  report?: string,
  commitsCount?: number,
  date?: string,
  timeRange?: ReportTimeRange,
): AutoSyncRunResult {
  return toCloneable({
    status,
    message,
    ranAt,
    nextRunAt: getAutoSyncState(config).nextRunAt,
    report,
    date,
    timeRange,
    commitsCount,
  });
}


export async function validateAutoSyncConfig(config: AppConfig) {
  const repoPaths = normalizeRepoPaths(config.selectedRepoPaths);
  if (!repoPaths.length) {
    throw new Error('请至少选择一个项目后再启用自动同步');
  }
  requireFeishuConfigValue(config.reporterName, '汇报人');

  const formConfig: FeishuFormConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...config.feishuForm,
  };
  requireFeishuConfigValue(formConfig.projectOptionId, '飞书所属项目');
  requireFeishuConfigValue(formConfig.reporterUserId, '飞书汇报人 userId');
  requireFeishuConfigValue(formConfig.questionId, '明细表问题 ID');
  requireFeishuConfigValue(formConfig.dateFieldId, '日期字段 ID');
  requireFeishuConfigValue(formConfig.userFieldId, '汇报人字段 ID');
  requireFeishuConfigValue(formConfig.projectFieldId, '所属项目字段 ID');
  requireFeishuConfigValue(formConfig.hoursFieldId, '工作时长字段 ID');
  requireFeishuConfigValue(formConfig.contentFieldId, '工作内容字段 ID');
  await resolveFeishuAuth(formConfig, '自动同步配置校验失败');
}


export async function validateAutoSync(config: AppConfig) {
  try {
    await validateAutoSyncConfig(normalizeConfig(config));
    return { valid: true, message: '自动同步配置可用' };
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : '自动同步配置不可用' };
  }
}


export async function runAutoSync(trigger: 'scheduled' | 'manual'): Promise<AutoSyncRunResult> {
  const runDate = new Date();
  const ranAt = runDate.toISOString();
  const isScheduled = trigger === 'scheduled';

  if (autoSyncRunning || autoSyncStarting) {
    const skippedConfig = await loadConfig();
    return buildAutoSyncRunResult(skippedConfig, 'skipped', '已有自动同步任务正在执行', ranAt);
  }

  autoSyncStarting = true;
  let initialConfig: AppConfig;
  try {
    initialConfig = await loadConfig();
  } catch (error) {
    autoSyncStarting = false;
    throw error;
  }
  const initialReportWindow = buildAutoSyncReportWindow(initialConfig, runDate);
  const runKey = buildAutoSyncTaskKey(initialConfig, initialReportWindow.date);

  if (autoSyncRunning) {
    autoSyncStarting = false;
    return buildAutoSyncRunResult(initialConfig, 'skipped', '已有自动同步任务正在执行', ranAt);
  }

  if (isScheduled && !initialConfig.autoSync.enabled) {
    autoSyncStarting = false;
    return buildAutoSyncRunResult(initialConfig, 'skipped', '自动同步未启用', ranAt);
  }

  if (isScheduled && initialConfig.autoSync.lastSuccessKey === runKey) {
    autoSyncStarting = false;
    const savedConfig = await updateAutoSyncStatus('skipped', '今日相同配置已成功同步，本次跳过', {
      runKey,
      ranAt,
      scheduled: isScheduled,
    });
    return buildAutoSyncRunResult(savedConfig, 'skipped', '今日相同配置已成功同步，本次跳过', ranAt);
  }

  autoSyncRunning = true;
  autoSyncStarting = false;

  try {
    await updateAutoSyncStatus('running', '自动同步执行中', { runKey, ranAt, scheduled: isScheduled });

    const config = initialConfig;
    await validateAutoSyncConfig(config);

    const repoPaths = normalizeRepoPaths(config.selectedRepoPaths);
    const reportWindow = buildAutoSyncReportWindow(config, runDate);
    const result = await generateReport({
      repoPaths,
      date: reportWindow.date,
      startDateTime: reportWindow.startDateTime,
      endDateTime: reportWindow.endDateTime,
      reporterName: config.reporterName,
    });

    if (!result.commits.length) {
      const message = '跳过：未匹配到可生成日报的提交记录';
      const savedConfig = await updateAutoSyncStatus('skipped', message, { runKey, ranAt, scheduled: isScheduled });
      return buildAutoSyncRunResult(savedConfig, 'skipped', message, ranAt, result.report, 0, reportWindow.date, result.timeRange);
    }

    await syncFeishuDaily({
      config: config.feishuForm,
      report: result.report,
      date: reportWindow.date,
      reporterName: config.reporterName,
      reportId: result.historyId,
      triggerType: trigger,
    });

    const message = `已自动同步 ${result.commits.length} 条记录到飞书日报表（${result.timeRange.label}）`;
    const savedConfig = await updateAutoSyncStatus('success', message, {
      runKey,
      ranAt,
      scheduled: isScheduled,
      success: true,
    });
    return buildAutoSyncRunResult(savedConfig, 'success', message, ranAt, result.report, result.commits.length, reportWindow.date, result.timeRange);
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动同步失败';
    const savedConfig = await updateAutoSyncStatus('failed', message, { runKey, ranAt, scheduled: isScheduled });
    return buildAutoSyncRunResult(savedConfig, 'failed', message, ranAt);
  } finally {
    autoSyncStarting = false;
    autoSyncRunning = false;
    await refreshAutoSyncSchedule();
  }
}


export async function saveConfigAndReschedule(config: AppConfig) {
  const savedConfig = await saveConfig(config);
  scheduleAutoSync(savedConfig);
  emitAutoSyncState(savedConfig);
  return savedConfig;
}
