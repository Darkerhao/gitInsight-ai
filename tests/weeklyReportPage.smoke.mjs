import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/renderer/src/views/WeeklyReportsView.vue', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../src/renderer/src/composables/useWeeklyReports.ts', import.meta.url), 'utf8');
const actions = await readFile(new URL('../src/renderer/src/composables/weeklyReportActions.ts', import.meta.url), 'utf8');
const state = await readFile(new URL('../src/renderer/src/composables/useWeeklyReportState.ts', import.meta.url), 'utf8');
const router = await readFile(new URL('../src/renderer/src/router.ts', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('../src/renderer/src/components/AppSidebar.vue', import.meta.url), 'utf8');

assert.match(router, /generate\|weekly\|reflection\|history/, 'weekly and reflection routes should be registered beside report routes');
assert.match(sidebar, /key: 'weekly'.+label: '一周日报'/, 'weekly page should have a dedicated menu item');
assert.match(page, /useWeeklyReports/, 'weekly page should use the dedicated workflow composable');
assert.match(actions, /id: draft\.reportId \?\? undefined/, 'editing should overwrite the generated history record');
assert.match(actions, /draft\.dirty \|\| !draft\.reportId/, 'publishing a dirty draft should save it first');
assert.match(actions, /for \(const draft of drafts\)/, 'batch publish should continue item by item');
assert.match(state, /draft\.publishStatus !== 'success'/, 'batch retry should skip successful Feishu submissions');
assert.match(actions, /draft\.workHoursSource === 'unresolved'/, 'unresolved automatic hours should block Feishu publishing');
assert.match(page, /:disabled="loading \|\| pushing"/, 'range controls should be locked during generation and publishing');
assert.match(page, /@click="generateCurrent"[\s\S]*重新生成当前项目/, 'the active date-project draft should support independent regeneration');
assert.match(workflow, /\.\.\.state, \.\.\.mutations, \.\.\.commands/, 'weekly commands should be exposed to the page');

console.log('weekly report page smoke: pass');
