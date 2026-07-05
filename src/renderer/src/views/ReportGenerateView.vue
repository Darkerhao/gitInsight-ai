<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardCopy,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  FolderGit2,
  ListChecks,
  Pin,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { DailyReportRecord, RepoInfo } from '@shared/types';

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
  feishuLoading,
  sortedRepos,
  selectedRepoPaths,
  selectedRepos,
  projectOptions,
  lastReportResult,
  dailyReports,
  chooseWorkspace,
  generate,
  push,
  openFeishuSubmissionRecords,
  saveCurrentReport,
  toggleRepo,
  isRepoPinned,
  toggleRepoPin,
  removeRepo,
  selectFeishuProject,
  updateProjectWorkHours,
  applyFullDayReportRange,
} = assistant;

const dateShortcut = ref<'today' | 'yesterday' | 'rolling' | 'custom'>('today');
const repoKeyword = ref('');
const workHourPresets = [1, 2, 4, 6, 7, 7.5, 8, 10];
const hasReport = computed(() => report.value.trim().length > 0);
const selectedRepoNames = computed(() => selectedRepos.value.map((repo) => repo.name));
const selectedRepoNamesText = computed(() => selectedRepoNames.value.join('、'));

const selectedRepoSummary = computed(() => {
  if (!selectedRepos.value.length) return '请选择要生成日报的仓库';
  if (selectedRepos.value.length === 1) return selectedRepos.value[0].name;
  return `已选择 ${selectedRepos.value.length} 个仓库`;
});

const repoContextText = computed(() => {
  if (!selectedRepos.value.length) return '尚未选择仓库';
  if (selectedRepos.value.length === 1) return selectedRepos.value[0].path;
  return selectedRepoNamesText.value;
});

const filteredRepos = computed(() => {
  const keyword = repoKeyword.value.trim().toLocaleLowerCase();
  if (!keyword) return sortedRepos.value;
  return sortedRepos.value.filter((repo) => `${repo.name} ${repo.path}`.toLocaleLowerCase().includes(keyword));
});

const reportRangeStartMs = computed(() => new Date(form.startDateTime).getTime());
const reportRangeEndMs = computed(() => new Date(form.endDateTime).getTime());
const reportRangeValid = computed(
  () => !Number.isNaN(reportRangeStartMs.value) && !Number.isNaN(reportRangeEndMs.value) && reportRangeStartMs.value < reportRangeEndMs.value,
);

const reportRangeLabel = computed(() => {
  if (!reportRangeValid.value) return '请选择有效时间范围';
  return `${formatRangeDateTime(form.startDateTime)} 至 ${formatRangeDateTime(form.endDateTime)}`;
});

const generatedAtText = computed(() => formatDateTime(lastReportResult.value?.generatedAt || dailyReports.value[0]?.generatedAt));
const commitCount = computed(() => lastReportResult.value?.commits.length ?? 0);
const touchedFiles = computed(() => Array.from(new Set(lastReportResult.value?.commits.flatMap((commit) => commit.files) ?? [])));
const reportLineCount = computed(() => report.value.split(/\r?\n/).filter((line) => line.trim()).length);

const metrics = computed(() => [
  { label: '已选仓库', value: selectedRepos.value.length },
  { label: '提交记录', value: commitCount.value },
  { label: '影响文件', value: touchedFiles.value.length },
  { label: '正文行数', value: report.value ? reportLineCount.value : 0 },
]);

