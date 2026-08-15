import {
  DEFAULT_AUTO_SYNC_TASK_CONFIG,
  DEFAULT_FEISHU_FORM_CONFIG,
} from '../../src/shared/types.js';
import type {
  AutoSyncConfig,
  AutoSyncStatus,
  AutoSyncTaskConfig,
  AutoSyncTimeWindowMode,
  FeishuFormConfig,
} from '../../src/shared/types.js';
import { formatDateTimeForGit, nextDateString, normalizeDateTimeValue, shiftDateString, toLocalDateString } from './dateUtils.js';

export interface AutoSyncKeyContext {
  reporterName: string;
  gitAuthorEmail?: string;
}

export interface AutoSyncNormalizeContext {
  feishuForm?: Partial<FeishuFormConfig>;
  selectedRepoPaths?: unknown;
}

/** 旧版全局单例 autoSync 的字段特征，用于识别需要迁移的配置。 */
const LEGACY_AUTO_SYNC_FIELDS = [
  'time',
  'timeWindowMode',
  'windowStartTime',
  'lastRunAt',
  'lastSuccessAt',
  'lastStatus',
  'lastMessage',
  'lastRunKey',
  'lastScheduledRunKey',
  'lastSuccessKey',
] as const;

export function normalizeRepoPaths(options: unknown) {
  const source = Array.isArray(options) ? options : [];
  return Array.from(new Set(source.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)));
}


export function normalizeWorkHours(value: unknown, fallback = DEFAULT_FEISHU_FORM_CONFIG.defaultWorkHours) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return fallback;
  return Math.min(Math.max(normalized, 0.5), 24);
}


export function normalizeProjectWorkHours(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, hours]) => [key.trim(), normalizeWorkHours(hours)] as const)
      .filter(([key]) => key),
  );
}


export function normalizeTaskWorkHours(value: unknown): number | null {
  if (value == null || value === '') return null;
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  return Math.min(Math.max(normalized, 0.5), 24);
}


export function normalizeAutoSyncTime(time: unknown, fallback = DEFAULT_AUTO_SYNC_TASK_CONFIG.time) {
  if (typeof time !== 'string') return fallback;
  const normalizedTime = time.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime) ? normalizedTime : fallback;
}


export function normalizeAutoSyncStatus(status: unknown): AutoSyncStatus {
  return ['idle', 'running', 'success', 'failed', 'skipped'].includes(String(status)) ? (status as AutoSyncStatus) : 'idle';
}


export function normalizeAutoSyncTimeWindowMode(mode: unknown): AutoSyncTimeWindowMode {
  return mode === 'yesterday-start-to-run' ? 'yesterday-start-to-run' : DEFAULT_AUTO_SYNC_TASK_CONFIG.timeWindowMode;
}


function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : '';
}


function normalizeAutoSyncTask(raw: unknown, index: number, usedIds: Set<string>): AutoSyncTaskConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rawTask = raw as Partial<AutoSyncTaskConfig>;
  const rawId = typeof rawTask.id === 'string' ? rawTask.id.trim() : '';
  const id = rawId || `task-${index + 1}`;
  if (usedIds.has(id)) return null;
  usedIds.add(id);

  return {
    id,
    name: typeof rawTask.name === 'string' && rawTask.name.trim() ? rawTask.name.trim() : `任务${index + 1}`,
    enabled: rawTask.enabled !== false,
    repoPaths: normalizeRepoPaths(rawTask.repoPaths),
    projectOptionId: typeof rawTask.projectOptionId === 'string' ? rawTask.projectOptionId.trim() : '',
    projectName: typeof rawTask.projectName === 'string' ? rawTask.projectName.trim() : '',
    workHours: normalizeTaskWorkHours(rawTask.workHours),
    time: normalizeAutoSyncTime(rawTask.time),
    timeWindowMode: normalizeAutoSyncTimeWindowMode(rawTask.timeWindowMode),
    windowStartTime: normalizeAutoSyncTime(rawTask.windowStartTime, DEFAULT_AUTO_SYNC_TASK_CONFIG.windowStartTime),
    lastRunAt: normalizeOptionalString(rawTask.lastRunAt),
    lastSuccessAt: normalizeOptionalString(rawTask.lastSuccessAt),
    lastStatus: normalizeAutoSyncStatus(rawTask.lastStatus),
    lastMessage: normalizeOptionalString(rawTask.lastMessage),
    lastRunKey: normalizeOptionalString(rawTask.lastRunKey),
    lastScheduledRunKey: normalizeOptionalString(rawTask.lastScheduledRunKey),
    lastSuccessKey: normalizeOptionalString(rawTask.lastSuccessKey),
  };
}


