import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';
import { basename } from 'node:path';

const source = await readFile(new URL('../electron/main/report.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
compileFunction(outputText, ['require', 'exports'])(() => ({}), exports);
const timeRange = { label: '2026-09-29', startDateTime: '2026-09-29T00:00:00', endDateTime: '2026-09-30T00:00:00' };
const commit = { message: 'fix(api): 修复接口空值错误', files: ['server/api.ts'] };
const fallback = (commits = [], manual = '') =>
  exports.fallbackReport(['service'], '2026-09-29', '张三', commits, timeRange, manual);

test('fallback preserves commit facts without inventing outcomes, plans or hours', () => {
  const report = fallback([commit]);
  assert.match(report, /【api】修复接口空值错误/);
  assert.doesNotMatch(report, /提升|交互稳定性|回归验证|8小时/);
  assert.match(report, /工作成果：\n\n1\. 待补充/);
  assert.match(report, /工作时长：\n\n待补充/);
  assert.match(report, /明日计划：\n\n1\. 待补充/);
});

test('manual work is preserved without asserting completion or inferring test platform', () => {
  const report = fallback([], '排查服务端测试失败，尚未解决');
  assert.match(report, /排查服务端测试失败，尚未解决/);
  assert.doesNotMatch(report, /网页测试|已完成|8小时/);
});

test('fallback retains all supplied work without an arbitrary item limit', () => {
  const report = fallback([commit], '需求会议\n后端联调\n文档整理');
  for (const item of ['需求会议', '后端联调', '文档整理', '修复接口空值错误']) assert.ok(report.includes(item));
});

test('empty evidence yields no invented work', () => {
  const report = fallback();
  assert.doesNotMatch(report, /完成|基础环境搭建|推进当前模块|8小时/);
  assert.match(report, /暂无可用工作记录/);
});

function createGenerator(overrides = {}, hasCommits = true) {
  const saved = [];
  const imports = {
    'node:path': { basename },
    './config.js': { loadConfig: async () => ({}) },
    './aiClient.js': {
      resolveAiConfig: () => ({ aiApiKey: 'test' }),
      callAiReport: async () => fallback([commit]),
      callAiStructuredExtract: async () => undefined,
    },
    './database.js': { recordGeneratedReport: async (...args) => { saved.push(args); return { id: 1 }; } },
    './dateUtils.js': {
      nextDateString: () => '2026-09-30',
      normalizeDateTimeValue: (value) => value,
      parseLocalDateTimeMs: Date.parse,
      formatDateTimeForDisplay: (value) => value,
    },
    './gitCollect.js': {
      collectGitData: async () => ({ commits: hasCommits ? [commit] : [] }),
      filterCommitsByReporter: (commits) => commits,
      formatCollectedGitData: (commits) => ({ commits, files: '', diff: '', gitLogs: '' }),
    },
  };
  for (const [name, values] of Object.entries(overrides)) Object.assign(imports[name], values);
  const module = {};
  compileFunction(outputText, ['require', 'exports'])((name) => imports[name], module);
  return {
    saved,
    generate: (signal) => module.generateReport({ date: '2026-09-29', reporterName: '张三', repoPaths: ['/repo'] }, signal),
  };
}

test('empty generation keeps scan diagnostics outside user work sections', async () => {
  const { generate, saved } = createGenerator({}, false);
  const result = await generate();
  assert.match(result.report, /暂无可用工作记录/);
  assert.doesNotMatch(result.report, /已完成.*扫描|推进当前模块/);
  assert.match(result.report, /AI提示：所选时间段未采集到代码提交记录/);
  assert.equal(saved.length, 1);
});

for (const stage of ['collection', 'report', 'extraction']) {
  test(`cancellation during ${stage} rejects without saving a fallback`, async () => {
    const controller = new AbortController();
    const overrides = stage === 'collection'
      ? { './gitCollect.js': { collectGitData: async () => { controller.abort(); return { commits: [commit] }; } } }
      : { './aiClient.js': stage === 'report'
        ? { callAiReport: async (_config, _input, _range, _style, signal) => {
          assert.equal(signal, controller.signal);
          controller.abort();
          signal.throwIfAborted();
        } }
        : { callAiStructuredExtract: async (_config, _report, signal) => {
          assert.equal(signal, controller.signal);
          controller.abort();
          return undefined;
        } } };
    const { generate, saved } = createGenerator(overrides);
    await assert.rejects(generate(controller.signal), { name: 'AbortError' });
    assert.equal(saved.length, 0);
  });
}

test('ordinary AI failure still produces a factual saved fallback', async () => {
  const { generate, saved } = createGenerator({ './aiClient.js': {
    callAiReport: async () => { throw new Error('服务暂不可用'); },
  } });
  const result = await generate();
  assert.match(result.report, /AI提示：服务暂不可用/);
  assert.doesNotMatch(result.report, /8小时|交互稳定性/);
  assert.equal(saved.length, 1);
});
