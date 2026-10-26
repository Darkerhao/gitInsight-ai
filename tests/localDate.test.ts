import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDateTime, formatLocalDate, shiftLocalDate } from '../src/shared/localDate.js';

test('formatLocalDate 使用本地日历日期而不是 UTC 日期', () => {
  const earlyMorning = new Date(2026, 9, 26, 1, 30, 0);
  assert.equal(formatLocalDate(earlyMorning), '2026-10-26');
});

test('shiftLocalDate 按日历日跨月跨年偏移', () => {
  assert.equal(shiftLocalDate('2026-10-26', -7), '2026-10-19');
  assert.equal(shiftLocalDate('2026-12-31', 1), '2027-01-01');
});

test('buildDateTime 生成无时区偏移的本地时间字符串', () => {
  assert.equal(buildDateTime('2026-10-26', '09:30'), '2026-10-26T09:30:00');
});
