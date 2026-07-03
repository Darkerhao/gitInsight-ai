import { computed } from 'vue';
import type { Ref } from 'vue';
import { ElMessage } from 'element-plus';
import { DEFAULT_AUTO_SYNC_CONFIG } from '@shared/types';
import type { AppConfig } from '@shared/types';
import {
  mergeCurrentOption,
  normalizeAutoSyncTimeWindowMode,
  normalizeOptions,
  normalizeProjectWorkHours,
  normalizeRepoSelections,
  normalizeTimeValue,
  normalizeWorkHours,
  normalizeWorkspaceDirs,
  toPlainString,
} from './normalizers';

type ConfigStateContext = {
  config: AppConfig;
  selectedRepoPaths: Ref<string[]>;
  savedConfigSignature: Ref<string>;
  getWorkspaceDirs: () => string[];
  getRepoKey: (path: string) => string;
  validateAutoSyncBeforeSave: (payload: AppConfig) => Promise<boolean>;
  refreshAutoSyncState: () => Promise<void>;
};

export function createConfigState(ctx: ConfigStateContext) {
  const {
    config,
    selectedRepoPaths,
    savedConfigSignature,
    getWorkspaceDirs,
    getRepoKey,
    validateAutoSyncBeforeSave,
    refreshAutoSyncState,
  } = ctx;

  const reporterOptions = computed(() => (config.reporterName ? [config.reporterName] : []));

  const aiBaseUrlOptions = computed(() => mergeCurrentOption(config.aiBaseUrlOptions, config.aiBaseUrl));

  const aiModelOptions = computed(() => mergeCurrentOption(config.aiModelOptions, config.aiModel));

  function getConfigPayload(): AppConfig {
    const workspaceDirs = getWorkspaceDirs();
    const normalizedSelectedRepoPaths = normalizeRepoSelections(selectedRepoPaths.value);
    const normalizedIgnoredRepoPaths = normalizeRepoSelections(config.ignoredRepoPaths ?? []);
    const ignoredRepoKeys = new Set(normalizedIgnoredRepoPaths.map(getRepoKey));
    const normalizedPinnedRepoPaths = normalizeRepoSelections(config.pinnedRepoPaths ?? []).filter(
      (path) => !ignoredRepoKeys.has(getRepoKey(path)),
    );

    selectedRepoPaths.value = normalizedSelectedRepoPaths;
    config.selectedRepoPaths = normalizedSelectedRepoPaths;
    config.ignoredRepoPaths = normalizedIgnoredRepoPaths;
    config.pinnedRepoPaths = normalizedPinnedRepoPaths;

    return {
      workspaceDir: toPlainString(config.workspaceDir),
      workspaceDirs,
      selectedRepoPaths: normalizedSelectedRepoPaths,
      ignoredRepoPaths: normalizedIgnoredRepoPaths,
      pinnedRepoPaths: normalizedPinnedRepoPaths,
      reporterName: toPlainString(config.reporterName),
      aiBaseUrl: toPlainString(config.aiBaseUrl),
      aiApiKey: toPlainString(config.aiApiKey),
      aiModel: toPlainString(config.aiModel),
      aiBaseUrlOptions: normalizeOptions([...config.aiBaseUrlOptions, config.aiBaseUrl]),
      aiModelOptions: normalizeOptions([...config.aiModelOptions, config.aiModel]),
      feishuForm: {
        endpoint: toPlainString(config.feishuForm.endpoint),
        shareToken: toPlainString(config.feishuForm.shareToken),
        csrfToken: toPlainString(config.feishuForm.csrfToken),
        cookie: toPlainString(config.feishuForm.cookie),
        reporterUserId: toPlainString(config.feishuForm.reporterUserId),
        reporterName: toPlainString(config.feishuForm.reporterName),
        reporterAvatarUrl: toPlainString(config.feishuForm.reporterAvatarUrl),
        projectOptionId: toPlainString(config.feishuForm.projectOptionId),
        projectName: toPlainString(config.feishuForm.projectName),
        defaultWorkHours: normalizeWorkHours(config.feishuForm.defaultWorkHours),
        projectWorkHours: normalizeProjectWorkHours(config.feishuForm.projectWorkHours),
        questionId: toPlainString(config.feishuForm.questionId),
        dateFieldId: toPlainString(config.feishuForm.dateFieldId),
        userFieldId: toPlainString(config.feishuForm.userFieldId),
        projectFieldId: toPlainString(config.feishuForm.projectFieldId),
        hoursFieldId: toPlainString(config.feishuForm.hoursFieldId),
        contentFieldId: toPlainString(config.feishuForm.contentFieldId),
      },
      autoSync: {
        enabled: Boolean(config.autoSync.enabled),
        time: normalizeTimeValue(config.autoSync.time),
        timeWindowMode: normalizeAutoSyncTimeWindowMode(config.autoSync.timeWindowMode),
        windowStartTime: normalizeTimeValue(config.autoSync.windowStartTime),
        lastRunAt: toPlainString(config.autoSync.lastRunAt),
        lastSuccessAt: toPlainString(config.autoSync.lastSuccessAt),
        lastStatus: config.autoSync.lastStatus,
        lastMessage: toPlainString(config.autoSync.lastMessage),
        lastRunKey: toPlainString(config.autoSync.lastRunKey),
        lastScheduledRunKey: toPlainString(config.autoSync.lastScheduledRunKey),
        lastSuccessKey: toPlainString(config.autoSync.lastSuccessKey),
      },
    };
  }


  function getEditableConfigSignature() {
    return JSON.stringify({
      workspaceDir: toPlainString(config.workspaceDir),
      workspaceDirs: normalizeWorkspaceDirs([...(config.workspaceDirs ?? []), config.workspaceDir]),
      selectedRepoPaths: normalizeRepoSelections(selectedRepoPaths.value),
      ignoredRepoPaths: normalizeRepoSelections(config.ignoredRepoPaths ?? []),
      pinnedRepoPaths: normalizeRepoSelections(config.pinnedRepoPaths ?? []),
      reporterName: toPlainString(config.reporterName),
      aiBaseUrl: toPlainString(config.aiBaseUrl),
      aiApiKey: toPlainString(config.aiApiKey),
      aiModel: toPlainString(config.aiModel),
      aiBaseUrlOptions: normalizeOptions([...config.aiBaseUrlOptions, config.aiBaseUrl]),
      aiModelOptions: normalizeOptions([...config.aiModelOptions, config.aiModel]),
      feishuForm: {
        ...config.feishuForm,
        defaultWorkHours: normalizeWorkHours(config.feishuForm.defaultWorkHours),
        projectWorkHours: normalizeProjectWorkHours(config.feishuForm.projectWorkHours),
      },
      autoSync: {
        enabled: Boolean(config.autoSync.enabled),
        time: normalizeTimeValue(config.autoSync.time),
        timeWindowMode: normalizeAutoSyncTimeWindowMode(config.autoSync.timeWindowMode),
        windowStartTime: normalizeTimeValue(config.autoSync.windowStartTime),
      },
    });
  }


  function markConfigSaved() {
    savedConfigSignature.value = getEditableConfigSignature();
  }


  const isConfigDirty = computed(() => Boolean(savedConfigSignature.value) && savedConfigSignature.value !== getEditableConfigSignature());


  async function persistConfig() {
    const saved = await window.api.saveConfig(getConfigPayload());
    markConfigSaved();
    return saved;
  }


  async function persistConfigBeforeAction(actionLabel: string) {
    const shouldNotify = isConfigDirty.value;
    const saved = await persistConfig();
    if (shouldNotify) {
      ElMessage.info(`检测到配置修改，已先保存后${actionLabel}`);
    }
    return saved;
  }


  async function saveSettings() {
    const payload = getConfigPayload();
    if (!(await validateAutoSyncBeforeSave(payload))) return;
    try {
      const saved = await persistConfig();
      Object.assign(config.autoSync, {
        ...DEFAULT_AUTO_SYNC_CONFIG,
        ...saved.autoSync,
      });
      markConfigSaved();
      await refreshAutoSyncState();
      ElMessage.success('配置已保存');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '配置保存失败');
    }
  }


  function rememberAiBaseUrlOption(value: string) {
    config.aiBaseUrlOptions = normalizeOptions([...config.aiBaseUrlOptions, value]);
  }


  function rememberAiModelOption(value: string) {
    config.aiModelOptions = normalizeOptions([...config.aiModelOptions, value]);
  }


  async function removeAiBaseUrlOption(value: string) {
    config.aiBaseUrlOptions = config.aiBaseUrlOptions.filter((item) => item !== value);
    if (config.aiBaseUrl === value) config.aiBaseUrl = '';
    await persistConfig();
    ElMessage.success('接口地址选项已删除');
  }


  async function removeAiModelOption(value: string) {
    config.aiModelOptions = config.aiModelOptions.filter((item) => item !== value);
    if (config.aiModel === value) config.aiModel = '';
    await persistConfig();
    ElMessage.success('模型选项已删除');
  }



  return {
    reporterOptions,
    aiBaseUrlOptions,
    aiModelOptions,
    isConfigDirty,
    getConfigPayload,
    getEditableConfigSignature,
    markConfigSaved,
    persistConfig,
    persistConfigBeforeAction,
    saveSettings,
    rememberAiBaseUrlOption,
    rememberAiModelOption,
    removeAiBaseUrlOption,
    removeAiModelOption,
  };
}
