import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { listWeeklyDates } from '@shared/weeklyReport';
import { getRepoDisplayName } from '@shared/repositoryName';
import type { RepoInfo } from '@shared/types';
import type { useAssistant } from './useAssistant';
import { formatLocalDate, shiftLocalDate } from './assistant/dateUtils';
import { normalizeProjectWorkHours, normalizeWorkHours } from './assistant/normalizers';
import { createWeeklyReportDraft, mergeWeeklyReportDrafts } from './weeklyReportDrafts';
import type { WeeklyReportDraft } from './weeklyReportActions';
import { createWeeklyWorkHoursRecalculator } from './weeklyReportHours';

type Assistant = ReturnType<typeof useAssistant>;

function installDraftSynchronization(state: WeeklyReportState, assistant: Assistant) {
  const syncDrafts = () => {
    state.drafts.value = mergeWeeklyReportDrafts(
      state.drafts.value, state.availableDates.value, state.selectedRepos.value, state.createDraft,
    );
    if (!state.drafts.value.some((draft) => draft.key === state.activeDraftKey.value)) {
      state.activeDraftKey.value = state.drafts.value[0]?.key ?? '';
    }
  };
  watch([state.availableDates, state.selectedRepos], syncDrafts, { immediate: true });
  watch(assistant.sortedRepos, (repos) => {
    if (!state.selectedRepoPaths.value.length && assistant.selectedRepoPaths.value.length) {
      state.selectedRepoPaths.value = [...assistant.selectedRepoPaths.value];
    } else if (!state.selectedRepoPaths.value.length && repos.length === 1) {
      state.selectedRepoPaths.value = [repos[0].path];
    }
  });
}

export function useWeeklyReportState(assistant: Assistant) {
  const today = formatLocalDate(new Date());
  const dateRange = ref<[string, string]>([shiftLocalDate(today, -6), today]);
  const selectedRepoPaths = ref<string[]>([...assistant.selectedRepoPaths.value]);
  const drafts = ref<WeeklyReportDraft[]>([]);
  const activeDraftKey = ref('');
  const loading = ref(false);
  const pushing = ref(false);
  const status = ref('');
  const availableDates = computed(() => listWeeklyDates(dateRange.value[0], dateRange.value[1]));
  const selectedRepos = computed(() => assistant.sortedRepos.value.filter((repo) => selectedRepoPaths.value.includes(repo.path)));
  const activeDraft = computed(() => drafts.value.find((draft) => draft.key === activeDraftKey.value) ?? drafts.value[0]);
  const activeReportModel = computed({ get: () => activeDraft.value?.report ?? '', set: (value) => updateDraftReport(state, activeDraft.value?.key ?? '', value) });
  const draftGroups = computed(() => availableDates.value.map((date) => ({ date, items: drafts.value.filter((draft) => draft.date === date) })));
  const generatedDrafts = computed(() => drafts.value.filter((draft) => draft.report.trim()));
  const dirtyDrafts = computed(() => generatedDrafts.value.filter((draft) => draft.dirty));
  const pendingPublishDrafts = computed(() => generatedDrafts.value.filter((draft) => draft.publishStatus !== 'success'));
  const publishableDrafts = computed(() => pendingPublishDrafts.value.filter((draft) => draft.projectOptionId.trim() && draft.workHoursSource !== 'unresolved'));
  const generatedHoursTotal = computed(() => generatedDrafts.value.reduce((sum, draft) => sum + draft.workHours, 0));
  const dateRangeLabel = computed(() => availableDates.value.length ? `${availableDates.value[0]} 至 ${availableDates.value.at(-1)}（${availableDates.value.length} 天）` : '请选择有效日期范围');
  const displayRepoName = (repo: RepoInfo) => getRepoDisplayName(repo, assistant.config.repoDisplayNames);
  const getDefaultWorkHours = (id: string) => normalizeWorkHours(normalizeProjectWorkHours(assistant.config.feishuForm.projectWorkHours)[id], assistant.config.feishuForm.defaultWorkHours);
  const createDraft = (date: string, repo: RepoInfo) => createWeeklyReportDraft(date, repo, assistant.config.feishuForm.projectOptionId.trim(), getDefaultWorkHours(assistant.config.feishuForm.projectOptionId.trim()));
  const state = { dateRange, selectedRepoPaths, drafts, activeDraftKey, loading, pushing, status, availableDates, selectedRepos, activeDraft, activeReportModel, draftGroups, generatedDrafts, dirtyDrafts, pendingPublishDrafts, publishableDrafts, generatedHoursTotal, dateRangeLabel, displayRepoName, getDefaultWorkHours, createDraft };
  installDraftSynchronization(state, assistant);
  return state;
}

export type WeeklyReportState = ReturnType<typeof useWeeklyReportState>;

function handleDateRangeChange(state: WeeklyReportState, value: [string, string] | null) {
  if (!value?.[0] || !value[1]) return;
  const dates = listWeeklyDates(value[0], value[1]);
  if (dates.length > 7) {
    state.dateRange.value = [value[0], shiftLocalDate(value[0], 6)];
    ElMessage.warning('一周日报最多选择连续 7 天');
    return;
  }
  state.dateRange.value = value;
}

function updateDraftReport(state: WeeklyReportState, key: string, value: string) {
  const draft = state.drafts.value.find((item) => item.key === key);
  if (!draft) return;
  draft.report = value;
  draft.dirty = true;
  if (draft.workHoursSource !== 'manual') draft.workHoursSource = 'unresolved';
  if (draft.publishStatus === 'success') {
    draft.publishStatus = 'idle';
    draft.message = '内容已修改，需要重新提交';
  }
}

function updateDraftProject(state: WeeklyReportState, key: string, value: string) {
  const draft = state.drafts.value.find((item) => item.key === key);
  if (!draft) return;
  draft.projectOptionId = value;
  if (draft.workHoursSource === 'default') draft.workHours = state.getDefaultWorkHours(value);
  draft.publishStatus = 'idle';
  draft.message = '';
}

function updateDraftHours(state: WeeklyReportState, key: string, value: number | null | undefined) {
  const draft = state.drafts.value.find((item) => item.key === key);
  if (!draft) return;
  draft.workHours = normalizeWorkHours(value, draft.workHours);
  draft.workHoursSource = 'manual';
  draft.publishStatus = 'idle';
}

export function createWeeklyReportMutations(state: WeeklyReportState, getDailyHours: () => number) {
  const recalculateWorkHours = createWeeklyWorkHoursRecalculator(state, getDailyHours);
  return {
    handleDateRangeChange: (value: [string, string] | null) => handleDateRangeChange(state, value),
    updateDraftProject: (key: string, value: string) => updateDraftProject(state, key, value),
    updateDraftHours: (key: string, value: number | null | undefined) => updateDraftHours(state, key, value),
    recalculateWorkHours,
  };
}