/**
 * 旧版全局单例 → tasks[0]：仓库取当时勾选集合、项目取 feishuForm 当前值，
 * 时间窗口与全部 last* 字段原样继承，保证升级当日运行键连续、幂等跳过不失效。
 */
function migrateLegacyAutoSyncTask(legacy: Record<string, unknown>, ctx: AutoSyncNormalizeContext): AutoSyncTaskConfig {
  return {
    id: 'task-1',
    name: '默认任务',
    enabled: true,
    repoPaths: normalizeRepoPaths(ctx.selectedRepoPaths),
    projectOptionId: typeof ctx.feishuForm?.projectOptionId === 'string' ? ctx.feishuForm.projectOptionId.trim() : '',
    projectName: typeof ctx.feishuForm?.projectName === 'string' ? ctx.feishuForm.projectName.trim() : '',
    workHours: null,
    time: normalizeAutoSyncTime(legacy.time),
    timeWindowMode: normalizeAutoSyncTimeWindowMode(legacy.timeWindowMode),
    windowStartTime: normalizeAutoSyncTime(legacy.windowStartTime, DEFAULT_AUTO_SYNC_TASK_CONFIG.windowStartTime),
    lastRunAt: normalizeOptionalString(legacy.lastRunAt),
    lastSuccessAt: normalizeOptionalString(legacy.lastSuccessAt),
    lastStatus: normalizeAutoSyncStatus(legacy.lastStatus),
    lastMessage: normalizeOptionalString(legacy.lastMessage),
    lastRunKey: normalizeOptionalString(legacy.lastRunKey),
    lastScheduledRunKey: normalizeOptionalString(legacy.lastScheduledRunKey),
    lastSuccessKey: normalizeOptionalString(legacy.lastSuccessKey),
  };
}


export function normalizeAutoSyncConfig(autoSync?: unknown, ctx: AutoSyncNormalizeContext = {}): AutoSyncConfig {
  const source = autoSync && typeof autoSync === 'object' && !Array.isArray(autoSync) ? (autoSync as Record<string, unknown>) : {};
  const enabled = Boolean(source.enabled);

  if (Array.isArray(source.tasks)) {
    const usedIds = new Set<string>();
    return {
      enabled,
      tasks: source.tasks
        .map((item, index) => normalizeAutoSyncTask(item, index, usedIds))
        .filter((item): item is AutoSyncTaskConfig => Boolean(item)),
    };
  }

  if (LEGACY_AUTO_SYNC_FIELDS.some((field) => field in source)) {
    return { enabled, tasks: [migrateLegacyAutoSyncTask(source, ctx)] };
  }

  return { enabled, tasks: [] };
}


export function getScheduledDate(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = normalizeAutoSyncTime(time).split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}


function normalizeReporterKey(name: string) {
  return name.trim().toLocaleLowerCase();
}


