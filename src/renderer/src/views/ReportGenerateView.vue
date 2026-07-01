<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CalendarDays, CheckCircle2, CircleAlert, ClipboardCopy, Download, FileText, Gamepad2, Pin, Plus, RotateCcw, Save, Search, Send, Sparkles, Trash2 } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { RepoInfo } from '@shared/types';

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const assistant = useAssistant();
const {
  config,
  form,
  report,
  status,
  loading,
  pushing,
  sortedRepos,
  selectedRepoPaths,
  selectedRepos,
  projectOptions,
  lastReportResult,
  dailyReports,
  chooseWorkspace,
  generate,
  push,
  saveCurrentReport,
  toggleRepo,
  isRepoPinned,
  toggleRepoPin,
  removeRepo,
  selectFeishuProject,
  updateProjectWorkHours,
  applyFullDayReportRange,
} = assistant;

const activePreviewTab = ref('report');
const reportMode = ref<'concise' | 'full'>('concise');
const conciseReportDraft = ref('');
const conciseDirty = ref(false);
const dateShortcut = ref('today');
const repoKeyword = ref('');
const gameScore = ref(0);
const gameStreak = ref(0);
const gameTarget = ref({ x: 52, y: 48 });
const workHourPresets = [1, 2, 4, 6, 7, 7.5, 8];
const workHourOptions = Array.from({ length: 48 }, (_, index) => (index + 1) * 0.5);
const loadingTips = [
  '正在读取提交记录和影响文件',
  '正在整理时间段工作内容',
  '正在压缩上下文并生成日报',
  '快点中间的小光标，给等待加一点手感',
];

const selectedProjectText = computed(() => {
  if (!selectedRepos.value.length) return '未选择项目';
  return selectedRepos.value.map((repo) => repo.name).join('、');
});

const generatedAtText = computed(() => formatDateTime(lastReportResult.value?.generatedAt || dailyReports.value[0]?.generatedAt));
const commitCount = computed(() => lastReportResult.value?.commits.length ?? 0);
const touchedFiles = computed(() => Array.from(new Set(lastReportResult.value?.commits.flatMap((commit) => commit.files) ?? [])));
const reportLineCount = computed(() => report.value.split(/\r?\n/).filter((line) => line.trim()).length);
const activeReportContent = computed(() => (reportMode.value === 'concise' ? conciseReportDraft.value : report.value));
const loadingTip = computed(() => loadingTips[gameScore.value % loadingTips.length]);
const reportRangeStartMs = computed(() => new Date(form.startDateTime).getTime());
const reportRangeEndMs = computed(() => new Date(form.endDateTime).getTime());
const reportRangeValid = computed(
  () => !Number.isNaN(reportRangeStartMs.value) && !Number.isNaN(reportRangeEndMs.value) && reportRangeStartMs.value < reportRangeEndMs.value,
);
const reportRangeLabel = computed(() => {
  if (!reportRangeValid.value) return '请选择有效时间段';
  return `${formatRangeDateTime(form.startDateTime)} 至 ${formatRangeDateTime(form.endDateTime)}`;
});
const reportTitleRange = computed(() => (reportRangeValid.value ? reportRangeLabel.value : form.date));
const gameTargetStyle = computed(() => ({
  left: `${gameTarget.value.x}%`,
  top: `${gameTarget.value.y}%`,
}));

const metrics = computed(() => [
  { label: '选中仓库', value: selectedRepos.value.length },
  { label: '提交记录', value: commitCount.value },
  { label: '影响文件', value: touchedFiles.value.length },
  { label: '日报行数', value: report.value ? reportLineCount.value : 0 },
]);

