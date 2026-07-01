<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  CheckCircle2,
  CircleAlert,
  CircleX,
  Clock3,
  FilePlus2,
  FileText,
  History,
  Layers3,
  Play,
  RefreshCw,
  Send,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts/core';
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { LineChart, PieChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, EChartsOption } from 'echarts';
import StatusBadge from '@/components/common/StatusBadge.vue';
import type { DailyReportRecord } from '@shared/types';
import { useAssistant } from '@/composables/useAssistant';

echarts.use([GridComponent, LegendComponent, TitleComponent, TooltipComponent, LineChart, PieChart, CanvasRenderer]);

interface TrendRow {
  date: string;
  label: string;
  done: number;
  failed: number;
  running: number;
}

const emit = defineEmits<{
  (e: 'navigate', value: 'config' | 'generate' | 'sync' | 'history' | 'repositories'): void;
}>();

const assistant = useAssistant();
const {
  today,
  config,
  loading,
  autoSyncLoading,
  sortedRepos,
  selectedRepos,
  dailyReports,
  syncLogs,
  errorLogs,
  autoSyncRunning,
  chooseWorkspace,
  generate,
  runAutoSyncNow,
} = assistant;

const selectedReport = ref<DailyReportRecord | null>(null);
const ruleQuestion = ref('');
const ruleAdvice = ref('规则建议会根据配置、同步、失败等关键词给出排查方向。');
const trendChartRef = ref<HTMLDivElement | null>(null);
const projectChartRef = ref<HTMLDivElement | null>(null);
const taskChartRef = ref<HTMLDivElement | null>(null);
let trendChart: ECharts | null = null;
let projectChart: ECharts | null = null;
let taskChart: ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

const reportDialogVisible = computed({
  get: () => Boolean(selectedReport.value),
  set: (visible: boolean) => {
    if (!visible) selectedReport.value = null;
  },
});

const todayReports = computed(() => dailyReports.value.filter((item) => item.date === today));
const todaySyncLogs = computed(() => syncLogs.value.filter((item) => item.date === today));
const successReportsToday = computed(() => todayReports.value.filter((item) => item.status === 'success'));
const failedReportsToday = computed(() => todayReports.value.filter((item) => item.status === 'failed'));

const pendingCount = computed(() => {
  const completedRepoPaths = new Set(successReportsToday.value.flatMap((item) => item.repoPaths));
  const pendingRepos = selectedRepos.value.filter((repo) => !completedRepoPaths.has(repo.path)).length;
  const drafts = todayReports.value.filter((item) => item.status === 'draft').length;
  return pendingRepos + drafts;
});

const runningCount = computed(() => (autoSyncRunning.value ? 1 : 0));
const doneCount = computed(() => {
  const synced = todaySyncLogs.value.filter((item) => item.status === 'success').length;
  return synced || successReportsToday.value.length;
});
const failedCount = computed(() => failedReportsToday.value.length + todaySyncLogs.value.filter((item) => item.status === 'failed').length);

const overviewCards = computed(() => [
  { key: 'pending', title: '待执行', desc: '今日待执行任务', value: pendingCount.value, icon: Clock3, tone: 'blue' },
  { key: 'running', title: '执行中', desc: '正在执行的任务', value: runningCount.value, icon: Play, tone: 'green' },
  { key: 'done', title: '已完成', desc: '今日已完成任务', value: doneCount.value, icon: CheckCircle2, tone: 'amber' },
  { key: 'failed', title: '失败', desc: '今日失败任务', value: failedCount.value, icon: CircleX, tone: 'red' },
]);

const recentReports = computed(() => dailyReports.value.slice(0, 5));
const recentExecutionItems = computed(() => {
  const reportItems = dailyReports.value.map((item) => ({
    id: `report-${item.id}`,
    time: item.generatedAt,
    title: item.status === 'failed' ? '日报生成失败' : '日报生成成功',
    project: item.repoNames.join('、') || '未记录项目',
    status: item.status,
  }));

  const syncItems = syncLogs.value.map((item) => ({
    id: `sync-${item.id}`,
    time: item.ranAt,
    title: item.status === 'failed' ? '日报同步失败' : item.status === 'success' ? '日报同步成功' : '同步任务记录',
    project: item.message,
    status: item.status,
  }));

  return [...reportItems, ...syncItems].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
});

