import assert from 'node:assert/strict';
import test from 'node:test';
import type { DailyReportRecord } from '../src/shared/types.js';
import {
  buildWeeklySummaryPrompt,
  normalizeWeeklySummaryParams,
  parseWeeklySummaryMetadata,
  selectWeeklySummarySources,
  validateWeeklySummaryEvidence,
} from '../src/shared/weeklySummary.js';
import { renderWeeklySummaryMarkdown } from '../src/shared/weeklySummaryMarkdown.js';

function report(overrides: Partial<DailyReportRecord> = {}): DailyReportRecord {
  return {
    id: 1,
    date: '2026-08-17',
    reporterName: '测试用户',
    repoNames: ['项目 A'],
    repoPaths: ['D:/repo-a'],
    report: '今日工作内容：完成周报模块设计。\n明日工作计划：实现周报模块。',
    status: 'success',
    commitsCount: 2,
    filesCount: 3,
    generatedAt: '2026-08-17T10:00:00.000Z',
    updatedAt: '2026-08-17T10:00:00.000Z',
    ...overrides,
  };
}

const params = { startDate: '2026-08-17', endDate: '2026-08-23' } as const;

test('weekly summary params enforce a valid range of at most seven days', () => {
  assert.equal(normalizeWeeklySummaryParams({ ...params, projectPath: ' D:/repo-a ' }).projectPath, 'D:/repo-a');
  assert.throws(() => normalizeWeeklySummaryParams({ ...params, endDate: '2026-08-24' }), /最多选择连续 7 天/);
  assert.throws(() => normalizeWeeklySummaryParams({ ...params, startDate: '2026-08-24' }), /结束日期必须晚于或等于开始日期/);
});

test('weekly summary sources deduplicate by project and date and prefer single-project reports', () => {
  const sources = selectWeeklySummarySources([
    report({ id: 1, repoNames: ['项目 A', '项目 B'], repoPaths: ['D:/repo-a', 'D:/repo-b'], updatedAt: '2026-08-17T12:00:00.000Z' }),
    report({ id: 2, report: '项目 A 单项目日报' }),
    report({ id: 3, date: '2026-08-18', repoNames: ['项目 B'], repoPaths: ['D:/repo-b'], report: '', manualWorkContent: '完成项目 B 联调', commitsCount: 0 }),
    report({ id: 4, date: '2026-08-24' }),
  ], params);
  assert.deepEqual(sources.map((source) => [source.reportId, source.projectName]), [[2, '项目 A'], [1, '项目 B'], [3, '项目 B']]);
  assert.deepEqual(selectWeeklySummarySources([report()], { ...params, projectPath: 'D:/other' }), []);
});

test('weekly summary parser validates evidence and renders concise markdown', () => {
  const sources = selectWeeklySummarySources([report()], params);
  const metadata = parseWeeklySummaryMetadata(JSON.stringify({
    summary: '完成周报方案并进入实现。',
    completed: [{ text: '完成周报模块设计', evidenceRefs: ['R1'] }],
    highlights: [{ text: '明确独立模块边界', evidenceRefs: ['R1'] }],
    blockers: [{ text: '暂无明显阻塞', evidenceRefs: [] }],
    nextWeek: [{ text: '完成周报模块实现', evidenceRefs: ['R1'] }],
  }));
  validateWeeklySummaryEvidence(metadata, sources);
  const markdown = renderWeeklySummaryMarkdown(params, metadata);
  assert.match(markdown, /# 本周工作汇报/);
  assert.match(markdown, /## 下周计划/);
  const prompt = buildWeeklySummaryPrompt({ ...params, projectPath: 'D:/repo-a' }, sources);
  assert.match(prompt, /<source_data>/);
  assert.doesNotMatch(prompt, /D:\/repo-a/);
});

test('weekly summary rejects malformed, oversized and unknown-evidence content', () => {
  assert.throws(() => parseWeeklySummaryMetadata('not-json'), /不是合法 JSON/);
  const tooMany = Array.from({ length: 6 }, (_, index) => ({ text: `事项${index}`, evidenceRefs: ['R1'] }));
  assert.throws(() => parseWeeklySummaryMetadata(JSON.stringify({ summary: '摘要', completed: tooMany, highlights: [], blockers: [], nextWeek: [] })), /条目过多/);
  const invalid = parseWeeklySummaryMetadata(JSON.stringify({
    summary: '摘要', completed: [{ text: '事项', evidenceRefs: ['R9'] }], highlights: [], blockers: [], nextWeek: [],
  }));
  assert.throws(() => validateWeeklySummaryEvidence(invalid, []), /不存在的日报证据/);
});
