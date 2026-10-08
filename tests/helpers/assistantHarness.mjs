import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compileFunction } from 'node:vm';
import ts from 'typescript';
import * as vue from 'vue';

const root = resolve(import.meta.dirname, '../..');

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

export const tick = () => new Promise((resolve) => setImmediate(resolve));

export function assistantHarness(overrides = {}) {
  const cache = new Map();
  const messages = [];
  const saves = [];
  let autoSyncListener;
  let authListener;
  const window = { api: {} };
  function loadModule(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const source = readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } });
    const exports = {};
    cache.set(filename, exports);
    compileFunction(outputText, ['require', 'exports', 'window'])((name) => {
      if (name === 'vue') return vue;
      if (name === 'element-plus') return {
        ElMessage: Object.fromEntries(['error', 'warning', 'success', 'info'].map((key) => [key, (message) => messages.push(message)])),
        ElMessageBox: { confirm: async () => {}, alert: async () => {} },
      };
      const path = name.startsWith('@shared/')
        ? resolve(root, 'src/shared', name.slice(8))
        : resolve(dirname(filename), name);
      return loadModule(path.replace(/\.js$/, '') + '.ts');
    }, exports, window);
    return exports;
  }
  const shared = loadModule(resolve(root, 'src/shared/types.ts'));
  const config = {
    workspaceDir: '/workspace', workspaceDirs: ['/workspace'], selectedRepoPaths: ['/workspace/a'],
    ignoredRepoPaths: [], pinnedRepoPaths: [], repoDisplayNames: {}, reporterName: 'Tester', gitAuthorEmail: '',
    aiBaseUrl: '', aiApiKey: '', aiModel: '', aiBaseUrlOptions: [], aiModelOptions: [],
    aiProfiles: [{ ...shared.DEFAULT_AI_PROFILE }], activeAiProfileId: shared.DEFAULT_AI_PROFILE.id,
    feishuForm: { ...shared.DEFAULT_FEISHU_FORM_CONFIG, shareToken: 'form-a', projectFieldId: 'project', projectOptionId: 'a', projectName: 'Saved name' },
    autoSync: { enabled: true, tasks: [{ ...shared.DEFAULT_AUTO_SYNC_TASK_CONFIG, id: 'saved', name: 'Saved task', repoPaths: ['/workspace/a'] }] },
  };
  const runtime = () => ({ enabled: config.autoSync.enabled, tasks: structuredClone(config.autoSync.tasks), isRunning: false });
  window.api = {
    loadConfig: async () => structuredClone(config),
    saveConfig: async (payload) => { saves.push(structuredClone(payload)); return structuredClone(payload); },
    scanRepositories: async () => [{ path: '/workspace/a', name: 'Project A' }],
    getAutoSyncState: async () => runtime(),
    onAutoSyncUpdated: (listener) => { autoSyncListener = listener; return () => { autoSyncListener = undefined; }; },
    onFeishuAuthUpdated: (listener) => { authListener = listener; return () => { authListener = undefined; }; },
    listFeishuFields: async () => [], listFeishuProjects: async () => [{ id: 'a', name: 'Remote name' }],
    listDailyReports: async () => [{ id: 1 }], listSyncLogs: async () => [], listErrorLogs: async () => [],
    getStorageInfo: async () => ({ reportsCount: 1 }),
    validateAutoSync: async () => ({ valid: true }),
    ...overrides,
  };
  for (const name of ['listFeishuFields', 'listFeishuProjects']) {
    const handler = window.api[name];
    window.api[name] = (payload) => handler(structuredClone(payload));
  }
  const assistant = loadModule(resolve(root, 'src/renderer/src/composables/useAssistant.ts')).useAssistant();
  return { assistant, config, runtime, api: window.api, saves, messages, shared,
    emitAutoSync: (state) => autoSyncListener?.(state),
    emitAuth: (state) => authListener?.(state),
  };
}
