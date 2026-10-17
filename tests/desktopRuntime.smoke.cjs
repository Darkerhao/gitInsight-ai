// Run after npm run build. Uses the installed Electron, real preload/IPC and an
// isolated profile; native windows stay hidden and network requests are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const prefix = 'DESKTOP_SMOKE ';
const fakeKey = 'runtime-smoke-fake-key';
const legacyMaterial = {
  role: 'projectManager', date: '2026-01-02',
  sections: [{ key: 'progress', label: '今日推进事项', content: '旧版本已保存的里程碑进度' }],
  extraNotes: '旧素材保持可读',
};

function checkedRoot(value) {
  const root = path.resolve(value || '.');
  assert.equal(path.dirname(root), path.resolve(tmpdir()));
  assert.match(path.basename(root), /^gitinsight-desktop-smoke-/);
  return root;
}

async function electronMain() {
  const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
  const root = checkedRoot(process.env.GITINSIGHT_SMOKE_ROOT);
  const phase = process.env.GITINSIGHT_SMOKE_PHASE;
  assert.ok(['write', 'secondary', 'read', 'restored', 'restored-again'].includes(phase));
  const profile = path.join(root, 'profile');
  const backupPath = path.join(root, 'export.gitinsight-backup');
  const isRestored = phase.startsWith('restored');
  for (const [name, directory] of Object.entries({
    appData: path.join(root, 'app-data'), userData: profile,
    // Chromium Local State contains the encryption key; real restarts reuse it.
    sessionData: path.join(root, phase === 'secondary' ? 'session-secondary' : 'session'),
    crashDumps: path.join(root, 'crashes'), logs: path.join(root, 'logs'),
  })) {
    fs.mkdirSync(directory, { recursive: true });
    app.setPath(name, directory);
  }
  const emit = data => process.stdout.write(`${prefix}${JSON.stringify({ phase, ...data })}\n`);
  const fail = error => { emit({ error: error.stack || String(error) }); app.exit(1); };
  process.on('uncaughtException', fail);
  process.on('unhandledRejection', fail);
  const watchdog = setTimeout(() => fail(new Error(`Timed out in ${phase}`)), 25_000);
  app.on('will-quit', () => clearTimeout(watchdog));

  // Electron 37 BrowserWindow inherits these methods from BaseWindow. Override
  // only visibility, retaining actual construction, preload and renderer loading.
  for (const method of ['show', 'showInactive', 'focus', 'restore']) {
    BrowserWindow.prototype[method] = function () {};
  }
  dialog.showErrorBox = (title, message) => fail(new Error(`${title}: ${message}`));
  dialog.showSaveDialog = async () => {
    assert.equal(phase, 'read');
    return { canceled: false, filePath: backupPath };
  };
  dialog.showOpenDialog = async () => {
    assert.equal(phase, 'read');
    return { canceled: false, filePaths: [backupPath] };
  };
  dialog.showMessageBox = async options => {
    assert.equal(phase, 'read');
    assert.equal(options.defaultId, 1, 'Restore confirmation must default to cancel');
    return { response: 0, checkboxChecked: false };
  };
  app.relaunch = () => {
    assert.equal(phase, 'read');
    emit({ event: 'relaunch' }); // The parent restarts only this known isolated profile.
  };
  globalThis.fetch = async () => { throw new Error('Network is disabled in desktop smoke tests'); };
  app.on('session-created', createdSession => {
    createdSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
  });
  app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
  });

  let windows = 0;
  let registrations = 0;
  let lock;
  let secondInstances = 0;
  const acquireLock = app.requestSingleInstanceLock.bind(app);
  app.requestSingleInstanceLock = (...args) => (lock = acquireLock(...args));
  const registerHandler = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (...args) => { registrations += 1; return registerHandler(...args); };
  app.on('second-instance', () => {
    secondInstances += 1;
    // Windows GUI executables do not reliably consume piped stdin. Finish via
    // Electron's own event, after the application's activation handler runs.
    setImmediate(() => app.quit());
  });
  app.on('will-quit', () => emit({ event: 'quit', lock, windows, registrations, secondInstances }));
  app.on('browser-window-created', (_event, window) => {
    windows += 1;
    if (phase === 'secondary') return fail(new Error('Second instance created a window'));
    window.webContents.on('preload-error', (_event, _file, error) => fail(error));
    window.webContents.on('render-process-gone', (_event, details) => fail(new Error(JSON.stringify(details))));
    window.webContents.once('did-fail-load', (_event, code, description) => fail(new Error(`${code}: ${description}`)));
    window.webContents.once('did-finish-load', async () => {
      try {
        // Poll from the main process: hidden renderer animation frames/timers are throttled.
        // This measures DOM mounting, not a visible installed application's cold start.
        const deadline = Date.now() + 10_000;
        let rendererTiming;
        do {
          rendererTiming = await window.webContents.executeJavaScript(`({
            timeOrigin: performance.timeOrigin,
            entries: performance.getEntries().filter(entry => entry.name.startsWith('gitinsight:'))
              .map(({ name, startTime, duration }) => ({ name, startTime, duration }))
          })`);
          if (rendererTiming.entries.some(entry => entry.name === 'gitinsight:first-page-ready')) break;
          await new Promise(resolve => setTimeout(resolve, 20));
        } while (Date.now() < deadline);
        const firstPage = rendererTiming.entries.find(entry => entry.name === 'gitinsight:first-page-ready');
        assert.ok(firstPage, 'The initial lazy page must mount');
        emit({ event: 'startup', metric: 'isolated hidden window DOM mount; not visible cold start',
          processToPageMs: Math.round(rendererTiming.timeOrigin + firstPage.startTime - Number(process.env.GITINSIGHT_SMOKE_STARTED_AT)),
          main: performance.getEntriesByType('mark').filter(entry => entry.name.startsWith('gitinsight:'))
            .map(({ name, startTime }) => ({ name, ms: Math.round(startTime) })),
          renderer: rendererTiming.entries.map(({ name, startTime, duration }) => ({ name, ms: Math.round(startTime), durationMs: Math.round(duration) })),
        });
        const result = await window.webContents.executeJavaScript(`(async () => {
          const config = await window.api.loadConfig();
          const material = await window.api.loadRoleMaterial('projectManager', '2026-01-02');
          if (${JSON.stringify(phase)} === 'write') {
            config.reporterName = 'Desktop runtime smoke';
            config.aiApiKey = ${JSON.stringify(fakeKey)};
            config.aiProfiles = config.aiProfiles.map(profile => ({ ...profile, apiKey: ${JSON.stringify(fakeKey)} }));
            await window.api.saveConfig(config);
            await window.api.saveDailyReport({
              date: '2026-01-02', reporterName: config.reporterName,
              repoNames: ['isolated-repository'], repoPaths: [${JSON.stringify(path.join(root, 'repository'))}],
              report: 'Persisted desktop smoke report', status: 'draft', commitsCount: 1, filesCount: 1,
            });
            config.aiProfiles = config.aiProfiles.map(profile => ({ ...profile, enabled: false }));
            await window.api.saveConfig(config);
            const productMaterial = {
              role: 'productManager', date: '2026-01-03',
              sections: [{ key: 'requirement', label: '需求进展', content: '完成版本需求评审' }], extraNotes: '',
            };
            await window.api.saveRoleMaterial(productMaterial);
            for (const input of [material, productMaterial]) {
              const generated = await window.api.generateReportFromMaterial({ ...input, reporterName: config.reporterName });
              if (!generated.report.includes(input.sections[0].content)) throw new Error('素材事实必须保留');
              await window.api.saveDailyReport({
                date: input.date, reporterName: config.reporterName, repoNames: [], repoPaths: [],
                report: generated.report, status: 'draft', commitsCount: 0, filesCount: 0,
                rawInput: { gitLogs: '', files: '', diff: '', materialRole: input.role, material: input },
              });
            }
          }
          return {
            config: await window.api.loadConfig(), storage: await window.api.getStorageInfo(),
            reports: await window.api.listDailyReports(),
            legacyMaterial: material,
            productMaterial: await window.api.loadRoleMaterial('productManager', '2026-01-03'),
            materialReport: await window.api.loadMaterialReport('projectManager', '2026-01-02'),
            mounted: Boolean(document.querySelector('#app')?.children.length),
          };
        })()`);
        assert.equal(result.mounted, true, 'Vue renderer must mount');
        assert.equal(result.config.reporterName, 'Desktop runtime smoke');
        assert.equal(result.config.aiApiKey, isRestored ? '' : fakeKey);
        assert.equal(result.storage.userDataPath, profile);
        assert.equal(result.storage.reportsCount, 3);
        assert.equal(result.reports.length, 3);
        assert.ok(result.reports.some(report => report.report === 'Persisted desktop smoke report'));
        assert.deepEqual(result.legacyMaterial.sections, legacyMaterial.sections);
        assert.equal(result.legacyMaterial.extraNotes, legacyMaterial.extraNotes);
        assert.equal(result.productMaterial.sections[0].content, '完成版本需求评审');
        assert.equal(result.materialReport.materialRole, 'projectManager');
        assert.deepEqual(result.materialReport.repoPaths, []);
        assert.deepEqual(result.materialReport.material.sections, legacyMaterial.sections);
        assert.equal(window.isVisible(), false);
        if (isRestored) {
          assert.ok(result.config.aiProfiles.every(profile => profile.apiKey === ''));
          for (const key of ['cookie', 'csrfToken', 'shareToken', 'endpoint']) assert.equal(result.config.feishuForm[key], '');
          assert.equal(result.config.autoSync.enabled, false);
          assert.equal(result.config.autoSync.tasks.length, 1);
          assert.equal(result.config.autoSync.tasks[0].enabled, false);
        }
        emit({ event: 'ready', lock, windows, registrations, encryptionAvailable: result.storage.encryptionAvailable });
        if (phase === 'read') {
          const exported = await window.webContents.executeJavaScript(`(async () => {
            const config = await window.api.loadConfig();
            config.autoSync = { enabled: true, tasks: [{
              id: 'backup-smoke-task', name: 'Backup smoke', enabled: true, time: '23:59', repoPaths: [],
            }] };
            config.feishuForm.cookie = 'fake-backup-cookie';
            config.feishuForm.csrfToken = 'fake-backup-csrf';
            config.feishuForm.shareToken = 'fake-backup-share-token';
            config.feishuForm.endpoint = 'https://example.invalid/fake-backup-endpoint';
            await window.api.saveConfig(config);
            const exported = await window.api.exportDataBackup();
            config.reporterName = 'Mutated after export';
            config.autoSync.enabled = false;
            await window.api.saveConfig(config);
            await window.api.saveDailyReport({
              date: '2026-01-03', reporterName: config.reporterName,
              repoNames: ['isolated-repository'], repoPaths: [${JSON.stringify(path.join(root, 'repository'))}],
              report: 'Created after export', status: 'draft', commitsCount: 2, filesCount: 2,
            });
            return { exported, config: await window.api.loadConfig(), reports: await window.api.listDailyReports() };
          })()`);
          assert.deepEqual(exported.exported, { canceled: false, filePath: backupPath });
          assert.equal(exported.config.reporterName, 'Mutated after export');
          assert.equal(exported.reports.length, 4);
          // Restore exits the main process before invoke can resolve. Its pending
          // file and relaunch request are verified by the parent after exit.
          await window.webContents.executeJavaScript('void window.api.restoreDataBackup(); true');
        } else if (isRestored) app.quit();
      } catch (error) { fail(error); }
    });
  });
  await import(pathToFileURL(path.join(projectRoot, 'out/main/main.js')).href);
}

