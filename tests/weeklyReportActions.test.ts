import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AI_PROFILE,
  DEFAULT_AUTO_SYNC_CONFIG,
  DEFAULT_FEISHU_FORM_CONFIG,
  type AppConfig,
  type DailyReportRecord,
  type ReportResult,
} from '../src/shared/types.js';
import {
  createWeeklyReportActions,
  runWeeklyPublishBatch,
  type WeeklyReportApi,
  type WeeklyReportDraft,
} from '../src/renderer/src/composables/weeklyReportActions.js';

function makeConfig(): AppConfig {
  return {
    workspaceDir: '', workspaceDirs: [], selectedRepoPaths: [], ignoredRepoPaths: [], pinnedRepoPaths: [],
    repoDisplayNames: {}, reporterName: '测试用户', gitAuthorEmail: '', aiBaseUrl: '', aiApiKey: '', aiModel: '',
    aiBaseUrlOptions: [], aiModelOptions: [], aiProfiles: [{ ...DEFAULT_AI_PROFILE }], activeAiProfileId: DEFAULT_AI_PROFILE.id,
    feishuForm: { ...DEFAULT_FEISHU_FORM_CONFIG, projectOptionId: 'project-a', projectName: '项目 A' },
    autoSync: { ...DEFAULT_AUTO_SYNC_CONFIG, tasks: [] },
  };
}

function makeResult(): ReportResult {
  return {
    report: '今日工作内容：\n\n1. 完成功能开发', commits: [], repos: [{ name: 'repo', path: 'D:/repo' }],
    generatedAt: '2026-08-16T10:00:00.000Z',
    timeRange: { startDateTime: '2026-08-16T00:00:00', endDateTime: '2026-08-17T00:00:00', label: '全天' },
    rawInput: { gitLogs: '', files: '', diff: '' }, historyId: 42,
  };
}

function makeDraft(overrides: Partial<WeeklyReportDraft> = {}): WeeklyReportDraft {
  return {
    key: '2026-08-16::D:/repo', date: '2026-08-16', repo: { name: 'repo', path: 'D:/repo' },
    report: makeResult().report, reportId: 42, result: makeResult(), projectOptionId: 'project-a', workHours: 8,
    workHoursSource: 'estimated', generateStatus: 'success', publishStatus: 'idle', dirty: false, message: '',
    ...overrides,
  };
}

function makeRecord(id: number): DailyReportRecord {
  return {
    id, date: '2026-08-16', reporterName: '测试用户', repoNames: ['repo'], repoPaths: ['D:/repo'],
    report: makeResult().report, status: 'success', commitsCount: 0, filesCount: 0,
    generatedAt: '2026-08-16T10:00:00.000Z', updatedAt: '2026-08-16T10:00:00.000Z',
  };
}

test('dirty draft saves with history id before Feishu publishing', async () => {
  const calls: string[] = [];
  let savedId: number | undefined;
  let publishedReportId: number | undefined;
  const api: WeeklyReportApi = {
    generateReport: async () => makeResult(),
    saveDailyReport: async (payload) => {
      calls.push('save');
      savedId = payload.id;
      return makeRecord(99);
    },
    syncFeishuDaily: async (payload) => {
      calls.push('sync');
      publishedReportId = payload.reportId;
      return true;
    },
  };
  const draft = makeDraft({ dirty: true });
  const actions = createWeeklyReportActions({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo' });

  assert.equal(await actions.publishDraft(draft), true);
  assert.deepEqual(calls, ['save', 'sync']);
  assert.equal(savedId, 42);
  assert.equal(publishedReportId, 99);
});

test('save failure and unresolved hours both prevent Feishu publishing', async () => {
  let syncCount = 0;
  const api: WeeklyReportApi = {
    generateReport: async () => makeResult(),
    saveDailyReport: async () => { throw new Error('保存失败'); },
    syncFeishuDaily: async () => { syncCount += 1; return true; },
  };
  const actions = createWeeklyReportActions({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo' });

  assert.equal(await actions.publishDraft(makeDraft({ dirty: true })), false);
  assert.equal(await actions.publishDraft(makeDraft({ workHoursSource: 'unresolved' })), false);
  assert.equal(syncCount, 0);
});

test('external failures use stable user-facing messages', async () => {
  const rawError = new Error('SQL path D:/private.db token=secret');
  const api: WeeklyReportApi = {
    generateReport: async () => { throw rawError; },
    saveDailyReport: async () => { throw rawError; },
    syncFeishuDaily: async () => { throw rawError; },
  };
  const actions = createWeeklyReportActions({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo' });
  const generateDraft = makeDraft();
  const saveDraft = makeDraft();
  const publishDraft = makeDraft();

  assert.equal(await actions.generateDraft(generateDraft), false);
  assert.equal(generateDraft.message, '生成日报失败，请稍后重试');
  assert.equal(await actions.saveDraft(saveDraft), false);
  assert.equal(saveDraft.message, '保存日报失败，请稍后重试');
  assert.equal(await actions.publishDraft(publishDraft), false);
  assert.equal(publishDraft.message, '提交飞书失败，请稍后重试');
});

test('runWeeklyPublishBatch continues after an item fails', async () => {
  const order: string[] = [];
  const drafts = [makeDraft({ key: 'first' }), makeDraft({ key: 'second' })];
  const result = await runWeeklyPublishBatch(drafts, async (draft) => {
    order.push(draft.key);
    return draft.key === 'second';
  });
  assert.deepEqual(order, ['first', 'second']);
  assert.deepEqual(result, { successCount: 1, failedCount: 1 });
});
