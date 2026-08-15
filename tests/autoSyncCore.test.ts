import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAutoSyncReportWindow,
  buildAutoSyncTaskKey,
  getNextAutoSyncRun,
  getNextTaskRunDate,
  normalizeAutoSyncConfig,
  normalizeTaskWorkHours,
  resolveTaskWorkHours,
  selectDueAutoSyncTasks,
} from '../electron/main/autoSyncCore.js';
import type { AutoSyncTaskConfig } from '../src/shared/types.js';

function makeTask(overrides: Partial<AutoSyncTaskConfig> = {}): AutoSyncTaskConfig {
  return {
    id: 'task-1',
    name: '任务1',
    enabled: true,
    repoPaths: ['D:/Work/Repo-A'],
    projectOptionId: 'proj-a',
    projectName: '项目A',
    workHours: null,
    time: '18:30',
    timeWindowMode: 'full-day',
    windowStartTime: '09:00',
    lastRunAt: '',
    lastSuccessAt: '',
    lastStatus: 'idle',
    lastMessage: '',
    lastRunKey: '',
    lastScheduledRunKey: '',
    lastSuccessKey: '',
    ...overrides,
  };
}

const ctx = { reporterName: '张三' };

test('legacy 单例配置迁移为 tasks[0] 且运行键逐字符保持旧格式', () => {
  // 旧版键格式：date::reporter::projectOptionId::mode@start::repos（repos 小写排序、| 连接）
  const legacyKey = '2026-08-03::张三::proj-legacy::yesterday-start-to-run@08:30::d:/work/repo-a|e:/labs/repo-b';
  const legacyRaw = {
    enabled: true,
    time: '19:15',
    timeWindowMode: 'yesterday-start-to-run',
    windowStartTime: '08:30',
    lastRunAt: '2026-08-03T19:15:02.000Z',
    lastSuccessAt: '2026-08-03T19:15:02.000Z',
    lastStatus: 'success',
    lastMessage: '已自动同步 3 条记录到飞书日报表',
    lastRunKey: legacyKey,
    lastScheduledRunKey: legacyKey,
    lastSuccessKey: legacyKey,
  };

  const normalized = normalizeAutoSyncConfig(legacyRaw, {
    feishuForm: { projectOptionId: ' proj-legacy ', projectName: '旧项目' },
    selectedRepoPaths: ['E:/Labs/Repo-B', 'D:/Work/Repo-A'],
  });

  assert.equal(normalized.enabled, true);
  assert.equal(normalized.tasks.length, 1);
  const task = normalized.tasks[0];
  assert.equal(task.name, '默认任务');
  assert.equal(task.enabled, true);
  assert.deepEqual(task.repoPaths, ['E:/Labs/Repo-B', 'D:/Work/Repo-A']);
  assert.equal(task.projectOptionId, 'proj-legacy');
  assert.equal(task.projectName, '旧项目');
  assert.equal(task.workHours, null);
  assert.equal(task.time, '19:15');
  assert.equal(task.timeWindowMode, 'yesterday-start-to-run');
  assert.equal(task.windowStartTime, '08:30');
  assert.equal(task.lastRunAt, legacyRaw.lastRunAt);
  assert.equal(task.lastSuccessAt, legacyRaw.lastSuccessAt);
  assert.equal(task.lastStatus, 'success');
  assert.equal(task.lastMessage, legacyRaw.lastMessage);
  assert.strictEqual(task.lastRunKey, legacyKey);
  assert.strictEqual(task.lastScheduledRunKey, legacyKey);
  assert.strictEqual(task.lastSuccessKey, legacyKey);

  // 键连续性：迁移任务用新函数重建的当日键与旧版键逐字符相等（reporter 大小写与首尾空白按旧规则归一）
  const rebuiltKey = buildAutoSyncTaskKey(task, { reporterName: ' 张三 ' }, '2026-08-03');
  assert.strictEqual(rebuiltKey, legacyKey);
  assert.strictEqual(rebuiltKey, task.lastSuccessKey);

  const emailKey = buildAutoSyncTaskKey(task, { reporterName: ' 张三 ', gitAuthorEmail: ' ZhangSan@Example.com ' }, '2026-08-03');
  assert.notStrictEqual(emailKey, legacyKey);
  assert.match(emailKey, /张三\|zhangsan@example\.com/);

  // 升级当日幂等：lastSuccessKey 命中当天键 → 下一次执行排到明天
  const now = new Date(2026, 7, 3, 20, 0, 0);
  const next = getNextTaskRunDate(task, ctx, now);
  assert.ok(next);
  assert.equal(next.getFullYear(), 2026);
  assert.equal(next.getMonth(), 7);
  assert.equal(next.getDate(), 4);
  assert.equal(next.getHours(), 19);
  assert.equal(next.getMinutes(), 15);
});

