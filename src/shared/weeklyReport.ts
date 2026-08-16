import type { ReportResult } from './types.js';

export interface WeeklyWorkContentInput {
  key: string;
  report: string;
}

export interface WeeklyWorkHourAllocation extends WeeklyWorkContentInput {
  weight: number;
  workHours: number;
}

export interface WeeklyDayWorkHoursInput extends WeeklyWorkContentInput {
  workHours: number;
  manual: boolean;
}

export interface WeeklyDayWorkHoursResult {
  allocations: WeeklyWorkHourAllocation[];
  unresolvedKeys: string[];
}

export function buildWeeklyDraftKeys(dates: string[], repoPaths: string[]) {
  return dates.flatMap((date) => repoPaths.map((repoPath) => `${date}::${repoPath}`));
}

function parseDateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function listWeeklyDates(startDate: string, endDate: string) {
  const startParts = parseDateParts(startDate);
  const endParts = parseDateParts(endDate);
  if (!startParts || !endParts) return [];

  const start = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const end = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  if (start > end) return [];

  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor += 86_400_000) {
    const value = new Date(cursor);
    dates.push(
      `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`,
    );
  }
  return dates;
}

export function getWeeklyWorkContent(report: string) {
  const lines = report.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^\s*今日工作内容[：:]/.test(line));
  if (startIndex < 0) return '';

  const endIndex = lines.slice(startIndex + 1).findIndex((line) => /^\s*(工作成果|工作时长|明日计划|汇报人|日期|时间范围|AI提示)[：:]/.test(line));
  return lines
    .slice(startIndex + 1, endIndex < 0 ? undefined : startIndex + 1 + endIndex)
    .join('\n')
    .trim();
}

export function getWeeklyWorkContentWeight(report: string) {
  const content = getWeeklyWorkContent(report).replace(/[`*_#>]/g, '').trim();
  if (!content) return 0;

  const itemCount = content
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:\d+[.)、]|[-*])\s+/.test(line))
    .length;
  const effectiveLength = content.replace(/\s+/g, '').length;
  return Math.max(1, itemCount * 2 + effectiveLength / 120);
}

export function allocateWeeklyWorkHours(
  items: WeeklyWorkContentInput[],
  totalHours: number,
  step = 0.5,
): WeeklyWorkHourAllocation[] {
  const weightedItems = items
    .map((item, index) => ({ ...item, index, weight: getWeeklyWorkContentWeight(item.report) }))
    .filter((item) => item.weight > 0);
  if (!weightedItems.length) return [];

  const normalizedStep = Number.isFinite(step) && step > 0 ? step : 0.5;
  const normalizedTotalHours = Number.isFinite(totalHours) && totalHours > 0 ? totalHours : 8;
  const targetUnits = Math.floor(normalizedTotalHours / normalizedStep);
  if (weightedItems.length > targetUnits) return [];
  const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0);
  const remainingUnits = targetUnits - weightedItems.length;
  const units = weightedItems.map((item) => {
    const exactExtraUnits = remainingUnits * (item.weight / totalWeight);
    const extraUnits = Math.floor(exactExtraUnits);
    return {
      ...item,
      units: 1 + extraUnits,
      remainder: exactExtraUnits - extraUnits,
    };
  });

  const undistributedUnits = targetUnits - units.reduce((sum, item) => sum + item.units, 0);
  [...units]
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .slice(0, undistributedUnits)
    .forEach((item) => {
      item.units += 1;
    });

  return units
    .sort((left, right) => left.index - right.index)
    .map(({ index: _index, remainder: _remainder, units: itemUnits, ...item }) => ({
      ...item,
      workHours: Number((itemUnits * normalizedStep).toFixed(2)),
    }));
}

export function allocateWeeklyDayWorkHours(
  items: WeeklyDayWorkHoursInput[],
  totalHours: number,
  force = false,
  step = 0.5,
): WeeklyDayWorkHoursResult {
  const manualItems = force ? [] : items.filter((item) => item.manual);
  const automaticItems = force ? items : items.filter((item) => !item.manual);
  if (!automaticItems.length) return { allocations: [], unresolvedKeys: [] };

  const remainingHours = totalHours - manualItems.reduce((sum, item) => sum + item.workHours, 0);
  if (remainingHours < step) {
    return { allocations: [], unresolvedKeys: automaticItems.map((item) => item.key) };
  }

  const allocations = allocateWeeklyWorkHours(automaticItems, remainingHours, step);
  const allocatedKeys = new Set(allocations.map((item) => item.key));
  return {
    allocations,
    unresolvedKeys: automaticItems.filter((item) => !allocatedKeys.has(item.key)).map((item) => item.key),
  };
}

export function countWeeklyReportFiles(result: ReportResult | null) {
  return new Set(result?.commits.flatMap((commit) => commit.files) ?? []).size;
}
