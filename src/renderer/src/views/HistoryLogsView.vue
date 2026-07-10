<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ClipboardCopy, Download, RotateCcw, Search, Send, X } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { HistoryLogRecord, HistoryLogStatusFilter, HistoryLogTypeFilter } from '@shared/types';

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const assistant = useAssistant();
const { repos, config, currentReportId, dailyReports, push, applyReportTimeRange, loadDailyReportDraft } = assistant;

const keyword = ref('');
const selectedProject = ref('全部项目');
const selectedType = ref<HistoryLogTypeFilter>('全部类型');
const selectedStatus = ref<HistoryLogStatusFilter>('全部状态');
const selectedLog = ref<HistoryLogRecord | null>(null);
const detailVisible = ref(false);
const timeRange = ref<[string, string] | null>(null);
const currentPage = ref(1);
const pageSize = ref(10);
const historyLogs = ref<HistoryLogRecord[]>([]);
const historyProjects = ref<string[]>([]);
const historyTotal = ref(0);
const historyLoading = ref(false);
let historyRequestSeq = 0;

const projectOptions = computed(() => {
  const names = new Set<string>();
  for (const name of historyProjects.value) names.add(name);
  for (const repo of repos.value) names.add(repo.name);
  for (const report of dailyReports.value) report.repoNames.forEach((name) => names.add(name));
  for (const item of historyLogs.value) {
    item.project
      .split('、')
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => names.add(name));
  }
  return Array.from(names);
});

const activeLog = computed(() => selectedLog.value ?? null);

function buildHistoryQuery() {
  return {
    keyword: keyword.value,
    project: selectedProject.value,
    type: selectedType.value,
    status: selectedStatus.value,
    startDate: timeRange.value?.[0],
    endDate: timeRange.value?.[1],
    page: currentPage.value,
    pageSize: pageSize.value,
  };
}

async function loadHistoryLogs(showEmptyMessage = false) {
  const requestSeq = ++historyRequestSeq;
  historyLoading.value = true;
  try {
    const page = await window.api.queryHistoryLogs(buildHistoryQuery());
    if (requestSeq !== historyRequestSeq) return;
    historyLogs.value = page.records;
    historyTotal.value = page.total;
    if (selectedLog.value && !page.records.some((item) => item.id === selectedLog.value?.id)) {
      selectedLog.value = null;
      detailVisible.value = false;
    }
    if (showEmptyMessage && page.total === 0) {
      ElMessage.warning('没有匹配日志');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '未知错误');
    ElMessage.error(`历史日志加载失败：${message}`);
  } finally {
    if (requestSeq === historyRequestSeq) {
      historyLoading.value = false;
    }
  }
}

async function loadHistoryProjects() {
  try {
    historyProjects.value = await window.api.listHistoryProjects();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '未知错误');
    ElMessage.error(`历史项目加载失败：${message}`);
  }
}

watch([keyword, selectedProject, selectedType, selectedStatus, timeRange], () => {
  currentPage.value = 1;
});

watch([currentPage, pageSize], () => {
  void loadHistoryLogs();
});

onMounted(() => {
  void loadHistoryLogs();
  void loadHistoryProjects();
});

async function resetFilters() {
  keyword.value = '';
  selectedProject.value = '全部项目';
  selectedType.value = '全部类型';
  selectedStatus.value = '全部状态';
  timeRange.value = null;
  selectedLog.value = null;
  detailVisible.value = false;
  if (currentPage.value === 1) {
    await loadHistoryLogs();
  } else {
    currentPage.value = 1;
  }
}

function openLogDetail(row: HistoryLogRecord) {
  selectedLog.value = row;
  detailVisible.value = true;
}

async function handleSearch() {
  selectedLog.value = null;
  detailVisible.value = false;
  if (currentPage.value === 1) {
    await loadHistoryLogs(true);
  } else {
    currentPage.value = 1;
  }
}

async function copyActiveLog() {
  if (!activeLog.value?.detail.trim()) {
    ElMessage.warning('当前没有可复制的详情内容');
    return;
  }
  await navigator.clipboard.writeText(activeLog.value.detail);
  ElMessage.success('详情内容已复制');
}

