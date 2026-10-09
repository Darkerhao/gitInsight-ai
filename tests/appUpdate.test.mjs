import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as files from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const release = { version: '3.8.9', releaseNotes: '改进应用内更新', releaseDate: '2026-10-09T00:00:00.000Z' };

async function updateContext(t, options = {}) {
  const directory = await files.mkdtemp(path.join(tmpdir(), 'maji-update-test-'));
  t.after(() => files.rm(directory, { recursive: true, force: true }));
  const preferencesPath = path.join(directory, 'updater-settings.json');
  if (options.preferences !== undefined) {
    await files.writeFile(preferencesPath, typeof options.preferences === 'string'
      ? options.preferences : JSON.stringify(options.preferences));
  }
  const executable = path.join(directory, '码迹 AI 轻量版.exe');
  if (options.installed !== false) await files.writeFile(path.join(directory, `Uninstall ${path.basename(executable)}`), '');
  if (options.packageType) await files.writeFile(path.join(directory, 'package-type'), options.packageType);
  const updater = new EventEmitter();
  Object.assign(updater, {
    checks: 0, downloads: 0, installs: [],
    checkImpl: async () => {
      updater.emit('update-not-available', { version: '3.8.8' });
      return { isUpdateAvailable: false };
    },
    downloadImpl: async () => {
      updater.emit('update-downloaded', release);
      return ['/cache/update.exe'];
    },
    async checkForUpdates() {
      updater.checks++;
      updater.emit('checking-for-update');
      return updater.checkImpl();
    },
    async downloadUpdate() { updater.downloads++; return updater.downloadImpl(); },
    quitAndInstall(...args) { updater.installs.push(args); },
  });
  const timers = new Map();
  const snapshots = [];
  const mockedProcess = {
    platform: options.platform ?? 'win32', resourcesPath: directory,
    env: options.env ?? {},
  };
  const imports = {
    electron: { app: {
      isPackaged: options.packaged !== false,
      getVersion: () => '3.8.8',
      getPath: key => key === 'exe' ? executable : directory,
    } },
    'electron-updater': { autoUpdater: updater },
    './atomicFile.js': { writeFileAtomically: async (filename, content) => {
      if (options.writeFailure) throw new Error('disk unavailable');
      await files.writeFile(filename, content);
    } },
    './windows.js': { sendToMainWindow: (channel, state) => snapshots.push({ channel, state: structuredClone(state) }) },
  };
  const source = await files.readFile(new URL('../electron/main/appUpdate.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } });
  const api = {};
  compileFunction(outputText, ['require', 'exports', 'process', 'setTimeout', 'clearTimeout'])(
    name => imports[name] ?? require(name), api, mockedProcess,
    (callback, delay) => { const timer = { unref() {} }; timers.set(timer, { callback, delay }); return timer; },
    timer => timers.delete(timer),
  );
  await api.initializeAppUpdates();
  t.after(() => api.stopAppUpdates());
  return { api, updater, timers, snapshots, preferencesPath, options };
}

function offerUpdate(context) {
  context.updater.checkImpl = async () => {
    context.updater.emit('update-available', release);
    return { isUpdateAvailable: true, updateInfo: release };
  };
}

test('installed builds start with delayed automatic checks and stable-only updates', async t => {
  const { api, updater, timers } = await updateContext(t);
  assert.equal(api.getAppUpdateState().currentVersion, '3.8.8');
  assert.equal(api.getAppUpdateState().autoUpdate, true);
  assert.equal(api.getAppUpdateState().supported, true);
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, true);
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.allowDowngrade, false);
  assert.equal(updater.checks, 0);
  assert.equal([...timers.values()][0].delay, 15_000);
});

