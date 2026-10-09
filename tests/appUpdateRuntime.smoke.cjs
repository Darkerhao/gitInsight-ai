// Real Electron + preload + updater HTTP downloads. Installer execution is intercepted;
// each phase has its own temporary profile and cache and all windows stay hidden.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { dump } = require('js-yaml');
const { version } = require('../package.json');

const projectRoot = path.resolve(__dirname, '..');
const nextVersion = require('semver').inc(version, 'patch');
const prefix = 'UPDATE_SMOKE ';
const payload = Buffer.alloc(256 * 1024, 'Local updater verification; not an executable.');
const installerName = `MajiAI-Lite-${nextVersion}-Windows-x64.exe`;

function checkedRoot(value) {
  const root = path.resolve(value || '.');
  assert.equal(path.dirname(root), path.resolve(tmpdir()));
  assert.match(path.basename(root), /^maji-updater-smoke-/);
  return root;
}

async function electronMain() {
  const { app, BrowserWindow, dialog, shell, session } = require('electron');
  const root = checkedRoot(process.env.MAJI_UPDATE_SMOKE_ROOT);
  const phase = process.env.MAJI_UPDATE_SMOKE_PHASE;
  assert.ok(['manual', 'automatic', 'disabled', 'exit-disabled', 'checksum'].includes(phase));
  const directory = path.join(root, phase);
  const profile = path.join(directory, 'profile');
  for (const [name, destination] of Object.entries({
    appData: path.join(directory, 'app-data'), userData: profile,
    sessionData: path.join(directory, 'session'), crashDumps: path.join(directory, 'crashes'), logs: path.join(directory, 'logs'),
  })) {
    fs.mkdirSync(destination, { recursive: true });
    app.setPath(name, destination);
  }
  const emit = message => fs.writeSync(1, `${prefix}${JSON.stringify({ phase, ...message })}\n`);
  const fail = error => { emit({ error: error.stack || String(error) }); app.exit(1); };
  process.on('uncaughtException', fail);
  process.on('unhandledRejection', fail);
  const watchdog = setTimeout(() => fail(new Error('Updater runtime timed out')), 25_000);
  app.on('will-quit', () => clearTimeout(watchdog));

  // Present only this isolated process as an installed NSIS app.
  const getPath = app.getPath.bind(app);
  const executable = path.join(directory, '码迹 AI 轻量版.exe');
  fs.writeFileSync(path.join(directory, `Uninstall ${path.basename(executable)}`), 'fixture');
  app.getPath = name => name === 'exe' ? executable : getPath(name);
  app.getVersion = () => version;
  Object.defineProperty(app, 'isPackaged', { value: true });
  fs.writeFileSync(path.join(profile, 'updater-settings.json'), JSON.stringify({ autoUpdate: phase === 'disabled' }));
  for (const method of ['show', 'showInactive', 'focus', 'restore']) BrowserWindow.prototype[method] = function () {};
  dialog.showErrorBox = (title, message) => fail(new Error(`${title}: ${message}`));
  const openedLinks = [];
  shell.openExternal = async url => { openedLinks.push(url); };
  const blockExternalRequests = target => target.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] }, (details, callback) => callback({ cancel: new URL(details.url).hostname !== '127.0.0.1' }),
  );
  app.on('session-created', blockExternalRequests);
  app.whenReady().then(() => blockExternalRequests(session.defaultSession));

  const { autoUpdater } = require('electron-updater');
  const cacheBase = require('electron-updater/out/AppAdapter').getAppCacheDir();
  const cacheName = path.relative(cacheBase, path.join(directory, 'cache'));
  assert.equal(path.resolve(cacheBase, cacheName), path.join(directory, 'cache'));
  const updateConfig = path.join(directory, 'app-update.yml');
  fs.writeFileSync(updateConfig, dump({
    provider: 'generic', channel: 'lite',
    url: `${process.env.MAJI_UPDATE_SMOKE_URL}/${phase}/`, updaterCacheDirName: cacheName,
  }));
  autoUpdater.updateConfigPath = updateConfig;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.logger = { info() {}, warn() {}, error() {}, debug() {} };
  const downloads = [];
  autoUpdater.on('update-downloaded', info => downloads.push(info.downloadedFile));
  autoUpdater.install = (silent, forceRun) => {
    assert.equal(downloads.length, 1);
    assert.ok(downloads[0].startsWith(path.join(directory, 'cache') + path.sep));
    assert.deepEqual(fs.readFileSync(downloads[0]), payload);
    emit({ event: 'install-intercepted', silent, forceRun });
    return true;
  };

  app.once('browser-window-created', (_event, window) => {
    window.webContents.on('preload-error', (_event, _file, error) => fail(error));
    window.webContents.once('did-finish-load', async () => {
      const execute = source => window.webContents.executeJavaScript(source);
      try {
        const initial = await execute(`(async () => {
          localStorage.setItem('gitinsight:welcome-finished', 'true');
          localStorage.setItem('gitinsight:welcome-animation-enabled', 'false');
          location.hash = '/about';
          return window.api.getAppUpdateState();
        })()`);
        assert.equal(initial.currentVersion, version);
        assert.equal(initial.supported, true);
        assert.equal(initial.autoUpdate, phase === 'disabled');
        assert.equal(await execute(`window.api.installAppUpdate().then(() => false, () => true)`), true);
        assert.equal(await execute(`window.api.openAppLink('file:///not-allowed').then(() => false, () => true)`), true);
        await execute(`window.api.openAppLink('releases')`);
        assert.deepEqual(openedLinks, ['https://github.com/Darkerhao/gitInsight-ai/releases']);

        const secondary = new BrowserWindow({ show: false, webPreferences: {
          preload: path.join(projectRoot, 'out/preload/preload.cjs'), contextIsolation: true, nodeIntegration: false,
        } });
        await secondary.loadURL('about:blank');
        assert.equal(await secondary.webContents.executeJavaScript(`window.api.checkForAppUpdates().then(() => false, () => true)`), true);
        secondary.destroy();

        await execute('window.api.checkForAppUpdates()');
        if (phase !== 'disabled') await execute('window.api.downloadAppUpdate()');
        const final = await execute(`(async () => {
          for (let attempt = 0; attempt < 300; attempt++) {
            const state = await window.api.getAppUpdateState();
            if (state.status === 'downloaded' || state.status === 'error') return state;
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          throw new Error('Update did not finish');
        })()`);
        assert.equal(final.status, phase === 'checksum' ? 'error' : 'downloaded');
        if (phase === 'checksum') {
          assert.match(final.message, /校验失败/);
          assert.equal(downloads.length, 0);
          assert.equal(await execute(`window.api.installAppUpdate().then(() => false, () => true)`), true);
        } else {
          assert.equal(final.latestVersion, nextVersion);
          assert.equal(downloads.length, 1);
          assert.deepEqual(fs.readFileSync(downloads[0]), payload);
        }
        assert.equal(await execute(`(async () => {
          for (let attempt = 0; attempt < 150; attempt++) {
            if (document.querySelector('.app-about-card')) return true;
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          return false;
        })()`), true, 'Real renderer must display the About page');
        assert.equal(window.isVisible(), false);
        emit({ event: 'verified', status: final.status, downloads: downloads.length });
        if (phase === 'manual') {
          // quitAndInstall schedules app.quit; do not require its invoke response after exit.
          await execute('void window.api.installAppUpdate(); true');
        } else {
          if (phase === 'automatic') await execute('window.api.setAutomaticUpdates(true)');
          if (phase === 'disabled') await execute('window.api.setAutomaticUpdates(false)');
          if (phase === 'exit-disabled') app.exit(0);
          else app.quit();
        }
      } catch (error) { fail(error); }
    });
  });
  await import(pathToFileURL(path.join(projectRoot, 'out/main/main.js')).href);
}

