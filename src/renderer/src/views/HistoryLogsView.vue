<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ClipboardCopy, Download, RotateCcw, Search, Send, X } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { DailyReportRecord } from '@shared/types';

type LogStatus = 'success' | 'failed' | 'info';
type LogType = '日报生成' | '手动同步' | '同步任务' | '错误日志';

interface HistoryLog {
  id: string;
  time: string;
  type: LogType;
  project: string;
  action: string;
  status: LogStatus;
  duration: string;
  operator: string;
  trigger: string;
  file?: string;
  detail: string;
  reportRecord?: DailyReportRecord;
}

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const assistant = useAssistant();
const { repos, selectedRepos, config, form, report, currentReportId, lastReportResult, dailyReports, syncLogs, errorLogs, push } = assistant;

const keyword = ref('');
const selectedProject = ref('全部项目');
const selectedType = ref('全部类型');
const selectedStatus = ref('全部状态');
const selectedLog = ref<HistoryLog | null>(null);
const timeRange = ref<[string, string] | null>(null);
const currentPage = ref(1);
const pageSize = ref(10);

const projectOptions = computed(() => {
  const names = new Set<string>();
  for (const repo of repos.value) names.add(repo.name);
  for (const report of dailyReports.value) report.repoNames.forEach((name) => names.add(name));
  return Array.from(names);
});

const logs = computed<HistoryLog[]>(() => {
  const reportLogs = dailyReports.value.map((item): HistoryLog => ({
    id: `report-${item.id}`,
    time: item.updatedAt || item.generatedAt,
    type: '日报生成',
    project: item.repoNames.join('、') || '未记录项目',
    action: `${item.date} 日报${item.status === 'draft' ? '草稿保存' : '生成'}`,
    status: item.status === 'failed' ? 'failed' : 'success',
    duration: '-',
    operator: item.reporterName || config.reporterName || '未设置',
    trigger: '手动触发',
    file: `项目日报-${item.date}.md`,
    detail: item.report,
    reportRecord: item,
  }));

  const syncRecords = syncLogs.value.map((item): HistoryLog => ({
    id: `sync-${item.id}`,
    time: item.ranAt,
    type: item.triggerType === 'scheduled' ? '同步任务' : '手动同步',
    project: selectedRepos.value.map((repo) => repo.name).join('、') || '当前配置项目',
    action: item.message,
    status: item.status === 'success' ? 'success' : item.status === 'failed' ? 'failed' : 'info',
    duration: item.durationMs == null ? '-' : `${Math.round(item.durationMs / 1000)}秒`,
    operator: item.triggerType === 'scheduled' ? '系统' : config.reporterName || '未设置',
    trigger: item.triggerType === 'scheduled' ? '自动触发' : '手动触发',
    detail: item.message,
  }));

  const errors = errorLogs.value.map((item): HistoryLog => ({
    id: `error-${item.id}`,
    time: item.createdAt,
    type: '错误日志',
    project: '系统',
    action: item.message,
    status: 'failed',
    duration: '-',
    operator: '系统',
    trigger: item.scope,
    detail: item.detail || item.message,
  }));

  return [...reportLogs, ...syncRecords, ...errors].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
});

const filteredLogs = computed(() => {
  return logs.value.filter((item) => {
    const text = `${item.action}${item.project}${item.type}${item.detail}`;
    const matchKeyword = !keyword.value || text.includes(keyword.value);
    const matchProject = selectedProject.value === '全部项目' || item.project.includes(selectedProject.value);
    const matchType = selectedType.value === '全部类型' || item.type === selectedType.value;
    const matchStatus =
      selectedStatus.value === '全部状态' ||
      (selectedStatus.value === '成功' && item.status === 'success') ||
      (selectedStatus.value === '失败' && item.status === 'failed');
    const itemTime = new Date(item.time).getTime();
    const matchTime =
      !timeRange.value ||
      (!Number.isNaN(itemTime) &&
        itemTime >= new Date(timeRange.value[0]).getTime() &&
        itemTime <= new Date(`${timeRange.value[1]} 23:59:59`).getTime());
    return matchKeyword && matchProject && matchType && matchStatus && matchTime;
  });
});

const activeLog = computed(() => selectedLog.value || filteredLogs.value[0]);
const pagedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredLogs.value.slice(start, start + pageSize.value);
});

watch([keyword, selectedProject, selectedType, selectedStatus, timeRange], () => {
  currentPage.value = 1;
});

function resetFilters() {
  keyword.value = '';
  selectedProject.value = '全部项目';
  selectedType.value = '全部类型';
  selectedStatus.value = '全部状态';
  timeRange.value = null;
}

function focusFirstLog() {
  selectedLog.value = filteredLogs.value[0] ?? null;
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
  form.date = record.date;
  config.reporterName = record.reporterName || config.reporterName;
  report.value = record.report;
  currentReportId.value = record.id;
  lastReportResult.value = null;
  emit('navigate', 'generate');
  ElMessage.success('已加载到日报生成页，可继续编辑');
}

async function republishActiveReport() {
  const record = activeLog.value?.reportRecord;
  if (!record) {
    ElMessage.warning('请选择一条日报生成记录');
    return;
  }
  form.date = record.date;
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

    <div class="content-grid history-layout">
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
            <el-button type="primary" @click="focusFirstLog">查询</el-button>
          </div>
        </section>

        <section class="surface-card log-table-card">
          <div class="table-summary">共 {{ filteredLogs.length }} 条日志</div>
          <el-table :data="pagedLogs" class="log-table" @row-click="(row: HistoryLog) => (selectedLog = row)">
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
          <div v-if="!filteredLogs.length" class="empty-state">暂无匹配日志</div>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              layout="prev, pager, next, sizes, total"
              :total="filteredLogs.length"
              :page-sizes="[10, 20, 50]"
            />
          </div>
        </section>
      </div>

      <aside class="surface-card detail-panel" v-if="activeLog">
        <div class="panel-head">
          <h3>日志详情</h3>
          <el-button :icon="X" link @click="selectedLog = null" />
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
    </div>
  </div>
</template>