const generationRecords = computed(() => dailyReports.value.slice(0, 5));
const generationChecks = computed(() => [
  {
    key: 'repo',
    label: '仓库范围',
    ok: selectedRepos.value.length > 0,
    detail: selectedRepos.value.length ? `已选择 ${selectedRepos.value.length} 个仓库` : '尚未选择仓库',
    action: 'config',
    required: true,
  },
  {
    key: 'date',
    label: '日报日期',
    ok: Boolean(form.date),
    detail: form.date || '尚未选择日期',
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
    detail: config.reporterName || '尚未配置汇报人',
    action: 'config',
    required: true,
  },
  {
    key: 'ai',
    label: 'AI 接入',
    ok: Boolean(config.aiBaseUrl && config.aiModel && config.aiApiKey),
    detail: config.aiApiKey ? config.aiModel : '未配置时将使用基础模板生成',
    action: 'config',
    required: false,
  },
]);

const requiredGenerationChecks = computed(() => generationChecks.value.filter((item) => item.required));
const completedRequiredCheckCount = computed(() => requiredGenerationChecks.value.filter((item) => item.ok).length);
const blockedGenerationCheck = computed(() => generationChecks.value.find((item) => item.required && !item.ok));
const pendingGenerationChecks = computed(() => generationChecks.value.filter((item) => !item.ok));
const generateButtonLabel = computed(() => (report.value.trim() ? '重新生成日报' : '开始生成日报'));
const setupReady = computed(() => !blockedGenerationCheck.value);
const setupStatus = computed<'success' | 'pending'>(() => (setupReady.value ? 'success' : 'pending'));
const setupStatusLabel = computed(() => (setupReady.value ? '生成条件就绪' : '待完善'));
const readinessDetail = computed(() => {
  const blocked = blockedGenerationCheck.value;
  if (blocked) return `${blocked.label}：${blocked.detail}`;
  if (pendingGenerationChecks.value.length) return '可生成，建议补齐可选配置以提升日报质量';
  return '仓库、日期、时间段和汇报人均已就绪';
});
const readinessProgressLabel = computed(() => `${completedRequiredCheckCount.value}/${requiredGenerationChecks.value.length} 必填项`);
const reportTitle = computed(() => {
  const repoTitle =
    selectedRepos.value.length > 1 ? `${selectedRepos.value[0].name} 等 ${selectedRepos.value.length} 个仓库` : selectedRepoSummary.value;
  return `${repoTitle} ${form.date || '未选择日期'} 研发日报`;
});
const reportSubtitle = computed(() => (hasReport.value ? reportRangeLabel.value : '生成后的日报会在这里进入可编辑状态'));
const selectedProjectName = computed(
  () => projectOptions.value.find((item) => item.id === config.feishuForm.projectOptionId)?.name || '',
);
const canPublishReport = computed(() => hasReport.value && Boolean(config.feishuForm.projectOptionId));
const publishStatusTitle = computed(() => {
  if (!hasReport.value) return '等待日报正文';
  if (!config.feishuForm.projectOptionId) return '请选择飞书目标';
  return '可发布到飞书';
});
const publishStatusDetail = computed(() => {
  if (!hasReport.value) return '先在左侧生成或编辑日报内容';
  if (!config.feishuForm.projectOptionId) return '选择目标后即可同步到飞书日报表';
  return `目标：${selectedProjectName.value || '已选择项目'}，工时 ${Number(config.feishuForm.defaultWorkHours).toFixed(1)} 小时`;
});

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeValue(date: Date) {
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${formatDate(date)}T${hour}:${minute}:${second}`;
}

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

function setDateShortcut(value: 'today' | 'yesterday' | 'rolling' | 'custom') {
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
    if (blocked.action) emit('navigate', blocked.action);
    return;
  }
  if (!config.aiApiKey) {
    ElMessage.info('未配置 AI 接入，将使用基础日报模板生成');
  }
  await generate();
}

async function handleSaveCurrentReport() {
  if (!hasReport.value) {
    ElMessage.warning('当前没有可保存的日报内容');
    return;
  }
  await saveCurrentReport(report.value);
}

async function copyReport() {
  if (!report.value.trim()) {
    ElMessage.warning('当前没有可复制的日报内容');
    return;
  }
  await navigator.clipboard.writeText(report.value);
  ElMessage.success('日报内容已复制');
}

function exportMarkdown() {
  if (!report.value.trim()) {
    ElMessage.warning('当前没有可导出的日报内容');
    return;
  }
  const blob = new Blob([report.value], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `研发日报-${form.date}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('Markdown 已导出');
}