function exportActiveLog() {
  if (!activeLog.value?.detail.trim()) {
    ElMessage.warning('当前没有可导出的详情内容');
    return;
  }
  const blob = new Blob([activeLog.value.detail], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${activeLog.value.file || `${activeLog.value.type}-${activeLog.value.time.slice(0, 10)}.md`}`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('详情内容已导出');
}

function loadActiveReport() {
  const record = activeLog.value?.reportRecord;
  if (!record) {
    ElMessage.warning('请选择一条日报生成记录');
    return;
  }
  applyReportTimeRange(record.date, record.timeRange);
  config.reporterName = record.reporterName || config.reporterName;
  loadDailyReportDraft(record);
  emit('navigate', 'generate');
  ElMessage.success('已加载到日报生成页，可继续编辑');
}

async function republishActiveReport() {
  const record = activeLog.value?.reportRecord;
  if (!record) {
    ElMessage.warning('请选择一条日报生成记录');
    return;
  }
  applyReportTimeRange(record.date, record.timeRange);
  config.reporterName = record.reporterName || config.reporterName;
  currentReportId.value = record.id;
  await push(record.report);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="历史日志" subtitle="查看所有日报生成、同步及错误记录" />

    <div class="content-grid">
      <div class="view-stack">
        <section class="surface-card filter-panel">
          <div class="field-grid">
            <div class="field">
              <label>项目</label>
              <el-select v-model="selectedProject">
                <el-option label="全部项目" value="全部项目" />
                <el-option v-for="item in projectOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </div>
            <div class="field">
              <label>日志类型</label>
              <el-select v-model="selectedType">
                <el-option label="全部类型" value="全部类型" />
                <el-option label="日报生成" value="日报生成" />
                <el-option label="手动同步" value="手动同步" />
                <el-option label="同步任务" value="同步任务" />
                <el-option label="错误日志" value="错误日志" />
              </el-select>
            </div>
            <div class="field">
              <label>状态</label>
              <el-select v-model="selectedStatus">
                <el-option label="全部状态" value="全部状态" />
                <el-option label="成功" value="成功" />
                <el-option label="失败" value="失败" />
              </el-select>
            </div>
            <div class="field">
              <label>时间范围</label>
              <el-date-picker v-model="timeRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" />
            </div>
          </div>
          <div class="filter-actions">
            <el-input v-model="keyword" :prefix-icon="Search" placeholder="请输入操作内容、文件名或其他关键词" />
            <el-button @click="resetFilters">重置</el-button>
            <el-button type="primary" @click="handleSearch">查询</el-button>
          </div>
        </section>

        <section class="surface-card log-table-card">
          <div class="table-summary">共 {{ historyTotal }} 条日志</div>
          <el-table v-loading="historyLoading" :data="historyLogs" class="log-table" @row-click="openLogDetail">
            <el-table-column label="时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
            </el-table-column>
            <el-table-column prop="type" label="日志类型" width="120" />
            <el-table-column prop="project" label="项目" min-width="160" />
            <el-table-column prop="action" label="操作内容" min-width="220" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <StatusBadge :status="row.status" :label="row.status === 'success' ? '成功' : row.status === 'failed' ? '失败' : '信息'" />
              </template>
            </el-table-column>
            <el-table-column prop="duration" label="耗时" width="100" />
            <el-table-column prop="operator" label="操作人" width="110" />
          </el-table>
          <div v-if="!historyLoading && !historyLogs.length" class="empty-state">暂无匹配日志</div>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              layout="prev, pager, next, sizes, total"
              :total="historyTotal"
              :page-sizes="[10, 20, 50]"
            />
          </div>
        </section>
      </div>
    </div>

    <el-drawer
      v-model="detailVisible"
      append-to-body
      body-class="history-detail-drawer-body"
      class="history-detail-drawer"
      direction="rtl"
      size="min(430px, 92vw)"
      :with-header="false"
    >
      <aside class="detail-panel" v-if="activeLog">
        <div class="panel-head">
          <h3>日志详情</h3>
          <el-button :icon="X" link @click="detailVisible = false" />
        </div>
        <div class="detail-actions">
          <el-button :icon="RotateCcw" plain :disabled="!activeLog.reportRecord" @click="loadActiveReport">继续编辑</el-button>
          <el-button :icon="Send" plain :disabled="!activeLog.reportRecord" @click="republishActiveReport">重新发布</el-button>
          <el-button :icon="ClipboardCopy" plain @click="copyActiveLog">复制</el-button>
          <el-button :icon="Download" type="primary" plain @click="exportActiveLog">导出</el-button>
        </div>
        <StatusBadge :status="activeLog.status" :label="activeLog.status === 'success' ? '成功' : activeLog.status === 'failed' ? '失败' : '信息'" />
        <dl class="detail-list">
          <dt>日志类型</dt>
          <dd>{{ activeLog.type }}</dd>
          <dt>操作内容</dt>
          <dd>{{ activeLog.action }}</dd>
          <dt>项目</dt>
          <dd>{{ activeLog.project }}</dd>
          <dt>执行时间</dt>
          <dd>{{ formatDateTime(activeLog.time) }}</dd>
          <template v-if="activeLog.reportRecord?.timeRange">
            <dt>日报时间段</dt>
            <dd>{{ activeLog.reportRecord.timeRange.label }}</dd>
          </template>
          <dt>执行时长</dt>
          <dd>{{ activeLog.duration }}</dd>
          <dt>操作人</dt>
          <dd>{{ activeLog.operator }}</dd>
          <dt>触发方式</dt>
          <dd>{{ activeLog.trigger }}</dd>
          <dt>生成文件</dt>
          <dd>{{ activeLog.file || '-' }}</dd>
        </dl>
        <div class="process-list">
          <h4>详情内容</h4>
          <pre class="log-detail-text">{{ activeLog.detail || '-' }}</pre>
        </div>
      </aside>
    </el-drawer>
  </div>
</template>