const generationRecords = computed(() => dailyReports.value.slice(0, 5));
const selectedRepoSummary = computed(() => {
  if (!selectedRepos.value.length) return '请选择要生成日报的仓库';
  if (selectedRepos.value.length === 1) return selectedRepos.value[0].name;
  return `已选择 ${selectedRepos.value.length} 个仓库`;
});
const filteredRepos = computed(() => {
  const keyword = repoKeyword.value.trim().toLocaleLowerCase();
  if (!keyword) return sortedRepos.value;
  return sortedRepos.value.filter((repo) => `${repo.name} ${repo.path}`.toLocaleLowerCase().includes(keyword));
});
const generationChecks = computed(() => [
  {
    key: 'repo',
    label: '仓库范围',
    ok: selectedRepos.value.length > 0,
    detail: selectedRepos.value.length ? `已选择 ${selectedRepos.value.length} 个仓库` : '未选择仓库',
    action: 'repositories',
    required: true,
  },
  {
    key: 'date',
    label: '日报日期',
    ok: Boolean(form.date),
    detail: form.date || '未选择日期',
    action: '',
    required: true,
  },
  {
    key: 'range',
    label: '提交时间段',
    ok: reportRangeValid.value,
    detail: reportRangeLabel.value,
    action: '',
    required: true,
  },
  {
    key: 'reporter',
    label: '汇报人',
    ok: Boolean(config.reporterName),
    detail: config.reporterName || '未设置汇报人',
    action: 'config',
    required: true,
  },
  {
    key: 'ai',
    label: 'AI 接入',
    ok: Boolean(config.aiBaseUrl && config.aiModel && config.aiApiKey),
    detail: config.aiApiKey ? config.aiModel : '未配置时将使用基础日报模板',
    action: 'config',
    required: false,
  },
]);
const blockedGenerationCheck = computed(() => generationChecks.value.find((item) => item.required && !item.ok));

function extractReportSection(reportText: string, sectionTitle: string) {
  const lines = reportText.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim().replace(/^#+\s*/, '').startsWith(sectionTitle));
  if (startIndex < 0) return '';

  const sectionLines: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    const trimmed = line.trim();
    if (/^(今日工作内容|工作成果|工作时长|明日计划|汇报人|日期)[：:]/.test(trimmed)) {
      break;
    }
    if (trimmed) sectionLines.push(trimmed);
  }
  return sectionLines.join('\n').trim();
}

function buildConciseReport(reportText: string) {
  const workContent = extractReportSection(reportText, '今日工作内容') || reportText.trim();
  return workContent
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean)
    .join('\n');
}

function moveGameTarget() {
  gameTarget.value = {
    x: Math.round(12 + Math.random() * 76),
    y: Math.round(18 + Math.random() * 58),
  };
}

function hitGameTarget() {
  gameScore.value += 1;
  gameStreak.value += 1;
  moveGameTarget();
}

function markConciseDirty() {
  conciseDirty.value = true;
}

watch(report, (value) => {
  if (!conciseDirty.value) {
    conciseReportDraft.value = buildConciseReport(value);
  }
  if (value.trim()) reportMode.value = 'concise';
});

watch(loading, (isLoading) => {
  if (!isLoading) return;
  gameScore.value = 0;
  gameStreak.value = 0;
  moveGameTarget();
});

