<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { BrainCog, CalendarDays, FileText } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import ReportEditorCard from '@/components/report-generate/ReportEditorCard.vue';
import ReportGenerationLoadingOverlay from '@/components/report-generate/ReportGenerationLoadingOverlay.vue';
import ReportPublishSidebar from '@/components/report-generate/ReportPublishSidebar.vue';
import ReportSetupCard from '@/components/report-generate/ReportSetupCard.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { ProjectReportDraft } from '@/composables/useAssistant';
import { countResultFiles, getReportRangePayloadFromForm, resolveReportTimeRange, toPlainRawInput } from '@/composables/assistant/reportState';
import { normalizeProjectWorkHours, normalizeWorkHours } from '@/composables/assistant/normalizers';
import type { DailyReportRecord, RepoInfo } from '@shared/types';

type DateShortcut = 'today' | 'yesterday' | 'rolling' | 'custom';
type GenerationCheckAction = '' | 'config' | 'ai';

interface GenerationCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  action: GenerationCheckAction;
  required: boolean;
}

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const assistant = useAssistant();
const {
  config,
  form,
  status,
  loading,
  pushing,
  feishuLoading,
  sortedRepos,
  selectedRepoPaths,
  selectedRepos,
  aiProfileOptions,
  activeAiProfile,
  projectOptions,
  activeDraftKey,
  projectDrafts,
  dailyReports,
  chooseWorkspace,
  createProjectReportDraft,
  openFeishuSubmissionRecords,
  removeRepo,
  selectAiProfile,
  persistConfig,
  refreshLocalData,
  toggleRepo,
  isRepoSelected,
  isRepoPinned,
  toggleRepoPin,
  applyFullDayReportRange,
} = assistant;

const dateShortcut = ref<DateShortcut>('today');
const workHourPresets = [1, 2, 4, 6, 7, 7.5, 8, 10];

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

const reportRangeStartMs = computed(() => new Date(form.startDateTime).getTime());
const reportRangeEndMs = computed(() => new Date(form.endDateTime).getTime());
const reportRangeValid = computed(
  () => !Number.isNaN(reportRangeStartMs.value) && !Number.isNaN(reportRangeEndMs.value) && reportRangeStartMs.value < reportRangeEndMs.value,
);

const reportRangeLabel = computed(() => {
  if (!reportRangeValid.value) return '请选择有效时间范围';
  return `${formatRangeDateTime(form.startDateTime)} 至 ${formatRangeDateTime(form.endDateTime)}`;
});

const activeDraft = computed(() => projectDrafts.value.find((item) => item.key === activeDraftKey.value) ?? projectDrafts.value[0]);
const hasAnyReport = computed(() => projectDrafts.value.some((item) => item.report.trim().length > 0));
const hasAnyDirtyReport = computed(() => projectDrafts.value.some((item) => item.dirty && item.report.trim().length > 0));
const activeHasReport = computed(() => Boolean(activeDraft.value?.report.trim()));
const activeHasLastReportResult = computed(() => Boolean(activeDraft.value?.lastReportResult));
const generationRecords = computed(() => dailyReports.value.slice(0, 5));

const activeMetrics = computed(() => {
  const draft = activeDraft.value;
  const result = draft?.lastReportResult ?? null;
  const touchedFiles = Array.from(new Set(result?.commits.flatMap((commit) => commit.files) ?? []));
  const reportLineCount = draft?.report.split(/\r?\n/).filter((line) => line.trim()).length ?? 0;

  return [
    { label: '已生成项目', value: projectDrafts.value.filter((item) => item.report.trim()).length },
    { label: '提交记录', value: result?.commits.length ?? 0 },
    { label: '影响文件', value: touchedFiles.length },
    { label: '正文行数', value: draft?.report ? reportLineCount : 0 },
  ];
});

