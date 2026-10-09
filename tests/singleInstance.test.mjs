import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileFunction } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

async function start({ lock = true, restoreError, configError, resumeError, pendingRestore, pendingUpdates } = {}) {
  const calls = [];
  const handlers = new Map();
  const powerHandlers = new Map();
  const window = { isMinimized: () => true, restore: () => calls.push('restore-window'), show: () => calls.push('show'), focus: () => calls.push('focus') };
  const app = {
    requestSingleInstanceLock: () => { calls.push('lock'); return lock; },
    quit: () => calls.push('quit'),
    whenReady: () => { calls.push('ready'); return Promise.resolve(); },
    on: (event, callback) => handlers.set(event, callback),
  };
  const imports = {
    electron: { app, BrowserWindow: { getAllWindows: () => [window] }, powerMonitor: { on: (event, callback) => powerHandlers.set(event, callback) }, dialog: { showErrorBox: (...args) => calls.push(['error', ...args]) } },
    './main/autoSync.js': { clearAutoSyncTimer: () => calls.push('clear'), refreshAutoSyncSchedule: async () => {
      calls.push('schedule');
      if (resumeError && calls.filter(value => value === 'schedule').length > 1) throw resumeError;
    } },
    './main/feishuAuth.js': { disposeFeishuAuthWatchers: () => calls.push('dispose') },
    './main/appUpdate.js': { initializeAppUpdates: async () => { calls.push('updates'); await pendingUpdates; }, stopAppUpdates: () => calls.push('stop-updates') },
    './main/ipc.js': { registerIpcHandlers: () => calls.push('ipc') },
    './main/windows.js': { mainWindow: window, createMainWindow: () => calls.push('window') },
    './main/config.js': { loadConfig: async () => { calls.push('config'); if (configError) throw configError; } },
    './main/backup.js': { applyPendingRestore: async () => { calls.push('pending'); if (restoreError) throw restoreError; await pendingRestore; } },
  };
  const source = await readFile(new URL('../electron/main.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  compileFunction(outputText, ['require', 'exports', 'process'])(name => {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  }, {}, { platform: 'win32' });
  await new Promise(resolve => setImmediate(resolve));
  return { calls, handlers, powerHandlers };
}

test('second process exits before readiness, restore, IPC, database or scheduling', async () => {
  const { calls, handlers } = await start({ lock: false });
  assert.deepEqual(calls, ['lock', 'quit']);
  assert.equal(handlers.has('activate'), false);
});

test('primary process restores data and validates config before initializing UI and scheduler', async () => {
  const { calls, handlers } = await start();
  assert.deepEqual(calls, ['lock', 'ready', 'pending', 'config', 'updates', 'ipc', 'window', 'schedule']);
  handlers.get('second-instance')();
  assert.deepEqual(calls.slice(-3), ['restore-window', 'show', 'focus']);
  handlers.get('before-quit')();
  assert.deepEqual(calls.slice(-2), ['clear', 'dispose']);
  handlers.get('quit')();
  assert.equal(calls.at(-1), 'stop-updates');
});

test('restore and config errors show a fatal message and never initialize application services', async () => {
  for (const options of [{ restoreError: new Error('restore failed') }, { configError: new Error('invalid config') }]) {
    const { calls, handlers } = await start(options);
    assert.equal(calls.includes('ipc'), false);
    assert.equal(calls.includes('window'), false);
    assert.equal(calls.includes('schedule'), false);
    assert.equal(calls.at(-1), 'quit');
    assert.ok(calls.some(value => Array.isArray(value) && value[0] === 'error'));
    handlers.get('activate')?.();
    handlers.get('second-instance')?.();
    assert.equal(calls.includes('window'), false);
  }
});

test('resume failures are handled and stop the app instead of becoming unhandled rejections', async () => {
  const { calls, powerHandlers } = await start({ resumeError: new Error('configuration inaccessible') });
  assert.equal(typeof powerHandlers.get('resume'), 'function');
  await powerHandlers.get('resume')();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(value => value === 'schedule').length, 2);
  assert.equal(calls.at(-1), 'quit');
  assert.match(calls.find(value => Array.isArray(value) && value[0] === 'error')[2], /configuration inaccessible/);
  powerHandlers.get('resume')();
  assert.equal(calls.filter(value => value === 'schedule').length, 2);
});

test('quitting during startup prevents later service initialization', async () => {
  for (const pending of ['pendingRestore', 'pendingUpdates']) {
    let release;
    const promise = new Promise(resolve => { release = resolve; });
    const { calls, handlers } = await start({ [pending]: promise });
    handlers.get('before-quit')();
    release();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.includes('ipc'), false);
    assert.equal(calls.includes('window'), false);
    assert.equal(calls.includes('schedule'), false);
  }
});