test('normalizeAutoSyncConfig 缺省与坏值', () => {
  assert.deepEqual(normalizeAutoSyncConfig(), { enabled: false, tasks: [] });
  assert.deepEqual(normalizeAutoSyncConfig(null), { enabled: false, tasks: [] });
  assert.deepEqual(normalizeAutoSyncConfig({ enabled: 1, tasks: 'nope' }), { enabled: true, tasks: [] });

  const normalized = normalizeAutoSyncConfig({
    enabled: false,
    tasks: [
      {
        id: '  ',
        name: '  ',
        time: '25:99',
        timeWindowMode: 'weird',
        windowStartTime: '9:0',
        workHours: 'abc',
        repoPaths: 'not-array',
        lastStatus: 'unknown',
        lastMessage: 42,
      },
      { id: 'dup', name: '甲' },
      { id: 'dup', name: '乙' },
      null,
      'text-item',
    ],
  });

  assert.equal(normalized.enabled, false);
  assert.equal(normalized.tasks.length, 2);
  const [first, second] = normalized.tasks;
  assert.equal(first.id, 'task-1');
  assert.equal(first.name, '任务1');
  assert.equal(first.enabled, true);
  assert.deepEqual(first.repoPaths, []);
  assert.equal(first.workHours, null);
  assert.equal(first.time, '18:30');
  assert.equal(first.timeWindowMode, 'full-day');
  assert.equal(first.windowStartTime, '09:00');
  assert.equal(first.lastStatus, 'idle');
  assert.equal(first.lastMessage, '');
  assert.equal(second.id, 'dup');
  assert.equal(second.name, '甲');

  assert.equal(normalizeTaskWorkHours(null), null);
  assert.equal(normalizeTaskWorkHours(''), null);
  assert.equal(normalizeTaskWorkHours('abc'), null);
  assert.equal(normalizeTaskWorkHours(0), null);
  assert.equal(normalizeTaskWorkHours(-2), null);
  assert.equal(normalizeTaskWorkHours('6'), 6);
  assert.equal(normalizeTaskWorkHours(0.1), 0.5);
  assert.equal(normalizeTaskWorkHours(99), 24);
});

test('buildAutoSyncReportWindow 两种统计窗口边界', () => {
  const fullDay = buildAutoSyncReportWindow(makeTask({ timeWindowMode: 'full-day' }), new Date(2026, 0, 31, 18, 30, 0));
  assert.equal(fullDay.date, '2026-01-31');
  assert.equal(fullDay.startDateTime, '2026-01-31T00:00:00');
  assert.equal(fullDay.endDateTime, '2026-02-01T00:00:00');

  const yesterdayWindow = buildAutoSyncReportWindow(
    makeTask({ timeWindowMode: 'yesterday-start-to-run', windowStartTime: '09:00' }),
    new Date(2026, 2, 1, 18, 30, 5),
  );
  assert.equal(yesterdayWindow.date, '2026-03-01');
  assert.equal(yesterdayWindow.startDateTime, '2026-02-28T09:00:00');
  assert.equal(yesterdayWindow.endDateTime, '2026-03-01T18:30:05');
});

test('getNextTaskRunDate 未到点/已成功/逾期/停用', () => {
  const task = makeTask({ time: '18:30' });

  // 未到点 → 当天执行时刻
  const beforeTime = getNextTaskRunDate(task, ctx, new Date(2026, 7, 4, 10, 0, 0));
  assert.ok(beforeTime);
  assert.equal(beforeTime.getDate(), 4);
  assert.equal(beforeTime.getHours(), 18);
  assert.equal(beforeTime.getMinutes(), 30);

  // 已成功（lastSuccessKey 命中当天键）→ 明天执行时刻
  const doneTask = makeTask({ lastSuccessKey: buildAutoSyncTaskKey(task, ctx, '2026-08-04') });
  const afterSuccess = getNextTaskRunDate(doneTask, ctx, new Date(2026, 7, 4, 19, 0, 0));
  assert.ok(afterSuccess);
  assert.equal(afterSuccess.getDate(), 5);
  assert.equal(afterSuccess.getHours(), 18);

  // 已排程（lastScheduledRunKey 命中当天键）→ 明天执行时刻
  const scheduledTask = makeTask({ lastScheduledRunKey: buildAutoSyncTaskKey(task, ctx, '2026-08-04') });
  const afterScheduled = getNextTaskRunDate(scheduledTask, ctx, new Date(2026, 7, 4, 19, 0, 0));
  assert.ok(afterScheduled);
  assert.equal(afterScheduled.getDate(), 5);

  // 逾期未做 → 立即（返回 now）
  const overdueNow = new Date(2026, 7, 4, 19, 0, 0);
  assert.strictEqual(getNextTaskRunDate(task, ctx, overdueNow)?.getTime(), overdueNow.getTime());

  // 任务停用 → null
  assert.equal(getNextTaskRunDate(makeTask({ enabled: false }), ctx, overdueNow), null);
});