const editorDrafts = computed(() =>
  projectDrafts.value.map((draft) => ({
    key: draft.key,
    repoName: draft.repo.name,
    repoPath: draft.repo.path,
    report: draft.report,
    hasReport: draft.report.trim().length > 0,
    hasLastReportResult: Boolean(draft.lastReportResult),
    dirty: draft.dirty,
    generateStatus: draft.generateStatus,
    publishStatus: draft.publishStatus,
    reportTitle: `${draft.repo.name} ${form.date || '未选择日期'} 研发日报`,
    reportSubtitle: draft.report.trim() ? reportRangeLabel.value : '生成后的日报会在这里进入可编辑状态',
    generatedAtText: formatDateTime(draft.lastReportResult?.generatedAt),
  })),
);

const activePublishDraft = computed(() => {
  const draft = activeDraft.value;
  if (!draft) return undefined;
  return {
    key: draft.key,
    repoName: draft.repo.name,
    hasReport: draft.report.trim().length > 0,
    projectOptionId: draft.projectOptionId,
    workHours: draft.workHours,
    publishStatus: draft.publishStatus,
    publishMessage: draft.publishMessage,
  };
});

const publishDraftItems = computed(() =>
  projectDrafts.value.map((draft) => ({
    key: draft.key,
    repoName: draft.repo.name,
    hasReport: draft.report.trim().length > 0,
    projectOptionId: draft.projectOptionId,
    workHours: draft.workHours,
    publishStatus: draft.publishStatus,
    publishMessage: draft.publishMessage,
  })),
);

const publishableDrafts = computed(() => projectDrafts.value.filter((item) => item.report.trim() && item.projectOptionId.trim()));
const canPublishActive = computed(() => Boolean(activeDraft.value?.report.trim() && activeDraft.value.projectOptionId.trim() && form.date && !pushing.value));
const canPublishAll = computed(() => Boolean(form.date && publishableDrafts.value.length > 0 && !pushing.value));

const generationChecks = computed<GenerationCheck[]>(() => [
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
    ok: Boolean(activeAiProfile.value.enabled && activeAiProfile.value.baseUrl && activeAiProfile.value.model && activeAiProfile.value.apiKey),
    detail: !activeAiProfile.value.enabled
      ? '当前配置已停用'
      : activeAiProfile.value.apiKey
        ? activeAiProfile.value.model
        : '未配置时将使用基础模板生成',
    action: 'ai',
    required: false,
  },
]);

const requiredGenerationChecks = computed(() => generationChecks.value.filter((item) => item.required));
const completedRequiredCheckCount = computed(() => requiredGenerationChecks.value.filter((item) => item.ok).length);
const blockedGenerationCheck = computed(() => generationChecks.value.find((item) => item.required && !item.ok));
const pendingGenerationChecks = computed(() => generationChecks.value.filter((item) => !item.ok));
const generateButtonLabel = computed(() => {
  if (!projectDrafts.value.length) return '生成全部日报';
  return hasAnyReport.value ? '重新生成全部日报' : `生成 ${projectDrafts.value.length} 个项目日报`;
});
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

watch(
  selectedRepos,
  (repos) => {
    const previousDrafts = new Map(projectDrafts.value.map((draft) => [draft.key, draft]));
    projectDrafts.value = repos.map((repo) => {
      const previous = previousDrafts.get(repo.path);
      if (previous) {
        previous.repo = repo;
        return previous;
      }

      return createProjectReportDraft(repo, {
        repo,
      });
    });

    if (!projectDrafts.value.length) {
      activeDraftKey.value = '';
      return;
    }
    if (!projectDrafts.value.some((item) => item.key === activeDraftKey.value)) {
      activeDraftKey.value = projectDrafts.value[0].key;
    }
  },
  { immediate: true },
);

function getProjectWorkHours(optionId: string) {
  const projectHours = normalizeProjectWorkHours(config.feishuForm.projectWorkHours);
  return normalizeWorkHours(optionId ? projectHours[optionId] : undefined, config.feishuForm.defaultWorkHours);
}

