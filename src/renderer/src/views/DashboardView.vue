<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  CheckCircle2,
  CircleAlert,
  CircleX,
  Clock3,
  FilePlus2,
  History,
  Play,
  Send,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts/core';
import { GridComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { LineChart, PieChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, EChartsOption } from 'echarts';
import StatusBadge from '@/components/common/StatusBadge.vue';
import PageHeader from '@/components/common/PageHeader.vue';
import { formatLocalDate, shiftLocalDate } from '@/composables/assistant/dateUtils';
import type { DailyReportRecord } from '@shared/types';
import { useAssistant } from '@/composables/useAssistant';

echarts.use([GridComponent, TitleComponent, TooltipComponent, LineChart, PieChart, CanvasRenderer]);

interface TrendRow {
  date: string;
  label: string;
  done: number;
  failed: number;
  draft: number;
}

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const assistant = useAssistant();
const {
  today,
  config,
  sortedRepos,
  selectedRepos,
  dailyReports,
  syncLogs,
  getAutoSyncTaskState,
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
let themeObserver: MutationObserver | null = null;

const reportDialogVisible = computed({
  get: () => Boolean(selectedReport.value),
  set: (visible: boolean) => {
    if (!visible) selectedReport.value = null;
  },
});

const todayReports = computed(() => dailyReports.value.filter((item) => item.date === today));
const successReportsToday = computed(() => todayReports.value.filter((item) => item.status === 'success'));
const todaySyncLogs = computed(() => syncLogs.value.filter((item) => formatLocalDate(new Date(item.ranAt)) === today));
const overviewCards = computed(() => [
  { key: 'generated', title: '生成成功日报', desc: '今日日报生成成功', value: successReportsToday.value.length, icon: Clock3, tone: 'blue' },
  { key: 'running', title: '执行中任务', desc: '当前实际运行的同步任务', value: config.autoSync.tasks.filter((task) => getAutoSyncTaskState(task.id)?.isRunning).length, icon: Play, tone: 'green' },
  { key: 'published', title: '同步成功次数', desc: '今日成功同步日志条数', value: todaySyncLogs.value.filter((item) => item.status === 'success').length, icon: CheckCircle2, tone: 'amber' },
  { key: 'failed', title: '同步失败次数', desc: '今日失败同步日志条数', value: todaySyncLogs.value.filter((item) => item.status === 'failed').length, icon: CircleX, tone: 'red' },
]);

const recentReports = computed(() => dailyReports.value.slice(0, 5));
const recentExecutionItems = computed(() => {
  const syncItems = syncLogs.value.map((item) => ({
    id: `sync-${item.id}`,
    time: item.ranAt,
    title: item.status === 'failed' ? '日报同步失败' : item.status === 'success' ? '日报同步成功' : '同步任务记录',
    project: item.message,
    status: item.status,
  }));

  return syncItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
});

const trendRows = computed<TrendRow[]>(() => Array.from({ length: 7 }, (_, index) => {
  const date = shiftLocalDate(today, index - 6);
  const reports = dailyReports.value.filter((item) => item.date === date);
  return {
    date, label: date.slice(5),
    done: reports.filter((item) => item.status === 'success').length,
    failed: reports.filter((item) => item.status === 'failed').length,
    draft: reports.filter((item) => item.status === 'draft').length,
  };
}));
const trendMax = computed(() => Math.max(1, ...trendRows.value.flatMap((item) => [item.done, item.failed, item.draft])));
const trendLegend = [
  { key: 'done', label: '生成成功', color: '#22c55e' },
  { key: 'failed', label: '生成失败', color: '#ef4444' },
  { key: 'draft', label: '草稿', color: '#2f80ed' },
];
const projectStats = computed(() => ({
  total: sortedRepos.value.length,
  selected: selectedRepos.value.length,
  unselected: Math.max(0, sortedRepos.value.length - selectedRepos.value.length),
}));
const taskDistribution = computed(() => {
  const running = config.autoSync.tasks.filter((task) => getAutoSyncTaskState(task.id)?.isRunning);
  const idle = config.autoSync.tasks.filter((task) => !running.includes(task));
  const enabled = idle.filter((task) => config.autoSync.enabled && task.enabled).length;
  return {
    total: config.autoSync.tasks.length,
    items: [
      { label: '执行中', value: running.length, color: '#2f80ed' },
      { label: '已启用', value: enabled, color: '#22c55e' },
      { label: '已停用', value: idle.length - enabled, color: '#94a3b8' },
    ],
  };
});
const quickActions = [
  { title: '生成日报', icon: FilePlus2, action: () => emit('navigate', 'generate') },
  { title: '素材日报', icon: FilePlus2, action: () => emit('navigate', 'material') },
  { title: '管理同步任务', icon: Send, action: () => emit('navigate', 'sync') },
  { title: '查看历史日志', icon: History, action: () => emit('navigate', 'history') },
];
const guideSteps = [
  { title: '选择工作来源', desc: '研发选择 Git 仓库；项目和产品经理填写工作素材' },
  { title: '配置 AI 与汇报人', desc: '设置当前 AI 方案和汇报人信息' },
  { title: '生成并校对', desc: '编辑日报后保存，按需发布到飞书' },
  { title: '设置自动同步', desc: '按任务配置仓库、飞书项目和执行时间' },
];

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
  if (status === 'success') return '生成成功';
  if (status === 'failed') return '生成失败';
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
    ruleAdvice.value = '在日报配置中补齐汇报人与飞书字段，在 AI 设置中配置当前方案。研发选择仓库；项目和产品经理进入素材日报填写工作素材。';
  } else if (text.includes('失败')) {
    ruleAdvice.value = '可以先查看最近同步记录和历史日志中的错误详情，重点检查飞书凭证、项目映射和网络连接。';
  } else if (text.includes('飞书') || text.includes('同步')) {
    ruleAdvice.value = '手动发布前请先校对日报正文；自动同步会按任务设置生成日报。两种方式都需要有效的飞书凭证、汇报人和项目映射。';
  } else {
    ruleAdvice.value = '可从最近生成记录开始排查：确认项目选择、日期范围、日报正文，再根据需要执行同步。';
  }
}

