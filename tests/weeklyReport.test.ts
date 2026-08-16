import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateWeeklyDayWorkHours, allocateWeeklyWorkHours, buildWeeklyDraftKeys, getWeeklyWorkContentWeight, listWeeklyDates } from '../src/shared/weeklyReport.js';

test('listWeeklyDates returns inclusive dates and rejects reversed ranges', () => {
  assert.deepEqual(listWeeklyDates('2026-08-10', '2026-08-12'), ['2026-08-10', '2026-08-11', '2026-08-12']);
  assert.deepEqual(listWeeklyDates('2026-08-12', '2026-08-10'), []);
});

test('buildWeeklyDraftKeys keeps date then project order without collisions', () => {
  assert.deepEqual(buildWeeklyDraftKeys(['2026-08-10', '2026-08-11'], ['repo-a', 'repo-b']), [
    '2026-08-10::repo-a',
    '2026-08-10::repo-b',
    '2026-08-11::repo-a',
    '2026-08-11::repo-b',
  ]);
});

test('getWeeklyWorkContentWeight uses the work section instead of plan text', () => {
  const short = '今日工作内容：\n\n1. 修复登录问题\n\n工作成果：\n\n1. 已完成';
  const long = '今日工作内容：\n\n1. 修复登录问题并补充异常态\n2. 完成回归测试与接口联调\n\n明日计划：\n\n1. 发布';
  assert.ok(getWeeklyWorkContentWeight(long) > getWeeklyWorkContentWeight(short));
});

test('allocateWeeklyWorkHours keeps half-hour precision and daily total', () => {
  const result = allocateWeeklyWorkHours(
    [
      { key: 'small', report: '今日工作内容：\n\n1. 修复一个按钮\n\n工作成果：\n\n1. 完成' },
      { key: 'large', report: '今日工作内容：\n\n1. 完成长流程联调与回归测试\n2. 补充异常态和权限校验\n3. 更新发布文档\n\n工作成果：\n\n1. 完成' },
    ],
    8,
  );
  assert.equal(result.reduce((sum, item) => sum + item.workHours, 0), 8);
  assert.ok(result.every((item) => item.workHours >= 0.5 && item.workHours % 0.5 === 0));
  assert.ok(result.find((item) => item.key === 'large')!.workHours > result.find((item) => item.key === 'small')!.workHours);
});

test('allocateWeeklyWorkHours refuses to exceed daily capacity', () => {
  const items = Array.from({ length: 17 }, (_, index) => ({
    key: `project-${index}`,
    report: `今日工作内容：\n\n1. 完成项目 ${index} 的工作\n\n工作成果：\n\n1. 完成`,
  }));
  assert.deepEqual(allocateWeeklyWorkHours(items, 8), []);
});

test('allocateWeeklyDayWorkHours subtracts manual hours before automatic allocation', () => {
  const report = '今日工作内容：\n\n1. 完成项目工作\n\n工作成果：\n\n1. 完成';
  const result = allocateWeeklyDayWorkHours([
    { key: 'manual', report, workHours: 7, manual: true },
    { key: 'automatic', report, workHours: 8, manual: false },
  ], 8);
  assert.equal(result.allocations.find((item) => item.key === 'automatic')?.workHours, 1);
  assert.deepEqual(result.unresolvedKeys, []);
});

test('allocateWeeklyDayWorkHours marks over-capacity projects unresolved', () => {
  const report = '今日工作内容：\n\n1. 完成项目工作\n\n工作成果：\n\n1. 完成';
  const result = allocateWeeklyDayWorkHours([
    { key: 'manual', report, workHours: 8, manual: true },
    { key: 'automatic', report, workHours: 8, manual: false },
  ], 8);
  assert.deepEqual(result.allocations, []);
  assert.deepEqual(result.unresolvedKeys, ['automatic']);
});
