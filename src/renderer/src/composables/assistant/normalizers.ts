import {
  DEFAULT_AUTO_SYNC_CONFIG,
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

export function normalizeTimeValue(value: unknown) {
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

  return DEFAULT_AUTO_SYNC_CONFIG.time;
}

export function normalizeAutoSyncTimeWindowMode(value: unknown) {
  return value === 'yesterday-start-to-run' ? 'yesterday-start-to-run' : DEFAULT_AUTO_SYNC_CONFIG.timeWindowMode;
}

export function mergeCurrentOption(options: string[], currentValue: string) {
  const normalizedValue = currentValue.trim();
  if (!normalizedValue || options.includes(normalizedValue)) return options;
  return [normalizedValue, ...options];
}