const trendRows = computed<TrendRow[]>(() => {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const value = formatDateValue(date);
    const reports = dailyReports.value.filter((item) => item.date === value);
    const logs = syncLogs.value.filter((item) => item.date === value);
    return {
      date: value,
      label: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      done: reports.filter((item) => item.status === 'success').length + logs.filter((item) => item.status === 'success').length,
      failed: reports.filter((item) => item.status === 'failed').length + logs.filter((item) => item.status === 'failed').length,
      running: value === today && autoSyncRunning.value ? 1 : logs.filter((item) => item.status === 'running').length,
    };
  });
});

const trendMax = computed(() => Math.max(1, ...trendRows.value.flatMap((item) => [item.done, item.failed, item.running])));
const trendLegend = [
  { key: 'done', label: '完成', color: '#22c55e' },
  { key: 'failed', label: '失败', color: '#ef4444' },
  { key: 'running', label: '执行中', color: '#2f80ed' },
];

const projectTotal = computed(() => Math.max(sortedRepos.value.length, selectedRepos.value.length, 0));
const projectCompleted = computed(() => {
  const completedRepoPaths = new Set(successReportsToday.value.flatMap((item) => item.repoPaths));
  return sortedRepos.value.filter((repo) => completedRepoPaths.has(repo.path)).length;
});
const projectRunning = computed(() => Math.min(runningCount.value, projectTotal.value));
const projectPending = computed(() => Math.max(projectTotal.value - projectCompleted.value - projectRunning.value, 0));
const projectStats = computed(() => {
  const total = Math.max(projectTotal.value, 1);
  return {
    total: projectTotal.value,
    running: projectRunning.value,
    completed: projectCompleted.value,
    pending: projectPending.value,
    runningPercent: Math.round((projectRunning.value / total) * 100),
    completedPercent: Math.round((projectCompleted.value / total) * 100),
    pendingPercent: Math.round((projectPending.value / total) * 100),
  };
});

const taskDistribution = computed(() => {
  const reportCount = dailyReports.value.length;
  const syncCount = syncLogs.value.length;
  const errorCount = errorLogs.value.length;
  const total = reportCount + syncCount + errorCount;
  return {
    total,
    items: [
      { label: '日报生成', value: reportCount, color: '#2f80ed' },
      { label: '同步任务', value: syncCount, color: '#22c55e' },
      { label: '异常处理', value: errorCount, color: '#94a3b8' },
    ],
  };
});

const generationBlocker = computed(() => {
  if (!selectedRepos.value.length) return { message: '请先选择参与日报生成的项目', target: 'repositories' as const };
  if (!config.reporterName) return { message: '请先填写汇报人', target: 'config' as const };
  return null;
});

const syncBlocker = computed(() => {
  const baseBlocker = generationBlocker.value;
  if (baseBlocker) return baseBlocker;
  const form = config.feishuForm;
  if (!form.projectOptionId) return { message: '请先选择飞书所属项目', target: 'config' as const };
  if (!form.reporterUserId) return { message: '请先填写飞书汇报人 userId', target: 'config' as const };
  if (!form.questionId || !form.dateFieldId || !form.userFieldId || !form.projectFieldId || !form.hoursFieldId || !form.contentFieldId) {
    return { message: '请先补齐飞书表单字段映射', target: 'config' as const };
  }
  return null;
});

async function runCheckedGenerate() {
  const blocker = generationBlocker.value;
  if (blocker) {
    ElMessage.warning(blocker.message);
    emit('navigate', blocker.target);
    return;
  }
  await generate();
}

async function runCheckedSync() {
  const blocker = syncBlocker.value;
  if (blocker) {
    ElMessage.warning(blocker.message);
    emit('navigate', blocker.target);
    return;
  }
  await runAutoSyncNow();
}

