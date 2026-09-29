import { test as base, expect } from '@playwright/test';
import { DEFAULT_AI_PROFILE, DEFAULT_AUTO_SYNC_CONFIG, DEFAULT_FEISHU_FORM_CONFIG } from '../../src/shared/types';
import type { GenerateReportParams, SaveDailyReportPayload, SyncFeishuDailyPayload } from '../../src/shared/types';

declare global {
  interface Window {
    reportTest: {
      generateFailures: number;
      publishFailures: number;
      saveFailure: boolean;
      configFailure: boolean;
      generations: GenerateReportParams[];
      saves: SaveDailyReportPayload[];
      submissions: SyncFeishuDailyPayload[];
    };
  }
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(({ ai, autoSync, feishu }) => {
      localStorage.setItem('gitinsight:welcome-finished', 'true');
      localStorage.setItem('gitinsight:welcome-animation-enabled', 'false');
      const repos = [{ name: 'Project A', path: '/workspace/a' }, { name: 'Project B', path: '/workspace/b' }];
      const config = {
        workspaceDir: '/workspace', workspaceDirs: ['/workspace'], selectedRepoPaths: repos.map((repo) => repo.path),
        ignoredRepoPaths: [], pinnedRepoPaths: [], repoDisplayNames: {}, reporterName: '测试用户', gitAuthorEmail: '',
        aiBaseUrl: '', aiApiKey: '', aiModel: '', aiBaseUrlOptions: [], aiModelOptions: [],
        aiProfiles: [{ ...ai, enabled: false }], activeAiProfileId: ai.id,
        feishuForm: { ...feishu, endpoint: 'https://example.invalid', shareToken: 'test', projectFieldId: 'project', projectOptionId: 'target', projectName: '测试项目' },
        autoSync: { ...autoSync, enabled: false, tasks: [] },
      };
      const state = window.reportTest = { generateFailures: 0, publishFailures: 0, saveFailure: false, configFailure: false, generations: [], saves: [], submissions: [] };
      let id = 100;
      window.api = {
        loadConfig: async () => config,
        saveConfig: async (value) => {
          if (state.configFailure) throw new Error('config unavailable');
          return value;
        },
        scanRepositories: async () => repos,
        listFeishuFields: async () => [],
        listFeishuProjects: async () => [{ id: 'target', name: '测试项目' }],
        listDailyReports: async () => [], listSyncLogs: async () => [], listErrorLogs: async () => [],
        getStorageInfo: async () => ({ appVersion: 'test', reportsCount: 0, syncLogsCount: 0, errorLogsCount: 0 }),
        getAutoSyncState: async () => ({ enabled: false, tasks: [], isRunning: false }),
        onAutoSyncUpdated: () => () => {}, onFeishuAuthUpdated: () => () => {},
        getCheckinWalletSnapshot: async () => ({ wallet: { coins: 1000000, lastCheckinDate: '', streak: 0 }, today: '2026-09-29' }),
        onCheckinWalletUpdated: () => () => {},
        getZoomFactor: async () => 1,
        generateReport: async (payload) => {
          state.generations.push(payload);
          if (state.generateFailures > 0) { state.generateFailures -= 1; throw new Error('generation failed'); }
          const repo = repos.find((item) => item.path === payload.repoPaths[0])!;
          return {
            report: `今日工作内容：\n1. ${repo.name} 修复列表查询，验证分页结果。`, repos: [repo],
            commits: [{ hash: 'abc', message: '修复列表查询', author: '测试用户', date: payload.date, files: ['list.ts'] }],
            generatedAt: new Date().toISOString(), historyId: ++id,
            timeRange: { startDateTime: payload.startDateTime, endDateTime: payload.endDateTime, label: '测试范围' },
            rawInput: { gitLogs: '', files: '', diff: '' },
          };
        },
        saveDailyReport: async (payload) => {
          structuredClone(payload);
          state.saves.push(payload);
          if (state.saveFailure) throw new Error('disk unavailable');
          return { ...payload, id: payload.id ?? ++id };
        },
        checkFeishuDuplicate: async () => ({ available: true, matches: 0 }),
        syncFeishuDaily: async (payload) => {
          structuredClone(payload);
          state.submissions.push(payload);
          if (payload.report.includes('Project B') && state.publishFailures > 0) {
            state.publishFailures -= 1;
            throw new Error('remote unavailable');
          }
          return { success: true };
        },
      } as typeof window.api;
    }, { ai: DEFAULT_AI_PROFILE, autoSync: DEFAULT_AUTO_SYNC_CONFIG, feishu: DEFAULT_FEISHU_FORM_CONFIG });
    await use(page);
  },
});
export { expect };
