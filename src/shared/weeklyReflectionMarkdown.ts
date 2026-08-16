import type {
  WeeklyReflectionMetadata,
  WeeklyReflectionParams,
  WeeklyReflectionSource,
} from './types.js';
import { normalizeWeeklyReflectionParams } from './weeklyReflection.js';

function evidenceLabel(refs: string[], sources: WeeklyReflectionSource[]) {
  const dates = refs
    .map((ref) => sources.find((source) => source.ref === ref)?.date)
    .filter((date): date is string => Boolean(date));
  return dates.length ? `依据：${[...new Set(dates)].join('、')}` : '暂无可关联的日报证据';
}

function renderPoints(
  points: Array<{ title: string; detail: string; evidenceRefs: string[] }>,
  sources: WeeklyReflectionSource[],
) {
  return points.length
    ? points.map((point) => `- **${point.title}**：${point.detail}（${evidenceLabel(point.evidenceRefs, sources)}）`).join('\n')
    : '- 暂无足够证据';
}

export function renderWeeklyReflectionMarkdown(
  params: WeeklyReflectionParams,
  metadata: WeeklyReflectionMetadata,
  sources: WeeklyReflectionSource[],
) {
  const normalized = normalizeWeeklyReflectionParams(params);
  const projectName = sources[0]?.projectName || '当前项目';
  const improvements = metadata.improvements.length
    ? metadata.improvements
        .map(
          (item) =>
            `- **${item.action}**（优先级：${item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}；${evidenceLabel(item.evidenceRefs, sources)}）\n  - 原因：${item.reason}\n  - 预期结果：${item.expectedOutcome}`,
        )
        .join('\n')
    : '- 暂无具体改进动作';
  const focus = metadata.nextWeekFocus.length ? metadata.nextWeekFocus.map((item) => `- ${item}`).join('\n') : '- 暂无';

  return [
    `# ${metadata.title}`,
    '',
    `项目：${projectName}`,
    `时间范围：${normalized.startDate} 至 ${normalized.endDate}`,
    `分析日报：${sources.length} 条`,
    '',
    '## 本周概览',
    '',
    metadata.overview,
    '',
    '## 做得好的地方',
    '',
    renderPoints(metadata.strengths, sources),
    '',
    '## 发现的问题',
    '',
    metadata.problems.length
      ? metadata.problems
          .map((item) => `- **${item.title}**：${item.detail}（影响：${item.impact}；${evidenceLabel(item.evidenceRefs, sources)}）`)
          .join('\n')
      : '- 暂无足够证据',
    '',
    '## 工作中的不足',
    '',
    renderPoints(metadata.shortcomings, sources),
    '',
    '## 后续改进动作',
    '',
    improvements,
    '',
    '## 下周重点',
    '',
    focus,
  ].join('\n');
}
