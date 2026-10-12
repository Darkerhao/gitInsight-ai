import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
function evaluate(source, imports, window = {}) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  compileFunction(outputText, ['require', 'exports', 'window'])(imports, exports, window);
  return exports;
}
function loadTs(path) {
  return evaluate(readFileSync(path, 'utf8'), (name) => loadTs(name.startsWith('@shared/') ? resolve(root, 'src/shared', name.slice(8) + '.ts') : resolve(dirname(path), name.replace(/\.js$/, '') + '.ts')));
}
const project = loadTs(resolve(root, 'src/renderer/src/composables/assistant/projectGeneration.ts'));
const normalizers = loadTs(resolve(root, 'src/renderer/src/composables/assistant/normalizers.ts'));
const dateUtils = loadTs(resolve(root, 'src/renderer/src/composables/assistant/dateUtils.ts'));
const sharedTypes = loadTs(resolve(root, 'src/shared/types.ts'));
const names = loadTs(resolve(root, 'src/shared/repositoryName.ts'));
const { descriptor } = parse(readFileSync(resolve(root, 'src/renderer/src/views/ReportGenerateView.vue'), 'utf8'));
const script = compileScript(descriptor, { id: 'report-generation-test' }).content;
function createHistoryAssistant() {
  const imports = {
    vue, 'element-plus': { ElMessage: { warning() {} } }, '@shared/types': sharedTypes,
    '@shared/repositoryName': names,
    './assistant/normalizers': normalizers, './assistant/dateUtils': dateUtils,
    './assistant/projectGeneration': project,
  };
  return evaluate(readFileSync(resolve(root, 'src/renderer/src/composables/useAssistant.ts'), 'utf8'),
    (name) => imports[name] ?? new Proxy({}, { get: () => () => ({}) })).useAssistant();
}
function createPage(t, api, count = 2, confirm = async () => {}) {
  const messages = [];
  let refreshes = 0;
  const repos = Array.from({ length: count }, (_, index) => ({ path: `repo-${index}`, name: `Project ${index}` }));
  const selectedPaths = vue.ref(repos.map((repo) => repo.path));
  const assistant = {
    config: vue.reactive({ reporterName: 'Tester', repoDisplayNames: {}, feishuForm: { defaultWorkHours: 8 } }),
    form: vue.reactive({ date: '2026-09-29', startDateTime: '2026-09-29T00:00', endDateTime: '2026-09-30T00:00', manualWorkContent: 'GLOBAL MUST NOT LEAK' }),
    projectDrafts: vue.ref(repos.map((repo) => ({ key: repo.path, repo, report: `old-${repo.path}`, manualWorkContent: '', generateStatus: 'idle', publishStatus: 'success', dirty: false }))),
    activeDraftKey: vue.ref(repos[0].path), selectedRepos: vue.computed(() => repos.filter((repo) => selectedPaths.value.includes(repo.path))), selectedRepoPaths: selectedPaths,
    isRepoSelected: (path) => selectedPaths.value.includes(path),
    toggleRepo: (path) => { selectedPaths.value = selectedPaths.value.includes(path) ? selectedPaths.value.filter((item) => item !== path) : [...selectedPaths.value, path]; },
    dailyReports: vue.ref([]), status: vue.ref(''), loading: vue.ref(false), pushing: vue.ref(false),
    activeAiProfile: vue.ref({ enabled: false }),
    projectOptions: vue.ref([{ id: 'target', name: 'Target' }]),
    createProjectReportDraft: createHistoryAssistant().createProjectReportDraft,
    persistConfig: async () => {}, refreshLocalData: async () => { refreshes += 1; },
  };
  const scope = vue.effectScope();
  t.after(() => scope.stop());
  const imports = {
    vue: { ...vue, onMounted() {}, onBeforeUnmount() {} },
    'element-plus': {
      ElMessage: Object.fromEntries(['warning', 'success', 'error', 'info'].map((key) => [key, (message) => messages.push(message)])),
      ElMessageBox: { confirm },
    },
    '@/composables/useAssistant': { useAssistant: () => assistant },
    '@/composables/assistant/projectGeneration': project,
    '@/composables/projectReportActions': loadTs(resolve(root, 'src/renderer/src/composables/projectReportActions.ts')),
    '@/composables/assistant/normalizers': normalizers,
    '@shared/repositoryName': names,
    '@shared/weeklyReport': loadTs(resolve(root, 'src/shared/weeklyReport.ts')),
    '@/composables/assistant/reportState': {
      getReportRangePayloadFromForm: (form) => ({ startDateTime: form.startDateTime, endDateTime: form.endDateTime }),
      countResultFiles: () => 0,
      resolveReportTimeRange: (range, label) => ({ ...range, label }),
    },
  };
  const module = evaluate(script, (name) => imports[name] ?? {}, { api });
  const page = scope.run(() => module.default.setup({}, { expose() {}, emit() {} }));
  return { page, assistant, messages, refreshes: () => refreshes };
}
const result = (text) => ({ report: text, commits: [], generatedAt: new Date().toISOString(), repos: [], rawInput: {} });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('real page sends selected project material only and edits do not cross project tabs', async (t) => {
  const payloads = [];
  const { page, assistant } = createPage(t, { generateReport: async (payload) => { payloads.push(payload); return result('new'); } });
  page.handleManualWorkContentChange('A review');
  assistant.activeDraftKey.value = 'repo-1';
  page.handleManualWorkContentChange('B testing');
  await page.handleGenerateAll();
  assert.deepEqual(payloads.map((payload) => [payload.repoPaths[0], payload.manualWorkContent]), [['repo-0', 'A review'], ['repo-1', 'B testing']]);
  assert.equal(new Set(payloads.map((payload) => payload.requestId)).size, 2);
});