const quickActions = [
  { title: '生成日报', icon: FilePlus2, action: () => emit('navigate', 'generate') },
  { title: '按当前范围生成', icon: Layers3, action: () => runCheckedGenerate() },
  { title: '同步到飞书', icon: Send, action: () => runCheckedSync() },
  { title: '查看历史日志', icon: History, action: () => emit('navigate', 'history') },
];

const guideSteps = [
  { title: '配置日报规则', desc: '填写项目路径，选择项目类型等基本信息' },
  { title: '配置 AI 接入', desc: '配置飞书连接信息，确保数据同步' },
  { title: '设置自动同步', desc: '设置定时任务，自动生成并同步日报' },
  { title: '生成日报', desc: '手动或自动生成日报并同步到飞书' },
];

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

function statusLabel(status: string) {
  if (status === 'success') return '成功';
  if (status === 'failed') return '失败';
  if (status === 'draft') return '草稿';
  if (status === 'running') return '执行中';
  if (status === 'skipped') return '已跳过';
  return '信息';
}

function badgeStatus(status: string) {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'running') return 'running';
  return 'info';
}

function askRuleAdvice(question?: string) {
  const text = (question || ruleQuestion.value).trim();
  if (!text) {
    ElMessage.warning('请输入需要排查的关键词');
    return;
  }
  ruleQuestion.value = text;
  if (text.includes('配置')) {
    ruleAdvice.value = '建议先进入日报配置，补齐汇报人、AI 接入和飞书表单字段，再回到工作台执行生成。';
  } else if (text.includes('失败')) {
    ruleAdvice.value = '可以先查看今日执行状态和历史日志中的错误详情，重点检查飞书凭证、项目映射和网络连接。';
  } else if (text.includes('飞书') || text.includes('同步')) {
    ruleAdvice.value = '同步前请确认已生成日报正文，并且飞书 shareToken、cookie、csrfToken 与项目选项仍然有效。';
  } else {
    ruleAdvice.value = '可从最近生成记录开始排查：确认项目选择、日期范围、日报正文，再根据需要执行同步。';
  }
}

function createTrendOption(): EChartsOption {
  return {
    color: trendLegend.map((item) => item.color),
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#e3e7ef',
      textStyle: { color: '#1f2937' },
    },
    grid: {
      left: 34,
      right: 18,
      top: 20,
      bottom: 34,
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel',
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendRows.value.map((item) => item.label),
      axisLine: { lineStyle: { color: '#e3e7ef' } },
      axisTick: { show: false },
      axisLabel: { color: '#7b8496', fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: Math.max(trendMax.value, 4),
      minInterval: 1,
      splitLine: { lineStyle: { color: '#edf1f7' } },
      axisLabel: { color: '#7b8496', fontSize: 12 },
    },
    series: [
      {
        name: '完成',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.08 },
        data: trendRows.value.map((item) => item.done),
      },
      {
        name: '失败',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3 },
        data: trendRows.value.map((item) => item.failed),
      },
      {
        name: '执行中',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3 },
        data: trendRows.value.map((item) => item.running),
      },
    ],
  };
}

function createDonutOption(total: number, subtext: string, items: { label: string; value: number; color: string }[]): EChartsOption {
  const hasData = items.some((item) => item.value > 0);
  return {
    color: items.map((item) => item.color),
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: '#ffffff',
      borderColor: '#e3e7ef',
      textStyle: { color: '#1f2937' },
    },
    title: {
      text: String(total),
      subtext,
      left: 'center',
      top: '38%',
      textStyle: { color: '#111827', fontSize: 26, fontWeight: 700 },
      subtextStyle: { color: '#6b7280', fontSize: 12 },
    },
    series: [
      {
        name: subtext,
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderColor: '#ffffff',
          borderWidth: 3,
          borderRadius: 6,
        },
        data: hasData ? items.map((item) => ({ name: item.label, value: item.value })) : [{ name: '暂无数据', value: 1, itemStyle: { color: '#cbd5e1' } }],
      },
    ],
  };
}

