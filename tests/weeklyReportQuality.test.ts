import assert from 'node:assert/strict';
import test from 'node:test';
import { checkWeeklyReportQuality, findWeeklyDuplicateKeys } from '../src/shared/weeklyReportQuality.js';

test('quality check reports missing evidence and vague content', () => {
  const result = checkWeeklyReportQuality({
    key: 'a', date: '2026-08-22', projectName: '项目 A', report: '处理了一些事情', commitsCount: 0, filesCount: 0,
  });
  assert.equal(result.score, 'warning');
  assert.ok(result.issues.includes('没有关联提交或影响文件'));
});

test('quality check accepts concrete work with result and evidence', () => {
  const result = checkWeeklyReportQuality({
    key: 'a', date: '2026-08-22', projectName: '项目 A', report: '完成日报批量提交检查，修复失败重试流程并通过专项测试。下一步继续验证发布结果。', commitsCount: 2, filesCount: 4,
  });
  assert.equal(result.score, 'good');
});

test('duplicate detection ignores punctuation and whitespace', () => {
  const duplicates = findWeeklyDuplicateKeys([
    { key: 'a', date: '2026-08-21', projectName: 'A', report: '完成登录功能。', commitsCount: 1, filesCount: 1 },
    { key: 'b', date: '2026-08-22', projectName: 'A', report: ' 完成登录功能 ', commitsCount: 1, filesCount: 1 },
    { key: 'c', date: '2026-08-22', projectName: 'B', report: '修复列表问题', commitsCount: 1, filesCount: 1 },
  ]);
  assert.deepEqual([...duplicates].sort(), ['a', 'b']);
});