test('development, portable, extracted Windows and unsigned macOS builds report their limitation', async t => {
  for (const options of [
    { packaged: false }, { env: { PORTABLE_EXECUTABLE_FILE: 'portable.exe' } },
    { installed: false }, { platform: 'darwin' }, { platform: 'linux' },
  ]) {
    const { api, updater, timers } = await updateContext(t, options);
    assert.equal(api.getAppUpdateState().status, 'unsupported');
    assert.equal(api.getAppUpdateState().supported, false);
    assert.ok(api.getAppUpdateState().message);
    await api.checkForAppUpdates();
    assert.equal(updater.checks, 0);
    assert.equal(timers.size, 0);
    assert.throws(() => api.installAppUpdate(), /下载|安装|更新/);
  }
});

test('AppImage and supported Linux package managers can update', async t => {
  for (const options of [{ env: { APPIMAGE: '/opt/app.AppImage' } }, { packageType: 'deb' }, { packageType: 'rpm' }]) {
    const { api } = await updateContext(t, { ...options, platform: 'linux' });
    assert.equal(api.getAppUpdateState().supported, true);
  }
});

test('disabled preferences survive startup without changing any business configuration', async t => {
  const { api, updater, timers, preferencesPath } = await updateContext(t, { preferences: { autoUpdate: false } });
  assert.equal(api.getAppUpdateState().autoUpdate, false);
  assert.equal(timers.size, 0);
  await api.setAutomaticUpdates(true);
  assert.equal(JSON.parse(await files.readFile(preferencesPath, 'utf8')).autoUpdate, true);
  assert.equal([...timers.values()][0].delay, 0);
  await api.setAutomaticUpdates(false);
  assert.equal(timers.size, 0);
  assert.equal(JSON.parse(await files.readFile(preferencesPath, 'utf8')).autoUpdate, false);
  assert.equal(updater.checks, 0);
  assert.deepEqual((await files.readdir(path.dirname(preferencesPath))).sort(), ['Uninstall 码迹 AI 轻量版.exe', 'updater-settings.json'].sort());
});

test('preference failures are visible, do not enable automation, and can be retried', async t => {
  const context = await updateContext(t, { preferences: '{broken' });
  assert.equal(context.api.getAppUpdateState().status, 'error');
  assert.equal(context.api.getAppUpdateState().autoUpdate, false);
  assert.equal(context.timers.size, 0);
  await context.api.setAutomaticUpdates(true);
  assert.equal(context.api.getAppUpdateState().autoUpdate, true);
  const denied = await updateContext(t, { preferences: { autoUpdate: false }, writeFailure: true });
  await assert.rejects(denied.api.setAutomaticUpdates(true), /disk unavailable/);
  assert.equal(denied.api.getAppUpdateState().autoUpdate, false);
  assert.equal(denied.timers.size, 0);
  await assert.rejects(denied.api.setAutomaticUpdates('false'), /开关|boolean|布尔/);
});

test('manual checks return current-version feedback and a timestamp', async t => {
  const { api } = await updateContext(t, { preferences: { autoUpdate: false } });
  const state = await api.checkForAppUpdates();
  assert.equal(state.status, 'not-available');
  assert.ok(Number.isFinite(Date.parse(state.lastCheckedAt)));
});

test('overlapping checks share one request', async t => {
  const { api, updater } = await updateContext(t, { preferences: { autoUpdate: false } });
  let finish;
  updater.checkImpl = () => new Promise(resolve => { finish = resolve; });
  const first = api.checkForAppUpdates();
  const second = api.checkForAppUpdates();
  assert.equal(updater.checks, 1);
  assert.equal(api.getAppUpdateState().status, 'checking');
  updater.emit('update-not-available', { version: '3.8.8' });
  finish({ isUpdateAvailable: false });
  assert.deepEqual(await first, await second);
});