/** 无邮箱时运行键与旧版全局单例逐字符一致；配置邮箱后纳入运行键，避免换作者后被旧成功记录跳过。 */
export function buildAutoSyncTaskKey(task: AutoSyncTaskConfig, ctx: AutoSyncKeyContext, date: string) {
  const repoKey = normalizeRepoPaths(task.repoPaths)
    .map((item) => item.toLocaleLowerCase())
    .sort()
    .join('|');
  const timeWindowKey = [
    normalizeAutoSyncTimeWindowMode(task.timeWindowMode),
    normalizeAutoSyncTime(task.windowStartTime, DEFAULT_AUTO_SYNC_TASK_CONFIG.windowStartTime),
  ].join('@');
  const reporterKey = [normalizeReporterKey(ctx.reporterName), normalizeReporterKey(ctx.gitAuthorEmail ?? '')].filter(Boolean).join('|');
  return [
    date,
    reporterKey,
    task.projectOptionId.trim(),
    timeWindowKey,
    repoKey,
  ].join('::');
}


export function buildAutoSyncReportWindow(task: AutoSyncTaskConfig, now = new Date()) {
  const date = toLocalDateString(now);

  if (normalizeAutoSyncTimeWindowMode(task.timeWindowMode) === 'yesterday-start-to-run') {
    const startDate = shiftDateString(date, -1);
    return {
      date,
      startDateTime: normalizeDateTimeValue(`${startDate}T${normalizeAutoSyncTime(task.windowStartTime, DEFAULT_AUTO_SYNC_TASK_CONFIG.windowStartTime)}:00`),
      endDateTime: normalizeDateTimeValue(formatDateTimeForGit(now).replace(' ', 'T')),
    };
  }

  return {
    date,
    startDateTime: normalizeDateTimeValue(`${date}T00:00:00`),
    endDateTime: normalizeDateTimeValue(`${nextDateString(date)}T00:00:00`),
  };
}


export function getNextTaskRunDate(task: AutoSyncTaskConfig, ctx: AutoSyncKeyContext, now = new Date()) {
  if (!task.enabled) return null;

  const today = toLocalDateString(now);
  const scheduledToday = getScheduledDate(today, task.time);
  const todayTaskKey = buildAutoSyncTaskKey(task, ctx, today);

  if (now.getTime() < scheduledToday.getTime()) {
    return scheduledToday;
  }

  if (task.lastSuccessKey === todayTaskKey || task.lastScheduledRunKey === todayTaskKey) {
    return getScheduledDate(nextDateString(today), task.time);
  }

  return now;
}


export function getNextAutoSyncRun(config: AutoSyncConfig, ctx: AutoSyncKeyContext, now = new Date()) {
  if (!config.enabled) return null;

  let earliest: { taskId: string; runAt: Date } | null = null;
  for (const task of config.tasks) {
    const runDate = getNextTaskRunDate(task, ctx, now);
    if (!runDate) continue;
    if (!earliest || runDate.getTime() < earliest.runAt.getTime()) {
      earliest = { taskId: task.id, runAt: runDate };
    }
  }
  return earliest;
}


export function selectDueAutoSyncTasks(config: AutoSyncConfig, ctx: AutoSyncKeyContext, now = new Date()) {
  if (!config.enabled) return [];
  return config.tasks.filter((task) => {
    const runDate = getNextTaskRunDate(task, ctx, now);
    return Boolean(runDate && runDate.getTime() <= now.getTime());
  });
}


/** 工时三级解析：task.workHours → projectWorkHours[projectOptionId] → defaultWorkHours。 */
export function resolveTaskWorkHours(task: AutoSyncTaskConfig, feishuForm?: Partial<FeishuFormConfig>) {
  const taskHours = normalizeTaskWorkHours(task.workHours);
  if (taskHours != null) return taskHours;

  const projectKey = task.projectOptionId.trim();
  const projectHours = projectKey ? normalizeProjectWorkHours(feishuForm?.projectWorkHours)[projectKey] : undefined;
  if (projectHours != null) return projectHours;

  return normalizeWorkHours(feishuForm?.defaultWorkHours);
}
