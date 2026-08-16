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