function renderCharts() {
  if (!trendChart || !projectChart || !taskChart) return;

  trendChart.setOption(createTrendOption(), true);
  projectChart.setOption(
    createDonutOption(projectStats.value.total, '全部项目', [
      { label: '进行中', value: projectStats.value.running, color: '#2f80ed' },
      { label: '已完成', value: projectStats.value.completed, color: '#22c55e' },
      { label: '待处理', value: projectStats.value.pending, color: '#94a3b8' },
    ]),
    true,
  );
  taskChart.setOption(createDonutOption(taskDistribution.value.total, '全部任务', taskDistribution.value.items), true);
}

function resizeCharts() {
  trendChart?.resize();
  projectChart?.resize();
  taskChart?.resize();
}

onMounted(async () => {
  await nextTick();
  if (trendChartRef.value) trendChart = echarts.init(trendChartRef.value);
  if (projectChartRef.value) projectChart = echarts.init(projectChartRef.value);
  if (taskChartRef.value) taskChart = echarts.init(taskChartRef.value);
  renderCharts();

  resizeObserver = new ResizeObserver(() => resizeCharts());
  [trendChartRef.value, projectChartRef.value, taskChartRef.value].forEach((el) => {
    if (el) resizeObserver?.observe(el);
  });
  window.addEventListener('resize', resizeCharts);
});

watch([trendRows, trendMax, projectStats, taskDistribution], async () => {
  await nextTick();
  renderCharts();
  resizeCharts();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  resizeObserver?.disconnect();
  trendChart?.dispose();
  projectChart?.dispose();
  taskChart?.dispose();
  trendChart = null;
  projectChart = null;
  taskChart = null;
});
</script>

