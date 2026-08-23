import type { ComputedRef, Ref } from 'vue';
import { listWeeklyDates } from '@shared/weeklyReport';
import type { RepoInfo } from '@shared/types';

interface RecentConfigState {
  dateRange: Ref<[string, string]>;
  selectedRepoPaths: Ref<string[]>;
  recentRepoPaths: Ref<string[]>;
  recentDateRange: Ref<[string, string] | null>;
  restoring: Ref<boolean>;
  sortedRepos: ComputedRef<RepoInfo[]>;
}

export function createWeeklyReportRecentConfig(state: RecentConfigState) {
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem('gitinsight:weekly-recent-config') || '{}') as { repoPaths?: unknown; dateRange?: unknown };
      state.recentRepoPaths.value = Array.isArray(raw.repoPaths) ? raw.repoPaths.filter((path): path is string => typeof path === 'string') : [];
      const range = Array.isArray(raw.dateRange) && raw.dateRange.length === 2 && raw.dateRange.every((date): date is string => typeof date === 'string')
        ? [raw.dateRange[0], raw.dateRange[1]] as [string, string]
        : null;
      const dates = range ? listWeeklyDates(range[0], range[1]) : [];
      if (range && dates.length > 0 && dates.length <= 7) {
        state.restoring.value = true;
        state.recentDateRange.value = range;
        state.dateRange.value = range;
      }
    } catch {
      state.recentRepoPaths.value = [];
      state.recentDateRange.value = null;
    }
  }

  function save() {
    if (state.restoring.value) {
      state.restoring.value = false;
      return;
    }
    localStorage.setItem('gitinsight:weekly-recent-config', JSON.stringify({
      repoPaths: state.selectedRepoPaths.value,
      dateRange: state.dateRange.value,
    }));
    state.recentRepoPaths.value = [...state.selectedRepoPaths.value];
    state.recentDateRange.value = [...state.dateRange.value];
  }

  function reuse() {
    const available = state.recentRepoPaths.value.filter((path) => state.sortedRepos.value.some((repo) => repo.path === path));
    if (available.length) state.selectedRepoPaths.value = available;
    if (state.recentDateRange.value) state.dateRange.value = [...state.recentDateRange.value];
    return available.length > 0 && state.recentDateRange.value !== null;
  }

  return { load, save, reuse };
}
