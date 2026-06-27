<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { FolderSearch, LogIn, Send, Sparkles, RefreshCw, Settings2, TestTube2 } from 'lucide-vue-next';
import { DEFAULT_FEISHU_FORM_CONFIG } from '@shared/types';
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

const config = reactive<AppConfig>({
  workspaceDir: '',
  reporterName: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  feishuForm: { ...DEFAULT_FEISHU_FORM_CONFIG },
});

const form = reactive({
  date: today,
});

const reporterOptions = computed(() => {
  return config.reporterName ? [config.reporterName] : [];
});

const selectedRepos = computed(() => repos.value.filter((item) => selectedRepoPaths.value.includes(item.path)));

function getConfigPayload(): AppConfig {
  return {
    workspaceDir: config.workspaceDir,
    reporterName: config.reporterName,
    aiBaseUrl: config.aiBaseUrl,
    aiApiKey: config.aiApiKey,
    aiModel: config.aiModel,
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
  if (config.feishuForm.shareToken) {
    await loadFeishuProjects();
  }
  if (config.workspaceDir) {
    await refreshRepos();
  }
}

async function chooseWorkspace() {
  const dir = await window.api.selectDirectory();
  if (!dir) return;
  config.workspaceDir = dir;
  await window.api.saveConfig(getConfigPayload());
  await refreshRepos();
}

async function refreshRepos() {
  if (!config.workspaceDir) {
    repos.value = [];
    selectedRepoPaths.value = [];
    return;
  }
  loading.value = true;
  try {
    repos.value = await window.api.scanRepositories(config.workspaceDir);
    selectedRepoPaths.value = repos.value.length ? [repos.value[0].path] : [];
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

    <section class="panel">
      <div class="panel-title">
        <span>基础配置</span>
        <el-button size="small" :icon="FolderSearch" @click="chooseWorkspace">选择工作目录</el-button>
      </div>
      <div class="form-grid">
        <el-input v-model="config.workspaceDir" placeholder="例如：D:/workspace" />
        <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
        <el-select v-model="config.reporterName" filterable allow-create placeholder="选择或输入汇报人">
          <el-option v-for="item in reporterOptions" :key="item" :label="item" :value="item" />
        </el-select>
        <el-input v-model="config.aiBaseUrl" placeholder="OpenAI兼容接口地址" />
        <el-input v-model="config.aiModel" placeholder="模型名称" />
        <el-input v-model="config.aiApiKey" type="password" show-password placeholder="API Key" />
        <el-input v-model="config.feishuForm.endpoint" placeholder="飞书表单提交接口地址" />
        <el-input v-model="config.feishuForm.shareToken" placeholder="飞书表单 shareToken" />
        <el-input v-model="config.feishuForm.csrfToken" type="password" show-password placeholder="x-csrftoken" />
        <el-input v-model="config.feishuForm.cookie" type="textarea" :rows="2" placeholder="Cookie（仅保存在本机配置）" />
        <el-input v-model="config.feishuForm.reporterUserId" placeholder="飞书汇报人 userId" />
        <el-input v-model="config.feishuForm.reporterName" placeholder="飞书汇报人名称，留空使用上方汇报人" />
        <el-input v-model="config.feishuForm.reporterAvatarUrl" placeholder="飞书头像地址，可选" />
        <el-select
          v-model="config.feishuForm.projectOptionId"
          filterable
          placeholder="选择所属项目"
          :loading="projectLoading"
          @change="selectFeishuProject"
        >
          <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-input v-model="config.feishuForm.projectName" placeholder="所属项目名称，仅用于备注" />
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
