import { computed, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  DEFAULT_AI_BASE_URL_OPTIONS,
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
  ReportTimeRange,
  StorageInfo,
  SyncLogRecord,
} from '@shared/types';

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftLocalDate(date: string, deltaDays: number) {
  const [year, month, day] = date.split('-').map(Number);
  return formatLocalDate(new Date(year, month - 1, day + deltaDays));
}

function buildDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

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
    feishuForm: { ...DEFAULT_FEISHU_FORM_CONFIG },
    autoSync: { ...DEFAULT_AUTO_SYNC_CONFIG },
  });

  const form = reactive({
    date: today,
    startDateTime: buildDateTime(today, '00:00'),
    endDateTime: buildDateTime(tomorrow, '00:00'),
  });

  const reporterOptions = computed(() => {
    return config.reporterName ? [config.reporterName] : [];
  });

  function mergeCurrentOption(options: string[], currentValue: string) {
    const normalizedValue = currentValue.trim();
    if (!normalizedValue || options.includes(normalizedValue)) return options;
    return [normalizedValue, ...options];
  }

  function normalizeOptions(options: unknown[]) {
    return Array.from(new Set(options.map((item) => toPlainString(item).trim()).filter(Boolean)));
  }

  function normalizeWorkspaceDirs(options: unknown[]) {
    return Array.from(new Set(options.map((item) => toPlainString(item).trim()).filter(Boolean)));
  }

  function getWorkspaceDirs() {
    const workspaceDirs = normalizeWorkspaceDirs([...config.workspaceDirs, config.workspaceDir]);
    config.workspaceDirs = workspaceDirs;
    return workspaceDirs;
  }

  function getRepoKey(path: string) {
    return path.trim().toLocaleLowerCase();
  }

  function mergeRepos(currentRepos: RepoInfo[], nextRepos: RepoInfo[]) {
    const repoMap = new Map<string, RepoInfo>();
    for (const repo of [...currentRepos, ...nextRepos]) {
      repoMap.set(getRepoKey(repo.path), repo);
    }
    return Array.from(repoMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }

  function normalizeRepoSelections(paths: string[]) {
    const selectedPathMap = new Map<string, string>();
    for (const path of paths) {
      if (path.trim()) selectedPathMap.set(getRepoKey(path), path);
    }
    return Array.from(selectedPathMap.values());
  }

  function filterIgnoredRepos(repoItems: RepoInfo[]) {
    const ignoredRepoKeys = new Set(normalizeRepoSelections(config.ignoredRepoPaths ?? []).map(getRepoKey));
    return repoItems.filter((repo) => !ignoredRepoKeys.has(getRepoKey(repo.path)));
  }

  function sortReposForDisplay(repoItems: RepoInfo[]) {
    const pinnedOrder = new Map(normalizeRepoSelections(config.pinnedRepoPaths ?? []).map((path, index) => [getRepoKey(path), index]));
    return [...repoItems].sort((a, b) => {
      const pinnedA = pinnedOrder.get(getRepoKey(a.path));
      const pinnedB = pinnedOrder.get(getRepoKey(b.path));
      if (pinnedA !== undefined && pinnedB !== undefined) return pinnedA - pinnedB;
      if (pinnedA !== undefined) return -1;
      if (pinnedB !== undefined) return 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }

  function toPlainString(value: unknown) {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }

  function normalizeWorkHours(value: unknown, fallback = DEFAULT_FEISHU_FORM_CONFIG.defaultWorkHours) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) return fallback;
    return Math.min(Math.max(normalized, 0.5), 24);
  }

  function normalizeProjectWorkHours(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, hours]) => [key.trim(), normalizeWorkHours(hours)] as const)
        .filter(([key]) => key),
    );
  }

  function normalizeTimeValue(value: unknown) {
    if (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      return value;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
    }

    const maybeFormatter = (value as { format?: unknown } | null)?.format;
    if (typeof maybeFormatter === 'function') {
      try {
        const formatted = maybeFormatter.call(value, 'HH:mm');
        if (typeof formatted === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(formatted)) {
          return formatted;
        }
      } catch {
        // Fall back to the default time below.
      }
    }

    return DEFAULT_AUTO_SYNC_CONFIG.time;
  }

  function normalizeAutoSyncTimeWindowMode(value: unknown) {
    return value === 'yesterday-start-to-run' ? 'yesterday-start-to-run' : DEFAULT_AUTO_SYNC_CONFIG.timeWindowMode;
  }

  async function scanWorkspaceDirs(workspaceDirs: string[], options: { includeIgnored?: boolean } = {}) {
    const scannedGroups = await Promise.all(workspaceDirs.map((workspaceDir) => window.api.scanRepositories(workspaceDir)));
    const scannedRepos = scannedGroups.flat();
    return options.includeIgnored ? scannedRepos : filterIgnoredRepos(scannedRepos);
  }

  const aiBaseUrlOptions = computed(() => mergeCurrentOption(config.aiBaseUrlOptions, config.aiBaseUrl));
  const aiModelOptions = computed(() => mergeCurrentOption(config.aiModelOptions, config.aiModel));

  const pinnedRepoKeys = computed(() => new Set(normalizeRepoSelections(config.pinnedRepoPaths ?? []).map(getRepoKey)));
  const sortedRepos = computed(() => sortReposForDisplay(repos.value));
  const selectedRepos = computed(() => sortedRepos.value.filter((item) => selectedRepoPaths.value.includes(item.path)));
  const autoSyncRunning = computed(() => autoSyncLoading.value || Boolean(autoSyncState.value?.isRunning));
  const autoSyncStatusType = computed(() => {
    const statusValue = autoSyncState.value?.lastStatus ?? config.autoSync.lastStatus;
    if (statusValue === 'success') return 'success';
    if (statusValue === 'failed') return 'danger';
    if (statusValue === 'running') return 'warning';
    if (statusValue === 'skipped') return 'info';
    return 'info';
  });

  const autoSyncStatusLabel = computed(() => {
    const statusValue = autoSyncState.value?.lastStatus ?? config.autoSync.lastStatus;
    const statusMap: Record<string, string> = {
      idle: '未执行',
      running: '执行中',
      success: '成功',
      failed: '失败',
      skipped: '已跳过',
    };
    return statusMap[statusValue] ?? '未执行';
  });

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

  function countResultFiles(result: ReportResult | null) {
    if (!result) return 0;
    return Array.from(new Set(result.commits.flatMap((commit) => commit.files))).length;
  }

  async function refreshDailyReports() {
    dailyReports.value = await window.api.listDailyReports(10);
  }

  async function refreshLocalData() {
    const [reports, syncRecords, errorRecords, storage] = await Promise.all([
      window.api.listDailyReports(50),
      window.api.listSyncLogs(50),
      window.api.listErrorLogs(50),
      window.api.getStorageInfo(),
    ]);
    dailyReports.value = reports;
    syncLogs.value = syncRecords;
    errorLogs.value = errorRecords;
    storageInfo.value = storage;
  }

  function applyAutoSyncState(state: AutoSyncState) {
    autoSyncState.value = state;
    Object.assign(config.autoSync, {
      enabled: state.enabled,
      time: state.time,
      timeWindowMode: state.timeWindowMode,
      windowStartTime: state.windowStartTime,
      lastRunAt: state.lastRunAt,
      lastSuccessAt: state.lastSuccessAt,
      lastStatus: state.lastStatus,
      lastMessage: state.lastMessage,
      lastRunKey: state.lastRunKey,
      lastScheduledRunKey: state.lastScheduledRunKey,
      lastSuccessKey: state.lastSuccessKey,
    });
  }

  async function refreshAutoSyncState() {
    applyAutoSyncState(await window.api.getAutoSyncState());
  }

  function formatDateTime(value?: string) {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无';
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function applyFullDayReportRange(date: string) {
    form.date = date;
    form.startDateTime = buildDateTime(date, '00:00');
    form.endDateTime = buildDateTime(shiftLocalDate(date, 1), '00:00');
  }

  function applyReportTimeRange(date: string, timeRange?: ReportTimeRange) {
    form.date = date;
    if (timeRange?.startDateTime && timeRange.endDateTime) {
      form.startDateTime = timeRange.startDateTime;
      form.endDateTime = timeRange.endDateTime;
      return;
    }
    applyFullDayReportRange(date);
  }

  function getReportRangePayload() {
    const startMs = new Date(form.startDateTime).getTime();
    const endMs = new Date(form.endDateTime).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) return null;
    return {
      startDateTime: form.startDateTime,
      endDateTime: form.endDateTime,
    };
  }

  function getCurrentReportTimeRange(): ReportTimeRange | undefined {
    const payload = getReportRangePayload();
    if (!payload) return undefined;

    const resultRange = lastReportResult.value?.timeRange;
    if (
      resultRange?.startDateTime === payload.startDateTime &&
      resultRange.endDateTime === payload.endDateTime
    ) {
      return resultRange;
    }

    return {
      ...payload,
      label: `${formatDateTime(payload.startDateTime)} 至 ${formatDateTime(payload.endDateTime)}`,
    };
  }

  async function validateAutoSyncBeforeSave(payload: AppConfig) {
    if (!payload.autoSync.enabled) return true;
    const result = await window.api.validateAutoSync(payload);
    if (result.valid) return true;
    if (!advancedConfigPanels.value.includes('autoSync')) {
      advancedConfigPanels.value = [...advancedConfigPanels.value, 'autoSync'];
    }
    ElMessage.warning(result.message);
    return false;
  }

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
    if (!form.date) form.date = today;
    config.aiBaseUrlOptions = normalizeOptions(config.aiBaseUrlOptions.length ? config.aiBaseUrlOptions : [...DEFAULT_AI_BASE_URL_OPTIONS]);
    config.aiModelOptions = normalizeOptions(config.aiModelOptions.length ? config.aiModelOptions : [...DEFAULT_AI_MODEL_OPTIONS]);
    config.workspaceDirs = normalizeWorkspaceDirs([...(config.workspaceDirs ?? []), config.workspaceDir]);
    const feishuAuthIncomplete =
      !config.feishuForm.endpoint ||
      !config.feishuForm.shareToken ||
      !config.feishuForm.cookie ||
      !config.feishuForm.csrfToken;
    const feishuMappingIncomplete =
      !config.feishuForm.reporterUserId ||
      !config.feishuForm.projectOptionId;
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
      await loadFeishuFields({ silent: true });
      if (config.feishuForm.projectFieldId) {
        await loadFeishuProjects({ silent: true });
      }
    }
    if (config.workspaceDirs.length) {
      await refreshRepos();
    }
    await refreshAutoSyncState();
    markConfigSaved();
  }

  async function chooseWorkspace() {
    const dir = await window.api.selectDirectory();
    if (!dir) return;
    loading.value = true;
    try {
      const scannedRepos = await scanWorkspaceDirs([dir], { includeIgnored: true });
      if (!scannedRepos.length) {
        status.value = '所选目录下未识别到 Git 仓库';
        ElMessage.warning('未在所选目录下识别到 Git 仓库，请选择包含 .git 的项目目录或工作区');
        return;
      }
      config.workspaceDir = dir;
      config.workspaceDirs = normalizeWorkspaceDirs([...config.workspaceDirs, dir]);
      const scannedRepoKeys = new Set(scannedRepos.map((repo) => getRepoKey(repo.path)));
      config.ignoredRepoPaths = normalizeRepoSelections((config.ignoredRepoPaths ?? []).filter((path) => !scannedRepoKeys.has(getRepoKey(path))));
      repos.value = mergeRepos(repos.value, scannedRepos);
      selectedRepoPaths.value = normalizeRepoSelections([...selectedRepoPaths.value, ...scannedRepos.map((repo) => repo.path)]);
      await persistConfig();
      status.value = `已添加 ${scannedRepos.length} 个仓库，项目列表共 ${repos.value.length} 个仓库`;
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '扫描失败');
    } finally {
      loading.value = false;
    }
  }

  async function refreshRepos() {
    const workspaceDirs = getWorkspaceDirs();
    if (!workspaceDirs.length) {
      repos.value = [];
      selectedRepoPaths.value = [];
      return;
    }
    loading.value = true;
    try {
      repos.value = mergeRepos([], await scanWorkspaceDirs(workspaceDirs));
      const repoPathSet = new Set(repos.value.map((repo) => getRepoKey(repo.path)));
      const selectedPaths = selectedRepoPaths.value.filter((path) => repoPathSet.has(getRepoKey(path)));
      const firstDisplayRepo = sortReposForDisplay(repos.value)[0];
      selectedRepoPaths.value = selectedPaths.length || !firstDisplayRepo ? selectedPaths : [firstDisplayRepo.path];
      config.selectedRepoPaths = normalizeRepoSelections(selectedRepoPaths.value);
      status.value = `已扫描到 ${repos.value.length} 个仓库`;
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '扫描失败');
    } finally {
      loading.value = false;
    }
  }

  async function saveSettings() {
    const payload = getConfigPayload();
    if (!(await validateAutoSyncBeforeSave(payload))) return;
    const saved = await persistConfig();
    Object.assign(config.autoSync, {
      ...DEFAULT_AUTO_SYNC_CONFIG,
      ...saved.autoSync,
    });
    markConfigSaved();
    await refreshAutoSyncState();
    ElMessage.success('配置已保存');
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

  async function loginFeishu() {
    feishuLoading.value = true;
    try {
      await persistConfigBeforeAction('打开飞书登录');
      await window.api.loginFeishu({ config: getConfigPayload().feishuForm });
      ElMessage.success('已打开飞书登录窗口');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '打开飞书登录失败');
    } finally {
      feishuLoading.value = false;
    }
  }

  async function loadFeishuFields(options: { silent?: boolean } = {}) {
    fieldLoading.value = true;
    try {
      await persistConfigBeforeAction('解析飞书字段');
      feishuFieldOptions.value = await window.api.listFeishuFields({ config: getConfigPayload().feishuForm });
      status.value = `已解析 ${feishuFieldOptions.value.length} 个飞书表单字段`;
      if (!options.silent) ElMessage.success('飞书字段已解析');
    } catch (error) {
      if (!options.silent) {
        ElMessage.error(error instanceof Error ? error.message : '解析飞书字段失败');
      }
    } finally {
      fieldLoading.value = false;
    }
  }

  async function loadFeishuProjects(options: { silent?: boolean } = {}) {
    if (!config.feishuForm.projectFieldId.trim()) {
      if (!options.silent) ElMessage.warning('请先选择或填写所属项目字段 ID');
      return;
    }
    projectLoading.value = true;
    try {
      await persistConfigBeforeAction('刷新飞书项目');
      projectOptions.value = await window.api.listFeishuProjects({ config: getConfigPayload().feishuForm });
      const selected = projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId);
      if (selected) {
        config.feishuForm.projectName = selected.name;
      }
      status.value = `已获取 ${projectOptions.value.length} 个飞书项目选项`;
      if (!options.silent) ElMessage.success('飞书项目选项已刷新');
    } catch (error) {
      if (!options.silent) {
        ElMessage.error(error instanceof Error ? error.message : '获取飞书项目列表失败');
      }
    } finally {
      projectLoading.value = false;
    }
  }

  function selectFeishuProject(optionId: string) {
    const selected = projectOptions.value.find((item) => item.id === optionId);
    config.feishuForm.projectName = selected?.name ?? '';
    const projectHours = config.feishuForm.projectWorkHours?.[optionId];
    config.feishuForm.defaultWorkHours = normalizeWorkHours(projectHours, config.feishuForm.defaultWorkHours);
  }

  function updateProjectWorkHours(value: number | undefined) {
    const hours = normalizeWorkHours(value, config.feishuForm.defaultWorkHours);
    config.feishuForm.defaultWorkHours = hours;
    const optionId = config.feishuForm.projectOptionId.trim();
    if (!optionId) return;
    config.feishuForm.projectWorkHours = {
      ...normalizeProjectWorkHours(config.feishuForm.projectWorkHours),
      [optionId]: hours,
    };
  }

  async function testSubmitFeishu() {
    try {
      await ElMessageBox.confirm('测试提交会向当前飞书表单写入一条带测试标记的真实记录，确认继续？', '确认测试提交', {
        confirmButtonText: '写入测试记录',
        cancelButtonText: '取消',
        type: 'warning',
      });
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        ElMessage.error(error instanceof Error ? error.message : '测试提交已取消');
      }
      return;
    }

    feishuLoading.value = true;
    try {
      await persistConfigBeforeAction('测试提交');
      const payloadConfig = {
        ...getConfigPayload().feishuForm,
        reporterName: config.feishuForm.reporterName || config.reporterName,
      };
      const result = await window.api.testSubmitFeishu({
        config: payloadConfig,
        date: form.date,
      });
      status.value = `飞书测试提交成功：code=${result.code}`;
      ElMessage.success('飞书测试提交成功');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '飞书测试提交失败');
    } finally {
      feishuLoading.value = false;
    }
  }

  async function generate() {
    if (!selectedRepos.value.length) {
      ElMessage.warning('请至少选择一个项目');
      return;
    }
    if (!config.reporterName) {
      ElMessage.warning('请先填写汇报人');
      return;
    }
    const reportRange = getReportRangePayload();
    if (!reportRange) {
      ElMessage.warning('请选择有效的提交时间段');
      return;
    }
    loading.value = true;
    try {
      await persistConfigBeforeAction('生成日报');
      const result = await window.api.generateReport({
        repoPaths: [...selectedRepoPaths.value],
        date: form.date,
        ...reportRange,
        reporterName: config.reporterName,
      });
      lastReportResult.value = result;
      currentReportId.value = result.historyId ?? null;
      report.value = result.report;
      status.value = `已汇总 ${result.repos.length} 个仓库，生成 ${result.commits.length} 条记录`;
      await refreshLocalData();
      if (!result.commits.length) {
        ElMessage.warning('未匹配到可用于生成日报的提交记录');
        return;
      }
      ElMessage.success('日报已生成');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '生成失败');
    } finally {
      loading.value = false;
    }
  }

  async function generateAndPush() {
    await generate();
    if (!report.value) return;
    await push();
  }

  async function push(reportContent = report.value) {
    const content = reportContent.trim();
    if (!content) {
      ElMessage.warning('请先生成日报');
      return;
    }
    pushing.value = true;
    try {
      await persistConfigBeforeAction('同步飞书');
      await window.api.syncFeishuDaily({
        config: getConfigPayload().feishuForm,
        report: content,
        date: form.date,
        reporterName: config.reporterName,
        workHours: normalizeWorkHours(config.feishuForm.defaultWorkHours),
        reportId: currentReportId.value ?? undefined,
        triggerType: 'manual',
      });
      ElMessage.success('已同步到飞书日报表');
      await refreshLocalData();
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '同步飞书失败');
    } finally {
      pushing.value = false;
    }
  }

  async function runAutoSyncNow() {
    const payload = getConfigPayload();
    if (!(await validateAutoSyncBeforeSave(payload))) return;
    autoSyncLoading.value = true;
    try {
      await persistConfigBeforeAction('执行自动同步');
      const result = await window.api.runAutoSyncNow(getConfigPayload());
      status.value = result.message;
      if (result.report) {
        report.value = result.report;
        lastReportResult.value = null;
        currentReportId.value = null;
        if (result.date) {
          applyReportTimeRange(result.date, result.timeRange);
        } else {
          applyFullDayReportRange(today);
        }
      }
      if (result.status === 'success') {
        ElMessage.success(result.message);
      } else if (result.status === 'skipped') {
        ElMessage.warning(result.message);
      } else if (result.status === 'failed') {
        ElMessage.error(result.message);
      } else {
        ElMessage.info(result.message);
      }
      await refreshAutoSyncState();
      await refreshLocalData();
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '自动同步执行失败');
    } finally {
      autoSyncLoading.value = false;
    }
  }

  async function saveRepoSelection() {
    try {
      await persistConfig();
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存项目选择失败');
    }
  }

  function toggleRepo(path: string) {
    const hasSelected = selectedRepoPaths.value.includes(path);
    if (hasSelected) {
      selectedRepoPaths.value = selectedRepoPaths.value.filter((item) => item !== path);
    } else {
      selectedRepoPaths.value = [...selectedRepoPaths.value, path];
    }
    void saveRepoSelection();
  }

  function isRepoPinned(path: string) {
    return pinnedRepoKeys.value.has(getRepoKey(path));
  }

  async function toggleRepoPin(path: string) {
    const repo = repos.value.find((item) => getRepoKey(item.path) === getRepoKey(path));
    const repoPath = repo?.path ?? path;
    const repoKey = getRepoKey(repoPath);
    const pinnedRepoPaths = normalizeRepoSelections(config.pinnedRepoPaths ?? []);
    const alreadyPinned = pinnedRepoPaths.some((item) => getRepoKey(item) === repoKey);
    config.pinnedRepoPaths = alreadyPinned
      ? pinnedRepoPaths.filter((item) => getRepoKey(item) !== repoKey)
      : [repoPath, ...pinnedRepoPaths.filter((item) => getRepoKey(item) !== repoKey)];

    try {
      await persistConfig();
      ElMessage.success(alreadyPinned ? '已取消置顶项目' : '项目已置顶');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存项目置顶状态失败');
    }
  }

  async function removeRepo(path: string) {
    const repo = repos.value.find((item) => getRepoKey(item.path) === getRepoKey(path));
    const repoPath = repo?.path ?? path;
    const repoKey = getRepoKey(repoPath);
    repos.value = repos.value.filter((item) => getRepoKey(item.path) !== repoKey);
    selectedRepoPaths.value = selectedRepoPaths.value.filter((item) => getRepoKey(item) !== repoKey);
    config.selectedRepoPaths = normalizeRepoSelections(selectedRepoPaths.value);
    config.ignoredRepoPaths = normalizeRepoSelections([...(config.ignoredRepoPaths ?? []), repoPath]);
    config.pinnedRepoPaths = normalizeRepoSelections(config.pinnedRepoPaths ?? []).filter((item) => getRepoKey(item) !== repoKey);
    config.workspaceDirs = normalizeWorkspaceDirs((config.workspaceDirs ?? []).filter((item) => getRepoKey(item) !== repoKey));
    if (getRepoKey(config.workspaceDir) === repoKey) {
      config.workspaceDir = config.workspaceDirs[0] ?? '';
    }
    await persistConfig();
    status.value = `已从项目列表移除 ${repo?.name ?? repoPath}`;
    ElMessage.success('项目已从列表移除，本地文件不会被删除');
  }

  async function saveCurrentReport() {
    if (!report.value.trim()) {
      ElMessage.warning('当前没有可保存的日报内容');
      return;
    }
    const selected = selectedRepos.value;
    const result = lastReportResult.value;
    const record = await window.api.saveDailyReport({
      id: currentReportId.value ?? undefined,
      date: form.date,
      reporterName: config.reporterName,
      repoNames: result?.repos.map((item) => item.name) ?? selected.map((item) => item.name),
      repoPaths: result?.repos.map((item) => item.path) ?? selected.map((item) => item.path),
      report: report.value,
      status: result?.commits.length ? 'success' : 'draft',
      commitsCount: result?.commits.length ?? 0,
      filesCount: countResultFiles(result),
      generatedAt: result?.generatedAt,
      timeRange: getCurrentReportTimeRange(),
      rawInput: result?.rawInput,
    });
    currentReportId.value = record.id;
    await refreshLocalData();
    ElMessage.success('日报已保存');
  }

  async function init() {
    removeAutoSyncListener = window.api.onAutoSyncUpdated(applyAutoSyncState);
    await loadConfig();
    await refreshLocalData();
  }

  function dispose() {
    removeAutoSyncListener?.();
    removeAutoSyncListener = null;
  }

  return {
    // 常量
    today,
    // 状态
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
    // computed
    reporterOptions,
    aiBaseUrlOptions,
    aiModelOptions,
    sortedRepos,
    selectedRepos,
    autoSyncRunning,
    autoSyncStatusType,
    autoSyncStatusLabel,
    isConfigDirty,
    // 方法
    applyFullDayReportRange,
    applyReportTimeRange,
    formatDateTime,
    chooseWorkspace,
    refreshRepos,
    saveSettings,
    rememberAiBaseUrlOption,
    rememberAiModelOption,
    removeAiBaseUrlOption,
    removeAiModelOption,
    loginFeishu,
    loadFeishuProjects,
    loadFeishuFields,
    selectFeishuProject,
    updateProjectWorkHours,
    testSubmitFeishu,
    generate,
    generateAndPush,
    push,
    runAutoSyncNow,
    refreshDailyReports,
    refreshLocalData,
    saveCurrentReport,
    toggleRepo,
    isRepoPinned,
    toggleRepoPin,
    removeRepo,
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
