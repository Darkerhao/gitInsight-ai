import assert from 'node:assert/strict';
import test from 'node:test';
import type { DailyReportRecord, SyncLogRecord } from '../src/shared/types.js';
import {
  buildWeeklyReflectionPrompt,
  buildWeeklyReflectionPreviousContext,
  getSuccessfulSyncReportIds,
  normalizeWeeklyReflectionParams,
  parseWeeklyReflectionMetadata,
  selectWeeklyReflectionSources,
  validateWeeklyReflectionContinuity,
  validateWeeklyReflectionEvidence,
} from '../src/shared/weeklyReflection.js';
import { renderWeeklyReflectionMarkdown } from '../src/shared/weeklyReflectionMarkdown.js';

function makeRecord(overrides: Partial<DailyReportRecord> = {}): DailyReportRecord {
  return {
    id: 1,
    date: '2026-08-10',
    reporterName: '测试用户',
    repoNames: ['项目 A'],
    repoPaths: ['D:/repo-a'],
    report: '今日工作内容：\n\n1. 完成功能开发\n\n工作成果：\n\n1. 已完成',
    status: 'success',
    commitsCount: 3,
    filesCount: 4,
    generatedAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-10T10:00:00.000Z',
    ...overrides,
  };
}

const params = {
  projectPath: 'D:/repo-a',
  startDate: '2026-08-10',
  endDate: '2026-08-16',
} as const;

test('normalizeWeeklyReflectionParams enforces one project and at most seven days', () => {
  assert.equal(normalizeWeeklyReflectionParams({ ...params, projectPath: ' D:/repo-a ' }).projectPath, 'D:/repo-a');
  assert.throws(
    () => normalizeWeeklyReflectionParams({ ...params, endDate: '2026-08-17' }),
    /最多选择连续 7 天/,
  );
  assert.throws(
    () => normalizeWeeklyReflectionParams({ ...params, startDate: '2026-08-17', endDate: '2026-08-10' }),
    /结束日期必须晚于或等于开始日期/,
  );
});

test('selectWeeklyReflectionSources filters project/date/failed records and published scope', () => {
  const records = [
    makeRecord({ id: 1 }),
    makeRecord({ id: 2, date: '2026-08-11', report: '第二天日报' }),
    makeRecord({ id: 3, date: '2026-08-11', status: 'failed' }),
    makeRecord({ id: 4, date: '2026-08-12', repoPaths: ['D:/other'], repoNames: ['其他项目'] }),
    makeRecord({ id: 5, date: '2026-08-17' }),
  ];
  const published = new Set([2]);

  assert.deepEqual(
    selectWeeklyReflectionSources(records, published, params).map((source) => source.reportId),
    [1, 2],
  );
  assert.deepEqual(
    selectWeeklyReflectionSources(records, published, { ...params, sourceScope: 'published' }).map((source) => source.reportId),
    [2],
  );
});

test('source selection keeps one report per day, prefers single-project reports and accepts manual-only work', () => {
  const records = [
    makeRecord({ id: 1, repoPaths: ['D:/repo-a', 'D:/repo-b'], repoNames: ['项目 A', '项目 B'], updatedAt: '2026-08-10T12:00:00.000Z' }),
    makeRecord({ id: 2, report: '单项目日报', updatedAt: '2026-08-10T10:00:00.000Z' }),
    makeRecord({ id: 3, date: '2026-08-11', status: 'failed', commitsCount: 0, manualWorkContent: '完成网页测试', report: '完成网页测试' }),
  ];
  const sources = selectWeeklyReflectionSources(records, new Set<number>(), params);
  assert.deepEqual(sources.map((source) => source.reportId), [2, 3]);
});

