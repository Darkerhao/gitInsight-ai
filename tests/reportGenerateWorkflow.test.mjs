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
function createPage(t, api, count = 2) {
  const messages = [];
  let refreshes = 0;
  const repos = Array.from({ length: count }, (_, index) => ({ path: `repo-${index}`, name: `Project ${index}` }));
  const assistant = {
    config: vue.reactive({ reporterName: 'Tester', repoDisplayNames: {}, feishuForm: { defaultWorkHours: 8 } }),
    form: vue.reactive({ date: '2026-09-29', startDateTime: '2026-09-29T00:00', endDateTime: '2026-09-30T00:00', manualWorkContent: 'GLOBAL MUST NOT LEAK' }),
    projectDrafts: vue.ref(repos.map((repo) => ({ key: repo.path, repo, report: `old-${repo.path}`, manualWorkContent: '', generateStatus: 'idle', publishStatus: 'success', dirty: false }))),
    activeDraftKey: vue.ref(repos[0].path), selectedRepos: vue.ref(repos), selectedRepoPaths: vue.ref(repos.map((repo) => repo.path)),
    dailyReports: vue.ref([]), status: vue.ref(''), loading: vue.ref(false), pushing: vue.ref(false),
    activeAiProfile: vue.ref({ enabled: false }),
    persistConfig: async () => {}, refreshLocalData: async () => { refreshes += 1; },
  };
  const scope = vue.effectScope();
  t.after(() => scope.stop());
  const imports = {
    vue: { ...vue, onMounted() {}, onBeforeUnmount() {} },
    'element-plus': { ElMessage: Object.fromEntries(['warning', 'success', 'error', 'info'].map((key) => [key, (message) => messages.push(message)])) },
    '@/composables/useAssistant': { useAssistant: () => assistant },
    '@/composables/assistant/projectGeneration': project,
    '@/composables/assistant/normalizers': normalizers,
    '@shared/repositoryName': names,
    '@/composables/assistant/reportState': {
      getReportRangePayloadFromForm: (form) => ({ startDateTime: form.startDateTime, endDateTime: form.endDateTime }),
      countResultFiles: () => 0,
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

test('actual history loader restores legacy material once and displays attribution warning', () => {
  const warnings = [];
  const imports = {
    vue,
    'element-plus': { ElMessage: { warning: (message) => warnings.push(message) } },
    '@shared/types': sharedTypes,
    '@shared/repositoryName': names,
    './assistant/normalizers': normalizers,
    './assistant/dateUtils': dateUtils,
    './assistant/projectGeneration': project,
  };
  const module = evaluate(readFileSync(resolve(root, 'src/renderer/src/composables/useAssistant.ts'), 'utf8'), (name) => imports[name] ?? new Proxy({}, { get: () => () => ({}) }));
  const assistant = module.useAssistant();
  assistant.loadDailyReportDraft({ id: 1, repoPaths: ['a', 'b'], repoNames: ['A', 'B'], report: 'old', status: 'success', manualWorkContent: 'legacy review' });
  assert.deepEqual(assistant.projectDrafts.value.map((draft) => draft.manualWorkContent), ['legacy review', '']);
  assert.equal(assistant.activeDraftKey.value, 'a');
  assert.match(warnings[0], /首个项目.*核对归属/);
});