test('real page cancellation aborts active requests, stops queued projects, preserves completed drafts and refreshes history', async (t) => {
  const pending = new Map();
  const started = [];
  const cancelled = [];
  const { page, assistant, refreshes } = createPage(t, {
    generateReport: (payload) => { started.push(payload); return new Promise((resolve, reject) => pending.set(payload.requestId, { resolve, reject })); },
    cancelReportGeneration: async (id) => { cancelled.push(id); pending.get(id).reject(new Error('cancelled')); },
  }, 6);
  const generating = page.handleGenerateAll();
  await tick();
  assert.equal(started.length, 3);
  pending.get(started[0].requestId).resolve(result('completed'));
  await tick();
  assert.equal(started.length, 4);
  await page.cancelGeneration();
  await generating;
  assert.equal(cancelled.length, 3);
  assert.equal(started.length, 4);
  assert.equal(assistant.projectDrafts.value[0].report, 'completed');
  assert.equal(assistant.projectDrafts.value[0].generateStatus, 'success');
  assert.equal(assistant.projectDrafts.value[1].report, 'old-repo-1');
  assert.equal(assistant.projectDrafts.value[5].generateStatus, 'cancelled');
  assert.equal(assistant.loading.value, false);
  assert.equal(refreshes(), 1);
});

test('history loader restores a combined report as one editable draft with all real sources', () => {
  const assistant = createHistoryAssistant();
  assistant.loadDailyReportDraft({ id: 1, repoPaths: ['a', 'b'], repoNames: ['A', 'B'], report: 'old', status: 'success', manualWorkContent: 'legacy review' });
  assert.equal(assistant.projectDrafts.value.length, 1);
  const draft = assistant.projectDrafts.value[0];
  assert.equal(draft.reportId, 1);
  assert.equal(draft.manualWorkContent, 'legacy review');
  assert.deepEqual(draft.sourceRepos.map((repo) => repo.path), ['a', 'b']);
  assert.equal(draft.repo.path, 'a');
  assert.equal(assistant.activeDraftKey.value, draft.key);
});

test('combined page sends one request and saves then publishes one report with complete paths', async (t) => {
  const generations = [], saves = [], submissions = [];
  const { page, assistant } = createPage(t, {
    generateReport: async (payload) => { generations.push(payload); return { ...result('combined'), historyId: 12 }; },
    saveDailyReport: async (payload) => { saves.push(payload); return { ...payload, id: 12 }; },
    syncFeishuDaily: async (payload) => { submissions.push(payload); return { success: true }; },
  });
  page.handleManualWorkContentChange('A review');
  assistant.activeDraftKey.value = 'repo-1';
  page.handleManualWorkContentChange('B testing');
  await page.handleGenerateCombined();
  assert.equal(generations.length, 1);
  assert.deepEqual(generations[0].repoPaths, ['repo-0', 'repo-1']);
  assert.match(generations[0].manualWorkContent, /Project 0.*\nA review/);
  assert.match(generations[0].manualWorkContent, /Project 1.*\nB testing/);
  assert.equal(assistant.projectDrafts.value.length, 1);
  const draft = assistant.projectDrafts.value[0];
  page.updateDraftReport(draft.key, 'edited combined');
  assistant.config.repoDisplayNames[names.getRepoPathKey('repo-1')] = '项目 B 别名';
  page.handleUpdateDraftProject(draft.key, 'target');
  await page.publishAllReports();
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].repoPaths, ['repo-0', 'repo-1']);
  assert.deepEqual(saves[0].repoNames, ['Project 0', '项目 B 别名']);
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].report, 'edited combined');
  assert.equal(submissions[0].reportId, 12);
  await page.publishAllReports();
  assert.equal(submissions.length, 1);
});

