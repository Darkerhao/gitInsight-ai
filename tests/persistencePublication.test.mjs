import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'node:fs';
import * as files from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import { compileFunction } from 'node:vm';
import ts from 'typescript';
import initSqlJs from 'sql.js';

async function loadModule(name, imports) {
  const source = await files.readFile(new URL(`../electron/main/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } });
  const exports = {};
  compileFunction(outputText, ['require', 'exports'])((name) => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, exports);
  return exports;
}

async function database(t, overrides = {}) {
  const directory = await files.mkdtemp(path.join(tmpdir(), 'gitinsight-persistence-'));
  t.after(() => files.rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'reports.sqlite');
  const SQL = await initSqlJs();
  let initializations = 0;
  const atomicFile = await loadModule('atomicFile', {
    'node:crypto': crypto, 'node:fs/promises': { ...files, ...overrides },
  });
  const api = await loadModule('database', {
    electron: {}, 'node:fs': fs, 'node:fs/promises': { ...files, ...overrides }, 'node:path': path,
    'sql.js': async () => { initializations++; return SQL; },
    './atomicFile.js': atomicFile,
    '../../src/shared/edition.js': {},
    './paths.js': { ensureConfigDir: async () => {}, getDatabasePath: () => filename },
    './reflectionStore.js': { ensureReflectionSchema() {} },
    './weeklySummaryStore.js': { ensureWeeklySummarySchema() {} },
    './timeline.js': { ensureTimelineSchema() {}, async backfillTimelineSnapshots() {} },
  });
  return { api, filename, SQL, initializations: () => initializations };
}

test('concurrent initialization shares one ready database', async (t) => {
  const context = await database(t);
  const [first, second] = await Promise.all([context.api.getDatabase(), context.api.getDatabase()]);
  assert.equal(first, second);
  assert.equal(context.initializations(), 1);
});

test('concurrent saves serialize and leave the latest valid SQLite snapshot', async (t) => {
  let writes = 0;
  let active = 0;
  let peak = 0;
  const context = await database(t, { async writeFile(...args) {
    writes++;
    active++;
    peak = Math.max(peak, active);
    if (writes === 2) await new Promise(resolve => setTimeout(resolve, 60));
    try { return await files.writeFile(...args); } finally { active--; }
  } });
  const db = await context.api.getDatabase();
  db.run('CREATE TABLE snapshot (value INTEGER)');
  db.run('INSERT INTO snapshot VALUES (1)');
  const first = context.api.persistDatabase();
  await new Promise(resolve => setTimeout(resolve, 10));
  db.run('INSERT INTO snapshot VALUES (2)');
  const second = context.api.persistDatabase();
  await Promise.all([first, second]);
  const saved = new context.SQL.Database(await files.readFile(context.filename));
  assert.equal(saved.exec('SELECT COUNT(*) FROM snapshot')[0].values[0][0], 2);
  assert.equal(peak, 1);
  saved.close();
});

test('partial write preserves the previous database and the save queue recovers', async (t) => {
  let fail = false;
  const context = await database(t, { async writeFile(filename, contents) {
    if (fail) {
      fail = false;
      await files.writeFile(filename, new Uint8Array([1, 2, 3]));
      throw new Error('disk write failed');
    }
    return files.writeFile(filename, contents);
  } });
  const db = await context.api.getDatabase();
  const previous = await files.readFile(context.filename);
  db.run('CREATE TABLE recovered (value INTEGER)');
  fail = true;
  await assert.rejects(context.api.persistDatabase(), /disk write failed/);
  assert.equal((await files.readFile(context.filename)).equals(previous), true);
  await context.api.persistDatabase();
  const saved = new context.SQL.Database(await files.readFile(context.filename));
  assert.doesNotThrow(() => saved.run('INSERT INTO recovered VALUES (1)'));
  saved.close();
});

async function publication({ remoteError, logError } = {}) {
  const logs = [];
  let submissions = 0;
  const fetch = async () => {
    submissions++;
    if (remoteError) throw remoteError;
    return new Response(JSON.stringify({ code: 0 }));
  };
  const api = await loadModule('feishuForm', {
    electron: {},
    '../../src/shared/types.js': { DEFAULT_FEISHU_FORM_CONFIG: {} },
    './config.js': { normalizeWorkHours: () => 8 },
    './database.js': {
      async recordSyncLog(value) { logs.push(value); if (logError) throw logError; },
      async recordErrorLog() { if (logError) throw logError; },
    },
    './networkRequest.js': { fetchWithTimeout: fetch },
    './windows.js': {},
    './feishuAuth.js': {
      resolveFeishuAuth: async () => ({ endpoint: 'https://example.test/submit' }),
      requireFeishuConfigValue: (value) => value,
      parseFeishuEndpointUrl: endpoint => new URL(endpoint),
      getFeishuShareToken: config => config.shareToken,
      checkFeishuDuplicate: async () => ({ available: true, matches: 0 }),
    },
  });
  // Also cover the original implementation before it adopts fetchWithTimeout.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetch;
  try {
    return { result: await api.syncFeishuDaily({
      date: '2026-09-29', report: 'work', reporterName: 'Tester',
      config: { reporterName: '', reporterAvatarUrl: '', endpoint: 'https://example.test/submit',
        shareToken: 'shr-test', reporterUserId: 'tester', projectOptionId: 'project' },
    }), logs, submissions };
  } finally { globalThis.fetch = originalFetch; }
}

test('remote success with failed local logging remains successful with a warning', async () => {
  const { result, logs, submissions } = await publication({ logError: new Error('disk full') });
  assert.equal(result.success, true);
  assert.match(result.warning, /已提交.*本地.*失败/);
  assert.deepEqual(logs.map(log => log.status), ['success']);
  assert.equal(submissions, 1);
});

test('remote failure survives a secondary log failure without retrying submission', async () => {
  const original = new Error('request timed out; submission unknown');
  await assert.rejects(publication({ remoteError: original, logError: new Error('disk full') }), error => error === original);
});

test('successful publication returns a successful result without warning', async () => {
  const { result, submissions } = await publication();
  assert.deepEqual(result, { success: true });
  assert.equal(submissions, 1);
});

test('publication timeout asks user to verify records before resubmitting', async () => {
  await assert.rejects(publication({ remoteError: new DOMException('请求超时', 'TimeoutError') }), /核对飞书提交记录.*勿直接重复提交/);
});
