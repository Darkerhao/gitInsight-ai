import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

async function loadModule(name, imports) {
  const source = await readFile(new URL(`../electron/main/${name}.ts`, import.meta.url), 'utf8');
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

function payload(overrides = {}) {
  return {
    config: {
      endpoint: 'https://example.test/submit', shareToken: 'shr-form',
      reporterUserId: 'user-1', reporterName: 'Tester', reporterAvatarUrl: '',
      projectOptionId: 'project-1', projectName: 'Project One', defaultWorkHours: 8,
    },
    date: '2026-10-08', report: '今日工作内容：\n1. 完成测试', reporterName: 'Tester', workHours: 8,
    ...overrides,
  };
}

async function publication({ check = async () => ({ available: true, matches: 0 }), response = 0, submit } = {}) {
  const checks = [];
  const dialogs = [];
  const posts = [];
  const logs = [];
  const api = await loadModule('feishuForm', {
    electron: { dialog: { async showMessageBox(...args) { dialogs.push(args.at(-1)); return { response }; } } },
    '../../src/shared/types.js': { DEFAULT_FEISHU_FORM_CONFIG: {} },
    './config.js': { normalizeWorkHours: (value, fallback) => value ?? fallback },
    './windows.js': { mainWindow: null },
    './database.js': { async recordSyncLog(log) { logs.push(log); }, async recordErrorLog() {} },
    './networkRequest.js': { async fetchWithTimeout(url, options) {
      posts.push({ url, options });
      if (submit) return submit();
      return new Response(JSON.stringify({ code: 0 }));
    } },
    './feishuAuth.js': {
      resolveFeishuAuth: async (config) => ({ ...config, endpoint: config.endpoint }),
      requireFeishuConfigValue: value => value,
      getFeishuShareToken: config => config.shareToken,
      parseFeishuEndpointUrl: endpoint => new URL(endpoint),
      async checkFeishuDuplicate(value) { checks.push(value); return check(value); },
    },
  });
  return { api, checks, dialogs, posts, logs };
}

test('scheduled duplicate stops before POST and reports that verification is required', async () => {
  const context = await publication({ check: async () => ({ available: true, matches: 1 }) });
  await assert.rejects(context.api.syncFeishuDaily(payload({ triggerType: 'scheduled' })), /待核对.*重复/);
  assert.equal(context.checks.length, 1);
  assert.equal(context.posts.length, 0);
  assert.equal(context.dialogs.length, 0);
  assert.equal(context.logs[0].status, 'failed');
});

test('unavailable or failed checks stop scheduled publication without prompting', async () => {
  for (const check of [async () => ({ available: false, matches: 0 }), async () => { throw new Error('page unavailable'); }]) {
    const context = await publication({ check });
    await assert.rejects(context.api.syncFeishuDaily(payload({ triggerType: 'scheduled' })), /待核对.*无法/);
    assert.equal(context.posts.length, 0);
    assert.equal(context.dialogs.length, 0);
  }
});

test('manual duplicate and unavailable checks require explicit confirmation; cancel never posts', async () => {
  for (const result of [{ available: true, matches: 2 }, { available: false, matches: 0 }]) {
    for (const response of [0, 1]) {
      const context = await publication({ check: async () => result, response });
      if (response === 0) await assert.rejects(context.api.syncFeishuDaily(payload()), /取消发布/);
      else assert.deepEqual(await context.api.syncFeishuDaily(payload()), { success: true });
      assert.equal(context.posts.length, response);
      assert.equal(context.dialogs.length, 1);
      assert.equal(context.dialogs[0].defaultId, 0);
      assert.equal(context.dialogs[0].cancelId, 0);
      assert.match(context.dialogs[0].detail, /2026-10-08.*Project One.*8/);
    }
  }
});

test('manual and scheduled submissions check before posting and clean checks do not prompt', async () => {
  const context = await publication();
  for (const triggerType of ['manual', 'manual', 'scheduled']) {
    const result = await context.api.syncFeishuDaily(payload({ triggerType }));
    assert.equal(result.success, true);
  }
  assert.equal(context.checks.length, 3);
  assert.equal(context.posts.length, 3);
  assert.equal(context.dialogs.length, 0);
});

test('single and batch report actions share main-process confirmation and cancellation', async () => {
  const renderer = await loadModule('../../src/renderer/src/composables/projectReportActions', {
    '../../../shared/weeklyReport.js': {}, './assistant/dateUtils.js': {},
    './assistant/projectGeneration.js': {}, './assistant/reportIpcPayload.js': {},
  });
  for (const result of [{ available: true, matches: 0 }, { available: true, matches: 1 }, { available: false, matches: 0 }]) {
    for (const response of [0, 1]) {
      const context = await publication({ check: async () => result, response });
      const actions = renderer.createProjectReportActions({
        api: context.api,
        config: { feishuForm: payload().config, reporterName: 'Tester' },
        getScope: () => ({ date: '2026-10-08' }),
        getProjectOptions: () => [{ id: 'project-1', name: 'Project One' }],
      });
      const draft = () => ({
        report: 'Completed changes', reportId: 1, dirty: false, projectOptionId: 'project-1',
        workHours: 8, workHoursSource: 'manual', publishStatus: 'idle',
      });
      const expected = result.available && !result.matches || response === 1;
      assert.equal(await actions.publishDraft(draft()), expected);
      const batch = await renderer.runProjectPublishBatch([draft(), draft()], actions.publishDraft);
      assert.deepEqual(batch, expected ? { successCount: 2, failedCount: 0 } : { successCount: 0, failedCount: 2 });
      assert.equal(context.posts.length, expected ? 3 : 0);
      assert.equal(context.checks.length, 3);
    }
  }
});

test('scheduled runner persists duplicate and unavailable checks as visible pending verification failures', async () => {
  for (const check of [async () => ({ available: true, matches: 1 }), async () => ({ available: false, matches: 0 })]) {
    const context = await publication({ check });
    let config = {
      reporterName: 'Tester', feishuForm: payload().config,
      autoSync: { enabled: true, tasks: [{
        id: 'task-1', name: 'Scheduled', enabled: true, projectOptionId: 'project-1', projectName: 'Project One',
        repoPaths: ['D:/repo'], lastSuccessKey: '', lastScheduledRunKey: '',
      }] },
    };
    const api = await loadModule('autoSync', {
      '../../src/shared/types.js': { DEFAULT_FEISHU_FORM_CONFIG: {} },
      './autoSyncCore.js': {
        getNextAutoSyncRun: () => null, getNextTaskRunDate: () => null,
        selectDueAutoSyncTasks: autoSync => autoSync.tasks,
        buildAutoSyncReportWindow: () => ({ date: '2026-10-08' }),
        buildAutoSyncTaskKey: () => 'today', resolveTaskWorkHours: () => 8,
      },
      './config.js': {
        loadConfig: async () => structuredClone(config),
        updateConfig: async mutator => { config = mutator(config); return config; },
      },
      './feishuForm.js': context.api,
      './feishuAuth.js': { requireFeishuConfigValue: value => value, resolveFeishuAuth: async () => ({}) },
      './report.js': { generateReport: async () => ({ commits: [{}], report: 'Completed changes', timeRange: { label: 'Today' } }) },
      './windows.js': { sendToMainWindow() {}, toCloneable: value => value },
    });
    const result = await api.runAutoSync('scheduled');
    assert.equal(result.status, 'failed');
    assert.match(result.message, /待核对/);
    assert.equal(config.autoSync.tasks[0].lastStatus, 'failed');
    assert.match(config.autoSync.tasks[0].lastMessage, /待核对/);
    assert.equal(config.autoSync.tasks[0].lastScheduledRunKey, 'today');
    assert.equal(context.posts.length, 0);
    assert.equal(context.dialogs.length, 0);
  }
});

test('manual and scheduled calls share one identity lock across check and POST', async () => {
  let releaseCheck;
  let checkStarted;
  const started = new Promise(resolve => { checkStarted = resolve; });
  const gate = new Promise(resolve => { releaseCheck = resolve; });
  const context = await publication({ check: async () => {
    checkStarted();
    await gate;
    return { available: true, matches: 0 };
  } });
  const first = context.api.syncFeishuDaily(payload());
  await started;
  const second = context.api.syncFeishuDaily(payload({ triggerType: 'scheduled', workHours: 6 }));
  // Release even when the assertion fails so an old implementation cannot hang the suite.
  setTimeout(releaseCheck, 50);
  await assert.rejects(second, /同一日报正在/);
  assert.equal((await first).success, true);
  assert.equal(context.checks.length, 1);
  assert.equal(context.posts.length, 1);
  assert.equal((await context.api.syncFeishuDaily(payload())).success, true);
});

test('identity remains locked until the POST response completes', async () => {
  let release;
  let notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const context = await publication({ submit: async () => {
    notifyStarted();
    await gate;
    return new Response(JSON.stringify({ code: 0 }));
  } });
  const first = context.api.syncFeishuDaily(payload());
  await started;
  setTimeout(release, 50);
  await assert.rejects(context.api.syncFeishuDaily(payload({ triggerType: 'scheduled' })), /同一日报正在/);
  assert.equal((await first).success, true);
  assert.equal(context.posts.length, 1);
});

test('publication locks release after cancellation, duplicate block, and remote errors', async () => {
  for (const triggerType of ['manual', 'scheduled']) {
    let attempts = 0;
    const context = await publication({ check: async () => ({ available: true, matches: attempts++ ? 0 : 1 }) });
    await assert.rejects(context.api.syncFeishuDaily(payload({ triggerType })));
    assert.equal((await context.api.syncFeishuDaily(payload({ triggerType }))).success, true);
    assert.equal(context.posts.length, 1);
  }
  let attempts = 0;
  const context = await publication({ submit: async () => {
    if (!attempts++) throw new Error('network disconnected');
    return new Response(JSON.stringify({ code: 0 }));
  } });
  await assert.rejects(context.api.syncFeishuDaily(payload()), /network disconnected/);
  assert.equal((await context.api.syncFeishuDaily(payload())).success, true);
  assert.equal(context.posts.length, 2);
});

test('duplicate check uses a disposable hidden window without changing the user Feishu window', async () => {
  const windows = [];
  class Window {
    constructor(options) {
      this.options = options;
      this.urls = [];
      this.visibleActions = 0;
      this.destroyed = false;
      this.webContents = {
        session: { cookies: { get: async () => [{ name: '_csrf_token', value: 'csrf' }] } },
        getURL: () => this.urls.at(-1) ?? '',
        on() {},
        executeJavaScript: async script => script.includes('const targetHours')
          ? { available: true, matches: 0 } : { recordsOpened: true },
      };
      windows.push(this);
    }
    async loadURL(url) { this.urls.push(url); }
    on() {}
    isDestroyed() { return this.destroyed; }
    show() { this.visibleActions++; }
    focus() { this.visibleActions++; }
    destroy() { this.destroyed = true; }
  }
  const api = await loadModule('feishuAuth', {
    electron: { BrowserWindow: Window, session: { fromPartition: () => ({ cookies: { on() {}, removeListener() {} } }) } },
    '../../src/shared/types.js': { DEFAULT_FEISHU_FORM_CONFIG: {} },
    './windows.js': { getWindowOptionsIcon() {}, sendToMainWindow() { return false; } },
  });
  await api.openFeishuLogin({ config: payload().config });
  const visible = windows[0];
  const checked = await api.checkFeishuDuplicate({ config: payload().config, targetDate: '2026-10-08', workHours: 8 });
  assert.deepEqual(checked, { available: true, matches: 0 });
  assert.equal(windows.length, 2);
  assert.equal(windows[1].options.show, false);
  assert.equal(windows[1].options.webPreferences.partition, 'persist:feishu');
  assert.equal(windows[1].options.webPreferences.backgroundThrottling, false);
  assert.equal(windows[1].destroyed, true);
  assert.equal(visible.visibleActions, 0);
  assert.equal(visible.urls.length, 1);
  assert.equal(api.feishuWindow, visible);
  api.disposeFeishuAuthWatchers();
});

test('failed record navigation still destroys the hidden check window', async () => {
  let destroyed = false;
  class Window {
    async loadURL() { throw new Error('navigation failed'); }
    isDestroyed() { return destroyed; }
    destroy() { destroyed = true; }
  }
  const api = await loadModule('feishuAuth', {
    electron: { BrowserWindow: Window },
    '../../src/shared/types.js': { DEFAULT_FEISHU_FORM_CONFIG: {} },
    './windows.js': {},
  });
  await assert.rejects(api.checkFeishuDuplicate({ config: payload().config, targetDate: '2026-10-08', workHours: 8 }), /navigation failed/);
  assert.equal(destroyed, true);
});

test('config edits and runtime status updates compose in either save order without restoring deleted tasks', async () => {
  for (const statusFirst of [true, false]) {
    let saved = {
      reporterName: 'Tester', gitAuthorEmail: '',
      autoSync: { enabled: false, tasks: [{
        id: 'task-1', name: 'Original', time: '18:00', enabled: true,
        lastRunAt: '', lastSuccessAt: '', lastStatus: 'idle', lastMessage: '',
        lastRunKey: '', lastScheduledRunKey: '', lastSuccessKey: '',
      }, { id: 'task-deleted', name: 'Deleted from editor' }] },
    };
    let queue = Promise.resolve();
    const updateConfig = mutator => {
      const operation = queue.then(() => {
        saved = structuredClone(mutator(structuredClone(saved)));
        return structuredClone(saved);
      });
      queue = operation.catch(() => {});
      return operation;
    };
    const api = await loadModule('autoSync', {
      '../../src/shared/types.js': { DEFAULT_FEISHU_FORM_CONFIG: {} },
      './autoSyncCore.js': { getNextAutoSyncRun: () => null, getNextTaskRunDate: () => null },
      './config.js': { loadConfig: async () => structuredClone(saved), normalizeConfig: value => value,
        saveConfig: value => updateConfig(() => value), updateConfig },
      './feishuForm.js': {}, './feishuAuth.js': {}, './report.js': {},
      './windows.js': { sendToMainWindow() {}, toCloneable: value => value },
    });
    const draft = structuredClone(saved);
    draft.autoSync.tasks = [{ ...draft.autoSync.tasks[0], name: 'Edited name', time: '19:30', enabled: false }];
    const status = () => api.updateAutoSyncTaskStatus('task-1', 'success', 'Submitted', {
      ranAt: '2026-10-08T10:00:00.000Z', runKey: 'today', scheduled: true, success: true,
    });
    const edit = () => api.saveConfigAndReschedule(draft);
    await Promise.all(statusFirst ? [status(), edit()] : [edit(), status()]);
    assert.equal(saved.autoSync.tasks.length, 1);
    assert.equal(saved.autoSync.tasks[0].name, 'Edited name');
    assert.equal(saved.autoSync.tasks[0].time, '19:30');
    assert.equal(saved.autoSync.tasks[0].enabled, false);
    assert.equal(saved.autoSync.tasks[0].lastStatus, 'success');
    assert.equal(saved.autoSync.tasks[0].lastRunAt, '2026-10-08T10:00:00.000Z');
    assert.equal(saved.autoSync.tasks[0].lastSuccessKey, 'today');
    await api.updateAutoSyncTaskStatus('task-deleted', 'success', 'Finished late', {
      ranAt: '2026-10-08T11:00:00.000Z', runKey: 'deleted', scheduled: true, success: true,
    });
    assert.equal(saved.autoSync.tasks.length, 1);
  }
});

test('record header alone is unavailable; the hidden check waits for readable record cards', async () => {
  const rawResults = [];
  const card = {
    innerText: '日期：2026-10-08\n所属项目：Project One\n工作时长：8\n工作内容：完成测试',
    children: [
      { innerText: '日期：2026-10-08', children: [] },
      { innerText: '所属项目：Project One', children: [] },
      { innerText: '工作时长：8', children: [] },
    ],
  };
  let duplicateScript;
  const documentFor = cards => ({
    body: { innerText: `我的提交记录\n${cards.map(item => item.innerText).join('\n')}` },
    querySelectorAll: selector => selector === 'body *' ? cards.flatMap(item => [item, ...item.children]) : [],
  });
  class Window {
    webContents = { executeJavaScript: async script => {
      if (!script.includes('const targetHours')) return { recordsOpened: true };
      duplicateScript = script;
      const result = compileFunction(`return (${script})`, ['document'])(documentFor(rawResults.length ? [card] : []));
      rawResults.push(result);
      return result;
    } };
    async loadURL() {}
    isDestroyed() { return false; }
    destroy() {}
  }
  const api = await loadModule('feishuAuth', {
    electron: { BrowserWindow: Window },
    '../../src/shared/types.js': { DEFAULT_FEISHU_FORM_CONFIG: {} },
    './windows.js': {},
  });
  const result = await api.checkFeishuDuplicate({
    config: payload().config, targetDate: '2026-10-08', projectName: 'Project One', workHours: 8,
  });
  assert.deepEqual(rawResults[0], { available: false, matches: 0 });
  assert.deepEqual(result, { available: true, matches: 1 });
  const previousDay = { ...card, innerText: card.innerText.replace('2026-10-08', '2026-10-07') };
  assert.deepEqual(compileFunction(`return (${duplicateScript})`, ['document'])(documentFor([previousDay])), { available: true, matches: 0 });
});
