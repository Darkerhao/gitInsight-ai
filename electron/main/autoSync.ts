import { DEFAULT_FEISHU_FORM_CONFIG } from '../../src/shared/types.js';
import type {
  AppConfig,
  AutoSyncRunResult,
  AutoSyncState,
  AutoSyncStatus,
  AutoSyncTaskConfig,
  AutoSyncTaskRunResult,
  AutoSyncTaskValidationResult,
  AutoSyncValidationResult,
  FeishuFormConfig,
} from '../../src/shared/types.js';
import type { AutoSyncKeyContext } from './autoSyncCore.js';
import {
  buildAutoSyncReportWindow,
  buildAutoSyncTaskKey,
  getNextAutoSyncRun,
  getNextTaskRunDate,
  resolveTaskWorkHours,
  selectDueAutoSyncTasks,
} from './autoSyncCore.js';
import { loadConfig, normalizeConfig, saveConfig } from './config.js';
import { syncFeishuDaily } from './feishuForm.js';
import { requireFeishuConfigValue, resolveFeishuAuth } from './feishuAuth.js';
import { generateReport } from './report.js';
import { sendToMainWindow, toCloneable } from './windows.js';

export let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

export let autoSyncRunning = false;

export let autoSyncStarting = false;

export let autoSyncRunningTaskId = '';

function getAutoSyncKeyContext(config: AppConfig): AutoSyncKeyContext {
  return { reporterName: config.reporterName, gitAuthorEmail: config.gitAuthorEmail };
}


