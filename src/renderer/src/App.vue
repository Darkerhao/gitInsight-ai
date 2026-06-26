<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { FolderSearch, Send, Sparkles, RefreshCw, Settings2 } from 'lucide-vue-next';
import type { AppConfig, RepoInfo } from '@shared/types';

const today = new Date().toISOString().slice(0, 10);
const loading = ref(false);
const pushing = ref(false);
const repos = ref<RepoInfo[]>([]);
const selectedRepoPaths = ref<string[]>([]);
const report = ref('');
const status = ref('');

const config = reactive<AppConfig>({
  workspaceDir: '',
  reporterName: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  feishuWebhook: '',
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
    feishuWebhook: config.feishuWebhook,
  };
}

async function loadConfig() {
  const saved = await window.api.loadConfig();
  Object.assign(config, saved);
  if (!form.date) form.date = today;
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
  if (!config.feishuWebhook) {
    ElMessage.warning('请先填写飞书Webhook');
    return;
  }
  pushing.value = true;
  try {
    await window.api.pushFeishu({ webhook: config.feishuWebhook, report: report.value });
    ElMessage.success('已推送飞书');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '推送失败');
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
        <p>Git分析 → AI生成日报 → 飞书推送</p>
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
        <el-input v-model="config.feishuWebhook" placeholder="飞书Webhook地址" />
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
            <el-button :icon="Send" type="success" :loading="pushing" @click="push">推送飞书</el-button>
          </div>
        </div>
        <el-input v-model="report" type="textarea" :rows="24" placeholder="生成结果会显示在这里" />
        <div class="footer-actions">
          <el-button type="primary" :loading="loading" @click="generateAndPush">生成并推送</el-button>
          <span class="status">{{ status }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
