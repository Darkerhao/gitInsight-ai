import assert from 'node:assert/strict';
import test from 'node:test';
import { computed, ref } from 'vue';
import { createWeeklyWorkHoursRecalculator } from '../src/renderer/src/composables/weeklyReportHours.js';
import type { WeeklyReportDraft } from '../src/renderer/src/composables/weeklyReportActions.js';

function makeDraft(key: string): WeeklyReportDraft {
  return {
    key, date: '2026-08-16', repo: { name: key, path: `D:/${key}` },
    report: '今日工作内容：\n\n1. 完成功能开发', reportId: null, result: null,
    projectOptionId: key, workHours: 0.5, workHoursSource: 'default',
    generateStatus: 'success', publishStatus: 'idle', dirty: false, message: '',
  };
}

test('work hours are zero when the report has no commits or changed files', () => {
  const inactive = makeDraft('inactive');
  inactive.result = {
    report: inactive.report,
    commits: [],
    repos: [inactive.repo],
    generatedAt: '2026-08-16T10:00:00.000Z',
    timeRange: {
      startDateTime: '2026-08-16T00:00:00',
      endDateTime: '2026-08-17T00:00:00',
      label: '全天',
    },
    rawInput: { gitLogs: '', files: '', diff: '' },
  };
  const drafts = ref([inactive]);
  const state = { drafts, availableDates: computed(() => ['2026-08-16']), status: ref('') };

  createWeeklyWorkHoursRecalculator(state, () => 8)();

  assert.equal(inactive.workHours, 0);
  assert.equal(inactive.workHoursSource, 'estimated');
});

test('reports without Git activity do not consume hours from active reports', () => {
  const inactive = makeDraft('inactive');
  inactive.result = {
    report: inactive.report,
    commits: [],
    repos: [inactive.repo],
    generatedAt: '2026-08-16T10:00:00.000Z',
    timeRange: {
      startDateTime: '2026-08-16T00:00:00',
      endDateTime: '2026-08-17T00:00:00',
      label: '全天',
    },
    rawInput: { gitLogs: '', files: '', diff: '' },
  };
  const active = makeDraft('active');
  active.result = {
    ...inactive.result,
    report: active.report,
    repos: [active.repo],
    commits: [{
      hash: 'abc123', date: '2026-08-16', author: '测试用户', authorEmail: 'test@example.com',
      message: 'feat: 完成功能', files: ['src/feature.ts'], show: 'abc123 feat: 完成功能',
    }],
  };
  const drafts = ref([inactive, active]);
  const state = { drafts, availableDates: computed(() => ['2026-08-16']), status: ref('') };

  createWeeklyWorkHoursRecalculator(state, () => 8)();

  assert.equal(inactive.workHours, 0);
  assert.equal(active.workHours, 8);
});

test('work hours recalculation reads the current daily capacity on every call', () => {
  const drafts = ref([makeDraft('a'), makeDraft('b')]);
  const state = { drafts, availableDates: computed(() => ['2026-08-16']), status: ref('') };
  let dailyHours = 4;
  const recalculate = createWeeklyWorkHoursRecalculator(state, () => dailyHours);

  recalculate();
  assert.equal(drafts.value.reduce((sum, draft) => sum + draft.workHours, 0), 4);

  dailyHours = 8;
  recalculate();
  assert.equal(drafts.value.reduce((sum, draft) => sum + draft.workHours, 0), 8);
});
