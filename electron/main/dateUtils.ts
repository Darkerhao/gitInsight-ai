import type { ReportTimeRange } from '../../src/shared/types.js';

export function toLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


export function shiftDateString(date: string, deltaDays: number) {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + deltaDays);
  const shiftedYear = shifted.getFullYear();
  const shiftedMonth = String(shifted.getMonth() + 1).padStart(2, '0');
  const shiftedDay = String(shifted.getDate()).padStart(2, '0');
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}


export function nextDateString(date: string) {
  return shiftDateString(date, 1);
}


export type NormalizedReportTimeRange = ReportTimeRange & {
  startMs: number;
  endMs: number;
};


export function parseLocalDateTimeMs(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second = '0'] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getTime();
}


export function normalizeDateTimeValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return value.trim();
  const [, year, month, day, hour, minute, second = '00'] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second.padStart(2, '0')}`;
}


export function formatDateTimeForDisplay(value: string) {
  return normalizeDateTimeValue(value).replace('T', ' ').replace(/:00$/, '');
}


export function formatDateTimeForGit(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