async function publishActiveReport() {
  if (!hasReport.value) {
    ElMessage.warning('请先生成日报');
    return;
  }
  if (!config.feishuForm.projectOptionId) {
    ElMessage.warning('请选择飞书发布目标');
    return;
  }
  await push(report.value);
}

function getRecordStatus(item: DailyReportRecord) {
  if (item.status === 'draft') return { status: 'pending' as const, label: '草稿' };
  if (item.status === 'success') return { status: 'success' as const, label: '成功' };
  return { status: 'failed' as const, label: '失败' };
}

async function handleOpenFeishuSubmissionRecords() {
  if (!config.feishuForm.endpoint.trim() || !config.feishuForm.shareToken.trim()) {
    ElMessage.warning('请先完成飞书表单连接配置');
    emit('navigate', 'config');
    return;
  }

  await openFeishuSubmissionRecords();
}

async function confirmRemoveRepo(item: RepoInfo) {
  try {
    await ElMessageBox.confirm(`确定从列表中移除「${item.name}」吗？这不会删除本地仓库文件。`, '移除仓库', {
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
  <div class="view-stack report-generate-view">
    <div v-if="loading" class="generation-loading-overlay" aria-live="polite">
      <div class="generation-loading-shell">
        <div class="generation-loading-copy">
          <span class="loading-eyebrow">
            <FileText :size="16" />
            生成中
          </span>
          <h2>AI 正在整理研发日报</h2>
          <p>正在读取提交记录、整理时间范围并生成日报正文。</p>
          <div class="loading-progress">
            <i />
          </div>
        </div>
      </div>
    </div>

    <PageHeader title="日报生成" subtitle="基于 Git 提交记录生成研发日报">
      <template #actions>
        <el-button :icon="FileText" plain @click="emit('navigate', 'history')">生成记录</el-button>
        <el-button :icon="CalendarDays" plain @click="emit('navigate', 'config')">同步配置</el-button>
      </template>
    </PageHeader>

    <div class="content-grid has-right-panel">
      <div class="view-stack">
        <section class="surface-card step-card report-setup-card">
          <div class="step-title with-action">
            <div>
              <span>1</span>
              <strong>选择生成范围</strong>
            </div>
            <StatusBadge :status="setupStatus" :label="setupStatusLabel" />
          </div>

          <div class="report-context-bar">
            <div class="report-context-item">
              <FolderGit2 :size="16" />
              <span>
                <strong>{{ selectedRepoSummary }}</strong>
                <small>{{ repoContextText }}</small>
              </span>
            </div>
            <div class="report-context-item">
              <Clock3 :size="16" />
              <span>
                <strong>提交范围</strong>
                <small>{{ reportRangeLabel }}</small>
              </span>
            </div>
            <div class="report-context-item">
              <ListChecks :size="16" />
              <span>
                <strong>{{ readinessProgressLabel }}</strong>
                <small>{{ readinessDetail }}</small>
              </span>
            </div>
          </div>

          <div class="field-grid">
            <div class="field field-span-3 repo-picker-field">
              <label>选择仓库</label>
              <el-popover placement="bottom-start" trigger="click" :width="620" popper-class="repo-picker-popper">
                <template #reference>
                  <el-button class="repo-picker-trigger">
                    <div class="repo-picker-trigger-copy">
                      <strong>{{ selectedRepoSummary }}</strong>
                      <span>{{ selectedRepos.length ? selectedRepos.map((repo) => repo.name).join('、') : '支持多仓库汇总生成研发日报' }}</span>
                    </div>
                    <small>{{ selectedRepoPaths.length }}/{{ sortedRepos.length }}</small>
                  </el-button>
                </template>

                <div class="repo-picker-panel">
                  <div class="repo-picker-head">
                    <div>
                      <strong>仓库选择</strong>
                      <span>当前日报会基于已选仓库的提交记录生成</span>
                    </div>
                    <el-button :icon="Plus" type="primary" plain @click="chooseWorkspace">添加仓库</el-button>
                  </div>

                  <el-input v-model="repoKeyword" :prefix-icon="Search" clearable placeholder="搜索仓库名称或路径" />

                  <div class="repo-picker-list">
                    <el-button v-if="!sortedRepos.length" class="repo-picker-empty" plain @click="chooseWorkspace">
                      暂无仓库，点击选择工作目录
                    </el-button>

                    <div
                      v-for="repo in filteredRepos"
                      :key="repo.path"
                      class="repo-picker-item"
                      :class="{ active: selectedRepoPaths.includes(repo.path), pinned: isRepoPinned(repo.path) }"
                    >
                      <el-button class="repo-picker-main" @click="toggleRepo(repo.path)">
                        <span class="repo-picker-check">
                          <CheckCircle2 v-if="selectedRepoPaths.includes(repo.path)" :size="16" />
                        </span>
                        <span class="repo-picker-copy">
                          <strong>{{ repo.name }}</strong>
                          <small>{{ repo.path }}</small>
                        </span>
                      </el-button>

                      <el-tooltip :content="isRepoPinned(repo.path) ? '取消置顶' : '置顶仓库'" placement="top">
                        <el-button
                          class="repo-picker-icon"
                          :class="{ active: isRepoPinned(repo.path) }"
                          :aria-label="isRepoPinned(repo.path) ? `取消置顶 ${repo.name}` : `置顶 ${repo.name}`"
                          :aria-pressed="isRepoPinned(repo.path)"
                          plain
                          @click.stop="toggleRepoPin(repo.path)"
                        >
                          <Pin :size="15" />
                        </el-button>
                      </el-tooltip>

                      <el-tooltip content="从列表移除" placement="top">
                        <el-button class="repo-picker-icon danger" :aria-label="`移除 ${repo.name}`" plain @click.stop="confirmRemoveRepo(repo)">
                          <Trash2 :size="15" />
                        </el-button>
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
            <el-button class="segmented-action" :class="{ active: dateShortcut === 'today' }" plain @click="setDateShortcut('today')">
              今天
            </el-button>
            <el-button class="segmented-action" :class="{ active: dateShortcut === 'yesterday' }" plain @click="setDateShortcut('yesterday')">
              昨天
            </el-button>
            <el-button class="segmented-action" :class="{ active: dateShortcut === 'rolling' }" plain @click="setDateShortcut('rolling')">
              昨日 9 点至现在
            </el-button>
            <el-button class="segmented-action" :class="{ active: dateShortcut === 'custom' }" plain @click="setDateShortcut('custom')">
              自定义范围
            </el-button>
          </div>
        </section>

        <section class="surface-card step-card report-editor-card">
          <div class="step-title">
            <span>2</span>
            <strong>生成与编辑</strong>
          </div>

          <div class="generation-toolbar">
            <div class="generation-toolbar-copy">
              <strong>{{ setupReady ? '准备就绪，可以生成' : '生成条件未完成' }}</strong>
              <span>{{ readinessDetail }}</span>
            </div>
            <el-button class="generate-cta" :icon="FileText" type="primary" size="large" :loading="loading" @click="handleGenerate">
              {{ generateButtonLabel }}
            </el-button>
          </div>

          <div class="generation-check-strip">
            <el-button
              v-for="item in generationChecks"
              :key="item.key"
              class="generation-check-chip"
              :class="{ ready: item.ok, warning: item.required && !item.ok, optional: !item.required && !item.ok }"
              :disabled="!item.action"
              plain
              @click="item.action && emit('navigate', item.action)"
            >
              <CheckCircle2 v-if="item.ok" :size="16" />
              <CircleAlert v-else :size="16" />
              <span class="generation-check-copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.ok ? '已就绪' : item.detail }}</small>
              </span>
            </el-button>
          </div>

          <div v-if="lastReportResult" class="metric-grid">
            <div v-for="item in metrics" :key="item.label" class="metric-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>

          <article class="report-preview" :class="{ 'is-empty': !hasReport }">
            <div class="report-preview-head">
              <div>
                <h2>{{ reportTitle }}</h2>
                <span>{{ reportSubtitle }}</span>
              </div>
              <small>生成时间：{{ generatedAtText }}</small>
            </div>

            <div v-if="!hasReport" class="report-empty-panel">
              <FileText :size="30" />
              <strong>等待生成日报正文</strong>
              <span>选择仓库和时间范围后，点击“开始生成日报”，生成结果会在这里进入可编辑状态。</span>
            </div>

            <el-input
              v-else
              v-model="report"
              class="editable-report"
              type="textarea"
              :autosize="{ minRows: 16, maxRows: 28 }"
              resize="vertical"
              placeholder="生成后的研发日报会显示在这里，可直接修改后保存"
            />
          </article>

          <div class="button-row end">
            <el-button :icon="Save" :disabled="!hasReport" plain @click="handleSaveCurrentReport">保存修改</el-button>
            <el-button :icon="ClipboardCopy" :disabled="!hasReport" plain @click="copyReport">复制内容</el-button>
            <el-button :icon="Download" :disabled="!hasReport" type="primary" plain @click="exportMarkdown">导出 Markdown</el-button>
          </div>
          <p v-if="status" class="muted-text">{{ status }}</p>
        </section>
      </div>

      <aside class="view-stack">
        <section class="surface-card publish-panel">
          <div class="step-title with-action">
            <div>
              <span>3</span>
              <strong>发布与同步</strong>
            </div>
            <StatusBadge :status="canPublishReport ? 'success' : 'pending'" :label="canPublishReport ? '可发布' : '待准备'" />
          </div>

          <div class="publish-summary-card" :class="{ ready: canPublishReport }">
            <Send :size="18" />
            <div>
              <strong>{{ publishStatusTitle }}</strong>
              <span>{{ publishStatusDetail }}</span>
            </div>
          </div>

          <div class="publish-hint">
            <span>自动同步、字段映射与定时配置统一在日报配置页维护。</span>
            <el-button link type="primary" @click="emit('navigate', 'config')">去配置</el-button>
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
            <div class="hour-presets">
              <el-button
                v-for="hours in workHourPresets"
                :key="hours"
                class="hour-preset-btn"
                :class="{ active: Number(config.feishuForm.defaultWorkHours) === hours }"
                plain
                size="small"
                @click="updateProjectWorkHours(hours)"
              >
                {{ hours }}h
              </el-button>
            </div>
          </div>
          <el-button :icon="Send" type="primary" :loading="pushing" :disabled="!canPublishReport" @click="publishActiveReport">
            发布研发日报到飞书
          </el-button>
          <el-button class="submission-record-btn" :icon="ExternalLink" plain :loading="feishuLoading" @click="handleOpenFeishuSubmissionRecords">
            查看日报提交记录
          </el-button>
        </section>

        <section class="surface-card record-panel">
          <div class="panel-head">
            <div>
              <h3>生成记录</h3>
              <small>最近 5 条</small>
            </div>
            <el-button link type="primary" @click="emit('navigate', 'history')">查看全部</el-button>
          </div>
          <div class="record-list">
            <div v-if="!generationRecords.length" class="empty-state">暂无生成记录</div>
            <div v-for="item in generationRecords" :key="item.id" class="record-item">
              <StatusBadge :status="getRecordStatus(item).status" :label="getRecordStatus(item).label" />
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
