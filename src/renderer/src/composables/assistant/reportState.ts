import type { ReportTimeRange } from '@shared/types';
import { buildDateTime, shiftLocalDate } from './dateUtils';
import { toPlainReportTimeRange } from './reportIpcPayload';

type ReportRangeForm = { startDateTime: string; endDateTime: string };

export function getReportRangePayloadFromForm(form: ReportRangeForm) {
  const startMs = new Date(form.startDateTime).getTime();
  const endMs = new Date(form.endDateTime).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) return null;
  return {
    startDateTime: form.startDateTime,
    endDateTime: form.endDateTime,
  };
}

export function resolveReportTimeRange(
  payload: { startDateTime: string; endDateTime: string } | null,
  label: string,
  previousRange?: ReportTimeRange,
): ReportTimeRange | undefined {
  if (!payload) return undefined;
  if (previousRange?.startDateTime === payload.startDateTime && previousRange.endDateTime === payload.endDateTime) {
    return toPlainReportTimeRange(previousRange);
  }

  return {
    ...payload,
    label,
  };
}

export function createReportState(form: ReportRangeForm & { date: string }) {
  function formatDateTime(value?: string) {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无';
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function applyFullDayReportRange(date: string) {
    form.date = date;
    form.startDateTime = buildDateTime(date, '00:00');
    form.endDateTime = buildDateTime(shiftLocalDate(date, 1), '00:00');
  }

  function applyReportTimeRange(date: string, timeRange?: ReportTimeRange) {
    form.date = date;
    if (timeRange?.startDateTime && timeRange.endDateTime) {
      form.startDateTime = timeRange.startDateTime;
      form.endDateTime = timeRange.endDateTime;
      return;
    }
    applyFullDayReportRange(date);
  }

  return { formatDateTime, applyFullDayReportRange, applyReportTimeRange };
}