test('switching from combined mode restores per-project generation without splitting combined content', async (t) => {
  const payloads = [];
  const { page, assistant } = createPage(t, {
    generateReport: async (payload) => { payloads.push(payload); return result('generated'); },
  });
  await page.handleGenerateCombined();
  await page.handleGenerateAll();
  assert.deepEqual(payloads.map((payload) => payload.repoPaths), [['repo-0', 'repo-1'], ['repo-0'], ['repo-1']]);
  assert.equal(assistant.projectDrafts.value.length, 2);
  assert.ok(assistant.projectDrafts.value.every((draft) => !draft.sourceRepos));
  assert.ok(payloads.slice(1).every((payload) => !payload.manualWorkContent));
});

test('combined scope changes are confirmed before replacing edited content', async (t) => {
  let rejectConfirmation = false;
  const { page, assistant } = createPage(t, { generateReport: async () => result('combined') }, 2,
    async () => { if (rejectConfirmation) throw 'cancel'; });
  await page.handleGenerateCombined();
  page.updateDraftReport(assistant.activeDraftKey.value, 'preserve my edits');
  rejectConfirmation = true;
  await page.handleToggleRepo('repo-1');
  assert.deepEqual(assistant.selectedRepoPaths.value, ['repo-0', 'repo-1']);
  assert.equal(assistant.projectDrafts.value[0].report, 'preserve my edits');
  rejectConfirmation = false;
  await page.handleToggleRepo('repo-1');
  await vue.nextTick();
  assert.deepEqual(assistant.projectDrafts.value[0].sourceRepos.map((repo) => repo.path), ['repo-0']);
  assert.equal(assistant.projectDrafts.value.length, 1);
});

test('restored combined report preserves source metadata and manual input when edited and saved', async () => {
  const assistant = createHistoryAssistant();
  const rawInput = { gitLogs: 'original logs', files: 'a.ts\nb.ts', diff: 'original patch', manualWorkContent: 'review notes' };
  assistant.loadDailyReportDraft({ id: 9, date: '2026-10-12', repoPaths: ['a', 'b'], repoNames: ['A', 'B'], report: 'old', status: 'success', commitsCount: 4, filesCount: 7, generatedAt: '2026-10-12T09:00:00', rawInput });
  const draft = assistant.projectDrafts.value[0];
  draft.report = 'edited history';
  draft.dirty = true;
  let saved;
  const actions = loadTs(resolve(root, 'src/renderer/src/composables/projectReportActions.ts')).createProjectReportActions({
    api: { saveDailyReport: async (payload) => { saved = structuredClone(payload); return { ...payload, id: 9 }; } },
    config: assistant.config, getProjectOptions: () => [], displayRepoName: (repo) => repo.name,
    getScope: () => ({ date: '2026-10-12' }),
  });
  assert.equal(await actions.saveDraft(draft), true);
  assert.deepEqual(saved.repoPaths, ['a', 'b']);
  assert.deepEqual(saved.rawInput, rawInput);
  assert.equal(saved.commitsCount, 4);
  assert.equal(saved.filesCount, 7);
  assert.equal(saved.status, 'success');
  assert.equal(saved.generatedAt, '2026-10-12T09:00:00');
  assert.equal(saved.report, 'edited history');
});

test('cancelling combined regeneration preserves the prior report and source identity', async (t) => {
  let rejectGeneration;
  const requests = [];
  const { page, assistant } = createPage(t, {
    generateReport: async (payload) => {
      requests.push(payload);
      if (requests.length === 1) return result('original combined');
      return new Promise((_, reject) => { rejectGeneration = reject; });
    },
    cancelReportGeneration: async () => rejectGeneration(new Error('cancelled')),
  });
  await page.handleGenerateCombined();
  const generating = page.handleGenerateCurrent();
  await tick();
  await page.cancelGeneration();
  await generating;
  assert.equal(assistant.projectDrafts.value.length, 1);
  assert.equal(assistant.projectDrafts.value[0].report, 'original combined');
  assert.deepEqual(assistant.projectDrafts.value[0].sourceRepos.map((repo) => repo.path), ['repo-0', 'repo-1']);
  assert.equal(assistant.projectDrafts.value[0].generateStatus, 'cancelled');
  assert.deepEqual(requests[1].repoPaths, ['repo-0', 'repo-1']);
});
