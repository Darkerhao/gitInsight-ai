import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { TimelineDayGroup, TimelineQuery, TimelineRecord, TimelineSnapshot, TimelineWorkType } from '@shared/types';

export type TimelineScale = 'year' | 'month' | 'day';

export const typeOptions: Array<{ label: string; value: TimelineWorkType | '' }> = [
  { label: '全部', value: '' },
  { label: '功能开发', value: '功能开发' },
  { label: 'Bug 修复', value: 'Bug 修复' },
  { label: '重构优化', value: '重构优化' },
  { label: '性能优化', value: '性能优化' },
  { label: '工程优化', value: '工程优化' },
];

export function useTimeline() {
  const snapshot = ref<TimelineSnapshot | null>(null);
  const loading = ref(false);
  const loadError = ref('');
  const scale = ref<TimelineScale>('month');
  const activeType = ref<TimelineWorkType | ''>('');
  const selectedId = ref(0);

  const records = computed(() => snapshot.value?.records ?? []);
  const days = computed(() => snapshot.value?.days ?? []);
  const selectedRecord = computed(() => records.value.find((item) => item.id === selectedId.value) ?? records.value.at(-1) ?? null);
  const selectedDay = computed(() => days.value.find((item) => item.recordIds.includes(selectedId.value)) ?? days.value.at(-1) ?? null);
  const selectedDayIndex = computed(() => {
    const date = selectedDay.value?.date;
    return date ? days.value.findIndex((item) => item.date === date) : -1;
  });
  const selectedItems = computed(() => selectedDay.value?.records ?? (selectedRecord.value ? [selectedRecord.value] : []));
  const timelineWindow = computed(() => {
    if (scale.value === 'year') return days.value;
    if (scale.value === 'day') return selectedDay.value ? [selectedDay.value] : [];
    const focusIndex = Math.max(0, selectedDayIndex.value);
    return days.value.slice(Math.max(0, focusIndex - 3), Math.min(days.value.length, focusIndex + 4));
  });

  function buildQuery(): TimelineQuery {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');
    const query: TimelineQuery = {};
    if (scale.value === 'year') {
      query.startDate = `${year}-01-01`;
      query.endDate = `${year}-12-31`;
    } else if (scale.value === 'month') {
      const lastDay = new Date(year, month, 0).getDate();
      query.startDate = `${year}-${monthStr}-01`;
      query.endDate = `${year}-${monthStr}-${lastDay}`;
    } else if (selectedRecord.value) {
      query.startDate = selectedRecord.value.date;
      query.endDate = selectedRecord.value.date;
    }
    if (activeType.value) query.type = activeType.value;
    return query;
  }

  async function loadTimeline(keepSelection = true) {
    loading.value = true;
    loadError.value = '';
    const previousId = keepSelection ? selectedId.value : 0;
    try {
      if (typeof window.api.getTimelineSnapshot !== 'function') {
        throw new Error('时间长河接口尚未加载，请完全重启应用后重试');
      }
      snapshot.value = await window.api.getTimelineSnapshot(buildQuery());
      selectedId.value = records.value.some((item) => item.id === previousId) ? previousId : records.value.at(-1)?.id ?? 0;
    } catch (error) {
      snapshot.value = null;
      loadError.value = error instanceof Error ? error.message : '时间长河数据加载失败';
      ElMessage.error(loadError.value);
    } finally {
      loading.value = false;
    }
  }

  function representative(day: TimelineDayGroup) { return day.records.at(-1) as TimelineRecord; }
  function selectDay(day: TimelineDayGroup) { selectedId.value = representative(day).id; }

  function distance(day: TimelineDayGroup) {
    const dayIndex = days.value.findIndex((entry) => entry.date === day.date);
    return Math.min(3, Math.abs(dayIndex - selectedDayIndex.value));
  }

  function eventPosition(day: TimelineDayGroup) {
    if (scale.value !== 'month') return undefined;
    const itemIndex = days.value.findIndex((entry) => entry.date === day.date);
    return { top: `${(3 + itemIndex - selectedDayIndex.value) * (100 / 7)}%` };
  }

  function handleWheel(event: WheelEvent) {
    if (!days.value.length) return;
    const current = Math.max(0, selectedDayIndex.value);
    const next = Math.max(0, Math.min(days.value.length - 1, current + (event.deltaY > 0 ? 1 : -1)));
    selectDay(days.value[next]);
  }

  watch([scale, activeType], () => void loadTimeline(false));
  onMounted(() => void loadTimeline(false));

  return {
    snapshot, loading, loadError, scale, activeType, selectedId,
    records, days, selectedRecord, selectedDay, selectedDayIndex, selectedItems, timelineWindow,
    loadTimeline, representative, selectDay, distance, eventPosition, handleWheel,
  };
}
