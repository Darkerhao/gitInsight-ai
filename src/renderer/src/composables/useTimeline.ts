import { computed, onMounted, ref, watch } from 'vue';
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
  { label: '日常开发', value: '日常开发' },
];

export function useTimeline() {
  const snapshot = ref<TimelineSnapshot | null>(null);
  const loading = ref(false);
  const loadError = ref('');
  const scale = ref<TimelineScale>('month');
  const activeType = ref<TimelineWorkType | ''>('');
  const selectedId = ref(0);

  /* ── 月份 / 年份导航 ── */
  const now = new Date();
  const viewYear = ref(now.getFullYear());
  const viewMonth = ref(now.getMonth() + 1);

  const viewLabel = computed(() => {
    if (scale.value === 'year') return `${viewYear.value} 年`;
    return `${viewYear.value} 年 ${viewMonth.value} 月`;
  });

  const isCurrentPeriod = computed(() => {
    const today = new Date();
    if (scale.value === 'year') return viewYear.value === today.getFullYear();
    return viewYear.value === today.getFullYear() && viewMonth.value === today.getMonth() + 1;
  });

  function navigatePeriod(delta: number) {
    if (scale.value === 'year') {
      viewYear.value += delta;
    } else {
      let m = viewMonth.value + delta;
      let y = viewYear.value;
      while (m < 1) { m += 12; y--; }
      while (m > 12) { m -= 12; y++; }
      viewYear.value = y;
      viewMonth.value = m;
    }
  }

  function goToToday() {
    const today = new Date();
    viewYear.value = today.getFullYear();
    viewMonth.value = today.getMonth() + 1;
  }

  /* ── 派生数据 ── */
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
    return days.value.slice(Math.max(0, focusIndex - 2), Math.min(days.value.length, focusIndex + 3));
  });

  /* ── 查询构建 ── */
  function buildQuery(): TimelineQuery {
    const query: TimelineQuery = {};
    const y = viewYear.value;
    const m = viewMonth.value;
    const monthStr = String(m).padStart(2, '0');
    if (scale.value === 'year') {
      query.startDate = `${y}-01-01`;
      query.endDate = `${y}-12-31`;
    } else if (scale.value === 'month') {
      const lastDay = new Date(y, m, 0).getDate();
      query.startDate = `${y}-${monthStr}-01`;
      query.endDate = `${y}-${monthStr}-${lastDay}`;
    } else if (selectedRecord.value) {
      query.startDate = selectedRecord.value.date;
      query.endDate = selectedRecord.value.date;
    }
    if (activeType.value) query.type = activeType.value;
    return query;
  }

  /* ── 查询缓存 ── */
  const queryCache = new Map<string, TimelineSnapshot>();

  function queryCacheKey(query: TimelineQuery): string {
    return `${query.startDate ?? ''}|${query.endDate ?? ''}|${query.type ?? ''}|${query.project ?? ''}`;
  }

  /* ── 数据加载 ── */
  async function loadTimeline(keepSelection = true) {
    loading.value = true;
    loadError.value = '';
    const previousId = keepSelection ? selectedId.value : 0;
    try {
      if (typeof window.api.getTimelineSnapshot !== 'function') {
        throw new Error('时间长河接口尚未加载，请完全重启应用后重试');
      }
      const query = buildQuery();
      const cacheKey = queryCacheKey(query);
      const cached = queryCache.get(cacheKey);
      if (cached) {
        snapshot.value = cached;
      } else {
        const result = await window.api.getTimelineSnapshot(query);
        queryCache.set(cacheKey, result);
        snapshot.value = result;
      }
      selectedId.value = records.value.some((item) => item.id === previousId) ? previousId : records.value.at(-1)?.id ?? 0;
    } catch (error) {
      snapshot.value = null;
      loadError.value = error instanceof Error ? error.message : '时间长河数据加载失败';
      ElMessage.error(loadError.value);
    } finally {
      loading.value = false;
    }
  }

  /** 清除缓存并重新加载（用于"刷新今日轨迹"等需要强制刷新的场景） */
  async function forceReload(keepSelection = true) {
    queryCache.clear();
    await loadTimeline(keepSelection);
  }

  /* ── 节点操作 ── */
  function representative(day: TimelineDayGroup) { return day.records.at(-1) as TimelineRecord; }
  function selectDay(day: TimelineDayGroup) { selectedId.value = representative(day).id; }

  function distance(day: TimelineDayGroup) {
    const dayIndex = days.value.findIndex((entry) => entry.date === day.date);
    return Math.min(3, Math.abs(dayIndex - selectedDayIndex.value));
  }

  function eventPosition(day: TimelineDayGroup) {
    if (scale.value !== 'month') return undefined;
    const itemIndex = days.value.findIndex((entry) => entry.date === day.date);
    return { top: `${(2 + itemIndex - selectedDayIndex.value) * (100 / 5)}%` };
  }

  /* 触控板滚动节流：deltaY 累积过阈值才切换一步,带冷却与停顿重置 */
  let wheelAccumulated = 0;
  let lastWheelAt = 0;
  let wheelCooldownUntil = 0;

  function handleWheel(event: WheelEvent) {
    if (!days.value.length) {
      // 无数据时不阻止默认滚轮行为（.prevent 在模板上，这里通过无操作让用户知道无内容）
      return;
    }
    const now = performance.now();
    // 停顿超过 300ms 后清空累计量,避免触控板惯性残余误触发
    if (now - lastWheelAt > 300) wheelAccumulated = 0;
    lastWheelAt = now;
    if (now < wheelCooldownUntil) return;
    wheelAccumulated += event.deltaY;
    if (Math.abs(wheelAccumulated) < 60) return;
    const direction = wheelAccumulated > 0 ? 1 : -1;
    wheelAccumulated = 0;
    wheelCooldownUntil = now + 180;
    const current = Math.max(0, selectedDayIndex.value);
    const next = Math.max(0, Math.min(days.value.length - 1, current + direction));
    selectDay(days.value[next]);
  }

  /* ── 自动触发加载 ── */
  watch([scale, activeType, viewYear, viewMonth], () => void loadTimeline(false));
  onMounted(() => void loadTimeline(false));

  return {
    snapshot, loading, loadError, scale, activeType, selectedId,
    viewYear, viewMonth, viewLabel, isCurrentPeriod, navigatePeriod, goToToday,
    records, days, selectedRecord, selectedDay, selectedDayIndex, selectedItems, timelineWindow,
    loadTimeline, forceReload, representative, selectDay, distance, eventPosition, handleWheel,
  };
}