test('getNextAutoSyncRun 跨任务取最早且总开关关闭不调度', () => {
  const taskA = makeTask({ id: 'a', time: '10:00' });
  const taskB = makeTask({ id: 'b', time: '08:00' });
  const morning = new Date(2026, 7, 4, 6, 0, 0);

  const nextRun = getNextAutoSyncRun({ enabled: true, tasks: [taskA, taskB] }, ctx, morning);
  assert.ok(nextRun);
  assert.equal(nextRun.taskId, 'b');
  assert.equal(nextRun.runAt.getHours(), 8);

  // 并列最早（都逾期 → now）按 tasks 数组顺序取第一个
  const noon = new Date(2026, 7, 4, 12, 0, 0);
  assert.equal(getNextAutoSyncRun({ enabled: true, tasks: [taskA, taskB] }, ctx, noon)?.taskId, 'a');

  // 总开关关闭 → 不调度
  assert.equal(getNextAutoSyncRun({ enabled: false, tasks: [taskA, taskB] }, ctx, morning), null);
  // 所有任务停用 → 不调度
  assert.equal(getNextAutoSyncRun({ enabled: true, tasks: [makeTask({ enabled: false })] }, ctx, morning), null);
});

test('selectDueAutoSyncTasks 按数组顺序返回到期任务', () => {
  const taskA = makeTask({ id: 'a', time: '10:00' });
  const taskB = makeTask({ id: 'b', time: '08:00' });
  const taskDisabled = makeTask({ id: 'c', time: '08:00', enabled: false });
  const taskDone = makeTask({ id: 'd', time: '08:00' });
  taskDone.lastSuccessKey = buildAutoSyncTaskKey(taskDone, ctx, '2026-08-04');
  const noon = new Date(2026, 7, 4, 12, 0, 0);

  const due = selectDueAutoSyncTasks({ enabled: true, tasks: [taskA, taskB, taskDisabled, taskDone] }, ctx, noon);
  assert.deepEqual(due.map((task) => task.id), ['a', 'b']);

  // 未到点任务不在到期列表
  const morning = new Date(2026, 7, 4, 9, 0, 0);
  const dueMorning = selectDueAutoSyncTasks({ enabled: true, tasks: [taskA, taskB] }, ctx, morning);
  assert.deepEqual(dueMorning.map((task) => task.id), ['b']);

  // 总开关关闭 → 空
  assert.deepEqual(selectDueAutoSyncTasks({ enabled: false, tasks: [taskA, taskB] }, ctx, noon), []);
});

test('resolveTaskWorkHours 三级解析 task.workHours → projectWorkHours → defaultWorkHours', () => {
  const feishuForm = { defaultWorkHours: 7, projectWorkHours: { 'proj-a': 4 } };

  assert.equal(resolveTaskWorkHours(makeTask({ workHours: 6 }), feishuForm), 6);
  assert.equal(resolveTaskWorkHours(makeTask({ workHours: 99 }), feishuForm), 24);
  assert.equal(resolveTaskWorkHours(makeTask({ workHours: null, projectOptionId: 'proj-a' }), feishuForm), 4);
  assert.equal(resolveTaskWorkHours(makeTask({ workHours: null, projectOptionId: 'proj-x' }), feishuForm), 7);
  // defaultWorkHours 无效时兜底为 8
  assert.equal(resolveTaskWorkHours(makeTask({ workHours: null, projectOptionId: '' }), { defaultWorkHours: -1 }), 8);
  assert.equal(resolveTaskWorkHours(makeTask({ workHours: null, projectOptionId: '' }), undefined), 8);
});