async function persistConfigSnapshot() {
  config.selectedRepoPaths = [...selectedRepoPaths.value];
  config.feishuForm.projectWorkHours = normalizeProjectWorkHours(config.feishuForm.projectWorkHours);
  await persistConfig();
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

function setDateShortcut(value: DateShortcut) {
  const previousDate = form.date;
  const previousStartDateTime = form.startDateTime;
  const previousEndDateTime = form.endDateTime;
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
    resetPublishStateAfterRangeChange(previousDate, previousStartDateTime, previousEndDateTime);
    return;
  }
  const date = new Date(now);
  if (value === 'yesterday') date.setDate(date.getDate() - 1);
  applyFullDayReportRange(formatDate(date));
  resetPublishStateAfterRangeChange(previousDate, previousStartDateTime, previousEndDateTime);
}

function handleReportDateChange(value: string) {
  const previousDate = form.date;
  const previousStartDateTime = form.startDateTime;
  const previousEndDateTime = form.endDateTime;
  form.date = value;
  if (form.date) {
    applyFullDayReportRange(form.date);
  }
  dateShortcut.value = 'custom';
  resetPublishStateAfterRangeChange(previousDate, previousStartDateTime, previousEndDateTime);
}

function resetPublishStateAfterRangeChange(previousDate: string, previousStartDateTime: string, previousEndDateTime: string) {
  const changed = previousDate !== form.date || previousStartDateTime !== form.startDateTime || previousEndDateTime !== form.endDateTime;
  if (!changed) return;

  for (const draft of projectDrafts.value) {
    if (draft.publishStatus === 'success') {
      draft.publishStatus = 'idle';
      draft.publishMessage = '发布日期或提交范围已修改，需要重新发布';
    }
  }
}

function handleRangeChange(previousStartDateTime: string, previousEndDateTime: string) {
  dateShortcut.value = 'custom';
  resetPublishStateAfterRangeChange(form.date, previousStartDateTime, previousEndDateTime);
}

function handleStartDateTimeChange(value: string) {
  const previousStartDateTime = form.startDateTime;
  const previousEndDateTime = form.endDateTime;
  form.startDateTime = value;
  handleRangeChange(previousStartDateTime, previousEndDateTime);
}

function handleEndDateTimeChange(value: string) {
  const previousStartDateTime = form.startDateTime;
  const previousEndDateTime = form.endDateTime;
  form.endDateTime = value;
  handleRangeChange(previousStartDateTime, previousEndDateTime);
}

function getReportRangePayload() {
  return getReportRangePayloadFromForm(form);
}

function getCurrentReportTimeRange(draft: ProjectReportDraft) {
  return resolveReportTimeRange(getReportRangePayload(), reportRangeLabel.value, draft.lastReportResult?.timeRange);
}

function getDraftByKey(key: string) {
  return projectDrafts.value.find((item) => item.key === key);
}

function validateGenerationReady() {
  const blocked = blockedGenerationCheck.value;
  if (blocked) {
    ElMessage.warning(`请先完善：${blocked.label}`);
    if (blocked.action) emit('navigate', blocked.action);
    return false;
  }

  if (!activeAiProfile.value.enabled) {
    ElMessage.info('当前 AI 配置已停用，将使用基础日报模板生成');
  } else if (!activeAiProfile.value.apiKey) {
    ElMessage.info('当前 AI 配置未填写 API Key，将使用基础日报模板生成');
  }
  return true;
}

async function generateDraft(draftKey: string, options: { updateStatus?: boolean } = {}) {
  const draft = getDraftByKey(draftKey);
  if (!draft) return false;

  const reportRange = getReportRangePayload();
  if (!reportRange) {
    ElMessage.warning('请选择有效的提交时间段');
    return false;
  }

  draft.generateStatus = 'generating';
  draft.generateMessage = '';
  draft.publishStatus = 'idle';
  draft.publishMessage = '';
  if (options.updateStatus !== false) status.value = `正在生成 ${draft.repo.name} 的日报`;

  try {
    const result = await window.api.generateReport({
      repoPaths: [draft.repo.path],
      date: form.date,
      ...reportRange,
      reporterName: config.reporterName,
      aiProfileId: config.activeAiProfileId,
    });

    const latestDraft = getDraftByKey(draftKey);
    if (!latestDraft) return false;
    latestDraft.lastReportResult = result;
    latestDraft.reportId = result.historyId ?? null;
    latestDraft.report = result.report;
    latestDraft.generateStatus = 'success';
    latestDraft.generateMessage = '';
    latestDraft.dirty = false;
    if (options.updateStatus !== false) status.value = `${latestDraft.repo.name} 已生成 ${result.commits.length} 条提交记录`;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成失败';
    const latestDraft = getDraftByKey(draftKey);
    if (latestDraft) {
      latestDraft.generateStatus = 'failed';
      latestDraft.generateMessage = message;
    }
    if (options.updateStatus !== false) status.value = `${draft.repo.name} 生成失败：${message}`;
    return false;
  }
}