<template>
  <div class="dashboard-view">
    <section class="dashboard-overview surface-card">
      <div v-for="card in overviewCards" :key="card.key" class="dashboard-stat" :class="`tone-${card.tone}`">
        <div class="dashboard-stat-icon">
          <component :is="card.icon" :size="20" />
        </div>
        <div>
          <span>{{ card.title }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.desc }}</small>
        </div>
      </div>
    </section>

    <div class="dashboard-layout">
      <main class="dashboard-main">
        <div class="dashboard-chart-grid">
          <section class="surface-card dashboard-panel">
            <div class="panel-head">
              <h3>任务趋势</h3>
              <el-select model-value="近7天" size="small" class="dashboard-range-select">
                <el-option label="近7天" value="近7天" />
              </el-select>
            </div>
            <div class="trend-legend">
              <span v-for="item in trendLegend" :key="item.key">
                <i :style="{ backgroundColor: item.color }" />
                {{ item.label }}
              </span>
            </div>
            <div ref="trendChartRef" class="trend-chart dashboard-echart" />
          </section>

          <section class="surface-card dashboard-panel">
            <div class="panel-head">
              <h3>项目统计</h3>
            </div>
            <div class="donut-summary">
              <div ref="projectChartRef" class="dashboard-echart donut-chart" />
              <div class="donut-list">
                <span><i class="dot-blue" />进行中 {{ projectStats.running }} ({{ projectStats.runningPercent }}%)</span>
                <span><i class="dot-green" />已完成 {{ projectStats.completed }} ({{ projectStats.completedPercent }}%)</span>
                <span><i class="dot-gray" />待处理 {{ projectStats.pending }} ({{ projectStats.pendingPercent }}%)</span>
              </div>
            </div>
          </section>
        </div>

        <section class="surface-card dashboard-panel">
          <div class="panel-head">
            <h3>最近生成的日报</h3>
            <el-button link type="primary" @click="emit('navigate', 'history')">查看全部</el-button>
          </div>
          <el-table :data="recentReports" class="dashboard-table">
            <el-table-column label="项目名称" min-width="220">
              <template #default="{ row }">{{ row.repoNames.join('、') || '未记录项目' }}</template>
            </el-table-column>
            <el-table-column prop="date" label="日报日期" width="140" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <StatusBadge :status="badgeStatus(row.status)" :label="statusLabel(row.status)" />
              </template>
            </el-table-column>
            <el-table-column label="生成时间" width="120">
              <template #default="{ row }">{{ formatDateTime(row.generatedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template #default="{ row }">
                <el-button link type="primary" @click="selectedReport = row">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="!recentReports.length" class="empty-state">暂无生成记录，可先创建日报任务</div>
        </section>

        <div class="dashboard-bottom-grid">
          <section class="surface-card dashboard-panel">
            <div class="panel-head">
              <h3>任务分布</h3>
            </div>
            <div class="donut-summary">
              <div ref="taskChartRef" class="dashboard-echart donut-chart" />
              <div class="donut-list">
                <span v-for="item in taskDistribution.items" :key="item.label">
                  <i :style="{ backgroundColor: item.color }" />
                  {{ item.label }} {{ item.value }}
                </span>
              </div>
            </div>
          </section>

          <section class="surface-card dashboard-panel">
            <div class="panel-head">
              <h3>快捷操作</h3>
            </div>
            <div class="quick-action-grid">
              <button v-for="item in quickActions" :key="item.title" type="button" @click="item.action">
                <component :is="item.icon" :size="24" />
                <span>{{ item.title }}</span>
              </button>
            </div>
          </section>
        </div>
      </main>

      <aside class="dashboard-aside">
        <section class="surface-card dashboard-panel">
          <div class="panel-head">
            <h3>今日执行状态</h3>
            <el-button link type="primary" @click="emit('navigate', 'history')">查看全部</el-button>
          </div>
          <div class="execution-list">
            <div v-for="item in recentExecutionItems" :key="item.id" class="execution-item">
              <component :is="item.status === 'failed' ? CircleAlert : CheckCircle2" :size="18" :class="badgeStatus(item.status)" />
              <div>
                <strong>{{ item.title }}</strong>
                <span>{{ item.project }}</span>
              </div>
              <time>{{ formatDateTime(item.time) }}</time>
            </div>
            <div v-if="!recentExecutionItems.length" class="empty-state">暂无执行记录</div>
          </div>
        </section>

        <section class="surface-card dashboard-panel">
          <div class="panel-head">
            <h3>快速开始</h3>
          </div>
          <ol class="dashboard-guide">
            <li v-for="(step, index) in guideSteps" :key="step.title">
              <span>{{ index + 1 }}</span>
              <div>
                <strong>{{ step.title }}</strong>
                <p>{{ step.desc }}</p>
              </div>
            </li>
          </ol>
          <el-button class="full-width" plain type="primary" @click="emit('navigate', 'sync')">配置同步计划</el-button>
        </section>

        <section class="dashboard-assistant-card">
          <div class="dashboard-assistant-head">
            <CircleAlert :size="24" />
            <div>
              <h3>规则建议</h3>
              <p>按关键词给出工作流排查方向</p>
            </div>
          </div>
          <el-input v-model="ruleQuestion" placeholder="输入配置、同步、失败等关键词" @keyup.enter="askRuleAdvice()" />
          <el-button type="primary" :icon="Send" @click="askRuleAdvice()" />
          <p>{{ ruleAdvice }}</p>
          <div class="assistant-questions">
            <button type="button" @click="askRuleAdvice('如何配置日报生成规则？')">如何配置日报生成规则？</button>
            <button type="button" @click="askRuleAdvice('如何同步到飞书？')">如何同步到飞书？</button>
            <button type="button" @click="askRuleAdvice('日报生成失败怎么办？')">日报生成失败怎么办？</button>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog v-model="reportDialogVisible" width="720px" title="日报详情">
      <div v-if="selectedReport" class="dashboard-report-detail">
        <div class="report-preview-head">
          <h2>{{ selectedReport.repoNames.join('、') || '未记录项目' }} {{ selectedReport.date }} 日报</h2>
          <StatusBadge :status="badgeStatus(selectedReport.status)" :label="statusLabel(selectedReport.status)" />
        </div>
        <pre>{{ selectedReport.report }}</pre>
      </div>
    </el-dialog>

    <div class="dashboard-floating-actions">
      <el-button :icon="RefreshCw" :loading="loading" @click="runCheckedGenerate">生成日报</el-button>
      <el-button :icon="Send" type="primary" :loading="autoSyncLoading" @click="runCheckedSync">同步日报</el-button>
      <el-button v-if="!sortedRepos.length" :icon="FileText" plain @click="chooseWorkspace">添加项目</el-button>
    </div>
  </div>
</template>
