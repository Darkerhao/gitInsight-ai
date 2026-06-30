<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Bell,
  Database,
  FolderArchive,
  KeyRound,
  Link,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { config, projectOptions, storageInfo, refreshLocalData, saveSettings } = assistant;

const activeTab = ref('basic');

const systemTimezone = computed(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai');
const selectedProject = computed(() => {
  const selected = projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId);
  return selected?.name || config.feishuForm.projectName || '未选择飞书项目';
});
const storageRows = computed(() => [
  { label: '普通配置', path: storageInfo.value?.configPath || '-', size: storageInfo.value?.configSize ?? 0 },
  { label: '加密密钥', path: storageInfo.value?.secretsPath || '-', size: storageInfo.value?.secretsSize ?? 0 },
  { label: '本地数据库', path: storageInfo.value?.databasePath || '-', size: storageInfo.value?.databaseSize ?? 0 },
]);
const dataStats = computed(() => [
  { label: '日报记录', value: storageInfo.value?.reportsCount ?? 0 },
  { label: '同步日志', value: storageInfo.value?.syncLogsCount ?? 0 },
  { label: '错误日志', value: storageInfo.value?.errorLogsCount ?? 0 },
]);

const settingNotes = [
  { icon: Settings, title: '基础设置', desc: '普通配置保存在 config.json，敏感字段不再写入明文配置。' },
  { icon: KeyRound, title: '密钥保护', desc: 'AI Key、Cookie、CSRF Token 使用 Electron safeStorage 加密保存。' },
  { icon: Database, title: '本地数据库', desc: '日报历史、同步日志、错误日志写入 userData/gitinsight.db。' },
  { icon: Link, title: '集成配置', desc: '飞书字段 ID、AI Base URL、AI Model 继续由配置文件维护。' },
  { icon: Bell, title: '同步状态', desc: '自动同步状态来自本地配置和同步日志，可用于后续失败重试。' },
  { icon: ShieldCheck, title: '安全边界', desc: '本地数据只由 Electron main process 读写，渲染层通过 IPC 访问。' },
];

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function refreshStorage() {
  await refreshLocalData();
  ElMessage.success('本地数据状态已刷新');
}

async function resetSettings() {
  await ElMessageBox.confirm('确认将系统设置恢复为默认配置？保存后生效。', '重置配置', { type: 'warning' });
  config.autoSync.enabled = false;
  config.autoSync.time = '18:30';
  config.feishuForm.defaultWorkHours = 8;
  config.feishuForm.projectWorkHours = {};
  ElMessage.success('已恢复默认配置，请保存后生效');
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="系统设置" subtitle="管理系统配置、本地存储和安全状态">
      <template #actions>
        <el-button :icon="RefreshCw" plain @click="refreshStorage">刷新状态</el-button>
      </template>
    </PageHeader>

    <div class="content-grid has-right-panel">
      <section class="surface-card settings-panel">
        <el-tabs v-model="activeTab" class="clean-tabs">
          <el-tab-pane label="基础设置" name="basic" />
          <el-tab-pane label="集成配置" name="integration" />
          <el-tab-pane label="安全设置" name="security" />
          <el-tab-pane label="日志管理" name="logs" />
        </el-tabs>

        <div v-if="activeTab === 'basic'" class="settings-section">
          <div class="panel-head">
            <h3>系统信息</h3>
          </div>
          <div class="field-grid two-columns">
            <div class="field">
              <label>系统名称</label>
              <el-input model-value="AI日报助手" readonly />
            </div>
            <div class="field">
              <label>系统描述</label>
              <el-input model-value="基于配置自动生成日报，支持预览、导出和同步飞书" readonly />
            </div>
            <div class="field">
              <label>系统版本</label>
              <el-input :model-value="storageInfo?.appVersion || '读取中'" readonly />
            </div>
            <div class="field">
              <label>系统时区</label>
              <el-input :model-value="systemTimezone" readonly />
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'integration'" class="settings-section">
          <div class="panel-head">
            <h3>当前配置</h3>
          </div>
          <div class="field-grid three-columns">
            <div class="field">
              <label>工作目录</label>
              <el-input v-model="config.workspaceDir" placeholder="请选择工作目录" />
            </div>
            <div class="field">
              <label>AI Base URL</label>
              <el-input v-model="config.aiBaseUrl" />
            </div>
            <div class="field">
              <label>AI Model</label>
              <el-input v-model="config.aiModel" />
            </div>
            <div class="field">
              <label>默认工时</label>
              <el-input-number v-model="config.feishuForm.defaultWorkHours" :min="0.5" :max="24" :step="0.5" controls-position="right" />
            </div>
            <div class="field">
              <label>自动同步时间</label>
              <el-time-picker v-model="config.autoSync.time" format="HH:mm" value-format="HH:mm" :clearable="false" />
            </div>
            <div class="field">
              <label>飞书项目</label>
              <el-input :model-value="selectedProject" readonly />
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'security'" class="settings-section">
          <div class="panel-head">
            <h3>文件与存储</h3>
            <StatusBadge :status="storageInfo?.encryptionAvailable ? 'success' : 'failed'" :label="storageInfo?.encryptionAvailable ? '密钥保护可用' : '密钥保护不可用'" />
          </div>
          <div class="storage-table">
            <div v-for="item in storageRows" :key="item.label" class="storage-row">
              <strong>{{ item.label }}</strong>
              <span>{{ item.path }}</span>
              <em>{{ formatBytes(item.size) }}</em>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'logs'" class="settings-section">
          <div class="panel-head">
            <h3>本地数据统计</h3>
          </div>
          <div class="metric-grid">
            <div v-for="item in dataStats" :key="item.label" class="metric-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'logs'" class="settings-section">
          <h3>系统操作</h3>
          <div class="operation-grid">
            <button class="operation-card" @click="refreshStorage">
              <RefreshCw :size="18" />
              <strong>刷新本地数据状态</strong>
              <span>重新读取配置文件、数据库记录数量和存储文件大小</span>
            </button>
            <button class="operation-card" @click="resetSettings">
              <Settings :size="18" />
              <strong>重置基础配置</strong>
              <span>恢复自动同步时间和默认工时，保存后写入 config.json</span>
            </button>
          </div>
        </div>

        <div v-if="activeTab === 'basic' || activeTab === 'integration'" class="button-row end">
          <el-button :icon="Save" type="primary" @click="saveSettings">保存设置</el-button>
        </div>
      </section>

      <aside class="view-stack">
        <section class="surface-card">
          <h3>系统设置说明</h3>
          <p class="muted-text">当前采用「本地配置 + SQLite + 本地密钥保护」三层数据模型。</p>
          <div class="settings-note-list">
            <div v-for="item in settingNotes" :key="item.title" class="settings-note-item">
              <component :is="item.icon" :size="18" />
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.desc }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="surface-card help-card">
          <FolderArchive :size="18" />
          <div>
            <strong>本地数据目录</strong>
            <span>{{ storageInfo?.userDataPath || '读取中' }}</span>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