async function handleGenerateCurrent() {
  const draft = activeDraft.value;
  if (!draft || !validateGenerationReady()) return;

  loading.value = true;
  const draftKey = draft.key;
  try {
    await persistConfigSnapshot();
    const success = await generateDraft(draftKey);
    await refreshLocalData();
    const latestDraft = getDraftByKey(draftKey);
    if (success) {
      activeDraftKey.value = draftKey;
      ElMessage.success(`${latestDraft?.repo.name ?? draft.repo.name} 日报已生成`);
      if (!latestDraft?.lastReportResult?.commits.length) ElMessage.warning('当前项目未匹配到可用于生成日报的提交记录');
    } else {
      ElMessage.error(latestDraft?.generateMessage || '生成失败');
    }
  } finally {
    loading.value = false;
  }
}

async function handleGenerateAll() {
  if (!validateGenerationReady()) return;
  if (!projectDrafts.value.length) {
    ElMessage.warning('请至少选择一个项目');
    return;
  }

  loading.value = true;
  let successCount = 0;
  let failedCount = 0;
  let firstSuccessfulDraftKey = '';
  try {
    await persistConfigSnapshot();
    const draftKeys = projectDrafts.value.map((draft) => draft.key);
    status.value = `正在并发生成 ${draftKeys.length} 个项目日报`;
    const results = await Promise.allSettled(draftKeys.map((draftKey) => generateDraft(draftKey, { updateStatus: false })));
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const success = result.status === 'fulfilled' && result.value;
      if (success) {
        successCount += 1;
        if (!firstSuccessfulDraftKey) firstSuccessfulDraftKey = draftKeys[index];
      } else {
        failedCount += 1;
      }
    }
    await refreshLocalData();
    if (!activeDraft.value?.report.trim() && firstSuccessfulDraftKey) {
      activeDraftKey.value = firstSuccessfulDraftKey;
    }
    if (failedCount) {
      status.value = `已生成 ${successCount} 个项目，${failedCount} 个项目失败`;
      ElMessage.warning(`已生成 ${successCount} 个项目，${failedCount} 个项目失败`);
    } else {
      status.value = `已生成 ${successCount} 个项目日报`;
      ElMessage.success(`已生成 ${successCount} 个项目日报`);
    }
  } finally {
    loading.value = false;
  }
}

async function saveDraft(draft: ProjectReportDraft, options: { silent?: boolean; skipRefresh?: boolean } = {}) {
  const content = draft.report.trim();
  if (!content) {
    if (!options.silent) ElMessage.warning('当前没有可保存的日报内容');
    return null;
  }

  const result = draft.lastReportResult;
  const record = await window.api.saveDailyReport({
    id: draft.reportId ?? undefined,
    date: form.date,
    reporterName: config.reporterName,
    repoNames: result?.repos.map((item) => item.name) ?? [draft.repo.name],
    repoPaths: result?.repos.map((item) => item.path) ?? [draft.repo.path],
    report: content,
    status: result?.commits.length ? 'success' : 'draft',
    commitsCount: result?.commits.length ?? 0,
    filesCount: countResultFiles(result),
    generatedAt: result?.generatedAt,
    timeRange: getCurrentReportTimeRange(draft),
    rawInput: toPlainRawInput(result?.rawInput),
  });

  draft.reportId = record.id;
  draft.dirty = false;
  if (!options.skipRefresh) await refreshLocalData();
  if (!options.silent) ElMessage.success(`${draft.repo.name} 日报已保存`);
  return record;
}

