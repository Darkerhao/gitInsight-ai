import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  DEFAULT_AI_BASE_URL_OPTIONS,
  DEFAULT_AI_PROFILE,
  DEFAULT_AI_PROFILE_ID,
  DEFAULT_AI_MODEL_OPTIONS,
  DEFAULT_AUTO_SYNC_CONFIG,
  DEFAULT_FEISHU_FORM_CONFIG,
} from '@shared/types';
import type {
  AppConfig,
  AutoSyncState,
  DailyReportRecord,
  ErrorLogRecord,
  FeishuFieldOption,
  FeishuProjectOption,
  RepoInfo,
  ReportResult,
  StorageInfo,
  SyncLogRecord,
} from '@shared/types';
import { createAutoSyncState } from './assistant/autoSyncState';
import { createConfigState } from './assistant/configState';
import { buildDateTime, formatLocalDate, shiftLocalDate } from './assistant/dateUtils';
import { createFeishuState } from './assistant/feishuState';
import { createLocalDataState } from './assistant/localDataState';
import {
  normalizeOptions,
  normalizeProjectWorkHours,
  normalizeRepoSelections,
  normalizeWorkspaceDirs,
} from './assistant/normalizers';
import { createRepoState } from './assistant/repoState';
import { createReportState } from './assistant/reportState';

