import { basename } from 'node:path';
import type { CommitEntry, GenerateReportParams, ReportResult, ReportTimeRange, StructuredReportMetadata } from '../../src/shared/types.js';
import { callAiReport, callAiStructuredExtract, resolveAiConfig } from './aiClient.js';
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


function stripConventionalCommitPrefix(message: string) {
  return message.replace(/^(\w+)(\(.+?\))?:\s*/, '').trim();
}


function getCommitScope(message: string) {
  return message.match(/^\w+\((.+?)\):/)?.[1]?.trim();
}


function getFileModuleName(filePath: string) {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  const fileName = parts.at(-1);
  if (!fileName) return '';

  const baseName = fileName.replace(/\.[^.]+$/, '');
  if (baseName && baseName !== 'index') return baseName;

  const ignoredParts = new Set(['src', 'renderer', 'main', 'electron', 'components', 'composables', 'views', 'assets', 'shared', 'types']);
  return [...parts].reverse().find((part) => !ignoredParts.has(part) && !part.includes('.')) || '';
}


function getCommitModuleName(commit: CommitEntry, repoNames: string[]) {
  return normalizeModuleName(getCommitScope(commit.message) || commit.files.map(getFileModuleName).find(Boolean) || repoNames[0] || '当前项目');
}


function normalizeModuleSegment(name: string) {
  return name
    .replace(/[【】"'“”`]/g, '')
    .replace(/\.(vue|tsx?|jsx?|mjs|cjs|json|css|scss|less|html)$/i, '')
    .replace(/[，。；：:、\s].*$/, '')
    .trim()
    .slice(0, 30);
}


function isGenericModuleName(name: string) {
  return ['xxx', '相关模块', '当前模块', '当前项目', '模块/功能', '一级模块', '页面或场景', '具体功能'].includes(name)
    || name.includes('一级模块')
    || name.includes('页面或场景')
    || name.includes('具体功能');
}


function formatModulePath(segments: string[]) {
  const normalizedSegments = segments
    .map(normalizeModuleSegment)
    .filter((segment) => segment && !isGenericModuleName(segment))
    .filter((segment, index, list) => index === 0 || segment !== list[index - 1]);

  return normalizedSegments.slice(0, 3).join(' / ');
}


function normalizeModuleName(name: string) {
  const cleaned = name.replace(/[【】"'“”`]/g, '').replace(/^模块\/功能[：:]/, '').trim();
  const segments = cleaned.split(/\s*(?:\/|>|→|->|｜|\|)\s*/);
  return formatModulePath(segments) || normalizeModuleSegment(cleaned);
}


function stripModuleLabel(content: string) {
  return content.replace(/^【(?:模块\/功能[：:])?[^】]+】/, '').trim();
}


function readModuleLabel(content: string) {
  return content.trimStart().match(/^【(?:模块\/功能[：:])?([^】]+)】/)?.[1]?.trim() || '';
}


function getModuleNameFromWorkContent(content: string) {
  const withoutLabel = stripModuleLabel(content);
  const normalized = withoutLabel.replace(/^(修复|优化|新增|调整|完善|实现|完成|处理|解决|更新|重构|联调|对接|支持|补充|梳理|改造|升级|排查|恢复|统一|移除|增加)/, '');
  const hierarchyByDe = normalized.match(
    /^(.{2,24}?(?:大屏|系统|平台|中心|工作台|看板|管理|模块))的(.{2,24}?(?:页面|场景|列表|详情|表单|弹窗|看板|模块|功能))的(.{2,30}?(?:页面|列表|详情|表单|弹窗|看板|配置|接口|权限|任务|报表|图表|组件|特效|字段|流程|功能))/,
  );
  if (hierarchyByDe) {
    const moduleName = formatModulePath([hierarchyByDe[1], hierarchyByDe[2], hierarchyByDe[3]]);
    if (moduleName) return moduleName;
  }

  const compactHierarchy = normalized.match(
    /^(.{2,24}?(?:大屏|系统|平台|中心|工作台|看板|管理|模块)).{0,8}?(.{2,18}?(?:页面|场景)).{0,8}?(.{2,30}?(?:列表|详情|表单|弹窗|看板|配置|接口|权限|任务|报表|图表|组件|特效|字段|流程|功能))/,
  );
  if (compactHierarchy) {
    const moduleName = formatModulePath([compactHierarchy[1], compactHierarchy[2], compactHierarchy[3]]);
    if (moduleName) return moduleName;
  }

  const pageMatch = normalized.match(
    /^(.{2,30}?(?:页面|列表|详情|表单|弹窗|看板|管理|中心|配置|工作台|日报生成|历史日志|同步任务|接口|权限|登录|同步|任务|报表|图表|组件|特效|字段|流程|功能))/,
  );
  const moduleName = normalizeModuleName(pageMatch?.[1] || '');
  return moduleName && !isGenericModuleName(moduleName) ? moduleName : '';
}


function inferWorkItemModuleName(content: string, commits: CommitEntry[], repoNames: string[], itemIndex: number) {
  const contentModuleName = getModuleNameFromWorkContent(content);
  if (contentModuleName) return contentModuleName;

  const matchedCommit = commits.find((commit) => {
    const topic = stripConventionalCommitPrefix(commit.message);
    const moduleName = getCommitModuleName(commit, repoNames);
    return (topic.length >= 4 && content.includes(topic.slice(0, 12))) || (moduleName.length >= 2 && content.includes(moduleName));
  });
  if (matchedCommit) return getCommitModuleName(matchedCommit, repoNames);

  const indexedCommit = commits[itemIndex];
  return indexedCommit ? getCommitModuleName(indexedCommit, repoNames) : repoNames[0] || '当前项目';
}


function getConcreteModuleLabel(content: string) {
  const label = readModuleLabel(content);
  const normalizedLabel = normalizeModuleName(label || '');
  return normalizedLabel && !isGenericModuleName(normalizedLabel) ? normalizedLabel : '';
}


function ensureReportWorkItemModuleLabels(report: string, commits: CommitEntry[], repoNames: string[]) {
  let inWorkSection = false;
  let workItemIndex = 0;
  const sectionTitlePattern = /^(工作成果|工作时长|明日计划|汇报人|日期|时间范围|AI提示)[：:]/;

  return report
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (/^今日工作内容[：:]/.test(trimmed)) {
        inWorkSection = true;
        workItemIndex = 0;
        return line;
      }
      if (inWorkSection && sectionTitlePattern.test(trimmed)) {
        inWorkSection = false;
        return line;
      }
      if (!inWorkSection) return line;

      const itemMatch = line.match(/^(\s*(?:\d+[.、]|[-*])\s*)(.+)$/);
      if (!itemMatch) return line;

      const currentIndex = workItemIndex;
      workItemIndex += 1;
      const prefix = itemMatch[1];
      const content = itemMatch[2].trimStart();
      const contentWithoutLabel = stripModuleLabel(content);
      const existingLabel = getConcreteModuleLabel(content);
      const inferredModuleName = inferWorkItemModuleName(contentWithoutLabel, commits, repoNames, currentIndex);
      const moduleName = existingLabel && (existingLabel.includes(' / ') || !inferredModuleName.includes(' / '))
        ? existingLabel
        : inferredModuleName;
      return `${prefix}【${moduleName}】${contentWithoutLabel}`;
    })
    .join('\n');
}


function normalizeManualWorkItems(content: string) {
  return content
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, '').trim())
    .filter(Boolean);
}


