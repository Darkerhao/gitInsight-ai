import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

const filename = new URL('../src/renderer/src/views/HistoryLogsView.vue', import.meta.url);
const { descriptor } = parse(await readFile(filename, 'utf8'));
const script = compileScript(descriptor, { id: 'history-logs-test' });
const { outputText } = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

function createPage(t, queryHistoryLogs) {
  const scope = vue.effectScope();
  t.after(() => scope.stop());
  const messages = [];
  const exports = {};
  const imports = {
    vue: { ...vue, onMounted: () => {} },
    'element-plus': { ElMessage: { error: (message) => messages.push(message) } },
    '@/composables/useAssistant': {
      useAssistant: () => ({ repos: vue.ref([]), config: {}, dailyReports: vue.ref([]) }),
    },
  };
  compileFunction(outputText, ['require', 'exports', 'window'])(
    (name) => imports[name] ?? {}, exports, { api: { queryHistoryLogs } },
  );
  const page = scope.run(() => exports.default.setup({}, { expose() {}, emit() {} }));
  return { page, messages };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const emptyPage = { records: [], total: 0 };

test('initial failure persists and retry recovers to an unfiltered empty result', async (t) => {
  let calls = 0;
  const { page, messages } = createPage(t, async () => {
    if (++calls === 1) throw new Error('数据库暂不可用');
    return emptyPage;
  });
  await page.loadHistoryLogs();
  assert.equal(page.historyError.value, '数据库暂不可用');
  assert.equal(page.historyLoading.value, false);
  assert.deepEqual(messages, [], 'failure is displayed persistently instead of a toast');
  await page.loadHistoryLogs();
  assert.equal(page.historyError.value, '');
  assert.equal(page.historyFiltered.value, false);
  assert.equal(calls, 2);
});

test('empty state follows the submitted query, not edits to unsubmitted filters', async (t) => {
  const { page } = createPage(t, async () => emptyPage);
  await page.loadHistoryLogs();
  page.keyword.value = '不存在的日报';
  assert.equal(page.historyFiltered.value, false);
  await page.handleSearch();
  assert.equal(page.historyFiltered.value, true);
  page.keyword.value = '';
  assert.equal(page.historyFiltered.value, true);
  await page.resetFilters();
  assert.equal(page.historyFiltered.value, false);
});

test('all query filters distinguish an empty filtered result', async (t) => {
  const { page } = createPage(t, async () => emptyPage);
  for (const [field, value] of [
    ['selectedProject', '项目 A'], ['selectedType', '错误日志'],
    ['selectedStatus', '失败'], ['timeRange', ['2026-09-21', '2026-09-27']],
  ]) {
    page[field].value = value;
    await page.loadHistoryLogs();
    assert.equal(page.historyFiltered.value, true, field);
    await page.resetFilters();
    assert.equal(page.historyFiltered.value, false, field);
  }
});

test('a failed refresh removes stale records and closes their detail', async (t) => {
  const row = { id: 'saved', project: '项目 A' };
  let fail = false;
  const { page } = createPage(t, async () => {
    if (fail) throw new Error('读取失败');
    return { records: [row], total: 1 };
  });
  await page.loadHistoryLogs();
  page.openLogDetail(row);
  fail = true;
  await page.loadHistoryLogs();
  assert.deepEqual(page.historyLogs.value, []);
  assert.equal(page.historyTotal.value, 0);
  assert.equal(page.selectedLog.value, null);
  assert.equal(page.detailVisible.value, false);
});

test('an older failure cannot replace a newer success', async (t) => {
  const old = deferred();
  let calls = 0;
  const { page } = createPage(t, () => ++calls === 1 ? old.promise : Promise.resolve(emptyPage));
  const first = page.loadHistoryLogs();
  await page.loadHistoryLogs();
  old.reject(new Error('过期请求失败'));
  await first;
  assert.equal(page.historyError.value, '');
  assert.equal(page.historyLoading.value, false);
});

test('an older completion cannot stop the latest loading state or erase its error', async (t) => {
  const old = deferred();
  const latest = deferred();
  let calls = 0;
  const { page } = createPage(t, () => ++calls === 1 ? old.promise : latest.promise);
  const first = page.loadHistoryLogs();
  const second = page.loadHistoryLogs();
  old.resolve({ records: [{ id: 'old' }], total: 1 });
  await first;
  assert.equal(page.historyLoading.value, true);
  assert.deepEqual(page.historyLogs.value, []);
  latest.reject(new Error('当前请求失败'));
  await second;
  assert.equal(page.historyError.value, '当前请求失败');
  assert.equal(page.historyLoading.value, false);
});
