import { computed } from 'vue';
import type { Ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { DEFAULT_AI_PROFILE, DEFAULT_AUTO_SYNC_TASK_CONFIG } from '@shared/types';
import type { AiProfile, AppConfig, AutoSyncTaskConfig } from '@shared/types';
import { normalizeRepoDisplayNames } from '@shared/repositoryName';
import { normalizeRepoFeishuProjects } from '@shared/repositoryFeishu';
import {
  mergeCurrentOption,
  normalizeAutoSyncTimeWindowMode,
  normalizeOptions,
  normalizeProjectWorkHours,
  normalizeRepoSelections,
  normalizeTaskWorkHours,
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
};

export function createConfigState(ctx: ConfigStateContext) {
  const {
    config,
    selectedRepoPaths,
    savedConfigSignature,
    getWorkspaceDirs,
    getRepoKey,
    validateAutoSyncBeforeSave,
  } = ctx;

  const reporterOptions = computed(() => (config.reporterName ? [config.reporterName] : []));

  function createAiProfileId() {
    return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function ensureAiProfiles() {
    if (!Array.isArray(config.aiProfiles) || !config.aiProfiles.length) {
      config.aiProfiles = [{ ...DEFAULT_AI_PROFILE }];
    }
    if (!config.aiProfiles.some((profile) => profile.id === config.activeAiProfileId)) {
      config.activeAiProfileId = config.aiProfiles[0]?.id || DEFAULT_AI_PROFILE.id;
    }
    return config.aiProfiles;
  }

  function getActiveAiProfile(): AiProfile {
    const profiles = ensureAiProfiles();
    return profiles.find((profile) => profile.id === config.activeAiProfileId) ?? profiles[0] ?? { ...DEFAULT_AI_PROFILE };
  }

  function getAiProfilePayloads() {
    const usedIds = new Set<string>();
    const profiles = ensureAiProfiles()
      .map((profile, index): AiProfile | null => {
        const id = toPlainString(profile.id) || (index === 0 ? DEFAULT_AI_PROFILE.id : createAiProfileId());
        if (usedIds.has(id)) return null;
        usedIds.add(id);
        return {
          id,
          name: toPlainString(profile.name) || `AI 配置 ${index + 1}`,
          baseUrl: toPlainString(profile.baseUrl),
          apiKey: toPlainString(profile.apiKey),
          model: toPlainString(profile.model),
          enabled: profile.enabled !== false,
        };
      })
      .filter((profile): profile is AiProfile => Boolean(profile));

    const nextProfiles = profiles.length ? profiles : [{ ...DEFAULT_AI_PROFILE }];
    config.aiProfiles = nextProfiles;
    if (!nextProfiles.some((profile) => profile.id === config.activeAiProfileId)) {
      config.activeAiProfileId = nextProfiles[0]?.id || DEFAULT_AI_PROFILE.id;
    }
    syncLegacyAiFieldsFromActiveProfile();
    return nextProfiles.map((profile) => ({ ...profile }));
  }

  function syncLegacyAiFieldsFromActiveProfile() {
    const profile = getActiveAiProfile();
    config.aiBaseUrl = toPlainString(profile.baseUrl);
    config.aiApiKey = toPlainString(profile.apiKey);
    config.aiModel = toPlainString(profile.model);
  }

  const activeAiProfile = computed(() => getActiveAiProfile());

  const aiProfileOptions = computed(() =>
    ensureAiProfiles().map((profile) => ({
      label: profile.name || '未命名配置',
      value: profile.id,
      model: profile.model,
      baseUrl: profile.baseUrl,
    })),
  );

  const aiBaseUrlOptions = computed(() => mergeCurrentOption(config.aiBaseUrlOptions, activeAiProfile.value.baseUrl));

  const aiModelOptions = computed(() => mergeCurrentOption(config.aiModelOptions, activeAiProfile.value.model));

  function getAutoSyncTaskPayload(task: AutoSyncTaskConfig, index: number): AutoSyncTaskConfig {
    return {
      id: toPlainString(task.id) || `task-${index + 1}`,
      name: toPlainString(task.name) || `任务${index + 1}`,
      enabled: task.enabled !== false,
      repoPaths: normalizeRepoSelections(task.repoPaths ?? []),
      projectOptionId: toPlainString(task.projectOptionId).trim(),
      projectName: toPlainString(task.projectName).trim(),
      workHours: normalizeTaskWorkHours(task.workHours),
      time: normalizeTimeValue(task.time),
      timeWindowMode: normalizeAutoSyncTimeWindowMode(task.timeWindowMode),
      windowStartTime: normalizeTimeValue(task.windowStartTime, DEFAULT_AUTO_SYNC_TASK_CONFIG.windowStartTime),
      lastRunAt: toPlainString(task.lastRunAt),
      lastSuccessAt: toPlainString(task.lastSuccessAt),
      lastStatus: task.lastStatus ?? 'idle',
      lastMessage: toPlainString(task.lastMessage),
      lastRunKey: toPlainString(task.lastRunKey),
      lastScheduledRunKey: toPlainString(task.lastScheduledRunKey),
      lastSuccessKey: toPlainString(task.lastSuccessKey),
    };
  }

  function getConfigPayload(): AppConfig {
    const workspaceDirs = getWorkspaceDirs();
    const normalizedSelectedRepoPaths = normalizeRepoSelections(selectedRepoPaths.value);
    const normalizedIgnoredRepoPaths = normalizeRepoSelections(config.ignoredRepoPaths ?? []);
    const ignoredRepoKeys = new Set(normalizedIgnoredRepoPaths.map(getRepoKey));
    const normalizedPinnedRepoPaths = normalizeRepoSelections(config.pinnedRepoPaths ?? []).filter(
      (path) => !ignoredRepoKeys.has(getRepoKey(path)),
    );
    const normalizedRepoDisplayNames = normalizeRepoDisplayNames(config.repoDisplayNames ?? {});

    selectedRepoPaths.value = normalizedSelectedRepoPaths;
    config.selectedRepoPaths = normalizedSelectedRepoPaths;
    config.ignoredRepoPaths = normalizedIgnoredRepoPaths;
    config.pinnedRepoPaths = normalizedPinnedRepoPaths;
    config.repoDisplayNames = normalizedRepoDisplayNames;

    const aiProfiles = getAiProfilePayloads();
    const activeProfile = aiProfiles.find((profile) => profile.id === config.activeAiProfileId) ?? aiProfiles[0] ?? DEFAULT_AI_PROFILE;

    return {
      workspaceDir: toPlainString(config.workspaceDir),
      workspaceDirs,
      selectedRepoPaths: normalizedSelectedRepoPaths,
      ignoredRepoPaths: normalizedIgnoredRepoPaths,
      pinnedRepoPaths: normalizedPinnedRepoPaths,
      repoDisplayNames: normalizedRepoDisplayNames,
      repoFeishuProjects: normalizeRepoFeishuProjects(config.repoFeishuProjects),
      reporterName: toPlainString(config.reporterName),
      gitAuthorEmail: toPlainString(config.gitAuthorEmail),
      aiBaseUrl: toPlainString(activeProfile.baseUrl),
      aiApiKey: toPlainString(activeProfile.apiKey),
      aiModel: toPlainString(activeProfile.model),
      aiBaseUrlOptions: normalizeOptions([...config.aiBaseUrlOptions, ...aiProfiles.map((profile) => profile.baseUrl)]),
      aiModelOptions: normalizeOptions([...config.aiModelOptions, ...aiProfiles.map((profile) => profile.model)]),
      aiProfiles,
      activeAiProfileId: toPlainString(config.activeAiProfileId),
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
        tasks: (config.autoSync.tasks ?? []).map((task, index) => getAutoSyncTaskPayload(task, index)),
      },
    };
  }


  function getEditableConfigSignature(overrides?: Partial<AppConfig>) {
    const aiProfiles = getAiProfilePayloads();
    const activeProfile = aiProfiles.find((profile) => profile.id === config.activeAiProfileId) ?? aiProfiles[0] ?? DEFAULT_AI_PROFILE;

    return JSON.stringify({
      workspaceDir: toPlainString(config.workspaceDir),
      workspaceDirs: normalizeWorkspaceDirs([...(config.workspaceDirs ?? []), config.workspaceDir]),
      selectedRepoPaths: normalizeRepoSelections(selectedRepoPaths.value),
      ignoredRepoPaths: normalizeRepoSelections(config.ignoredRepoPaths ?? []),
      pinnedRepoPaths: normalizeRepoSelections(config.pinnedRepoPaths ?? []),
      repoDisplayNames: normalizeRepoDisplayNames(overrides?.repoDisplayNames ?? config.repoDisplayNames),
      repoFeishuProjects: normalizeRepoFeishuProjects(overrides?.repoFeishuProjects ?? config.repoFeishuProjects),
      reporterName: toPlainString(config.reporterName),
      gitAuthorEmail: toPlainString(config.gitAuthorEmail),
      aiBaseUrl: toPlainString(activeProfile.baseUrl),
      aiApiKey: toPlainString(activeProfile.apiKey),
      aiModel: toPlainString(activeProfile.model),
      aiBaseUrlOptions: normalizeOptions([...config.aiBaseUrlOptions, ...aiProfiles.map((profile) => profile.baseUrl)]),
      aiModelOptions: normalizeOptions([...config.aiModelOptions, ...aiProfiles.map((profile) => profile.model)]),
      aiProfiles,
      activeAiProfileId: toPlainString(config.activeAiProfileId),
      feishuForm: {
        ...config.feishuForm,
        defaultWorkHours: normalizeWorkHours(config.feishuForm.defaultWorkHours),
        projectWorkHours: normalizeProjectWorkHours(config.feishuForm.projectWorkHours),
      },
      autoSync: {
        enabled: Boolean(config.autoSync.enabled),
        tasks: (config.autoSync.tasks ?? []).map((task, index) => {
          const payload = getAutoSyncTaskPayload(task, index);
          return {
            id: payload.id,
            name: payload.name,
            enabled: payload.enabled,
            repoPaths: payload.repoPaths,
            projectOptionId: payload.projectOptionId,
            projectName: payload.projectName,
            workHours: payload.workHours,
            time: payload.time,
            timeWindowMode: payload.timeWindowMode,
            windowStartTime: payload.windowStartTime,
          };
        }),
      },
    });
  }


  function markConfigSaved() {
    savedConfigSignature.value = getEditableConfigSignature();
  }


  const isConfigDirty = computed(() => Boolean(savedConfigSignature.value) && savedConfigSignature.value !== getEditableConfigSignature());


  async function persistConfig(repoSettings?: Pick<AppConfig, 'repoDisplayNames' | 'repoFeishuProjects'>) {
    const payload = { ...getConfigPayload(), ...repoSettings };
    const signature = getEditableConfigSignature(repoSettings);
    const saved = await window.api.saveConfig(payload);
    if (repoSettings) Object.assign(config, repoSettings);
    savedConfigSignature.value = signature;
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
    try {
      const payload = getConfigPayload();
      const signature = getEditableConfigSignature();
      if (!(await validateAutoSyncBeforeSave(payload))) return;
      if (signature !== getEditableConfigSignature()) {
        ElMessage.warning('校验期间配置有修改，请重新保存');
        return;
      }
      await persistConfig();
      ElMessage.success('配置已保存');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '配置保存失败');
    }
  }


  function createAiProfile() {
    const profiles = ensureAiProfiles();
    const nextIndex = profiles.length + 1;
    const profile: AiProfile = {
      id: createAiProfileId(),
      name: `AI 配置 ${nextIndex}`,
      baseUrl: activeAiProfile.value.baseUrl || DEFAULT_AI_PROFILE.baseUrl,
      apiKey: '',
      model: activeAiProfile.value.model || DEFAULT_AI_PROFILE.model,
      enabled: true,
    };
    config.aiProfiles = [...profiles, profile];
    config.activeAiProfileId = profile.id;
    syncLegacyAiFieldsFromActiveProfile();
    ElMessage.info('AI 配置已新增，当前修改待保存');
  }


  function selectAiProfile(id: string) {
    const profiles = ensureAiProfiles();
    if (!profiles.some((profile) => profile.id === id)) return;
    config.activeAiProfileId = id;
    syncLegacyAiFieldsFromActiveProfile();
  }


  async function removeAiProfile(id: string) {
    const profiles = ensureAiProfiles();
    if (profiles.length <= 1) {
      ElMessage.warning('至少保留一套 AI 配置');
      return;
    }
    const profile = profiles.find((item) => item.id === id);
    try {
      await ElMessageBox.confirm(`确定删除「${profile?.name || '未命名配置'}」及其 API Key 吗？保存修改后生效。`, '删除 AI 配置', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
    } catch {
      return;
    }
    const nextProfiles = profiles.filter((profile) => profile.id !== id);
    if (nextProfiles.length === profiles.length) return;
    config.aiProfiles = nextProfiles;
    if (config.activeAiProfileId === id) {
      config.activeAiProfileId = nextProfiles[0]?.id || DEFAULT_AI_PROFILE.id;
    }
    syncLegacyAiFieldsFromActiveProfile();
    ElMessage.info('AI 配置已移除，当前修改待保存');
  }


  function rememberAiBaseUrlOption(value: string) {
    config.aiBaseUrlOptions = normalizeOptions([...config.aiBaseUrlOptions, value]);
  }


  function rememberAiModelOption(value: string) {
    config.aiModelOptions = normalizeOptions([...config.aiModelOptions, value]);
  }


  function removeAiOption(field: 'baseUrl' | 'model', value: string) {
    const isInUse = config.aiProfiles.some((profile) => profile[field].trim() === value);
    if (isInUse) {
      ElMessage.warning('请先将使用此选项的 AI 配置改为其他值');
      return;
    }
    const optionsKey = field === 'baseUrl' ? 'aiBaseUrlOptions' : 'aiModelOptions';
    config[optionsKey] = config[optionsKey].filter((item) => item !== value);
    ElMessage.info('选项已移除，当前修改待保存');
  }



  return {
    reporterOptions,
    aiBaseUrlOptions,
    aiModelOptions,
    aiProfileOptions,
    activeAiProfile,
    isConfigDirty,
    getConfigPayload,
    getEditableConfigSignature,
    markConfigSaved,
    persistConfig,
    persistConfigBeforeAction,
    saveSettings,
    createAiProfile,
    selectAiProfile,
    removeAiProfile,
    rememberAiBaseUrlOption,
    rememberAiModelOption,
    removeAiOption,
  };
}