function chartColor(variable: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

function createTrendOption(): EChartsOption {
  return {
    color: trendLegend.map((item) => item.color),
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartColor('--c-surface'),
      borderColor: chartColor('--c-border'),
      textStyle: { color: chartColor('--c-text') },
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
      axisLine: { lineStyle: { color: chartColor('--c-border') } },
      axisTick: { show: false },
      axisLabel: { color: chartColor('--c-text-muted'), fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: Math.max(trendMax.value, 4),
      minInterval: 1,
      splitLine: { lineStyle: { color: chartColor('--c-border') } },
      axisLabel: { color: chartColor('--c-text-muted'), fontSize: 12 },
    },
    series: [
      {
        name: '生成成功',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.08 },
        data: trendRows.value.map((item) => item.done),
      },
      {
        name: '生成失败',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3 },
        data: trendRows.value.map((item) => item.failed),
      },
      {
        name: '草稿',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3 },
        data: trendRows.value.map((item) => item.draft),
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
      backgroundColor: chartColor('--c-surface'),
      borderColor: chartColor('--c-border'),
      textStyle: { color: chartColor('--c-text') },
    },
    title: {
      text: String(total),
      subtext,
      left: 'center',
      top: '38%',
      textStyle: { color: chartColor('--c-text'), fontSize: 26, fontWeight: 700 },
      subtextStyle: { color: chartColor('--c-text-muted'), fontSize: 12 },
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
          borderColor: chartColor('--c-surface'),
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
    createDonutOption(projectStats.value.total, '全部仓库', [
      { label: '已选择', value: projectStats.value.selected, color: '#22c55e' },
      { label: '未选择', value: projectStats.value.unselected, color: '#94a3b8' },
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
  themeObserver = new MutationObserver(renderCharts);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

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
  themeObserver?.disconnect();
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
    <PageHeader title="工作台" subtitle="日报和日志分别展示最近最多 50 条记录，统计不代表全部历史。" />
    <section class="dashboard-overview surface-card">
      <div v-for="card in overviewCards" :key="card.key" class="dashboard-stat" :class="`tone-${card.tone}`" :data-stat="card.key">
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
              <h3>近 7 天日报状态</h3>
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
              <h3>仓库选择</h3>
            </div>
            <div class="donut-summary">
              <div ref="projectChartRef" class="dashboard-echart donut-chart" />
              <div class="donut-list">
                <span><i class="dot-green" />已选择 {{ projectStats.selected }}</span>
                <span><i class="dot-gray" />未选择 {{ projectStats.unselected }}</span>
                <el-button link type="primary" @click="emit('navigate', 'repositories')">管理仓库</el-button>
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
            <el-table-column label="状态" width="125">
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
              <h3>同步任务分布</h3>
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
              <el-button v-for="item in quickActions" :key="item.title" @click="item.action">
                <component :is="item.icon" :size="24" />
                <span>{{ item.title }}</span>
              </el-button>
            </div>
          </section>
        </div>
      </main>

      <aside class="dashboard-aside">
        <section class="surface-card dashboard-panel">
          <div class="panel-head">
            <h3>最近同步记录</h3>
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
          <el-steps class="dashboard-guide" direction="vertical" :active="-1">
            <el-step v-for="step in guideSteps" :key="step.title" :title="step.title" :description="step.desc" />
          </el-steps>
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
            <el-button @click="askRuleAdvice('如何配置日报生成规则？')">如何配置日报生成规则？</el-button>
            <el-button @click="askRuleAdvice('如何同步到飞书？')">如何同步到飞书？</el-button>
            <el-button @click="askRuleAdvice('日报生成失败怎么办？')">日报生成失败怎么办？</el-button>
          </div>
        </section>
      </aside>
    </div>

    <el-dialog v-model="reportDialogVisible" width="min(720px, 95vw)" title="日报详情" append-to-body>
      <div v-if="selectedReport" class="dashboard-report-detail">
        <div class="report-preview-head">
          <h2>{{ selectedReport.repoNames.join('、') || '未记录项目' }} {{ selectedReport.date }} 日报</h2>
          <StatusBadge :status="badgeStatus(selectedReport.status)" :label="statusLabel(selectedReport.status)" />
        </div>
        <pre>{{ selectedReport.report }}</pre>
      </div>
    </el-dialog>

    <div class="button-row end">
      <el-button :icon="FilePlus2" @click="emit('navigate', 'generate')">生成日报</el-button>
      <el-button :icon="Send" type="primary" @click="emit('navigate', 'sync')">管理同步任务</el-button>
    </div>
  </div>
</template>
