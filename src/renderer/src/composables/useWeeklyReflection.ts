import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type {
  WeeklyReflectionParams,
  WeeklyReflectionProject,
  WeeklyReflectionRecord,
  WeeklyReflectionSource,
  WeeklyReflectionSourceScope,
} from '@shared/types';
import { formatLocalDate, shiftLocalDate } from './assistant/dateUtils';
import { useAssistant } from './useAssistant';

function getCurrentWeekRange(): [string, string] {
  const now = new Date();
  const today = formatLocalDate(now);
  const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
  return [shiftLocalDate(today, mondayOffset), today];
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useWeeklyReflection() {
  const assistant = useAssistant();
  const projects = ref<WeeklyReflectionProject[]>([]);
  const history = ref<WeeklyReflectionRecord[]>([]);
  const sources = ref<WeeklyReflectionSource[]>([]);
  const currentRecord = ref<WeeklyReflectionRecord | null>(null);
  const selectedSource = ref<WeeklyReflectionSource | null>(null);
  const selectedProjectPath = ref('');
  const dateRange = ref<[string, string]>(getCurrentWeekRange());
  const sourceScope = ref<WeeklyReflectionSourceScope>('all');
  const projectsLoading = ref(false);
  const sourcesLoading = ref(false);
  const historyLoading = ref(false);
  const generating = ref(false);
  let sourceRequestSeq = 0;

  const selectedProject = computed(() => projects.value.find((project) => project.path === selectedProjectPath.value) ?? null);
  const displayProjectName = computed(() => {
    const project = selectedProject.value;
    return project ? assistant.getRepoDisplayName({ path: project.path, name: project.name }) : '未选择项目';
  });
  const publishedSourceCount = computed(() => sources.value.filter((source) => source.published).length);
  const totalCommits = computed(() => sources.value.reduce((total, source) => total + source.commitsCount, 0));
  const totalFiles = computed(() => sources.value.reduce((total, source) => total + source.filesCount, 0));
  const hasMultiProjectSource = computed(() => sources.value.some((source) => source.multiProject));
  const activeAiProfileName = computed(() => assistant.activeAiProfile.value.name || '当前 AI 配置');

  function buildParams(): WeeklyReflectionParams | null {
    if (!selectedProjectPath.value || dateRange.value.length !== 2) return null;
    return {
      projectPath: selectedProjectPath.value,
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
      sourceScope: sourceScope.value,
      aiProfileId: assistant.config.activeAiProfileId,
    };
  }

  function handleDateRangeChange() {
    const [startDate, endDate] = dateRange.value;
    const startMs = new Date(`${startDate}T00:00:00`).getTime();
    const endMs = new Date(`${endDate}T00:00:00`).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs - startMs <= 6 * 86400000) return true;
    dateRange.value = [startDate, shiftLocalDate(startDate, 6)];
    ElMessage.warning('项目周反思最多选择连续 7 天，已自动调整结束日期');
    return false;
  }

  async function loadProjects() {
    projectsLoading.value = true;
    try {
      projects.value = await window.api.listWeeklyReflectionProjects();
      if (!projects.value.some((project) => project.path === selectedProjectPath.value)) {
        selectedProjectPath.value = projects.value[0]?.path || '';
      }
    } catch (error) {
      ElMessage.error(errorMessage(error, '周反思项目加载失败'));
    } finally {
      projectsLoading.value = false;
    }
  }

  async function loadSources() {
    const params = buildParams();
    if (!params) {
      sources.value = [];
      return;
    }
    const requestSeq = ++sourceRequestSeq;
    sourcesLoading.value = true;
    try {
      const result = await window.api.listWeeklyReflectionSources(params);
      if (requestSeq === sourceRequestSeq) sources.value = result;
    } catch (error) {
      if (requestSeq === sourceRequestSeq) {
        sources.value = [];
        ElMessage.error(errorMessage(error, '周反思来源加载失败'));
      }
    } finally {
      if (requestSeq === sourceRequestSeq) sourcesLoading.value = false;
    }
  }

  async function loadHistory() {
    historyLoading.value = true;
    try {
      history.value = await window.api.listWeeklyReflections(30);
      if (!currentRecord.value && history.value.length) selectHistory(history.value[0]);
    } catch (error) {
      ElMessage.error(errorMessage(error, '周反思历史加载失败'));
    } finally {
      historyLoading.value = false;
    }
  }

  async function generateReflection() {
    const params = buildParams();
    if (!params) {
      ElMessage.warning('请选择项目和日期范围');
      return;
    }
    if (!sources.value.length) {
      ElMessage.warning('当前范围没有可用于反思的日报');
      return;
    }
    generating.value = true;
    try {
      await assistant.persistConfig();
      currentRecord.value = await window.api.generateWeeklyReflection(params);
      await loadHistory();
      ElMessage.success('项目周反思已生成');
    } catch (error) {
      ElMessage.error(errorMessage(error, '项目周反思生成失败'));
    } finally {
      generating.value = false;
    }
  }

  function selectHistory(record: WeeklyReflectionRecord) {
    currentRecord.value = record;
    selectedProjectPath.value = record.projectPath;
    dateRange.value = [record.startDate, record.endDate];
    sourceScope.value = record.sourceScope;
  }

  async function copyReflection() {
    if (!currentRecord.value?.content) return;
    await navigator.clipboard.writeText(currentRecord.value.content);
    ElMessage.success('周反思内容已复制');
  }

  function exportReflection() {
    const record = currentRecord.value;
    if (!record?.content) return;
    const blob = new Blob([record.content], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${record.projectName}-${record.startDate}-${record.endDate}-周反思.md`;
    link.click();
    URL.revokeObjectURL(link.href);
    ElMessage.success('周反思已导出');
  }

  watch([selectedProjectPath, dateRange, sourceScope], () => {
    if (handleDateRangeChange()) void loadSources();
  }, { deep: true });
  onMounted(async () => {
    await Promise.all([loadProjects(), loadHistory()]);
    await loadSources();
  });

  return {
    projects,
    history,
    sources,
    currentRecord,
    selectedSource,
    selectedProjectPath,
    dateRange,
    sourceScope,
    projectsLoading,
    sourcesLoading,
    historyLoading,
    generating,
    selectedProject,
    displayProjectName,
    publishedSourceCount,
    totalCommits,
    totalFiles,
    hasMultiProjectSource,
    activeAiProfileName,
    loadSources,
    generateReflection,
    selectHistory,
    copyReflection,
    exportReflection,
  };
}
