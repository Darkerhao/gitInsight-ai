import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
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
  FeishuProjectOption,
  RepoInfo,
  ReportResult,
  StorageInfo,
  SyncLogRecord,
} from '@shared/types';

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createAssistant() {
  const today = formatLocalDate(new Date());
  const loading = ref(false);
  const pushing = ref(false);
  const feishuLoading = ref(false);
  const projectLoading = ref(false);
  const autoSyncLoading = ref(false);
  const repos = ref<RepoInfo[]>([]);
  const projectOptions = ref<FeishuProjectOption[]>([]);
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
  let removeAutoSyncListener: (() => void) | null = null;

  const config = reactive<AppConfig>({
    workspaceDir: '',
    workspaceDirs: [],
    selectedRepoPaths: [],
    ignoredRepoPaths: [],
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

  function toPlainString(value: unknown) {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }

  function toPlainNumber(value: unknown, fallback: number) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
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

  async function scanWorkspaceDirs(workspaceDirs: string[], options: { includeIgnored?: boolean } = {}) {
    const scannedGroups = await Promise.all(workspaceDirs.map((workspaceDir) => window.api.scanRepositories(workspaceDir)));
    const scannedRepos = scannedGroups.flat();
    return options.includeIgnored ? scannedRepos : filterIgnoredRepos(scannedRepos);
  }

  const aiBaseUrlOptions = computed(() => mergeCurrentOption(config.aiBaseUrlOptions, config.aiBaseUrl));
  const aiModelOptions = computed(() => mergeCurrentOption(config.aiModelOptions, config.aiModel));

  const selectedRepos = computed(() => repos.value.filter((item) => selectedRepoPaths.value.includes(item.path)));
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
    selectedRepoPaths.value = normalizedSelectedRepoPaths;
    config.selectedRepoPaths = normalizedSelectedRepoPaths;
    config.ignoredRepoPaths = normalizedIgnoredRepoPaths;
    return {
      workspaceDir: toPlainString(config.workspaceDir),
      workspaceDirs,
      selectedRepoPaths: normalizedSelectedRepoPaths,
      ignoredRepoPaths: normalizedIgnoredRepoPaths,
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
        defaultWorkHours: toPlainNumber(config.feishuForm.defaultWorkHours, DEFAULT_FEISHU_FORM_CONFIG.defaultWorkHours),
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
      },
      autoSync: {
        ...DEFAULT_AUTO_SYNC_CONFIG,
        ...saved.autoSync,
      },
    });
    selectedRepoPaths.value = normalizeRepoSelections(config.selectedRepoPaths ?? []);
    config.ignoredRepoPaths = normalizeRepoSelections(config.ignoredRepoPaths ?? []);
    if (!form.date) form.date = today;
    config.aiBaseUrlOptions = normalizeOptions(config.aiBaseUrlOptions.length ? config.aiBaseUrlOptions : [...DEFAULT_AI_BASE_URL_OPTIONS]);
    config.aiModelOptions = normalizeOptions(config.aiModelOptions.length ? config.aiModelOptions : [...DEFAULT_AI_MODEL_OPTIONS]);
    config.workspaceDirs = normalizeWorkspaceDirs([...(config.workspaceDirs ?? []), config.workspaceDir]);
    advancedConfigPanels.value = [
      ...(!config.aiApiKey ? ['ai'] : []),
      ...(!config.feishuForm.shareToken || !config.feishuForm.cookie || !config.feishuForm.csrfToken ? ['feishu'] : []),
      ...(config.autoSync.enabled ? ['autoSync'] : []),
    ];
    if (config.feishuForm.shareToken) {
      await loadFeishuProjects();
    }
    if (config.workspaceDirs.length) {
      await refreshRepos();
    }
    await refreshAutoSyncState();
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
      await window.api.saveConfig(getConfigPayload());
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
      selectedRepoPaths.value = selectedPaths.length || !repos.value.length ? selectedPaths : [repos.value[0].path];
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
    const saved = await window.api.saveConfig(payload);
    Object.assign(config.autoSync, {
      ...DEFAULT_AUTO_SYNC_CONFIG,
      ...saved.autoSync,
    });
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
    await window.api.saveConfig(getConfigPayload());
    ElMessage.success('接口地址选项已删除');
  }

  async function removeAiModelOption(value: string) {
    config.aiModelOptions = config.aiModelOptions.filter((item) => item !== value);
    if (config.aiModel === value) config.aiModel = '';
    await window.api.saveConfig(getConfigPayload());
    ElMessage.success('模型选项已删除');
  }

  async function loginFeishu() {
    feishuLoading.value = true;
    try {
      await window.api.saveConfig(getConfigPayload());
      await window.api.loginFeishu({ config: getConfigPayload().feishuForm });
      ElMessage.success('已打开飞书登录窗口');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '打开飞书登录失败');
    } finally {
      feishuLoading.value = false;
    }
  }

  async function loadFeishuProjects() {
    projectLoading.value = true;
    try {
      await window.api.saveConfig(getConfigPayload());
      projectOptions.value = await window.api.listFeishuProjects({ config: getConfigPayload().feishuForm });
      const selected = projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId);
      if (selected) {
        config.feishuForm.projectName = selected.name;
      }
      status.value = `已获取 ${projectOptions.value.length} 个飞书项目选项`;
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '获取飞书项目列表失败');
    } finally {
      projectLoading.value = false;
    }
  }

  function selectFeishuProject(optionId: string) {
    const selected = projectOptions.value.find((item) => item.id === optionId);
    config.feishuForm.projectName = selected?.name ?? '';
  }

  async function testSubmitFeishu() {
    feishuLoading.value = true;
    try {
      await window.api.saveConfig(getConfigPayload());
      const result = await window.api.testSubmitFeishu({
        config: getConfigPayload().feishuForm,
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
    loading.value = true;
    try {
      await window.api.saveConfig(getConfigPayload());
      const result = await window.api.generateReport({
        repoPaths: [...selectedRepoPaths.value],
        date: form.date,
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

  async function push() {
    if (!report.value) {
      ElMessage.warning('请先生成日报');
      return;
    }
    pushing.value = true;
    try {
      await window.api.saveConfig(getConfigPayload());
      await window.api.syncFeishuDaily({
        config: getConfigPayload().feishuForm,
        report: report.value,
        date: form.date,
        reporterName: config.reporterName,
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
      const result = await window.api.runAutoSyncNow(payload);
      status.value = result.message;
      if (result.report) {
        report.value = result.report;
        lastReportResult.value = null;
        currentReportId.value = null;
        form.date = today;
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
      await window.api.saveConfig(getConfigPayload());
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

  async function removeRepo(path: string) {
    const repo = repos.value.find((item) => getRepoKey(item.path) === getRepoKey(path));
    const repoPath = repo?.path ?? path;
    const repoKey = getRepoKey(repoPath);
    repos.value = repos.value.filter((item) => getRepoKey(item.path) !== repoKey);
    selectedRepoPaths.value = selectedRepoPaths.value.filter((item) => getRepoKey(item) !== repoKey);
    config.selectedRepoPaths = normalizeRepoSelections(selectedRepoPaths.value);
    config.ignoredRepoPaths = normalizeRepoSelections([...(config.ignoredRepoPaths ?? []), repoPath]);
    config.workspaceDirs = normalizeWorkspaceDirs((config.workspaceDirs ?? []).filter((item) => getRepoKey(item) !== repoKey));
    if (getRepoKey(config.workspaceDir) === repoKey) {
      config.workspaceDir = config.workspaceDirs[0] ?? '';
    }
    await window.api.saveConfig(getConfigPayload());
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
    autoSyncLoading,
    repos,
    projectOptions,
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
    selectedRepos,
    autoSyncRunning,
    autoSyncStatusType,
    autoSyncStatusLabel,
    // 方法
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
    selectFeishuProject,
    testSubmitFeishu,
    generate,
    generateAndPush,
    push,
    runAutoSyncNow,
    refreshDailyReports,
    refreshLocalData,
    saveCurrentReport,
    toggleRepo,
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
