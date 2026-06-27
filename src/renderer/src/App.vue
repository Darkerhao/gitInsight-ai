<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { FolderSearch, LogIn, Send, Sparkles, RefreshCw, Settings2, TestTube2, Trash2 } from 'lucide-vue-next';
import { DEFAULT_AI_BASE_URL_OPTIONS, DEFAULT_AI_MODEL_OPTIONS, DEFAULT_FEISHU_FORM_CONFIG } from '@shared/types';
import type { AppConfig, FeishuProjectOption, RepoInfo } from '@shared/types';

const today = new Date().toISOString().slice(0, 10);
const loading = ref(false);
const pushing = ref(false);
const feishuLoading = ref(false);
const projectLoading = ref(false);
const repos = ref<RepoInfo[]>([]);
const projectOptions = ref<FeishuProjectOption[]>([]);
const selectedRepoPaths = ref<string[]>([]);
const report = ref('');
const status = ref('');
const advancedConfigPanels = ref<string[]>([]);

const config = reactive<AppConfig>({
  workspaceDir: '',
  workspaceDirs: [],
  reporterName: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiBaseUrlOptions: [...DEFAULT_AI_BASE_URL_OPTIONS],
  aiModelOptions: [...DEFAULT_AI_MODEL_OPTIONS],
  feishuForm: { ...DEFAULT_FEISHU_FORM_CONFIG },
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

function normalizeOptions(options: string[]) {
  return Array.from(new Set(options.map((item) => item.trim()).filter(Boolean)));
}

function normalizeWorkspaceDirs(options: string[]) {
  return Array.from(new Set(options.map((item) => item.trim()).filter(Boolean)));
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

async function scanWorkspaceDirs(workspaceDirs: string[]) {
  const scannedGroups = await Promise.all(workspaceDirs.map((workspaceDir) => window.api.scanRepositories(workspaceDir)));
  return scannedGroups.flat();
}

const aiBaseUrlOptions = computed(() => mergeCurrentOption(config.aiBaseUrlOptions, config.aiBaseUrl));
const aiModelOptions = computed(() => mergeCurrentOption(config.aiModelOptions, config.aiModel));

const selectedRepos = computed(() => repos.value.filter((item) => selectedRepoPaths.value.includes(item.path)));

function getConfigPayload(): AppConfig {
  const workspaceDirs = getWorkspaceDirs();
  return {
    workspaceDir: config.workspaceDir,
    workspaceDirs,
    reporterName: config.reporterName,
    aiBaseUrl: config.aiBaseUrl,
    aiApiKey: config.aiApiKey,
    aiModel: config.aiModel,
    aiBaseUrlOptions: normalizeOptions([...config.aiBaseUrlOptions, config.aiBaseUrl]),
    aiModelOptions: normalizeOptions([...config.aiModelOptions, config.aiModel]),
    feishuForm: {
      ...DEFAULT_FEISHU_FORM_CONFIG,
      ...config.feishuForm,
    },
  };
}

async function loadConfig() {
  const saved = await window.api.loadConfig();
  Object.assign(config, {
    ...saved,
    feishuForm: {
      ...DEFAULT_FEISHU_FORM_CONFIG,
      ...saved.feishuForm,
    },
  });
  if (!form.date) form.date = today;
  config.aiBaseUrlOptions = normalizeOptions(config.aiBaseUrlOptions.length ? config.aiBaseUrlOptions : [...DEFAULT_AI_BASE_URL_OPTIONS]);
  config.aiModelOptions = normalizeOptions(config.aiModelOptions.length ? config.aiModelOptions : [...DEFAULT_AI_MODEL_OPTIONS]);
  config.workspaceDirs = normalizeWorkspaceDirs([...(config.workspaceDirs ?? []), config.workspaceDir]);
  advancedConfigPanels.value = [
    ...(!config.aiApiKey ? ['ai'] : []),
    ...(!config.feishuForm.shareToken || !config.feishuForm.cookie || !config.feishuForm.csrfToken ? ['feishu'] : []),
  ];
  if (config.feishuForm.shareToken) {
    await loadFeishuProjects();
  }
  if (config.workspaceDirs.length) {
    await refreshRepos();
  }
}

async function chooseWorkspace() {
  const dir = await window.api.selectDirectory();
  if (!dir) return;
  config.workspaceDir = dir;
  config.workspaceDirs = normalizeWorkspaceDirs([...config.workspaceDirs, dir]);
  await window.api.saveConfig(getConfigPayload());
  loading.value = true;
  try {
    const scannedRepos = await scanWorkspaceDirs([dir]);
    repos.value = mergeRepos(repos.value, scannedRepos);
    selectedRepoPaths.value = normalizeRepoSelections([...selectedRepoPaths.value, ...scannedRepos.map((repo) => repo.path)]);
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
    status.value = `已扫描到 ${repos.value.length} 个仓库`;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '扫描失败');
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  await window.api.saveConfig(getConfigPayload());
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
  if (!config.feishuForm.cookie || !config.feishuForm.csrfToken) {
    ElMessage.warning('请先填写飞书 Cookie 和 x-csrftoken');
    return;
  }
  pushing.value = true;
  try {
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

function toggleRepo(path: string) {
  const hasSelected = selectedRepoPaths.value.includes(path);
  if (hasSelected) {
    selectedRepoPaths.value = selectedRepoPaths.value.filter((item) => item !== path);
    return;
  }
  selectedRepoPaths.value = [...selectedRepoPaths.value, path];
}

onMounted(loadConfig);
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
