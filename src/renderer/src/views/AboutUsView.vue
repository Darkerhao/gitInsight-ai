<script setup lang="ts">
import { computed } from 'vue';
import { Copy, FolderOpen, RefreshCw } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import { useAssistant } from '@/composables/useAssistant';

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const assistant = useAssistant();
const { config, repos, dailyReports, syncLogs, errorLogs, storageInfo, refreshLocalData } = assistant;

const metrics = computed(() => [
  { label: '仓库数量', value: repos.value.length },
  { label: '日报记录', value: dailyReports.value.length },
  { label: '同步日志', value: syncLogs.value.length },
  { label: '错误日志', value: errorLogs.value.length },
]);

const healthRows = computed(() => [
  { label: '应用版本', value: storageInfo.value?.appVersion || '-' },
  { label: '本地数据目录', value: storageInfo.value?.userDataPath || '-' },
  { label: '当前汇报人', value: config.reporterName || '未设置' },
  { label: 'AI 模型', value: config.aiModel || '未设置' },
  { label: 'AI Base URL', value: config.aiBaseUrl || '未设置' },
  { label: '密钥保护', value: storageInfo.value?.encryptionAvailable ? '可用' : '不可用' },
]);

async function copyUserDataPath() {
  const path = storageInfo.value?.userDataPath;
  if (!path) {
    ElMessage.warning('暂无可复制的本地路径');
    return;
  }
  await navigator.clipboard.writeText(path);
  ElMessage.success('本地数据目录已复制');
}

async function refreshInfo() {
  await refreshLocalData();
  ElMessage.success('运行信息已刷新');
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="关于我们" subtitle="查看应用能力、运行状态和本地持久化信息。">
      <template #actions>
        <el-button :icon="RefreshCw" plain @click="refreshInfo">刷新数据</el-button>
      </template>
    </PageHeader>

    <section class="surface-card about-hero">
      <div class="about-logo">A</div>
      <div class="about-hero-copy">
        <h2>AI 日报助手</h2>
        <span>基于 Git 变更自动生成日报，并同步至飞书。</span>
        <p>
          系统围绕日报生成、仓库管理、自动同步和日志追踪设计。所有运行结果均优先来自本地真实数据，便于你对生成链路和同步链路进行复盘与定位。
        </p>
      </div>
      <div class="about-badges">
        <span>智能生成</span>
        <span>多仓支持</span>
        <span>本地可审计</span>
        <span>自动同步</span>
      </div>
    </section>

    <div class="content-grid has-right-panel">
      <section class="surface-card">
        <div class="panel-head">
          <h3>运行统计</h3>
        </div>
        <div class="metric-grid">
          <div v-for="item in metrics" :key="item.label" class="metric-card">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="about-info-block">
          <div class="panel-head">
            <h3>系统信息</h3>
          </div>
          <div class="about-kv-list">
            <div v-for="item in healthRows" :key="item.label" class="about-kv-row">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </div>
      </section>

      <aside class="view-stack">
        <section class="surface-card about-side-card">
          <div class="panel-head">
            <h3>快捷操作</h3>
          </div>
          <button class="about-action-btn" @click="emit('navigate', 'config')">
            <FolderOpen :size="16" />
            <span>进入日报配置</span>
          </button>
          <button class="about-action-btn" @click="emit('navigate', 'history')">
            <FolderOpen :size="16" />
            <span>查看历史日志</span>
          </button>
          <button class="about-action-btn" @click="copyUserDataPath">
            <Copy :size="16" />
            <span>复制本地数据目录</span>
          </button>
        </section>

        <section class="surface-card about-side-card">
          <div class="panel-head">
            <h3>产品能力</h3>
          </div>
          <div class="about-feature-list">
            <div>支持多仓库扫描和筛选</div>
            <div>支持日报内容生成与人工编辑</div>
            <div>支持飞书表单测试与正式同步</div>
            <div>支持自动同步状态追踪与错误回溯</div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
