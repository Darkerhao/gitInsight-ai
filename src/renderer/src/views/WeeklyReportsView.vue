<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CalendarDays, ExternalLink } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import { useWeeklyReports } from '@/composables/useWeeklyReports';
import { checkWeeklyReportQuality, findWeeklyDuplicateKeys } from '@shared/weeklyReportQuality';
import WeeklyReportSetupSection from '@/components/weekly/WeeklyReportSetupSection.vue';
import WeeklyReportEditorSection from '@/components/weekly/WeeklyReportEditorSection.vue';
import WeeklyReportPublishSection from '@/components/weekly/WeeklyReportPublishSection.vue';
import { createWeeklyReportRecentConfig } from '@/composables/weeklyReportRecentConfig';

const emit = defineEmits<{
  (event: 'navigate', value: string): void;
}>();
const {
  sortedRepos, projectOptions, projectLoading, feishuLoading, dateRange, selectedRepoPaths, drafts,
  activeDraftKey, loading, pushing, status, selectedRepos, activeDraft, activeReportModel, draftGroups,
  generatedDrafts, dirtyDrafts, pendingPublishDrafts, publishableDrafts, generatedHoursTotal, dateRangeLabel,
  displayRepoName, handleDateRangeChange, formatDateLabel, getStatusLabel, getStatusType, getHoursSourceLabel,
  updateDraftProject, updateDraftHours, recalculateWorkHours, generateAll, generateCurrent, saveCurrent, saveAll, publishCurrent,
  publishAll, retryFailed, generateAndPublish, openSubmissionRecords, loadFeishuProjects, countWeeklyReportFiles,
} = useWeeklyReports();
type WorkflowStage = 'scope' | 'generate' | 'publish';
const activeStage = ref<WorkflowStage>('scope');
const publishCheckVisible = ref(false);
const autoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const showEvidence = ref(false);
const showSupplement = ref(false);
const supplementText = ref('');
const recentRepoPaths = ref<string[]>([]);
const recentDateRange = ref<[string, string] | null>(null);
const templateKey = ref('standard');
const recentConfig = createWeeklyReportRecentConfig({ dateRange, selectedRepoPaths, recentRepoPaths, recentDateRange, restoring: ref(false), sortedRepos });
const recentRepos = computed(() => recentRepoPaths.value
  .map((path) => sortedRepos.value.find((repo) => repo.path === path))
  .filter((repo): repo is NonNullable<typeof repo> => Boolean(repo)));
const duplicateKeys = computed(() => findWeeklyDuplicateKeys(drafts.value.map((draft) => ({
  key: draft.key, date: draft.date, projectName: displayRepoName(draft.repo), report: draft.report,
  commitsCount: draft.result?.commits.length ?? 0, filesCount: countWeeklyReportFiles(draft.result),
}))));
const activeQuality = computed(() => {
  const draft = activeDraft.value;
  return draft ? checkWeeklyReportQuality({
    key: draft.key, date: draft.date, projectName: displayRepoName(draft.repo), report: draft.report,
    commitsCount: draft.result?.commits.length ?? 0, filesCount: countWeeklyReportFiles(draft.result),
  }) : null;
});
const workflowStages = [
  { key: 'scope' as const, index: '01', label: '范围' },
  { key: 'generate' as const, index: '02', label: '生成' },
  { key: 'publish' as const, index: '03', label: '发布' },
];
const generationProgress = computed(() => ({
  total: drafts.value.length,
  completed: drafts.value.filter((draft) => draft.generateStatus === 'success' || draft.generateStatus === 'failed').length,
  success: drafts.value.filter((draft) => draft.generateStatus === 'success').length,
  failed: drafts.value.filter((draft) => draft.generateStatus === 'failed').length,
  generating: drafts.value.filter((draft) => draft.generateStatus === 'generating').length,
}));
const workflowState = computed(() => ({
  scope: selectedRepos.value.length && dateRangeLabel.value !== '请选择有效日期范围' ? 'done' : 'current',
  generate: generationProgress.value.generating ? 'current' : generationProgress.value.completed === generationProgress.value.total && generationProgress.value.total ? (generationProgress.value.failed ? 'warning' : 'done') : 'current',
  publish: generatedDrafts.value.length && pendingPublishDrafts.value.length === 0 ? 'done' : generatedDrafts.value.length ? 'current' : 'pending',
} as Record<WorkflowStage, 'done' | 'current' | 'warning' | 'pending'>));
const publishCheckStats = computed(() => ({
  publishable: publishableDrafts.value.length,
  total: generatedDrafts.value.length,
  dirty: dirtyDrafts.value.length,
  missingTarget: generatedDrafts.value.filter((draft) => !draft.projectOptionId.trim()).length,
  unresolvedHours: generatedDrafts.value.filter((draft) => draft.workHoursSource === 'unresolved').length,
  totalHours: publishableDrafts.value.reduce((sum, draft) => sum + draft.workHours, 0),
}));
const publishIssues = computed(() => [
  publishCheckStats.value.missingTarget ? `${publishCheckStats.value.missingTarget} 条日报未选择飞书项目` : '',
  publishCheckStats.value.unresolvedHours ? `${publishCheckStats.value.unresolvedHours} 条日报需要确认工作时长` : '',
  publishCheckStats.value.dirty ? `${publishCheckStats.value.dirty} 条日报有未保存修改，发布前会自动保存` : '',
].filter(Boolean));