function createAssistant() {
  const today = formatLocalDate(new Date());
  const tomorrow = shiftLocalDate(today, 1);

  const loading = ref(false);
  const pushing = ref(false);
  const feishuLoading = ref(false);
  const fieldLoading = ref(false);
  const projectLoading = ref(false);
  const autoSyncLoading = ref(false);

  const repos = ref<RepoInfo[]>([]);
  const projectOptions = ref<FeishuProjectOption[]>([]);
  const feishuFieldOptions = ref<FeishuFieldOption[]>([]);
  const selectedRepoPaths = ref<string[]>([]);
  const report = ref('');
  const currentReportId = ref<number | null>(null);
  const lastReportResult = ref<ReportResult | null>(null);
  const dailyReports = ref<DailyReportRecord[]>([]);
  const syncLogs = ref<SyncLogRecord[]>([]);
  const errorLogs = ref<ErrorLogRecord[]>([]);
  const storageInfo = ref<StorageInfo | null>(null);
  const status = ref('');
  const autoSyncState = ref<AutoSyncState | null>(null);
  const advancedConfigPanels = ref<string[]>([]);
  const savedConfigSignature = ref('');

  let removeAutoSyncListener: (() => void) | null = null;
  let removeFeishuAuthListener: (() => void) | null = null;

  const config = reactive<AppConfig>({
    workspaceDir: '',
    workspaceDirs: [],
    selectedRepoPaths: [],
    ignoredRepoPaths: [],
    pinnedRepoPaths: [],
    reporterName: '',
    aiBaseUrl: 'https://api.openai.com/v1',
    aiApiKey: '',
    aiModel: 'gpt-4o-mini',
    aiBaseUrlOptions: [...DEFAULT_AI_BASE_URL_OPTIONS],
    aiModelOptions: [...DEFAULT_AI_MODEL_OPTIONS],
    aiProfiles: [{ ...DEFAULT_AI_PROFILE }],
    activeAiProfileId: DEFAULT_AI_PROFILE_ID,
    feishuForm: { ...DEFAULT_FEISHU_FORM_CONFIG },
    autoSync: { ...DEFAULT_AUTO_SYNC_CONFIG },
  });

  const form = reactive({
    date: today,
    startDateTime: buildDateTime(today, '00:00'),
    endDateTime: buildDateTime(tomorrow, '00:00'),
  });

  let repoState: ReturnType<typeof createRepoState>;
  let autoSyncStateApi: ReturnType<typeof createAutoSyncState>;
  let reportState: ReturnType<typeof createReportState>;

  const configState = createConfigState({
    config,
    selectedRepoPaths,
    savedConfigSignature,
    getWorkspaceDirs: () => repoState.getWorkspaceDirs(),
    getRepoKey: (path: string) => repoState.getRepoKey(path),
    validateAutoSyncBeforeSave: (payload: AppConfig) => autoSyncStateApi.validateAutoSyncBeforeSave(payload),
    refreshAutoSyncState: () => autoSyncStateApi.refreshAutoSyncState(),
  });

  repoState = createRepoState({
    config,
    repos,
    selectedRepoPaths,
    loading,
    status,
    persistConfig: () => configState.persistConfig(),
  });

  const localDataState = createLocalDataState({
    dailyReports,
    syncLogs,
    errorLogs,
    storageInfo,
  });

  const feishuState = createFeishuState({
    config,
    form,
    status,
    feishuLoading,
    fieldLoading,
    projectLoading,
    projectOptions,
    feishuFieldOptions,
    advancedConfigPanels,
    getConfigPayload: () => configState.getConfigPayload(),
    persistConfig: () => configState.persistConfig(),
    persistConfigBeforeAction: (actionLabel: string) => configState.persistConfigBeforeAction(actionLabel),
  });

  autoSyncStateApi = createAutoSyncState({
    config,
    status,
    autoSyncLoading,
    autoSyncState,
    report,
    lastReportResult,
    currentReportId,
    getConfigPayload: () => configState.getConfigPayload(),
    persistConfigBeforeAction: (actionLabel: string) => configState.persistConfigBeforeAction(actionLabel),
    applyReportTimeRange: (date: string, timeRange: any) => reportState.applyReportTimeRange(date, timeRange),
    applyFullDayReportRange: (date: string) => reportState.applyFullDayReportRange(date),
    refreshLocalData: () => localDataState.refreshLocalData(),
    today,
  });

  reportState = createReportState({
    config,
    form,
    loading,
    pushing,
    report,
    currentReportId,
    lastReportResult,
    selectedRepoPaths,
    selectedRepos: repoState.selectedRepos,
    status,
    persistConfigBeforeAction: (actionLabel: string) => configState.persistConfigBeforeAction(actionLabel),
    getConfigPayload: () => configState.getConfigPayload(),
    refreshLocalData: () => localDataState.refreshLocalData(),
  });

  async function loadConfig() {
    const saved = await window.api.loadConfig();
    Object.assign(config, {
      ...saved,
      feishuForm: {
        ...DEFAULT_FEISHU_FORM_CONFIG,
        ...saved.feishuForm,
        projectWorkHours: normalizeProjectWorkHours(saved.feishuForm?.projectWorkHours),
      },
      autoSync: {
        ...DEFAULT_AUTO_SYNC_CONFIG,
        ...saved.autoSync,
      },
    });

    selectedRepoPaths.value = normalizeRepoSelections(config.selectedRepoPaths ?? []);
    config.ignoredRepoPaths = normalizeRepoSelections(config.ignoredRepoPaths ?? []);
    config.pinnedRepoPaths = normalizeRepoSelections(config.pinnedRepoPaths ?? []);
    config.aiBaseUrlOptions = normalizeOptions(config.aiBaseUrlOptions.length ? config.aiBaseUrlOptions : [...DEFAULT_AI_BASE_URL_OPTIONS]);
    config.aiModelOptions = normalizeOptions(config.aiModelOptions.length ? config.aiModelOptions : [...DEFAULT_AI_MODEL_OPTIONS]);
    if (!config.aiProfiles.length) {
      config.aiProfiles = [{ ...DEFAULT_AI_PROFILE }];
      config.activeAiProfileId = DEFAULT_AI_PROFILE_ID;
    }
    config.workspaceDirs = normalizeWorkspaceDirs([...(config.workspaceDirs ?? []), config.workspaceDir]);

    if (!form.date) form.date = today;

    const feishuAuthIncomplete =
      !config.feishuForm.endpoint ||
      !config.feishuForm.shareToken ||
      !config.feishuForm.cookie ||
      !config.feishuForm.csrfToken;
    const feishuMappingIncomplete = !config.feishuForm.reporterUserId || !config.feishuForm.projectOptionId;
    const feishuFieldMappingIncomplete =
      !config.feishuForm.questionId ||
      !config.feishuForm.dateFieldId ||
      !config.feishuForm.userFieldId ||
      !config.feishuForm.projectFieldId ||
      !config.feishuForm.hoursFieldId ||
      !config.feishuForm.contentFieldId;

    advancedConfigPanels.value = [
      ...(!config.aiApiKey ? ['ai'] : []),
      ...(feishuAuthIncomplete ? ['feishu'] : []),
      ...(feishuMappingIncomplete ? ['mapping'] : []),
      ...(feishuFieldMappingIncomplete ? ['fields'] : []),
      ...(config.autoSync.enabled ? ['autoSync'] : []),
    ];

    if (config.feishuForm.shareToken) {
      await feishuState.loadFeishuFields({ silent: true });
      if (config.feishuForm.projectFieldId) {
        await feishuState.loadFeishuProjects({ silent: true });
      }
    }

    if (config.workspaceDirs.length) {
      await repoState.refreshRepos();
    }

    await autoSyncStateApi.refreshAutoSyncState();
    configState.markConfigSaved();
  }

  async function init() {
    removeAutoSyncListener = window.api.onAutoSyncUpdated(autoSyncStateApi.applyAutoSyncState);
    removeFeishuAuthListener = window.api.onFeishuAuthUpdated((snapshot) => {
      void feishuState.applyFeishuAuthSnapshot(snapshot).catch((error: unknown) => {
        ElMessage.error(error instanceof Error ? error.message : '??????????????????');
      });
    });
    await loadConfig();
    await localDataState.refreshLocalData();
  }

  function dispose() {
    removeAutoSyncListener?.();
    removeFeishuAuthListener?.();
    removeAutoSyncListener = null;
    removeFeishuAuthListener = null;
  }

  return {
    today,
    loading,
    pushing,
    feishuLoading,
    projectLoading,
    fieldLoading,
    autoSyncLoading,
    repos,
    projectOptions,
    feishuFieldOptions,
    selectedRepoPaths,
    report,
    currentReportId,
    lastReportResult,
    dailyReports,
    syncLogs,
    errorLogs,
    storageInfo,
    status,
    autoSyncState,
    advancedConfigPanels,
    config,
    form,
    reporterOptions: configState.reporterOptions,
    aiBaseUrlOptions: configState.aiBaseUrlOptions,
    aiModelOptions: configState.aiModelOptions,
    aiProfileOptions: configState.aiProfileOptions,
    activeAiProfile: configState.activeAiProfile,
    sortedRepos: repoState.sortedRepos,
    selectedRepos: repoState.selectedRepos,
    autoSyncRunning: autoSyncStateApi.autoSyncRunning,
    autoSyncStatusType: autoSyncStateApi.autoSyncStatusType,
    autoSyncStatusLabel: autoSyncStateApi.autoSyncStatusLabel,
    isConfigDirty: configState.isConfigDirty,
    applyFullDayReportRange: reportState.applyFullDayReportRange,
    applyReportTimeRange: reportState.applyReportTimeRange,
    formatDateTime: reportState.formatDateTime,
    chooseWorkspace: repoState.chooseWorkspace,
    refreshRepos: repoState.refreshRepos,
    saveSettings: configState.saveSettings,
    createAiProfile: configState.createAiProfile,
    selectAiProfile: configState.selectAiProfile,
    removeAiProfile: configState.removeAiProfile,
    rememberAiBaseUrlOption: configState.rememberAiBaseUrlOption,
    rememberAiModelOption: configState.rememberAiModelOption,
    removeAiBaseUrlOption: configState.removeAiBaseUrlOption,
    removeAiModelOption: configState.removeAiModelOption,
    loginFeishu: feishuState.loginFeishu,
    openFeishuSubmissionRecords: feishuState.openFeishuSubmissionRecords,
    loadFeishuProjects: feishuState.loadFeishuProjects,
    loadFeishuFields: feishuState.loadFeishuFields,
    selectFeishuProject: feishuState.selectFeishuProject,
    updateProjectWorkHours: feishuState.updateProjectWorkHours,
    testSubmitFeishu: feishuState.testSubmitFeishu,
    generate: reportState.generate,
    generateAndPush: reportState.generateAndPush,
    push: reportState.push,
    runAutoSyncNow: autoSyncStateApi.runAutoSyncNow,
    refreshDailyReports: localDataState.refreshDailyReports,
    refreshLocalData: localDataState.refreshLocalData,
    saveCurrentReport: reportState.saveCurrentReport,
    toggleRepo: repoState.toggleRepo,
    isRepoPinned: repoState.isRepoPinned,
    toggleRepoPin: repoState.toggleRepoPin,
    removeRepo: repoState.removeRepo,
    init,
    dispose,
  };
}

let instance: ReturnType<typeof createAssistant> | null = null;

export function useAssistant() {
  if (!instance) {
    instance = createAssistant();
  }
  return instance;
}