async function nodeMain() {
  assert.equal(process.platform, 'win32', 'This runtime check exercises the Windows NSIS updater');
  assert.ok(fs.existsSync(path.join(projectRoot, 'out/main/main.js')), 'Run npm run build first');
  const root = checkedRoot(fs.mkdtempSync(path.join(tmpdir(), 'maji-updater-smoke-')));
  const requests = [];
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    requests.push(pathname);
    if (pathname.endsWith('/lite.yml')) {
      const sha512 = createHash('sha512').update(pathname.startsWith('/checksum/') ? Buffer.from('wrong digest') : payload).digest('base64');
      response.writeHead(200, { 'Content-Type': 'text/yaml' });
      response.end(dump({ version: nextVersion, files: [{ url: installerName, size: payload.length, sha512 }], releaseNotes: '本地更新验证' }));
    } else if (pathname.endsWith(`/${installerName}`)) {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': payload.length });
      response.end(payload);
    } else { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, MAJI_UPDATE_SMOKE_ROOT: root, MAJI_UPDATE_SMOKE_URL: `http://127.0.0.1:${server.address().port}` };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  delete env.VITE_DEV_SERVER_URL;
  try {
    for (const phase of ['manual', 'automatic', 'disabled', 'exit-disabled', 'checksum']) {
      const output = await new Promise((resolve, reject) => {
        const child = spawn(require('electron'), [__filename, `--user-data-dir=${path.join(root, phase, 'profile')}`], {
          cwd: projectRoot, env: { ...env, MAJI_UPDATE_SMOKE_PHASE: phase }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        const timer = setTimeout(() => child.kill(), 35_000);
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(`${phase} failed (${code}):\n${output}`)); });
      });
      const messages = output.split(/\r?\n/).filter(line => line.startsWith(prefix)).map(line => JSON.parse(line.slice(prefix.length)));
      assert.ok(messages.some(message => message.event === 'verified'), output);
      const installations = messages.filter(message => message.event === 'install-intercepted');
      assert.equal(installations.length, ['manual', 'automatic'].includes(phase) ? 1 : 0, output);
      if (installations.length) assert.equal(installations[0].forceRun, phase === 'manual');
      assert.ok(requests.includes(`/${phase}/lite.yml`));
      assert.ok(requests.includes(`/${phase}/${installerName}`));
      console.log(`Updater runtime ${phase}: PASS (real HTTP + SHA-512 + preload IPC; installer intercepted).`);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(checkedRoot(root), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

(process.versions.electron ? electronMain() : nodeMain()).catch(error => {
  console.error(error);
  process.exitCode = 1;
  if (process.versions.electron) require('electron').app.exit(1);
});