async function handleSaveCurrentReport() {
  const draft = activeDraft.value;
  if (!draft) return;
  try {
    await saveDraft(draft);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存日报失败');
  }
}

async function handleSaveAllReports() {
  const dirtyDrafts = projectDrafts.value.filter((draft) => draft.dirty && draft.report.trim());
  if (!dirtyDrafts.length) {
    ElMessage.info('没有需要保存的修改');
    return;
  }

  try {
    for (const draft of dirtyDrafts) {
      await saveDraft(draft, { silent: true, skipRefresh: true });
    }
    await refreshLocalData();
    ElMessage.success(`已保存 ${dirtyDrafts.length} 个项目的修改`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存全部修改失败');
  }
}

async function copyReport() {
  const draft = activeDraft.value;
  if (!draft?.report.trim()) {
    ElMessage.warning('当前没有可复制的日报内容');
    return;
  }
  await navigator.clipboard.writeText(draft.report);
  ElMessage.success(`${draft.repo.name} 日报内容已复制`);
}

function exportMarkdown() {
  const draft = activeDraft.value;
  if (!draft?.report.trim()) {
    ElMessage.warning('当前没有可导出的日报内容');
    return;
  }
  const blob = new Blob([draft.report], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `研发日报-${draft.repo.name}-${form.date}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
  ElMessage.success('Markdown 已导出');
}

function updateDraftReport(key: string, value: string) {
  const draft = projectDrafts.value.find((item) => item.key === key);
  if (!draft) return;
  draft.report = value;
  draft.dirty = true;
  if (draft.publishStatus === 'success') {
    draft.publishStatus = 'idle';
    draft.publishMessage = '内容已修改，需要重新发布';
  }
}

function handleUpdateActiveDraftKey(value: string) {
  activeDraftKey.value = value;
}

function handleUpdateDraftProject(key: string, optionId: string) {
  const draft = projectDrafts.value.find((item) => item.key === key);
  if (!draft) return;
  draft.projectOptionId = optionId;
  draft.workHours = getProjectWorkHours(optionId);
  draft.publishStatus = 'idle';
  draft.publishMessage = '';
}

function handleUpdateDraftHours(key: string, value: number | undefined) {
  const draft = projectDrafts.value.find((item) => item.key === key);
  if (!draft) return;
  const hours = normalizeWorkHours(value, draft.workHours);
  draft.workHours = hours;
  if (draft.projectOptionId) {
    config.feishuForm.projectWorkHours = {
      ...normalizeProjectWorkHours(config.feishuForm.projectWorkHours),
      [draft.projectOptionId]: hours,
    };
  }
}

function handleCommitDraftHours(key: string, value: number | undefined) {
  handleUpdateDraftHours(key, value);
  void persistConfigSnapshot().catch((error: unknown) => {
    ElMessage.error(error instanceof Error ? error.message : '保存项目工时失败');
  });
}

function buildDraftFeishuConfig(draft: ProjectReportDraft) {
  const projectName = projectOptions.value.find((item) => item.id === draft.projectOptionId)?.name ?? '';
  return {
    ...config.feishuForm,
    projectOptionId: draft.projectOptionId,
    projectName,
    defaultWorkHours: normalizeWorkHours(draft.workHours),
    projectWorkHours: {
      ...normalizeProjectWorkHours(config.feishuForm.projectWorkHours),
      [draft.projectOptionId]: normalizeWorkHours(draft.workHours),
    },
  };
}

async function publishDraft(draft: ProjectReportDraft, options: { persistBeforePublish?: boolean } = {}) {
  const content = draft.report.trim();
  if (!form.date) {
    draft.publishStatus = 'failed';
    draft.publishMessage = '请选择发布日期';
    return false;
  }
  if (!content) {
    draft.publishStatus = 'failed';
    draft.publishMessage = '请先生成日报';
    return false;
  }
  if (!draft.projectOptionId.trim()) {
    draft.publishStatus = 'failed';
    draft.publishMessage = '请选择飞书发布目标';
    return false;
  }

  draft.publishStatus = 'publishing';
  draft.publishMessage = '正在同步到飞书';
  try {
    if (options.persistBeforePublish !== false) await persistConfigSnapshot();
    if (draft.dirty || !draft.reportId) {
      await saveDraft(draft, { silent: true, skipRefresh: true });
    }
    await window.api.syncFeishuDaily({
      config: buildDraftFeishuConfig(draft),
      report: content,
      date: form.date,
      reporterName: config.reporterName,
      workHours: normalizeWorkHours(draft.workHours),
      reportId: draft.reportId ?? undefined,
      triggerType: 'manual',
    });
    draft.publishStatus = 'success';
    draft.publishMessage = '已同步到飞书日报表';
    return true;
  } catch (error) {
    draft.publishStatus = 'failed';
    draft.publishMessage = error instanceof Error ? error.message : '同步飞书失败';
    return false;
  }
}

async function confirmPublishDate(scopeLabel: string) {
  if (!form.date) {
    ElMessage.warning('请选择发布日期');
    return false;
  }

  try {
    await ElMessageBox.confirm(
      h('div', { class: 'publish-date-confirm' }, [
        h('p', ['发布日期：', h('strong', form.date)]),
        h('p', `提交范围：${reportRangeLabel.value}`),
        h('p', `${scopeLabel}将同步到飞书日报表，请确认日期无误。`),
      ]),
      '确认发布日期',
      {
        confirmButtonText: '确认发布',
        cancelButtonText: '返回修改',
        type: 'warning',
      },
    );
    return true;
  } catch (error) {
    if (error === 'cancel' || error === 'close') return false;
    ElMessage.error(error instanceof Error ? error.message : '发布已取消');
    return false;
  }
}

async function publishActiveReport() {
  const draft = activeDraft.value;
  if (!draft) return;
  if (!draft.report.trim()) {
    ElMessage.warning('请先生成日报');
    return;
  }
  if (!draft.projectOptionId.trim()) {
    ElMessage.warning('请选择飞书发布目标');
    return;
  }
  const confirmed = await confirmPublishDate(`当前项目「${draft.repo.name}」`);
  if (!confirmed) return;

  pushing.value = true;
  try {
    const success = await publishDraft(draft);
    await refreshLocalData();
    if (success) ElMessage.success(`${draft.repo.name} 已同步到飞书日报表`);
    else ElMessage.error(draft.publishMessage || '同步飞书失败');
  } finally {
    pushing.value = false;
  }
}

async function publishAllReports() {
  const targets = publishableDrafts.value;
  if (!targets.length) {
    ElMessage.warning('没有可发布的项目，请先生成日报并选择飞书目标');
    return;
  }
  const confirmed = await confirmPublishDate(`共 ${targets.length} 个项目`);
  if (!confirmed) return;

  pushing.value = true;
  let successCount = 0;
  let failedCount = 0;
  try {
    await persistConfigSnapshot();
    for (const draft of targets) {
      const success = await publishDraft(draft, { persistBeforePublish: false });
      if (success) successCount += 1;
      else failedCount += 1;
    }
    await refreshLocalData();
    if (failedCount) {
      ElMessage.warning(`已发布 ${successCount} 个项目，${failedCount} 个项目失败，可切换到失败项目重试`);
    } else {
      ElMessage.success(`已发布 ${successCount} 个项目到飞书`);
    }
  } finally {
    pushing.value = false;
  }
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

  await openFeishuSubmissionRecords(form.date);
}

async function handleToggleRepo(path: string) {
  if (!isRepoSelected(path)) {
    toggleRepo(path);
    return;
  }

  const draft = projectDrafts.value.find((item) => item.key === path);
  if (draft?.report.trim() || draft?.dirty) {
    try {
      await ElMessageBox.confirm(`取消选择「${draft.repo.name}」会移除当前页面内已生成或编辑的日报内容，确认继续？`, '取消选择项目', {
        confirmButtonText: '取消选择',
        cancelButtonText: '保留项目',
        type: 'warning',
      });
    } catch (error) {
      if (error === 'cancel' || error === 'close') return;
      ElMessage.error(error instanceof Error ? error.message : '操作已取消');
      return;
    }
  }

  toggleRepo(path);
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
    <ReportGenerationLoadingOverlay :visible="loading" />

    <PageHeader title="日报生成" subtitle="基于 Git 提交记录生成研发日报">
      <template #actions>
        <el-button :icon="FileText" plain @click="emit('navigate', 'history')">生成记录</el-button>
        <el-button :icon="BrainCog" plain @click="emit('navigate', 'ai')">AI 设置</el-button>
        <el-button :icon="CalendarDays" plain @click="emit('navigate', 'config')">同步配置</el-button>
      </template>
    </PageHeader>

    <div class="content-grid has-right-panel">
      <div class="view-stack">
        <ReportSetupCard
          :active-ai-profile-id="config.activeAiProfileId"
          :form="form"
          :setup-status="setupStatus"
          :setup-status-label="setupStatusLabel"
          :selected-repo-summary="selectedRepoSummary"
          :repo-context-text="repoContextText"
          :report-range-label="reportRangeLabel"
          :readiness-progress-label="readinessProgressLabel"
          :readiness-detail="readinessDetail"
          :selected-repos="selectedRepos"
          :selected-repo-paths="selectedRepoPaths"
          :sorted-repos="sortedRepos"
          :ai-profile-options="aiProfileOptions"
          :date-shortcut="dateShortcut"
          :is-repo-selected="isRepoSelected"
          :is-repo-pinned="isRepoPinned"
          @choose-workspace="chooseWorkspace"
          @select-ai-profile="selectAiProfile"
          @report-date-change="handleReportDateChange"
          @start-date-time-change="handleStartDateTimeChange"
          @end-date-time-change="handleEndDateTimeChange"
          @set-date-shortcut="setDateShortcut"
          @toggle-repo="handleToggleRepo"
          @toggle-repo-pin="toggleRepoPin"
          @remove-repo="confirmRemoveRepo"
        />

        <ReportEditorCard
          :drafts="editorDrafts"
          :active-draft-key="activeDraftKey"
          :status="status"
          :setup-ready="setupReady"
          :readiness-detail="readinessDetail"
          :generate-button-label="generateButtonLabel"
          :loading="loading"
          :generation-checks="generationChecks"
          :metrics="activeMetrics"
          :active-has-report="activeHasReport"
          :active-has-last-report-result="activeHasLastReportResult"
          :can-save-all="hasAnyDirtyReport"
          @update:active-draft-key="handleUpdateActiveDraftKey"
          @update-draft-report="updateDraftReport"
          @generate-all="handleGenerateAll"
          @generate-current="handleGenerateCurrent"
          @save-current="handleSaveCurrentReport"
          @save-all="handleSaveAllReports"
          @copy-current="copyReport"
          @export-current="exportMarkdown"
          @navigate="emit('navigate', $event)"
        />
      </div>

      <ReportPublishSidebar
        :active-draft="activePublishDraft"
        :drafts="publishDraftItems"
        :project-options="projectOptions"
        :generation-records="generationRecords"
        :report-date="form.date"
        :report-range-label="reportRangeLabel"
        :date-shortcut="dateShortcut"
        :can-publish-active="canPublishActive"
        :can-publish-all="canPublishAll"
        :publishable-count="publishableDrafts.length"
        :total-draft-count="projectDrafts.length"
        :pushing="pushing"
        :feishu-loading="feishuLoading"
        :work-hour-presets="workHourPresets"
        :format-date-time="formatDateTime"
        :get-record-status="getRecordStatus"
        @navigate="emit('navigate', $event)"
        @report-date-change="handleReportDateChange"
        @set-date-shortcut="setDateShortcut"
        @update-draft-project="handleUpdateDraftProject"
        @update-draft-hours="handleUpdateDraftHours"
        @commit-draft-hours="handleCommitDraftHours"
        @publish-current="publishActiveReport"
        @publish-all="publishAllReports"
        @open-submission-records="handleOpenFeishuSubmissionRecords"
      />
    </div>
  </div>
</template>
