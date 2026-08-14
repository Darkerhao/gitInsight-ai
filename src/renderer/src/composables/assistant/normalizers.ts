import {
  DEFAULT_AUTO_SYNC_TASK_CONFIG,
  DEFAULT_FEISHU_FORM_CONFIG,
} from '@shared/types';

export function toPlainString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function normalizeOptions(options: unknown[]) {
  return Array.from(new Set(options.map((item) => toPlainString(item).trim()).filter(Boolean)));
}

export function normalizeWorkspaceDirs(options: unknown[]) {
  return Array.from(new Set(options.map((item) => toPlainString(item).trim()).filter(Boolean)));
}

export function normalizeRepoSelections(paths: string[]) {
  const selectedPathMap = new Map<string, string>();
  for (const path of paths) {
    if (path.trim()) selectedPathMap.set(path.trim().toLocaleLowerCase(), path);
  }
  return Array.from(selectedPathMap.values());
}

export function normalizeWorkHours(value: unknown, fallback = DEFAULT_FEISHU_FORM_CONFIG.defaultWorkHours) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return fallback;
  return Math.min(Math.max(normalized, 0.5), 24);
}

export function normalizeProjectWorkHours(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, hours]) => [key.trim(), normalizeWorkHours(hours)] as const)
      .filter(([key]) => key),
  );
}

export function normalizeTaskWorkHours(value: unknown): number | null {
  if (value == null || value === '') return null;
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  return Math.min(Math.max(normalized, 0.5), 24);
}

export interface ProjectWorkHourInput {
  key: string;
  commitsCount: number;
  filesCount: number;
}

export interface ProjectWorkHourAllocation extends ProjectWorkHourInput {
  weight: number;
  workHours: number;
}

export function allocateProjectWorkHours(
  items: ProjectWorkHourInput[],
  totalHours: unknown,
  step = 0.5,
): ProjectWorkHourAllocation[] {
  if (!items.length) return [];

  const normalizedStep = Number.isFinite(step) && step > 0 ? step : 0.5;
  const targetUnits = Math.max(items.length, Math.round(normalizeWorkHours(totalHours) / normalizedStep));
  const remainingUnits = targetUnits - items.length;
  const weightedItems = items.map((item, index) => ({
    ...item,
    index,
    commitsCount: Math.max(0, Math.floor(Number(item.commitsCount) || 0)),
    filesCount: Math.max(0, Math.floor(Number(item.filesCount) || 0)),
    weight: Math.max(0.25, (Number(item.commitsCount) || 0) + (Number(item.filesCount) || 0) * 0.35),
  }));
  const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0);
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
  const remainderOrder = [...units].sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < undistributedUnits; index += 1) {
    remainderOrder[index % remainderOrder.length].units += 1;
  }

  return units
    .sort((left, right) => left.index - right.index)
    .map(({ index: _index, remainder: _remainder, units: itemUnits, ...item }) => ({
      ...item,
      workHours: Number((itemUnits * normalizedStep).toFixed(2)),
    }));
}

export function normalizeTimeValue(value: unknown, fallback = DEFAULT_AUTO_SYNC_TASK_CONFIG.time) {
  if (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }

  const maybeFormatter = (value as { format?: unknown } | null)?.format;
  if (typeof maybeFormatter === 'function') {
    try {
      const formatted = maybeFormatter.call(value, 'HH:mm');
      if (typeof formatted === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(formatted)) {
        return formatted;
      }
    } catch {
      // Fall through to default.
    }
  }

  return fallback;
}

export function normalizeAutoSyncTimeWindowMode(value: unknown) {
  return value === 'yesterday-start-to-run' ? 'yesterday-start-to-run' : DEFAULT_AUTO_SYNC_TASK_CONFIG.timeWindowMode;
}

export function mergeCurrentOption(options: string[], currentValue: string) {
  const normalizedValue = currentValue.trim();
  if (!normalizedValue || options.includes(normalizedValue)) return options;
  return [normalizedValue, ...options];
}
