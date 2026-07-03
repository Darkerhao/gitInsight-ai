import { basename } from 'node:path';
import type { CommitEntry, GenerateReportParams, ReportResult, ReportTimeRange } from '../../src/shared/types.js';
import { callAiReport } from './aiClient.js';
import { loadConfig } from './config.js';
import { recordGeneratedReport } from './database.js';
import { nextDateString, normalizeDateTimeValue, parseLocalDateTimeMs, formatDateTimeForDisplay, type NormalizedReportTimeRange } from './dateUtils.js';
import { collectGitData, filterCommitsByReporter, formatCollectedGitData } from './gitCollect.js';

export function normalizeReportTimeRange(params: GenerateReportParams): NormalizedReportTimeRange {
  const startDateTime = normalizeDateTimeValue(params.startDateTime || `${params.date}T00:00:00`);
  const endDateTime = normalizeDateTimeValue(params.endDateTime || `${nextDateString(params.date)}T00:00:00`);
  const startMs = parseLocalDateTimeMs(startDateTime);
  const endMs = parseLocalDateTimeMs(endDateTime);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error('提交时间段格式不正确');
  }
  if (startMs >= endMs) {
    throw new Error('提交时间段的结束时间必须晚于开始时间');
  }

  return {
    startDateTime,
    endDateTime,
    startMs,
    endMs,
    label: `${formatDateTimeForDisplay(startDateTime)} 至 ${formatDateTimeForDisplay(endDateTime)}`,
  };
}


export function formatNumbered(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}


export function fallbackReport(repoNames: string[], date: string, reporterName: string, commits: CommitEntry[], timeRange: ReportTimeRange) {
  const workItems = commits.slice(0, 5).map((commit) => {
    const topic = commit.message.replace(/^(\w+)(\(.+?\))?:\s*/, '') || '相关模块';
    const modules = commit.files.slice(0, 2).join('、') || repoNames[0] || '当前项目';
    return `围绕${topic}完成 ${modules} 相关优化与修复，持续提升业务稳定性与交互可用性。`;
  });
  const resultItems = commits.length
    ? [
        `完成 ${Math.min(commits.length, 5)} 项当日研发变更梳理，并整理为结构化日报内容。`,
        `覆盖 ${repoNames.join('、') || '当前项目'} 的主要改动线索，便于后续同步与复盘。`,
      ]
    : ['完成日报基础信息整理，当前时间段暂无可用研发记录。'];
  const planItems = commits.length
    ? commits.slice(0, 2).map((commit) => {
        const topic = commit.message.replace(/^(\w+)(\(.+?\))?:\s*/, '') || '当前模块';
        return `继续推进${topic}相关联调、验证与收尾工作。`;
      })
    : ['推进当前模块联调与问题收敛。', '补充后续功能迭代所需的日报素材。'];

  return [
    '今日工作内容：',
    '',
    formatNumbered(workItems.length ? workItems : ['完成基础环境搭建与日报生成流程联调。']),
    '',
    '工作成果：',
    '',
    formatNumbered(resultItems),
    '',
    '工作时长：',
    '',
    '8小时',
    '',
    '明日计划：',
    '',
    formatNumbered(planItems),
    '',
    `汇报人：${reporterName}`,
    `日期：${date}`,
    `时间范围：${timeRange.label}`,
  ].join('\n');
}


export async function generateReport(params: GenerateReportParams): Promise<ReportResult> {
  const config = await loadConfig();
  const generatedAt = new Date().toISOString();
  const timeRange = normalizeReportTimeRange(params);
  const repos = params.repoPaths.map((repoPath) => ({ name: basename(repoPath), path: repoPath }));
  const allRepoDataList = await Promise.all(params.repoPaths.map((repoPath) => collectGitData(repoPath, timeRange)));
  const repoDataList = allRepoDataList.map((item) => {
    const commits = filterCommitsByReporter(item.commits, params.reporterName);
    return formatCollectedGitData(commits);
  });
  const commits = repoDataList.flatMap((item) => item.commits);
  const allCommits = allRepoDataList.flatMap((item) => item.commits);
  const rawInput = {
    gitLogs: repoDataList
      .map((item, index) => `## ${repos[index]?.name ?? `项目${index + 1}`}\n${item.gitLogs || '该时间段无记录'}`)
      .join('\n\n'),
    files: [...new Set(repoDataList.flatMap((item) => item.files.split('\n').filter(Boolean)))].join('\n'),
    diff: repoDataList
      .map((item, index) => `## ${repos[index]?.name ?? `项目${index + 1}`}\n${item.diff || '该时间段无代码变更摘要'}`)
      .join('\n\n')
      .slice(0, 12000),
  };

  if (!commits.length) {
    const matchedTip = allCommits.length
      ? `所选时间段存在 ${allCommits.length} 条提交记录，但没有匹配到汇报人“${params.reporterName}”的提交。`
      : '所选时间段未采集到代码提交记录。';
    const report = [
      '今日工作内容：',
      '',
      `1. ${matchedTip}暂不生成推测性日报内容。`,
      '',
      '工作成果：',
      '',
      '1. 已完成所选仓库的提交记录扫描，但未发现可用于日报生成的研发变更。',
      '',
      '明日计划：',
      '',
      '1. 请确认工作日期、仓库路径、汇报人名称与 Git 作者名称后重新生成日报。',
      '',
      `汇报人：${params.reporterName}`,
      `日期：${params.date}`,
      `时间范围：${timeRange.label}`,
    ].join('\n');

    const result = { report, commits, repos, generatedAt, timeRange, rawInput };
    const record = await recordGeneratedReport(params, result);
    return { ...result, historyId: record.id };
  }

  let report = '';
  if (config.aiApiKey) {
    try {
      report = await callAiReport(config, rawInput, timeRange);
    } catch (error) {
      report = fallbackReport(repos.map((item) => item.name), params.date, params.reporterName, commits, timeRange);
      report = `${report}\n\nAI提示：${error instanceof Error ? error.message : '调用失败'}`;
    }
  } else {
    report = fallbackReport(repos.map((item) => item.name), params.date, params.reporterName, commits, timeRange);
    report = `${report}\n\nAI提示：请先在设置中配置 OpenAI 兼容接口。`;
  }

  const result = { report, commits, repos, generatedAt, timeRange, rawInput };
  const record = await recordGeneratedReport(params, result);
  return { ...result, historyId: record.id };
}
