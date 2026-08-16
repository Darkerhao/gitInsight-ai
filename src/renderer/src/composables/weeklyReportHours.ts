import type { ComputedRef, Ref } from 'vue';
import { ElMessage } from 'element-plus';
import { allocateWeeklyDayWorkHours } from '../../../shared/weeklyReport.js';
import type { WeeklyReportDraft } from './weeklyReportActions.js';

export interface WeeklyReportHoursState {
  drafts: Ref<WeeklyReportDraft[]>;
  availableDates: ComputedRef<string[]>;
  status: Ref<string>;
}

function allocateDayWorkHours(state: WeeklyReportHoursState, date: string, dailyHours: number, force: boolean) {
  const dayDrafts = state.drafts.value.filter((draft) => draft.date === date && draft.report.trim());
  const result = allocateWeeklyDayWorkHours(dayDrafts.map((draft) => ({
    key: draft.key, report: draft.report, workHours: draft.workHours, manual: draft.workHoursSource === 'manual',
  })), dailyHours, force);
  for (const key of result.unresolvedKeys) {
    const draft = state.drafts.value.find((item) => item.key === key);
    if (draft) draft.workHoursSource = 'unresolved';
  }
  for (const allocation of result.allocations) {
    const draft = state.drafts.value.find((item) => item.key === allocation.key);
    if (!draft) continue;
    draft.workHours = allocation.workHours;
    draft.workHoursSource = 'estimated';
  }
  return { estimatedCount: result.allocations.length, capacityExceeded: result.unresolvedKeys.length > 0 };
}

function recalculateWorkHours(state: WeeklyReportHoursState, dailyHours: number, force = false) {
  let estimatedCount = 0;
  const capacityExceededDates: string[] = [];
  for (const date of state.availableDates.value) {
    const result = allocateDayWorkHours(state, date, dailyHours, force);
    estimatedCount += result.estimatedCount;
    if (result.capacityExceeded) capacityExceededDates.push(date);
  }
  state.status.value = capacityExceededDates.length
    ? `${capacityExceededDates.join('、')} 的项目数超过每日工时可分配的 0.5 小时单位，请手动设置工时`
    : estimatedCount ? `已按工作内容重新估算 ${estimatedCount} 条日报工时` : '当前没有可估算的日报内容';
  if (force && capacityExceededDates.length) ElMessage.warning(state.status.value);
  return { estimatedCount, capacityExceededDates };
}

export function createWeeklyWorkHoursRecalculator(
  state: WeeklyReportHoursState,
  getDailyHours: () => number,
) {
  return (force = false) => recalculateWorkHours(state, getDailyHours(), force);
}
