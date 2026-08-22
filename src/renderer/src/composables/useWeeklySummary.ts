import { computed, onMounted, ref, watch } from 'vue';
import type { WeeklySummaryParams, WeeklySummaryRecord, WeeklySummarySource } from '@shared/types';

function dateToString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mondayOf(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function currentCompleteWeek(): [string, string] {
  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() - 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return [dateToString(monday), dateToString(sunday)];
}

function currentWeek(): [string, string] {
  const monday = mondayOf(new Date());
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return [dateToString(monday), dateToString(sunday)];
}

export function useWeeklySummary() {
  const defaultRange = currentCompleteWeek();
  const dateRange = ref<[string, string]>(defaultRange);
  const projectPath = ref('');
  const projectOptions = ref<Array<{ path: string; name: string }>>([]);
  const sources = ref<WeeklySummarySource[]>([]);
  const history = ref<WeeklySummaryRecord[]>([]);
  const current = ref<WeeklySummaryRecord | null>(null);
  const content = ref('');
  const loading = ref(false);
  const sourceLoading = ref(false);
  const saving = ref(false);
  const status = ref('');
  const error = ref('');
  const showSources = ref(false);

  const params = computed<WeeklySummaryParams>(() => ({
    startDate: dateRange.value[0],
    endDate: dateRange.value[1],
    projectPath: projectPath.value || undefined,
  }));
  const rangeLabel = computed(() => `${dateRange.value[0]} 至 ${dateRange.value[1]}`);
  const sourceDays = computed(() => new Set(sources.value.map((item) => item.date)).size);
  const sourceProjects = computed(() => new Set(sources.value.map((item) => item.projectName)).size);
  const commits = computed(() => sources.value.reduce((total, item) => total + item.commitsCount, 0));
  const files = computed(() => sources.value.reduce((total, item) => total + item.filesCount, 0));
  const dirty = computed(() => Boolean(current.value && content.value !== current.value.content));

  function shiftWeek(offset: number) {
    if (offset === 0) {
      dateRange.value = currentWeek();
      return;
    }
    const start = new Date(`${dateRange.value[0]}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + offset * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    dateRange.value = [dateToString(start), dateToString(end)];
  }

  async function loadSources() {
    sourceLoading.value = true;
    error.value = '';
    try {
      sources.value = await window.api.listWeeklySummarySources(params.value);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '读取周报来源失败';
    } finally {
      sourceLoading.value = false;
    }
  }

  async function loadHistory() {
    history.value = await window.api.listWeeklySummaries(20);
  }

  function selectHistory(record: WeeklySummaryRecord) {
    current.value = record;
    content.value = record.content;
    dateRange.value = [record.startDate, record.endDate];
    projectPath.value = record.projectPath;
    sources.value = record.sourceReports;
  }

  async function generate() {
    loading.value = true;
    status.value = '';
    error.value = '';
    try {
      const record = await window.api.generateWeeklySummary(params.value);
      selectHistory(record);
      await loadHistory();
      status.value = '周报已生成，可以直接编辑和汇报';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '生成周报失败';
    } finally {
      loading.value = false;
    }
  }

  async function save() {
    if (!current.value || !content.value.trim()) return;
    saving.value = true;
    error.value = '';
    try {
      const record = await window.api.saveWeeklySummary({ id: current.value.id, content: content.value });
      selectHistory(record);
      await loadHistory();
      status.value = '周报已保存';
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '保存周报失败';
    } finally {
      saving.value = false;
    }
  }

  async function copy(mode: 'text' | 'markdown') {
    const value = mode === 'markdown' ? content.value : content.value.replace(/^#+\s*/gm, '').replace(/[*`]/g, '');
    await navigator.clipboard.writeText(value);
    status.value = mode === 'markdown' ? 'Markdown 已复制' : '汇报文本已复制';
  }

  function exportMarkdown() {
    const blob = new Blob([content.value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `周报-${dateRange.value[0]}-${dateRange.value[1]}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  watch([dateRange, projectPath], () => { void loadSources(); });
  onMounted(async () => {
    projectOptions.value = (await window.api.listWeeklyReflectionProjects()).map((item) => ({ path: item.path, name: item.name }));
    await Promise.all([loadSources(), loadHistory()]);
  });

  return {
    dateRange, projectPath, projectOptions, sources, history, current, content, loading, sourceLoading, saving,
    status, error, showSources, params, rangeLabel, sourceDays, sourceProjects, commits, files, dirty,
    shiftWeek, loadSources, selectHistory, generate, save, copy, exportMarkdown,
  };
}