function stageLabel(stage: WorkflowStage) {
  const state = workflowState.value[stage];
  if (stage === 'scope') return state === 'done' ? '已完成' : '待完善';
  if (stage === 'generate') return generationProgress.value.total ? `${generationProgress.value.success}/${generationProgress.value.total} 已生成` : '待生成';
  return pendingPublishDrafts.value.length ? `${publishableDrafts.value.length} 条可发布` : generatedDrafts.value.length ? '已完成' : '待发布';
}

function scrollToStage(stage: WorkflowStage) {
  activeStage.value = stage;
  document.querySelector<HTMLElement>(`[data-weekly-stage="${stage}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectDraft(key: string) {
  if (key === activeDraftKey.value) return;
  const current = activeDraft.value;
  if (!current?.dirty) {
    activeDraftKey.value = key;
    return;
  }
  void ElMessageBox.confirm('当前日报有未保存修改，切换前先保存吗？', '未保存修改', {
    confirmButtonText: '保存并切换', cancelButtonText: '暂不切换', type: 'warning',
  }).then(async () => {
    await saveCurrent();
    if (!current.dirty) activeDraftKey.value = key;
  }).catch(() => undefined);
}

function scheduleAutoSave() {
  if (!activeDraft.value?.dirty || !activeDraft.value.report.trim()) return;
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
  autoSaveTimer.value = setTimeout(async () => {
    autoSaveTimer.value = null;
    if (!activeDraft.value?.dirty) return;
    await saveCurrent();
    status.value = `${displayRepoName(activeDraft.value.repo)} ${activeDraft.value.date} 已自动保存`;
  }, 900);
}

function openPublishCheck() {
  if (!publishableDrafts.value.length) {
    ElMessage.warning('没有可发布的日报，请先生成内容并补齐目标和工时');
    return;
  }
  publishCheckVisible.value = true;
}

function confirmPublishAll() {
  publishCheckVisible.value = false;
  void publishAll();
}

function reuseLastConfig() {
  ElMessage.success(recentConfig.reuse() ? '已沿用上次日期和项目范围' : '暂无可沿用的上次配置');
}

function applyTemplate(key: string) {
  const templates: Record<string, string> = {
    standard: '今日工作内容：\n\n1. \n\n工作成果：\n\n1. \n\n明日计划：\n\n1. ',
    concise: '今日工作内容：\n\n1. \n\n工作成果：\n\n1. ',
    detailed: '今日工作内容：\n\n1. \n\n问题与处理：\n\n1. \n\n工作成果：\n\n1. \n\n明日计划：\n\n1. ',
  };
  if (!activeDraft.value) return;
  activeReportModel.value = templates[key] ?? templates.standard;
  ElMessage.success('已插入日报模板，请补充具体内容');
}

function appendSupplement() {
  const value = supplementText.value.trim();
  if (!value || !activeDraft.value) return;
  const base = activeDraft.value.report.trim();
  activeReportModel.value = `${base}${base ? '\n\n' : ''}补充工作：\n${value.split(/\r?\n/).map((line) => `- ${line.trim()}`).join('\n')}`;
  supplementText.value = '';
  showSupplement.value = false;
  ElMessage.success('已补充到当前日报');
}

watch(activeReportModel, scheduleAutoSave);
onMounted(() => {
  recentConfig.load();
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('keydown', handleKeydown);
});
watch([dateRange, selectedRepoPaths], recentConfig.save, { deep: true });
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('keydown', handleKeydown);
});
function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirtyDrafts.value.length) return;
  event.preventDefault();
  event.returnValue = '';
}

function handleKeydown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    void saveCurrent();
  } else if (event.key === 'Enter' && activeDraft.value?.report.trim()) {
    event.preventDefault();
    void publishCurrent();
  }
}
</script>

<template>
  <div class="view-stack weekly-reports-view atelier-page">
    <PageHeader title="一周日报" subtitle="按日期与项目批量生成、编辑和提交研发日报">
      <template #actions>
        <el-button :icon="ExternalLink" plain :loading="feishuLoading" @click="openSubmissionRecords">查看飞书记录</el-button>
        <el-button :icon="CalendarDays" plain @click="emit('navigate', 'config')">日报配置</el-button>
      </template>
    </PageHeader>

    <nav class="weekly-workflow-rail" aria-label="一周日报工作流">
      <button
        v-for="stage in workflowStages"
        :key="stage.key"
        type="button"
        class="weekly-workflow-step"
        :class="[{ active: activeStage === stage.key }, `is-${workflowState[stage.key]}`]"
        @click="scrollToStage(stage.key)"
      >
        <span>{{ stage.index }}</span>
        <strong>{{ stage.label }}</strong>
        <small>{{ stageLabel(stage.key) }}</small>
      </button>
    </nav>

    <WeeklyReportSetupSection
      :class="{ 'weekly-range-locked': loading || pushing }"
      :date-range="dateRange"
      :date-range-label="dateRangeLabel"
      :sorted-repos="sortedRepos"
      :selected-repo-paths="selectedRepoPaths"
      :selected-repos="selectedRepos"
      :recent-repos="recentRepos"
      :drafts="drafts"
      :generated-drafts="generatedDrafts"
      :generated-hours-total="generatedHoursTotal"
      :loading="loading"
      :pushing="pushing"
      :status="status"
      :generation-progress="generationProgress"
      :display-repo-name="displayRepoName"
      :format-status-label="getStatusLabel"
      @update:date-range="dateRange = $event"
      @update:selected-repo-paths="selectedRepoPaths = $event"
      @date-range-change="handleDateRangeChange"
      @reuse-last-config="reuseLastConfig"
      @recalculate-hours="() => recalculateWorkHours(true)"
      @generate-all="generateAll"
      @generate-and-publish="generateAndPublish"
    />

    <WeeklyReportEditorSection
      :draft-groups="draftGroups"
      :selected-repos="selectedRepos"
      :active-draft="activeDraft"
      :active-report-model="activeReportModel"
      :template-key="templateKey"
      :dirty-drafts="dirtyDrafts"
      :project-options="projectOptions"
      :project-loading="projectLoading"
      :loading="loading"
      :pushing="pushing"
      :active-quality="activeQuality"
      :duplicate-keys="duplicateKeys"
      :display-repo-name="displayRepoName"
      :format-date-label="formatDateLabel"
      :get-status-label="getStatusLabel"
      :get-status-type="getStatusType"
      :get-hours-source-label="getHoursSourceLabel"
      :count-weekly-report-files="countWeeklyReportFiles"
      @select-draft="selectDraft"
      @update:active-report-model="activeReportModel = $event"
      @update:template-key="templateKey = $event"
      @refresh-projects="loadFeishuProjects()"
      @update-project="updateDraftProject"
      @update-hours="updateDraftHours"
      @apply-template="applyTemplate(templateKey)"
      @show-supplement="showSupplement = true"
      @show-evidence="showEvidence = true"
      @generate-current="generateCurrent"
      @save-current="saveCurrent"
      @publish-current="publishCurrent"
    />


    <WeeklyReportPublishSection
      :publishable-drafts="publishableDrafts"
      :generated-drafts="generatedDrafts"
      :dirty-drafts="dirtyDrafts"
      :pending-publish-drafts="pendingPublishDrafts"
      :drafts="drafts"
      :project-options="projectOptions"
      :pushing="pushing"
      :publish-check-visible="publishCheckVisible"
      :publish-check-stats="publishCheckStats"
      :publish-issues="publishIssues"
      :active-draft="activeDraft"
      :show-evidence="showEvidence"
      :show-supplement="showSupplement"
      :supplement-text="supplementText"
      :display-repo-name="displayRepoName"
      :get-hours-source-label="getHoursSourceLabel"
      :get-status-type="getStatusType"
      :get-status-label="getStatusLabel"
      :count-weekly-report-files="countWeeklyReportFiles"
      @update:publish-check-visible="publishCheckVisible = $event"
      @update:show-evidence="showEvidence = $event"
      @update:show-supplement="showSupplement = $event"
      @update:supplement-text="supplementText = $event"
      @recalculate-hours="() => recalculateWorkHours(true)"
      @save-all="saveAll"
      @retry-failed="retryFailed"
      @open-publish-check="openPublishCheck"
      @select-draft="selectDraft"
      @update-project="updateDraftProject"
      @confirm-publish-all="confirmPublishAll"
      @append-supplement="appendSupplement"
    />
  </div>
</template>
