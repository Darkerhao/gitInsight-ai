<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { FolderSearch, LogIn, Send, Sparkles, RefreshCw, Settings2, TestTube2, Trash2 } from 'lucide-vue-next';
import { DEFAULT_AI_BASE_URL_OPTIONS, DEFAULT_AI_MODEL_OPTIONS, DEFAULT_AUTO_SYNC_CONFIG, DEFAULT_FEISHU_FORM_CONFIG } from '@shared/types';
import type { AppConfig, AutoSyncState, FeishuProjectOption, RepoInfo } from '@shared/types';

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
const status = ref('');
const autoSyncState = ref<AutoSyncState | null>(null);
const advancedConfigPanels = ref<string[]>([]);
let removeAutoSyncListener: (() => void) | null = null;

const config = reactive<AppConfig>({
  workspaceDir: '',
  workspaceDirs: [],
  selectedRepoPaths: [],
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

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

async function scanWorkspaceDirs(workspaceDirs: string[]) {
  const scannedGroups = await Promise.all(workspaceDirs.map((workspaceDir) => window.api.scanRepositories(workspaceDir)));
  return scannedGroups.flat();
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
  selectedRepoPaths.value = normalizedSelectedRepoPaths;
  config.selectedRepoPaths = normalizedSelectedRepoPaths;
  return {
    workspaceDir: toPlainString(config.workspaceDir),
    workspaceDirs,
    selectedRepoPaths: normalizedSelectedRepoPaths,
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
  config.workspaceDir = dir;
  config.workspaceDirs = normalizeWorkspaceDirs([...config.workspaceDirs, dir]);
  loading.value = true;
  try {
    const scannedRepos = await scanWorkspaceDirs([dir]);
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
    report.value = result.report;
    status.value = `已汇总 ${result.repos.length} 个仓库，生成 ${result.commits.length} 条记录`;
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
    });
    ElMessage.success('已同步到飞书日报表');
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

onMounted(async () => {
  removeAutoSyncListener = window.api.onAutoSyncUpdated(applyAutoSyncState);
  await loadConfig();
});

onBeforeUnmount(() => {
  removeAutoSyncListener?.();
  removeAutoSyncListener = null;
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <h1>AI日报助手</h1>
        <p>Git分析 → AI生成日报 → 飞书同步</p>
      </div>
      <div class="actions">
        <el-button :icon="Settings2" @click="saveSettings">保存配置</el-button>
      </div>
    </header>

    <section class="panel config-panel">
      <div class="panel-title">
        <span>日报配置</span>
        <el-button size="small" :icon="FolderSearch" @click="chooseWorkspace">选择工作目录</el-button>
      </div>
      <div class="common-config-grid">
        <el-input v-model="config.workspaceDir" class="wide-field" placeholder="例如：D:/workspace" />
        <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        <el-select v-model="config.reporterName" filterable allow-create placeholder="选择或输入汇报人">
          <el-option v-for="item in reporterOptions" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select
          v-model="config.feishuForm.projectOptionId"
          class="wide-field"
          filterable
          placeholder="选择所属项目"
          :loading="projectLoading"
          @change="selectFeishuProject"
        >
          <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-input-number
          v-model="config.feishuForm.defaultWorkHours"
          :min="0.5"
          :max="24"
          :step="0.5"
          controls-position="right"
          placeholder="默认工时"
        />
        <div class="form-actions">
          <el-button :icon="LogIn" :loading="feishuLoading" @click="loginFeishu">登录飞书</el-button>
          <el-button :icon="RefreshCw" :loading="projectLoading" @click="loadFeishuProjects">刷新项目</el-button>
          <el-button :icon="TestTube2" type="warning" :loading="feishuLoading" @click="testSubmitFeishu">测试提交</el-button>
        </div>
      </div>
      <el-collapse v-model="advancedConfigPanels" class="advanced-collapse">
        <el-collapse-item title="AI 接入配置" name="ai">
          <div class="form-grid">
            <el-select
              v-model="config.aiBaseUrl"
              filterable
              allow-create
              default-first-option
              placeholder="OpenAI兼容接口地址"
              @change="rememberAiBaseUrlOption"
            >
              <el-option v-for="item in aiBaseUrlOptions" :key="item" :label="item" :value="item">
                <div class="select-option-row">
                  <span>{{ item }}</span>
                  <el-button
                    class="option-delete"
                    link
                    type="danger"
                    :icon="Trash2"
                    @click.stop="removeAiBaseUrlOption(item)"
                  />
                </div>
              </el-option>
            </el-select>
            <el-select
              v-model="config.aiModel"
              filterable
              allow-create
              default-first-option
              placeholder="模型名称"
              @change="rememberAiModelOption"
            >
              <el-option v-for="item in aiModelOptions" :key="item" :label="item" :value="item">
                <div class="select-option-row">
                  <span>{{ item }}</span>
                  <el-button class="option-delete" link type="danger" :icon="Trash2" @click.stop="removeAiModelOption(item)" />
                </div>
              </el-option>
            </el-select>
            <el-input v-model="config.aiApiKey" type="password" show-password placeholder="API Key" />
          </div>
        </el-collapse-item>
        <el-collapse-item title="飞书连接配置" name="feishu">
          <div class="form-grid">
            <el-input v-model="config.feishuForm.endpoint" placeholder="飞书表单提交接口地址" />
            <el-input v-model="config.feishuForm.shareToken" placeholder="飞书表单 shareToken" />
            <el-input v-model="config.feishuForm.csrfToken" type="password" show-password placeholder="x-csrftoken" />
            <el-input v-model="config.feishuForm.cookie" type="textarea" :rows="2" placeholder="Cookie（仅保存在本机配置）" />
          </div>
        </el-collapse-item>
        <el-collapse-item title="飞书人员与项目映射" name="mapping">
          <div class="form-grid">
            <el-input v-model="config.feishuForm.reporterUserId" placeholder="飞书汇报人 userId" />
            <el-input v-model="config.feishuForm.reporterName" placeholder="飞书汇报人名称，留空使用上方汇报人" />
            <el-input v-model="config.feishuForm.reporterAvatarUrl" placeholder="飞书头像地址，可选" />
            <el-input v-model="config.feishuForm.projectName" placeholder="所属项目名称，仅用于备注" />
          </div>
        </el-collapse-item>
        <el-collapse-item title="自动同步配置" name="autoSync">
          <div class="auto-sync-config">
            <div class="auto-sync-main">
              <el-switch v-model="config.autoSync.enabled" active-text="启用自动同步" inactive-text="关闭自动同步" />
              <el-time-picker
                v-model="config.autoSync.time"
                format="HH:mm"
                value-format="HH:mm"
                :clearable="false"
                placeholder="同步时间"
              />
              <el-button :icon="Sparkles" :loading="autoSyncRunning" @click="runAutoSyncNow">立即执行一次</el-button>
            </div>
            <div class="auto-sync-note">仅在应用打开时生效，关闭应用不会自动提交。</div>
            <div class="auto-sync-status-grid">
              <div>
                <span>下次执行</span>
                <strong>{{ formatDateTime(autoSyncState?.nextRunAt) }}</strong>
              </div>
              <div>
                <span>上次执行</span>
                <strong>{{ formatDateTime(autoSyncState?.lastRunAt || config.autoSync.lastRunAt) }}</strong>
              </div>
              <div>
                <span>上次成功</span>
                <strong>{{ formatDateTime(autoSyncState?.lastSuccessAt || config.autoSync.lastSuccessAt) }}</strong>
              </div>
              <div>
                <span>结果</span>
                <el-tag :type="autoSyncStatusType" effect="plain">{{ autoSyncStatusLabel }}</el-tag>
              </div>
            </div>
            <div v-if="autoSyncState?.lastMessage || config.autoSync.lastMessage" class="auto-sync-message">
              {{ autoSyncState?.lastMessage || config.autoSync.lastMessage }}
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </section>

    <section class="layout">
      <div class="panel repo-panel">
        <div class="panel-title">
          <span>项目列表</span>
          <el-button size="small" :icon="RefreshCw" :loading="loading" @click="refreshRepos">重新扫描</el-button>
        </div>
        <div class="repo-list">
          <button
            v-for="item in repos"
            :key="item.path"
            class="repo-item"
            :class="{ active: selectedRepoPaths.includes(item.path) }"
            @click="toggleRepo(item.path)"
          >
            <div class="repo-item-head">
              <el-checkbox :model-value="selectedRepoPaths.includes(item.path)" @click.stop @change="toggleRepo(item.path)" />
              <strong>{{ item.name }}</strong>
            </div>
            <span>{{ item.path }}</span>
          </button>
          <div v-if="!repos.length" class="empty">暂无仓库，请先选择工作目录</div>
        </div>
      </div>

      <div class="panel preview-panel">
        <div class="panel-title">
          <span>日报预览</span>
          <div class="actions">
            <el-button :icon="Sparkles" type="primary" :loading="loading" @click="generate">生成日报</el-button>
            <el-button :icon="Send" type="success" :loading="pushing" @click="push">同步飞书</el-button>
          </div>
        </div>
        <el-input v-model="report" type="textarea" :rows="24" placeholder="生成结果会显示在这里" />
        <div class="footer-actions">
          <el-button type="primary" :loading="loading" @click="generateAndPush">生成并同步</el-button>
          <span class="status">{{ status }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