async function nodeMain() {
  assert.ok(fs.existsSync(path.join(projectRoot, 'out/main/main.js')), 'Run npm run build first');
  const root = checkedRoot(fs.mkdtempSync(path.join(tmpdir(), 'gitinsight-desktop-smoke-')));
  // Seed the exact main-branch schema, then let the real application migrate it.
  const SQL = await require('sql.js')();
  const oldDatabase = new SQL.Database();
  oldDatabase.run(`CREATE TABLE role_materials (
    role TEXT NOT NULL, date TEXT NOT NULL, sections_json TEXT NOT NULL,
    extra_notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (role, date)
  )`);
  oldDatabase.run('INSERT INTO role_materials VALUES (?, ?, ?, ?, ?)', [
    legacyMaterial.role, legacyMaterial.date, JSON.stringify(legacyMaterial.sections), legacyMaterial.extraNotes, '2026-01-02T10:00:00Z',
  ]);
  fs.mkdirSync(path.join(root, 'profile'), { recursive: true });
  fs.writeFileSync(path.join(root, 'profile', 'gitinsight.db'), Buffer.from(oldDatabase.export()));
  oldDatabase.close();
  const children = [];
  const executable = require('electron');
  const env = { ...process.env, GITINSIGHT_SMOKE_ROOT: root };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  delete env.VITE_DEV_SERVER_URL;
  const launch = phase => {
    const child = spawn(executable, [__filename, `--user-data-dir=${path.join(root, 'profile')}`], {
      cwd: projectRoot, env: { ...env, GITINSIGHT_SMOKE_PHASE: phase, GITINSIGHT_SMOKE_STARTED_AT: String(Date.now()) },
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    let output = '';
    let pending = '';
    const messages = [];
    let readyResolve;
    let readyReject;
    const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    ready.catch(() => {});
    child.stdout.on('data', chunk => {
      output += chunk;
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      for (const line of lines) {
        if (!line.startsWith(prefix)) continue;
        const message = JSON.parse(line.slice(prefix.length));
        messages.push(message);
        if (message.event === 'startup') console.log(`${prefix}${JSON.stringify(message)}`);
        if (message.event === 'ready') readyResolve(message);
      }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => child.kill(), 35_000);
    const exit = new Promise((resolve, reject) => {
      child.on('error', error => { clearTimeout(timer); readyReject(error); reject(error); });
      child.on('close', code => {
        clearTimeout(timer);
        readyReject(new Error(`${phase} exited before readiness (${code}):\n${output}`));
        if (code === 0) resolve(messages);
        else reject(new Error(`${phase} exited with ${code}:\n${output}`));
      });
    });
    exit.catch(() => {});
    return { child, ready, exit };
  };
  try {
    const primary = launch('write');
    const ready = await primary.ready;
    assert.equal(ready.lock, true);
    assert.equal(ready.windows, 1);
    assert.ok(ready.registrations > 0);
    assert.equal(ready.encryptionAvailable, true);
    for (const name of ['config.json', 'secrets.json']) {
      assert.equal(fs.readFileSync(path.join(root, 'profile', name), 'utf8').includes(fakeKey), false);
    }
    const databasePath = path.join(root, 'profile', 'gitinsight.db');
    const database = fs.readFileSync(databasePath);
    const secondary = launch('secondary');
    const secondaryMessages = await secondary.exit;
    assert.deepEqual(secondaryMessages.find(message => message.event === 'quit'), {
      phase: 'secondary', event: 'quit', lock: false, windows: 0, registrations: 0, secondInstances: 0,
    });
    assert.deepEqual(fs.readFileSync(databasePath), database, 'Second instance must not change the database');
    const primaryMessages = await primary.exit;
    const quit = primaryMessages.find(message => message.event === 'quit');
    assert.equal(quit.secondInstances, 1);
    assert.equal(quit.windows, 1);
    const restarted = launch('read');
    await restarted.ready;
    const restartMessages = await restarted.exit;
    assert.equal(restartMessages.filter(message => message.event === 'relaunch').length, 1);
    const profile = path.join(root, 'profile');
    const pendingPath = path.join(profile, 'restore-pending.json');
    const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    const exported = JSON.parse(fs.readFileSync(path.join(root, 'export.gitinsight-backup'), 'utf8'));
    assert.deepEqual(pending.backup, exported);
    assert.equal(exported.config.reporterName, 'Desktop runtime smoke');
    assert.equal(exported.config.autoSync.enabled, true);
    assert.equal(exported.config.autoSync.tasks[0].enabled, true);
    assert.equal(exported.config.aiApiKey, '');
    for (const secret of [fakeKey, 'fake-backup-cookie', 'fake-backup-csrf', 'fake-backup-share-token', 'fake-backup-endpoint']) {
      assert.equal(JSON.stringify(exported).includes(secret), false);
    }
    const originalFiles = Object.fromEntries(Object.entries({ config: 'config.json', secrets: 'secrets.json', database: 'gitinsight.db' })
      .map(([key, filename]) => [key, fs.readFileSync(path.join(profile, filename)).toString('base64')]));
    const originalPath = path.join(profile, `restore-original-${pending.id}.json`);
    assert.equal(fs.existsSync(originalPath), false, 'Original snapshot is created on the next startup');
    const restored = launch('restored');
    await restored.ready;
    await restored.exit;
    assert.equal(fs.existsSync(pendingPath), false);
    assert.equal(fs.existsSync(path.join(profile, 'secrets.json')), false);
    const originalSnapshot = fs.readFileSync(originalPath);
    assert.deepEqual(JSON.parse(originalSnapshot.toString()).files, originalFiles);
    const restoredAgain = launch('restored-again');
    await restoredAgain.ready;
    await restoredAgain.exit;
    assert.deepEqual(fs.readFileSync(originalPath), originalSnapshot, 'Later startup must preserve the original snapshot byte for byte');
    console.log(`Desktop runtime smoke passed (Electron ${require('electron/package.json').version}): renderer + preload IPC, encrypted credentials, legacy material migration, both material roles generated and persisted without Git, backup round trip including material identity, single-instance rejection and original snapshot preservation. All data isolated; no visible windows or network requests.`);
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await new Promise(resolve => child.once('close', resolve));
      }
    }
    fs.rmSync(checkedRoot(root), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

(process.versions.electron ? electronMain() : nodeMain()).catch(error => {
  console.error(error);
  process.exitCode = 1;
  if (process.versions.electron) require('electron').app.exit(1);
});