function formatDateTime(value?: string) {
  if (!value) return '暂无';
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

function formatRangeDateTime(value?: string) {
  if (!value) return '暂无';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeValue(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(date)}T${hour}:${minute}:00`;
}

function setDateShortcut(value: string) {
  dateShortcut.value = value;
  if (value === 'custom') return;
  const now = new Date();
  if (value === 'rolling') {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(9, 0, 0, 0);
    form.date = formatDate(now);
    form.startDateTime = formatDateTimeValue(start);
    form.endDateTime = formatDateTimeValue(now);
    return;
  }
  const date = new Date(now);
  if (value === 'yesterday') date.setDate(date.getDate() - 1);
  applyFullDayReportRange(formatDate(date));
}

function handleReportDateChange() {
  if (form.date) {
    applyFullDayReportRange(form.date);
  }
  dateShortcut.value = 'custom';
}

function handleRangeChange() {
  dateShortcut.value = 'custom';
}

async function handleGenerate() {
  const blocked = blockedGenerationCheck.value;
  if (blocked) {
    ElMessage.warning(`请先完善：${blocked.label}`);
    return;
  }
  if (!config.aiApiKey) {
    ElMessage.info('未配置 AI 接入，将使用基础日报模板生成');
  }
  conciseDirty.value = false;
  await generate();
}

async function copyReport() {
  if (!activeReportContent.value.trim()) {
    ElMessage.warning('当前没有可复制的日报内容');
    return;
  }
  await navigator.clipboard.writeText(activeReportContent.value);
  ElMessage.success('日报内容已复制');
}

function exportMarkdown() {
  if (!activeReportContent.value.trim()) {
    ElMessage.warning('当前没有可导出的日报内容');
    return;
  }
  const blob = new Blob([activeReportContent.value], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `项目日报-${reportMode.value === 'concise' ? '简洁版-' : ''}${form.date}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('Markdown 已导出');
}

async function publishActiveReport() {
  await push(activeReportContent.value);
}

async function confirmRemoveRepo(item: RepoInfo) {
  try {
    await ElMessageBox.confirm(`确定从仓库中心移除「${item.name}」吗？这不会删除本地仓库文件。`, '移除仓库', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await removeRepo(item.path);
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '移除仓库失败');
  }
}
</script>

<template>
  <div class="view-stack">
    <div v-if="loading" class="generation-loading-overlay" aria-live="polite">
      <div class="generation-loading-shell">
        <div class="generation-loading-copy">
          <span class="loading-eyebrow">
            <Sparkles :size="16" />
            生成中
          </span>
          <h2>AI 正在整理所选范围日报</h2>
          <p>{{ loadingTip }}</p>
          <div class="loading-progress">
            <i />
          </div>
        </div>

        <div class="loading-game-panel">
          <div class="loading-game-head">
            <div>
              <strong>等待小游戏</strong>
              <span>点击光标收集灵感点</span>
            </div>
            <div class="loading-game-score">
              <Gamepad2 :size="16" />
              {{ gameScore }}
            </div>
          </div>
          <div class="loading-game-board">
            <span class="loading-game-chip chip-a">commit</span>
            <span class="loading-game-chip chip-b">diff</span>
            <span class="loading-game-chip chip-c">report</span>
            <button type="button" class="loading-game-target" :style="gameTargetStyle" @click="hitGameTarget">
              <Sparkles :size="20" />
            </button>
          </div>
          <p>连续命中 {{ gameStreak }} 次，日报生成完成后会自动关闭。</p>
        </div>
      </div>
    </div>

    <PageHeader title="日报生成" subtitle="基于当前仓库和配置生成日报，支持直接修改、保存、导出和同步飞书">
      <template #actions>
        <el-button :icon="FileText" plain @click="emit('navigate', 'history')">生成记录</el-button>
        <el-button :icon="CalendarDays" plain @click="emit('navigate', 'sync:list')">同步任务</el-button>
      </template>
    </PageHeader>

    <div class="content-grid has-right-panel">
      <div class="view-stack">
        <section class="surface-card step-card">
          <div class="step-title">
            <span>1</span>
            <strong>选择生成范围</strong>
          </div>
          <div class="field-grid">
            <div class="field field-span-3 repo-picker-field">
              <label>选择仓库</label>
              <el-popover placement="bottom-start" trigger="click" :width="620" popper-class="repo-picker-popper">
                <template #reference>
                  <button type="button" class="repo-picker-trigger">
                    <div>
                      <strong>{{ selectedRepoSummary }}</strong>
                      <span>{{ selectedRepos.length ? selectedRepos.map((repo) => repo.name).join('、') : '支持多仓库汇总生成日报' }}</span>
                    </div>
                    <small>{{ selectedRepoPaths.length }}/{{ sortedRepos.length }}</small>
                  </button>
                </template>

                <div class="repo-picker-panel">
                  <div class="repo-picker-head">
                    <div>
                      <strong>仓库选择</strong>
                      <span>当前日报会基于选中的仓库生成</span>
                    </div>
                    <el-button :icon="Plus" type="primary" plain @click="chooseWorkspace">添加仓库</el-button>
                  </div>

                  <el-input v-model="repoKeyword" :prefix-icon="Search" clearable placeholder="搜索仓库名称或路径" />

                  <div class="repo-picker-list">
                    <button v-if="!sortedRepos.length" type="button" class="repo-picker-empty" @click="chooseWorkspace">
                      暂无仓库，点击选择工作目录
                    </button>

                    <div
                      v-for="repo in filteredRepos"
                      :key="repo.path"
                      class="repo-picker-item"
                      :class="{ active: selectedRepoPaths.includes(repo.path), pinned: isRepoPinned(repo.path) }"
                    >
                      <button type="button" class="repo-picker-main" @click="toggleRepo(repo.path)">
                        <span class="repo-picker-check">
                          <CheckCircle2 v-if="selectedRepoPaths.includes(repo.path)" :size="16" />
                        </span>
                        <span class="repo-picker-copy">
                          <strong>{{ repo.name }}</strong>
                          <small>{{ repo.path }}</small>
                        </span>
                      </button>

                      <el-tooltip :content="isRepoPinned(repo.path) ? '取消置顶' : '置顶仓库'" placement="top">
                        <button
                          type="button"
                          class="repo-picker-icon"
                          :class="{ active: isRepoPinned(repo.path) }"
                          :aria-label="isRepoPinned(repo.path) ? `取消置顶 ${repo.name}` : `置顶 ${repo.name}`"
                          :aria-pressed="isRepoPinned(repo.path)"
                          @click.stop="toggleRepoPin(repo.path)"
                        >
                          <Pin :size="15" />
                        </button>
                      </el-tooltip>

                      <el-tooltip content="从列表移除" placement="top">
                        <button type="button" class="repo-picker-icon danger" :aria-label="`移除 ${repo.name}`" @click.stop="confirmRemoveRepo(repo)">
                          <Trash2 :size="15" />
                        </button>
                      </el-tooltip>
                    </div>

                    <div v-if="sortedRepos.length && !filteredRepos.length" class="repo-picker-empty">
                      未找到匹配仓库
                    </div>
                  </div>
                </div>
              </el-popover>
            </div>
            <div class="field">
              <label>日报日期</label>
              <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" :clearable="false" @change="handleReportDateChange" />
            </div>
            <div class="field">
              <label>提交开始</label>
              <el-date-picker
                v-model="form.startDateTime"
                type="datetime"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DDTHH:mm:ss"
                :clearable="false"
                placeholder="开始时间"
                @change="handleRangeChange"
              />
            </div>
            <div class="field">
              <label>提交结束</label>
              <el-date-picker
                v-model="form.endDateTime"
                type="datetime"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DDTHH:mm:ss"
                :clearable="false"
                placeholder="结束时间"
                @change="handleRangeChange"
              />
            </div>
          </div>
          <div class="segmented-actions">
            <button :class="{ active: dateShortcut === 'today' }" @click="setDateShortcut('today')">今天</button>
            <button :class="{ active: dateShortcut === 'yesterday' }" @click="setDateShortcut('yesterday')">昨天</button>
            <button :class="{ active: dateShortcut === 'rolling' }" @click="setDateShortcut('rolling')">昨日9点至现在</button>
            <button :class="{ active: dateShortcut === 'custom' }" @click="setDateShortcut('custom')">自定义范围</button>
          </div>
        </section>

        <section class="surface-card step-card">
          <div class="step-title with-action">
            <div>
              <span>2</span>
              <strong>生成与编辑</strong>
            </div>
            <el-button :icon="Sparkles" type="primary" :loading="loading" @click="handleGenerate">开始生成</el-button>
          </div>
          <div class="generation-check-grid">
            <button
              v-for="item in generationChecks"
              :key="item.key"
              type="button"
              class="generation-check-card"
              :class="{ ready: item.ok, warning: !item.ok && item.required, optional: !item.required }"
              :disabled="!item.action"
              @click="item.action && emit('navigate', item.action)"
            >
              <component :is="item.ok ? CheckCircle2 : CircleAlert" :size="18" />
              <span>
                <strong>{{ item.label }}</strong>
                <small>{{ item.detail }}</small>
              </span>
            </button>
          </div>
          <div class="notice-line">
            <StatusBadge
              status="info"
              :label="selectedRepos.length ? `将基于 ${selectedRepos.length} 个已选仓库和 ${reportRangeLabel} 生成日报` : '请先在当前仓库选择器中选择仓库'"
            />
          </div>
          <div class="metric-grid">
            <div v-for="item in metrics" :key="item.label" class="metric-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <el-tabs v-model="activePreviewTab" class="clean-tabs">
            <el-tab-pane label="日报正文" name="report" />
            <el-tab-pane :label="`提交记录 (${commitCount})`" name="commits" />
            <el-tab-pane :label="`影响文件 (${touchedFiles.length})`" name="files" />
            <el-tab-pane label="原始摘要" name="raw" />
          </el-tabs>

          <article class="report-preview">
            <div class="report-preview-head">
              <h2>{{ selectedProjectText }} {{ reportTitleRange }} 日报</h2>
              <span>生成时间：{{ generatedAtText }}</span>
            </div>

            <div v-if="activePreviewTab === 'report'" class="report-mode-row">
              <div class="report-mode-copy">
                <strong>{{ reportMode === 'concise' ? '简洁版日报' : '完整日报' }}</strong>
                <span>{{ reportMode === 'concise' ? '仅保留今日工作内容，适合直接提交飞书' : '保留完整结构，适合归档和复盘' }}</span>
              </div>
              <div class="report-mode-switch">
                <button type="button" :class="{ active: reportMode === 'concise' }" @click="reportMode = 'concise'">简洁版</button>
                <button type="button" :class="{ active: reportMode === 'full' }" @click="reportMode = 'full'">完整版</button>
              </div>
            </div>

            <el-input
              v-if="activePreviewTab === 'report' && reportMode === 'full'"
              v-model="report"
              class="editable-report"
              type="textarea"
              :rows="18"
              resize="vertical"
              placeholder="生成后的日报会显示在这里，可直接修改后保存"
            />

            <el-input
              v-else-if="activePreviewTab === 'report'"
              v-model="conciseReportDraft"
              class="editable-report concise-report"
              type="textarea"
              :rows="10"
              resize="vertical"
              placeholder="简洁版会自动提取今日工作内容，可手动微调后复制或发布到飞书"
              @input="markConciseDirty"
            />

            <div v-else-if="activePreviewTab === 'commits'" class="data-list">
              <div v-if="!lastReportResult?.commits.length" class="empty-state">暂无提交记录</div>
              <div v-for="commit in lastReportResult?.commits" :key="commit.hash" class="data-list-item">
                <strong>{{ commit.message }}</strong>
                <span>{{ commit.author }} · {{ formatDateTime(commit.date) }} · {{ commit.hash.slice(0, 8) }}</span>
              </div>
            </div>

            <div v-else-if="activePreviewTab === 'files'" class="data-list">
              <div v-if="!touchedFiles.length" class="empty-state">暂无影响文件</div>
              <div v-for="file in touchedFiles" :key="file" class="data-list-item">
                <strong>{{ file }}</strong>
              </div>
            </div>

            <pre v-else>{{ lastReportResult?.rawInput.gitLogs || '暂无原始摘要' }}</pre>
          </article>

          <div class="button-row between">
            <el-button :icon="RotateCcw" plain :loading="loading" @click="handleGenerate">重新生成</el-button>
            <div class="button-row">
              <el-button :icon="Save" plain @click="saveCurrentReport">保存修改</el-button>
              <el-button :icon="ClipboardCopy" plain @click="copyReport">复制内容</el-button>
              <el-button :icon="Download" type="primary" plain @click="exportMarkdown">导出为 Markdown</el-button>
            </div>
          </div>
          <p v-if="status" class="muted-text">{{ status }}</p>
        </section>
      </div>

      <aside class="view-stack">
        <section class="surface-card publish-panel">
          <div class="step-title">
            <span>3</span>
            <strong>发布与同步</strong>
          </div>
          <h3>发布到飞书</h3>
          <div class="publish-hint">
            <span>定时自动同步已移至同步任务统一管理</span>
            <button type="button" @click="emit('navigate', 'sync:list')">去配置</button>
          </div>
          <div class="field">
            <label>选择目标</label>
            <el-select v-model="config.feishuForm.projectOptionId" placeholder="请先获取飞书项目选项" @change="selectFeishuProject">
              <el-option v-for="item in projectOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </div>
          <div class="field">
            <label>工作时长</label>
            <div class="hour-field">
              <el-input-number
                v-model="config.feishuForm.defaultWorkHours"
                :min="0.5"
                :max="24"
                :step="0.5"
                :precision="1"
                controls-position="right"
                @change="updateProjectWorkHours"
              />
              <span>小时</span>
            </div>
            <el-select
              :model-value="Number(config.feishuForm.defaultWorkHours)"
              placeholder="选择工作时长"
              @change="updateProjectWorkHours"
            >
              <el-option
                v-for="hours in workHourOptions"
                :key="hours"
                :label="`${hours}h`"
                :value="hours"
              />
            </el-select>
            <div class="hour-presets">
              <button
                v-for="hours in workHourPresets"
                :key="hours"
                type="button"
                :class="{ active: Number(config.feishuForm.defaultWorkHours) === hours }"
                @click="updateProjectWorkHours(hours)"
              >
                {{ hours }}h
              </button>
            </div>
          </div>
          <el-button :icon="Send" type="primary" :loading="pushing" :disabled="!activeReportContent.trim()" @click="publishActiveReport">
            {{ reportMode === 'concise' ? '立即发布简洁版到飞书' : '立即发布当前内容到飞书' }}
          </el-button>
        </section>

        <section class="surface-card">
          <div class="panel-head">
            <h3>生成记录</h3>
            <el-button link type="primary" @click="emit('navigate', 'history')">查看全部</el-button>
          </div>
          <div class="record-list">
            <div v-if="!generationRecords.length" class="empty-state">暂无生成记录</div>
            <div v-for="item in generationRecords" :key="item.id" class="record-item">
              <StatusBadge :status="item.status === 'failed' ? 'failed' : 'success'" :label="item.status === 'draft' ? '草稿' : item.status === 'success' ? '成功' : '失败'" />
              <div>
                <strong>{{ item.date }} 日报</strong>
                <span>{{ item.repoNames.join('、') || '未记录项目' }} · {{ formatDateTime(item.generatedAt) }}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