test('weekly reflection metadata parser validates evidence refs and markdown rendering keeps source dates', () => {
  const sources = selectWeeklyReflectionSources([makeRecord()], new Set<number>(), params);
  const metadata = parseWeeklyReflectionMetadata(
    JSON.stringify({
      title: '项目 A 周反思',
      overview: '本周完成核心功能并进行了联调。',
      strengths: [{ title: '交付完整', detail: '日报记录了功能和验证过程。', evidenceRefs: ['R1'] }],
      problems: [{ title: '回归不足', detail: '部分场景仍需补充验证。', impact: '后续迭代存在回归风险。', evidenceRefs: ['R1'] }],
      shortcomings: [{ title: '验证偏晚', detail: '验证没有前置到开发过程中。', evidenceRefs: ['R1'] }],
      improvements: [{ action: '补充核心场景回归清单', reason: '降低重复问题', priority: 'high', expectedOutcome: '发布前完成验证', evidenceRefs: ['R1'] }],
      nextWeekFocus: ['完成回归清单并跟踪结果'],
    }),
  );
  validateWeeklyReflectionEvidence(metadata, sources);
  const markdown = renderWeeklyReflectionMarkdown(params, metadata, sources);
  assert.match(markdown, /## 发现的问题/);
  assert.match(markdown, /依据：2026-08-10/);
  const prompt = buildWeeklyReflectionPrompt(params, sources);
  assert.match(prompt, /<source_data>/);
  assert.doesNotMatch(prompt, /D:\/repo-a/);
});

test('weekly reflection parser rejects unknown evidence refs and malformed JSON', () => {
  const metadata = parseWeeklyReflectionMetadata(
    JSON.stringify({
      title: '标题', overview: '概览', strengths: [], problems: [], shortcomings: [], improvements: [], nextWeekFocus: [],
    }),
  );
  assert.throws(() => validateWeeklyReflectionEvidence({ ...metadata, strengths: [{ title: 'x', detail: 'y', evidenceRefs: ['R9'] }] }, []), /不存在的日报证据/);
  assert.throws(() => parseWeeklyReflectionMetadata('not-json'), /不是合法 JSON/);
  assert.throws(
    () => parseWeeklyReflectionMetadata(JSON.stringify({ ...metadata, strengths: [{ title: 'x', detail: 'y', evidenceRefs: [] }] })),
    /evidenceRefs 不能为空/,
  );
  const duplicateAction = { action: '补充回归清单', reason: '减少遗漏', priority: 'high', expectedOutcome: '完成验证', evidenceRefs: ['R1'] };
  assert.throws(
    () => parseWeeklyReflectionMetadata(JSON.stringify({ ...metadata, improvements: [duplicateAction, duplicateAction] })),
    /重复的改进动作/,
  );
});

test('weekly reflection reviews previous actions without guessing when evidence is missing', () => {
  const sources = selectWeeklyReflectionSources([makeRecord()], new Set<number>(), params);
  const previous = buildWeeklyReflectionPreviousContext({
    id: 7,
    projectPath: 'D:/repo-a',
    projectName: '项目 A',
    startDate: '2026-08-03',
    endDate: '2026-08-09',
    sourceScope: 'all',
    sourceReports: sources,
    content: '',
    structuredJson: {
      title: '上一周反思',
      overview: '上一周概览',
      strengths: [],
      problems: [{ title: '回归验证偏晚', detail: '问题在发布前才发现。', impact: '增加返工。', evidenceRefs: ['R1'] }],
      shortcomings: [],
      improvements: [{ action: '前置回归验证', reason: '减少返工', priority: 'high', expectedOutcome: '开发阶段完成回归', evidenceRefs: ['R1'] }],
      previousActionReviews: [],
      nextWeekFocus: [],
    },
    actionStates: [{ action: '前置回归验证', status: 'completed', updatedAt: '2026-08-09T12:00:00.000Z' }],
    aiProfileId: 'default',
    generatedAt: '2026-08-09T12:00:00.000Z',
    updatedAt: '2026-08-09T12:00:00.000Z',
  });
  const metadata = parseWeeklyReflectionMetadata(JSON.stringify({
    title: '本周反思',
    overview: '本周概览',
    strengths: [],
    problems: [{ title: '回归验证偏晚', detail: '本周仍在发布前集中回归。', impact: '返工风险仍在。', evidenceRefs: ['R1'], previousProblemRef: 'P1' }],
    shortcomings: [],
    improvements: [],
    previousActionReviews: [{
      actionRef: 'A1',
      action: '前置回归验证',
      previousStatus: 'completed',
      suggestedStatus: 'completed',
      assessment: '日报明确记录了开发阶段回归。',
      evidenceRefs: ['R1'],
    }],
    nextWeekFocus: [],
  }));

  validateWeeklyReflectionContinuity(metadata, previous, sources);
  const prompt = buildWeeklyReflectionPrompt(params, sources, previous);
  assert.match(prompt, /<previous_reflection>/);
  assert.match(prompt, /前置回归验证/);
  assert.doesNotMatch(prompt, /D:\/repo-a/);

  const pending = parseWeeklyReflectionMetadata(JSON.stringify({
    ...metadata,
    problems: [],
    previousActionReviews: [{ ...metadata.previousActionReviews[0], suggestedStatus: 'pending', evidenceRefs: [] }],
  }));
  validateWeeklyReflectionContinuity(pending, previous, sources);

  assert.throws(
    () => validateWeeklyReflectionContinuity({
      ...pending,
      previousActionReviews: [{ ...pending.previousActionReviews[0], suggestedStatus: 'completed' }],
    }, previous, sources),
    /已完成或未完成建议必须引用本期日报证据/,
  );
  assert.throws(
    () => validateWeeklyReflectionContinuity({
      ...metadata,
      problems: [{ ...metadata.problems[0], previousProblemRef: 'P9' }],
    }, previous, sources),
    /不存在的上一期问题/,
  );
  assert.throws(
    () => validateWeeklyReflectionContinuity({
      ...metadata,
      previousActionReviews: [{ ...metadata.previousActionReviews[0], actionRef: 'A9' }],
    }, previous, sources),
    /不存在的上一期动作/,
  );
});

test('getSuccessfulSyncReportIds only keeps successful report links', () => {
  const logs = [
    { reportId: 1, status: 'success' },
    { reportId: 2, status: 'failed' },
    { reportId: undefined, status: 'success' },
  ] as SyncLogRecord[];
  assert.deepEqual([...getSuccessfulSyncReportIds(logs)], [1]);
});
