import type { RepoInfo } from '@shared/types';
import { buildWeeklyDraftKeys } from '@shared/weeklyReport';
import type { WeeklyReportDraft, WeeklyWorkHoursSource } from './weeklyReportActions';

export function createWeeklyReportDraft(
  date: string,
  repo: RepoInfo,
  projectOptionId: string,
  workHours: number,
): WeeklyReportDraft {
  return {
    key: `${date}::${repo.path}`,
    date,
    repo,
    report: '',
    reportId: null,
    result: null,
    projectOptionId,
    workHours,
    workHoursSource: 'default',
    generateStatus: 'idle',
    publishStatus: 'idle',
    dirty: false,
    message: '',
  };
}

export function mergeWeeklyReportDrafts(
  currentDrafts: WeeklyReportDraft[],
  dates: string[],
  repos: RepoInfo[],
  createDraft: (date: string, repo: RepoInfo) => WeeklyReportDraft,
) {
  const previous = new Map(currentDrafts.map((draft) => [draft.key, draft]));
  const repoByPath = new Map(repos.map((repo) => [repo.path, repo]));
  return buildWeeklyDraftKeys(dates, repos.map((repo) => repo.path)).map((key) => {
    const separatorIndex = key.indexOf('::');
    const date = key.slice(0, separatorIndex);
    const repo = repoByPath.get(key.slice(separatorIndex + 2))!;
    const existing = previous.get(key);
    if (!existing) return createDraft(date, repo);
    existing.repo = repo;
    return existing;
  });
}

export function formatWeeklyDateLabel(date: string) {
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short', month: '2-digit', day: '2-digit' })
    .format(new Date(`${date}T12:00:00`));
}

export function getWeeklyDraftStatusLabel(draft: WeeklyReportDraft) {
  if (draft.publishStatus === 'publishing') return '提交中';
  if (draft.publishStatus === 'success') return '已提交';
  if (draft.publishStatus === 'failed') return '提交失败';
  if (draft.generateStatus === 'generating') return '生成中';
  if (draft.generateStatus === 'failed') return '生成失败';
  if (draft.workHoursSource === 'unresolved') return '待确认工时';
  if (draft.dirty) return '待保存';
  return draft.report.trim() ? '已生成' : '待生成';
}

export function getWeeklyDraftStatusType(draft: WeeklyReportDraft) {
  if (draft.publishStatus === 'success' || draft.generateStatus === 'success') return 'success';
  if (draft.publishStatus === 'failed' || draft.generateStatus === 'failed') return 'danger';
  if (draft.publishStatus === 'publishing' || draft.generateStatus === 'generating') return 'warning';
  if (draft.workHoursSource === 'unresolved') return 'warning';
  return draft.dirty ? 'warning' : 'info';
}

export function getWeeklyHoursSourceLabel(source: WeeklyWorkHoursSource) {
  if (source === 'estimated') return '按工作内容估算';
  if (source === 'manual') return '手动调整';
  if (source === 'unresolved') return '待手动确认';
  return '项目默认';
}
