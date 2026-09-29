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
  createProjectReportActions, fullDayReportScope,
  runProjectPublishBatch,
  type ProjectReportApi,
  type WeeklyReportDraft,
} from '../src/renderer/src/composables/projectReportActions.js';

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
    report: makeResult().report, reportId: 42, lastReportResult: makeResult(), projectOptionId: 'project-a', workHours: 8,
    workHoursSource: 'estimated', generateStatus: 'success', publishStatus: 'idle', dirty: false, manualWorkContent: '', generateMessage: '', publishMessage: '',
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
  const api: ProjectReportApi = {
    generateReport: async () => makeResult(),
    saveDailyReport: async (payload) => {
      calls.push('save');
      savedId = payload.id;
      return makeRecord(99);
    },
    syncFeishuDaily: async (payload) => {
      calls.push('sync');
      publishedReportId = payload.reportId;
      return { success: true };
    },
  };
  const draft = makeDraft({ dirty: true });
  const actions = createProjectReportActions<WeeklyReportDraft>({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo', getScope: fullDayReportScope });

  assert.equal(await actions.publishDraft(draft), true);
  assert.deepEqual(calls, ['save', 'sync']);
  assert.equal(savedId, 42);
  assert.equal(publishedReportId, 99);
});

test('save payload contains structured-cloneable plain objects for IPC', async () => {
  const api: ProjectReportApi = {
    generateReport: async () => makeResult(),
    saveDailyReport: async (payload) => {
      assert.doesNotThrow(() => structuredClone(payload));
      return makeRecord(99);
    },
    syncFeishuDaily: async () => ({ success: true }),
  };
  const result = makeResult();
  const draft = makeDraft({
    lastReportResult: {
      ...result,
      timeRange: new Proxy(result.timeRange!, {}),
      rawInput: new Proxy(result.rawInput, {}),
      structuredJson: new Proxy({
        title: '测试',
        workItems: new Proxy([new Proxy({ module: '日报', description: '保存', workType: 'Bug 修复' as const }, {})], {}),
        achievements: new Proxy(['可保存'], {}),
        techTags: new Proxy(['Electron'], {}),
        risks: new Proxy([], {}),
        tomorrowPlan: new Proxy(['提交飞书'], {}),
        milestone: false,
      }, {}),
    },
    dirty: true,
  });
  const actions = createProjectReportActions<WeeklyReportDraft>({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo', getScope: fullDayReportScope });

  assert.equal(await actions.saveDraft(draft), true);
});

test('save failure and unresolved hours both prevent Feishu publishing', async () => {
  let syncCount = 0;
  const api: ProjectReportApi = {
    generateReport: async () => makeResult(),
    saveDailyReport: async () => { throw new Error('保存失败'); },
    syncFeishuDaily: async () => { syncCount += 1; return { success: true }; },
  };
  const actions = createProjectReportActions<WeeklyReportDraft>({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo', getScope: fullDayReportScope });

  assert.equal(await actions.publishDraft(makeDraft({ dirty: true })), false);
  assert.equal(await actions.publishDraft(makeDraft({ workHoursSource: 'unresolved' })), false);
  assert.equal(syncCount, 0);
});

test('local logging warning retains published state and message', async () => {
  const warning = '飞书日报已提交，本地同步记录保存失败，请勿重复提交。';
  const api: ProjectReportApi = {
    generateReport: async () => makeResult(),
    saveDailyReport: async () => makeRecord(42),
    syncFeishuDaily: async () => ({ success: true, warning }),
  };
  const draft = makeDraft();
  const actions = createProjectReportActions<WeeklyReportDraft>({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo', getScope: fullDayReportScope });
  assert.equal(await actions.publishDraft(draft), true);
  assert.equal(draft.publishStatus, 'success');
  assert.equal(draft.publishMessage, warning);
});

test('external failures use stable user-facing messages', async () => {
  const rawError = new Error('SQL path D:/private.db token=secret');
  const api: ProjectReportApi = {
    generateReport: async () => { throw rawError; },
    saveDailyReport: async () => { throw rawError; },
    syncFeishuDaily: async () => { throw rawError; },
  };
  const actions = createProjectReportActions<WeeklyReportDraft>({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo', getScope: fullDayReportScope });
  const generateDraft = makeDraft();
  const saveDraft = makeDraft();
  const publishDraft = makeDraft();

  assert.equal(await actions.generateDraft(generateDraft), false);
  assert.equal(generateDraft.generateMessage, '生成日报失败，请稍后重试');
  assert.equal(await actions.saveDraft(saveDraft), false);
  assert.equal(saveDraft.publishMessage, '保存日报失败，请稍后重试');
  assert.equal(await actions.publishDraft(publishDraft), false);
  assert.equal(publishDraft.publishMessage, '提交结果未确认，请先核对飞书提交记录');
});

test('a failed project draft can be generated again independently', async () => {
  let generateCount = 0;
  const api: ProjectReportApi = {
    generateReport: async () => {
      generateCount += 1;
      return makeResult();
    },
    saveDailyReport: async () => makeRecord(42),
    syncFeishuDaily: async () => ({ success: true }),
  };
  const draft = makeDraft({
    report: 'AI提示：AI接口调用失败：502',
    lastReportResult: null,
    generateStatus: 'failed',
    generateMessage: '生成日报失败，请稍后重试',
  });
  const actions = createProjectReportActions<WeeklyReportDraft>({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo', getScope: fullDayReportScope });

  assert.equal(await actions.generateDraft(draft), true);
  assert.equal(generateCount, 1);
  assert.equal(draft.generateStatus, 'success');
  assert.equal(draft.report, makeResult().report);
  assert.equal(draft.generateMessage, '');
});

test('failed regeneration preserves the published content and batch retries never resubmit it', async () => {
  let submissions = 0;
  const api: ProjectReportApi = {
    generateReport: async () => { throw new Error('unavailable'); },
    saveDailyReport: async () => makeRecord(42),
    syncFeishuDaily: async () => { submissions += 1; return { success: true }; },
  };
  const draft = makeDraft({ publishStatus: 'success', publishMessage: '已提交飞书日报' });
  const original = draft.report;
  const actions = createProjectReportActions<WeeklyReportDraft>({ api, config: makeConfig(), getProjectOptions: () => [], displayRepoName: () => 'repo', getScope: fullDayReportScope });
  assert.equal(await actions.generateDraft(draft), false);
  assert.equal(draft.report, original);
  assert.equal(draft.publishStatus, 'success');
  assert.deepEqual(await runProjectPublishBatch([draft], actions.publishDraft), { successCount: 0, failedCount: 0 });
  assert.equal(submissions, 0);
});

test('runProjectPublishBatch continues after an item fails', async () => {
  const order: string[] = [];
  const drafts = [makeDraft({ key: 'first' }), makeDraft({ key: 'second' })];
  const result = await runProjectPublishBatch(drafts, async (draft) => {
    order.push(draft.key);
    return draft.key === 'second';
  });
  assert.deepEqual(order, ['first', 'second']);
  assert.deepEqual(result, { successCount: 1, failedCount: 1 });
});