function getManualWorkModuleName(content: string) {
  if (/(测试|验收|回归|验证)/.test(content)) return '质量保障 / 网页测试';
  if (/(上线|发布|部署|发版)/.test(content)) return '发布交付 / 功能上线';
  if (/(会议|评审|沟通|对齐)/.test(content)) return '协作沟通 / 方案评审';
  if (/(联调|接口)/.test(content)) return '协作联调 / 接口验证';
  return '非代码工作 / 工作补充';
}


export function fallbackReport(
  repoNames: string[],
  date: string,
  reporterName: string,
  commits: CommitEntry[],
  timeRange: ReportTimeRange,
  manualWorkContent = '',
) {
  const manualWorkItems = normalizeManualWorkItems(manualWorkContent);
  const commitWorkItems = commits.slice(0, 3).map((commit) => {
    const moduleName = getCommitModuleName(commit, repoNames);
    const topic = stripConventionalCommitPrefix(commit.message) || moduleName;
    return `【${moduleName}】完成${topic}相关优化，提升对应页面或功能的数据展示与交互稳定性。`;
  });
  const workItems = [
    ...manualWorkItems.map((item) => `【${getManualWorkModuleName(item)}】${item.replace(/[。；;]+$/, '')}。`),
    ...commitWorkItems,
  ];
  const moduleNames = [...new Set(commits.map((commit) => getCommitModuleName(commit, repoNames)))].slice(0, 3).join('、');
  const resultItems = commits.length
    ? [
        `${moduleNames || repoNames.join('、') || '当前项目'}相关展示与交互路径已完成整理，便于后续回归验证。`,
      ]
    : manualWorkItems.length
      ? [`已完成 ${manualWorkItems.length} 项非代码工作并纳入日报，确保测试、发布及协作事项可追踪。`]
      : ['完成日报基础信息整理，当前时间段暂无可用研发记录。'];
  const planItems = commits.length
    ? commits.slice(0, 2).map((commit) => {
        const topic = stripConventionalCommitPrefix(commit.message) || getCommitModuleName(commit, repoNames);
        return `回归验证${topic}相关场景，排查同类展示或排序异常。`;
      })
    : ['推进当前模块联调与问题收敛。', '补充后续功能迭代所需的日报素材。'];

  return [
    '今日工作内容：',
    '',
    formatNumbered(workItems.length ? workItems : ['【日报生成 / 基础联调】完成基础环境搭建与日报生成流程联调。']),
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
  const aiConfig = resolveAiConfig(config, params.aiProfileId);
  const generatedAt = new Date().toISOString();
  const timeRange = normalizeReportTimeRange(params);
  const repos = params.repoPaths.map((repoPath) => ({ name: basename(repoPath), path: repoPath }));
  const allRepoDataList = await Promise.all(params.repoPaths.map((repoPath) => collectGitData(repoPath, timeRange)));
  const repoDataList = allRepoDataList.map((item) => {
    const commits = filterCommitsByReporter(item.commits, params.reporterName, params.gitAuthorEmail);
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
    ...(params.manualWorkContent?.trim() ? { manualWorkContent: params.manualWorkContent.trim() } : {}),
  };

  if (!commits.length && !rawInput.manualWorkContent) {
    const matchedTip = allCommits.length
      ? `所选时间段存在 ${allCommits.length} 条提交记录，但没有匹配到汇报人“${params.reporterName}”或 Git 作者邮箱“${params.gitAuthorEmail?.trim() || '未配置'}”的提交。`
      : '所选时间段未采集到代码提交记录。';
    const report = [
      '今日工作内容：',
      '',
      `1. 【日报生成 / 提交扫描】${matchedTip}暂不生成推测性日报内容。`,
      '',
      '工作成果：',
      '',
      '1. 已完成所选仓库的提交记录扫描，但未发现可用于日报生成的研发变更。',
      '',
      '明日计划：',
      '',
      '1. 请确认工作日期、仓库路径、汇报人名称或 Git 作者邮箱后重新生成日报。',
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
  if (aiConfig.aiApiKey) {
    try {
      report = await callAiReport(aiConfig, rawInput, timeRange);
    } catch (error) {
      report = fallbackReport(repos.map((item) => item.name), params.date, params.reporterName, commits, timeRange, rawInput.manualWorkContent);
      report = `${report}\n\nAI提示：${error instanceof Error ? error.message : '调用失败'}`;
    }
  } else {
    report = fallbackReport(repos.map((item) => item.name), params.date, params.reporterName, commits, timeRange, rawInput.manualWorkContent);
    const profileLabel = aiConfig.aiProfileName ? `“${aiConfig.aiProfileName}”` : '当前 AI 配置';
    report = `${report}\n\nAI提示：请先在 AI 设置中为${profileLabel}配置 OpenAI 兼容接口与 API Key。`;
  }
  report = ensureReportWorkItemModuleLabels(
    report,
    commits,
    repos.map((item) => item.name),
  );

  // 二次 AI 调用：从日报文本中提取结构化元数据（失败不影响主流程）
  let structuredJson: StructuredReportMetadata | undefined;
  if (aiConfig.aiApiKey) {
    const extracted = await callAiStructuredExtract(aiConfig, report);
    if (extracted) structuredJson = extracted;
  }

  const result = { report, commits, repos, generatedAt, timeRange, rawInput, structuredJson };
  const record = await recordGeneratedReport(params, result);
  return { ...result, historyId: record.id };
}