export function getAutoSyncState(config: AppConfig): AutoSyncState {
  const ctx = getAutoSyncKeyContext(config);
  const nextRun = getNextAutoSyncRun(config.autoSync, ctx);
  return {
    enabled: config.autoSync.enabled,
    tasks: config.autoSync.tasks.map((task) => {
      const taskNextRunDate = config.autoSync.enabled ? getNextTaskRunDate(task, ctx) : null;
      return {
        ...task,
        nextRunAt: taskNextRunDate ? taskNextRunDate.toISOString() : '',
        isRunning: autoSyncRunning && autoSyncRunningTaskId === task.id,
      };
    }),
    isRunning: autoSyncRunning,
    runningTaskId: autoSyncRunning ? autoSyncRunningTaskId : '',
    nextRunAt: nextRun ? nextRun.runAt.toISOString() : '',
    nextRunTaskId: nextRun ? nextRun.taskId : '',
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
  const nextRun = getNextAutoSyncRun(config.autoSync, getAutoSyncKeyContext(config));
  emitAutoSyncState(config);

  if (!nextRun) return;

  const delay = Math.max(0, nextRun.runAt.getTime() - Date.now());
  autoSyncTimer = setTimeout(() => {
    void runAutoSync('scheduled');
  }, Math.min(delay, 2_147_483_647));
}


export async function refreshAutoSyncSchedule() {
  scheduleAutoSync(await loadConfig());
}


export async function updateAutoSyncTaskStatus(
  taskId: string,
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
  const tasks = latestConfig.autoSync.tasks.map((task) =>
    task.id !== taskId
      ? task
      : {
          ...task,
          lastRunAt: options.ranAt,
          lastStatus: status,
          lastMessage: message,
          lastRunKey: options.runKey,
          lastScheduledRunKey: options.scheduled ? options.runKey : task.lastScheduledRunKey,
          lastSuccessAt: options.success ? options.ranAt : task.lastSuccessAt,
          lastSuccessKey: options.success ? options.runKey : task.lastSuccessKey,
        },
  );
  const savedConfig = await saveConfig({ ...latestConfig, autoSync: { ...latestConfig.autoSync, tasks } });
  emitAutoSyncState(savedConfig);
  return savedConfig;
}


export function buildAutoSyncRunResult(
  config: AppConfig,
  status: AutoSyncStatus,
  message: string,
  ranAt: string,
  taskResults: AutoSyncTaskRunResult[],
): AutoSyncRunResult {
  return toCloneable({
    status,
    message,
    ranAt,
    nextRunAt: getAutoSyncState(config).nextRunAt,
    taskResults,
  });
}


function mergeFeishuFormConfig(config: AppConfig): FeishuFormConfig {
  return {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...config.feishuForm,
  };
}


export async function validateSharedAutoSyncConfig(config: AppConfig) {
  requireFeishuConfigValue(config.reporterName, '汇报人');

  const formConfig = mergeFeishuFormConfig(config);
  requireFeishuConfigValue(formConfig.reporterUserId, '飞书汇报人 userId');
  requireFeishuConfigValue(formConfig.questionId, '明细表问题 ID');
  requireFeishuConfigValue(formConfig.dateFieldId, '日期字段 ID');
  requireFeishuConfigValue(formConfig.userFieldId, '汇报人字段 ID');
  requireFeishuConfigValue(formConfig.projectFieldId, '所属项目字段 ID');
  requireFeishuConfigValue(formConfig.hoursFieldId, '工作时长字段 ID');
  requireFeishuConfigValue(formConfig.contentFieldId, '工作内容字段 ID');
  await resolveFeishuAuth(formConfig, '自动同步配置校验失败');
}


export function validateAutoSyncTaskFields(task: AutoSyncTaskConfig) {
  if (!task.repoPaths.length) {
    throw new Error('请为任务选择至少一个统计仓库');
  }
  requireFeishuConfigValue(task.projectOptionId, '飞书所属项目');
}


export async function validateAutoSyncTaskConfig(config: AppConfig, task: AutoSyncTaskConfig) {
  validateAutoSyncTaskFields(task);
  await validateSharedAutoSyncConfig(config);
}


export async function validateAutoSync(config: AppConfig, taskId?: string): Promise<AutoSyncValidationResult> {
  const normalizedConfig = normalizeConfig(config);
  const tasks = normalizedConfig.autoSync.tasks;
  const targetTasks = taskId ? tasks.filter((task) => task.id === taskId) : tasks.filter((task) => task.enabled);

  if (!targetTasks.length) {
    const message = taskId ? '未找到指定的同步任务' : '请至少配置并启用一个同步任务';
    return { valid: false, message, results: [] };
  }

  let sharedErrorMessage = '';
  try {
    await validateSharedAutoSyncConfig(normalizedConfig);
  } catch (error) {
    sharedErrorMessage = error instanceof Error ? error.message : '自动同步配置不可用';
  }

  const results: AutoSyncTaskValidationResult[] = targetTasks.map((task) => {
    let message = sharedErrorMessage;
    try {
      validateAutoSyncTaskFields(task);
    } catch (error) {
      message = `任务「${task.name}」：${error instanceof Error ? error.message : '任务配置不可用'}`;
    }
    return {
      taskId: task.id,
      taskName: task.name,
      valid: !message,
      message: message || '任务配置可用',
    };
  });

  const firstInvalid = results.find((item) => !item.valid);
  return {
    valid: !firstInvalid,
    message: firstInvalid ? firstInvalid.message : '自动同步配置可用',
    results,
  };
}


function aggregateAutoSyncRunStatus(taskResults: AutoSyncTaskRunResult[]): AutoSyncStatus {
  if (taskResults.some((item) => item.status === 'failed')) return 'failed';
  if (taskResults.some((item) => item.status === 'success')) return 'success';
  return 'skipped';
}


function buildAggregateRunMessage(taskResults: AutoSyncTaskRunResult[]) {
  if (taskResults.length === 1) return taskResults[0].message;
  const successCount = taskResults.filter((item) => item.status === 'success').length;
  const skippedCount = taskResults.filter((item) => item.status === 'skipped').length;
  const failedCount = taskResults.filter((item) => item.status === 'failed').length;
  return `已执行 ${taskResults.length} 个同步任务：成功 ${successCount}、跳过 ${skippedCount}、失败 ${failedCount}`;
}


async function runAutoSyncTask(
  task: AutoSyncTaskConfig,
  config: AppConfig,
  trigger: 'scheduled' | 'manual',
  runDate: Date,
  ranAt: string,
): Promise<AutoSyncTaskRunResult> {
  const isScheduled = trigger === 'scheduled';
  const reportWindow = buildAutoSyncReportWindow(task, runDate);
  const runKey = buildAutoSyncTaskKey(task, getAutoSyncKeyContext(config), reportWindow.date);

  try {
    if (isScheduled && task.lastSuccessKey === runKey) {
      const message = '今日相同配置已成功同步，本次跳过';
      await updateAutoSyncTaskStatus(task.id, 'skipped', message, { runKey, ranAt, scheduled: isScheduled });
      return { taskId: task.id, taskName: task.name, status: 'skipped', message };
    }

    await updateAutoSyncTaskStatus(task.id, 'running', '自动同步执行中', { runKey, ranAt, scheduled: isScheduled });
    await validateAutoSyncTaskConfig(config, task);

    const result = await generateReport({
      repoPaths: task.repoPaths,
      date: reportWindow.date,
      startDateTime: reportWindow.startDateTime,
      endDateTime: reportWindow.endDateTime,
      reporterName: config.reporterName,
      gitAuthorEmail: config.gitAuthorEmail,
    });

    if (!result.commits.length) {
      const message = '跳过：未匹配到可生成日报的提交记录';
      await updateAutoSyncTaskStatus(task.id, 'skipped', message, { runKey, ranAt, scheduled: isScheduled });
      return {
        taskId: task.id,
        taskName: task.name,
        status: 'skipped',
        message,
        report: result.report,
        date: reportWindow.date,
        timeRange: result.timeRange,
        commitsCount: 0,
      };
    }

    await syncFeishuDaily({
      config: {
        ...mergeFeishuFormConfig(config),
        projectOptionId: task.projectOptionId,
        projectName: task.projectName,
      },
      report: result.report,
      date: reportWindow.date,
      reporterName: config.reporterName,
      workHours: resolveTaskWorkHours(task, config.feishuForm),
      reportId: result.historyId,
      triggerType: trigger,
    });

    const message = `已自动同步 ${result.commits.length} 条记录到飞书日报表（${result.timeRange.label}）`;
    await updateAutoSyncTaskStatus(task.id, 'success', message, { runKey, ranAt, scheduled: isScheduled, success: true });
    return {
      taskId: task.id,
      taskName: task.name,
      status: 'success',
      message,
      report: result.report,
      date: reportWindow.date,
      timeRange: result.timeRange,
      commitsCount: result.commits.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动同步失败';
    await updateAutoSyncTaskStatus(task.id, 'failed', message, { runKey, ranAt, scheduled: isScheduled });
    return { taskId: task.id, taskName: task.name, status: 'failed', message };
  }
}


export async function runAutoSync(trigger: 'scheduled' | 'manual', taskId?: string): Promise<AutoSyncRunResult> {
  const runDate = new Date();
  const ranAt = runDate.toISOString();
  const isScheduled = trigger === 'scheduled';

  if (autoSyncRunning || autoSyncStarting) {
    const skippedConfig = await loadConfig();
    return buildAutoSyncRunResult(skippedConfig, 'skipped', '已有自动同步任务正在执行', ranAt, []);
  }

  autoSyncStarting = true;
  let config: AppConfig;
  try {
    config = await loadConfig();
  } catch (error) {
    autoSyncStarting = false;
    throw error;
  }

  if (autoSyncRunning) {
    autoSyncStarting = false;
    return buildAutoSyncRunResult(config, 'skipped', '已有自动同步任务正在执行', ranAt, []);
  }

  let targetTasks: AutoSyncTaskConfig[];
  if (taskId) {
    const task = config.autoSync.tasks.find((item) => item.id === taskId);
    if (!task) {
      autoSyncStarting = false;
      return buildAutoSyncRunResult(config, 'failed', '未找到指定的同步任务', ranAt, []);
    }
    targetTasks = [task];
  } else if (isScheduled) {
    if (!config.autoSync.enabled) {
      autoSyncStarting = false;
      return buildAutoSyncRunResult(config, 'skipped', '自动同步未启用', ranAt, []);
    }
    targetTasks = selectDueAutoSyncTasks(config.autoSync, getAutoSyncKeyContext(config), runDate);
    if (!targetTasks.length) {
      autoSyncStarting = false;
      return buildAutoSyncRunResult(config, 'skipped', '当前没有到期的同步任务', ranAt, []);
    }
  } else {
    targetTasks = config.autoSync.tasks.filter((task) => task.enabled);
    if (!targetTasks.length) {
      autoSyncStarting = false;
      return buildAutoSyncRunResult(config, 'skipped', '没有已启用的同步任务', ranAt, []);
    }
  }

  autoSyncRunning = true;
  autoSyncStarting = false;
  const taskResults: AutoSyncTaskRunResult[] = [];

  try {
    for (const task of targetTasks) {
      autoSyncRunningTaskId = task.id;
      taskResults.push(await runAutoSyncTask(task, config, trigger, runDate, ranAt));
    }
  } finally {
    autoSyncRunningTaskId = '';
    autoSyncRunning = false;
    autoSyncStarting = false;
    await refreshAutoSyncSchedule();
  }

  const latestConfig = await loadConfig();
  return buildAutoSyncRunResult(
    latestConfig,
    aggregateAutoSyncRunStatus(taskResults),
    buildAggregateRunMessage(taskResults),
    ranAt,
    taskResults,
  );
}


export async function saveConfigAndReschedule(config: AppConfig) {
  const savedConfig = await saveConfig(config);
  scheduleAutoSync(savedConfig);
  emitAutoSyncState(savedConfig);
  return savedConfig;
}