test('manual download reports progress, coalesces requests and cannot be replaced by a check', async t => {
  const context = await updateContext(t, { preferences: { autoUpdate: false } });
  const { api, updater, snapshots } = context;
  offerUpdate(context);
  assert.equal((await api.checkForAppUpdates()).status, 'available');
  assert.equal(updater.downloads, 0);
  let finish;
  updater.downloadImpl = () => new Promise(resolve => { finish = resolve; });
  const first = api.downloadAppUpdate();
  const second = api.downloadAppUpdate();
  assert.equal(updater.downloads, 1);
  updater.emit('download-progress', { percent: 42, transferred: 42, total: 100, bytesPerSecond: 10 });
  assert.equal(api.getAppUpdateState().progress.percent, 42);
  await api.checkForAppUpdates();
  assert.equal(updater.checks, 1);
  updater.emit('update-downloaded', release);
  finish(['/cache/update.exe']);
  await Promise.all([first, second]);
  assert.equal(api.getAppUpdateState().status, 'downloaded');
  assert.equal(api.getAppUpdateState().latestVersion, release.version);
  assert.equal(api.getAppUpdateState().releaseNotes, release.releaseNotes);
  assert.ok(snapshots.some(item => item.channel === 'app-update:state' && item.state.progress?.percent === 42));
  await api.checkForAppUpdates();
  assert.equal(updater.checks, 1);
});

test('automatic checks download a new release without restarting the app', async t => {
  const context = await updateContext(t);
  offerUpdate(context);
  const timer = [...context.timers.values()][0];
  await timer.callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.updater.checks, 1);
  assert.equal(context.updater.downloads, 1);
  assert.equal(context.api.getAppUpdateState().status, 'downloaded');
  assert.equal(context.updater.installs.length, 0);
  assert.ok([...context.timers.values()].some(item => item.delay === 6 * 60 * 60 * 1000));
});

test('download errors are recoverable without losing the available release', async t => {
  const context = await updateContext(t, { preferences: { autoUpdate: false } });
  offerUpdate(context);
  await context.api.checkForAppUpdates();
  context.updater.downloadImpl = async () => { throw new Error('connection reset'); };
  assert.equal((await context.api.downloadAppUpdate()).status, 'error');
  assert.ok(context.api.getAppUpdateState().message);
  context.updater.downloadImpl = async () => { context.updater.emit('update-downloaded', release); return ['/cache/update.exe']; };
  assert.equal((await context.api.downloadAppUpdate()).status, 'downloaded');
});

test('missing update manifests and network failures remain errors and can be rechecked', async t => {
  const { api, updater } = await updateContext(t, { preferences: { autoUpdate: false } });
  updater.checkImpl = async () => { throw Object.assign(new Error('missing channel'), { code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' }); };
  assert.equal((await api.checkForAppUpdates()).status, 'error');
  assert.match(api.getAppUpdateState().message, /更新文件|更新清单/);
  updater.checkImpl = async () => { updater.emit('update-not-available', { version: '3.8.8' }); return { isUpdateAvailable: false }; };
  assert.equal((await api.checkForAppUpdates()).status, 'not-available');
});

test('install is gated by a complete download and uses the updater restart operation', async t => {
  const context = await updateContext(t, { preferences: { autoUpdate: false } });
  assert.throws(() => context.api.installAppUpdate(), /下载/);
  offerUpdate(context);
  await context.api.checkForAppUpdates();
  assert.throws(() => context.api.installAppUpdate(), /下载/);
  await context.api.downloadAppUpdate();
  context.api.installAppUpdate();
  assert.deepEqual(context.updater.installs, [[true, true]]);
});

test('the quit hook follows the latest preference after a manual download', async t => {
  for (const autoUpdate of [false, true]) {
    const context = await updateContext(t, { preferences: { autoUpdate: false } });
    offerUpdate(context);
    await context.api.checkForAppUpdates();
    await context.api.downloadAppUpdate();
    assert.equal(context.updater.autoInstallOnAppQuit, true, 'Keep the library quit handler armed until quit');
    await context.api.setAutomaticUpdates(autoUpdate);
    context.api.stopAppUpdates();
    assert.equal(context.updater.autoInstallOnAppQuit, autoUpdate);
    assert.equal(context.timers.size, 0);
  }
});
