import type { WeeklySummaryMetadata, WeeklySummaryParams } from './types.js';

function section(title: string, items: Array<{ text: string }>) {
  const content = items.length ? items.map((item) => `- ${item.text}`).join('\n') : '- 暂无';
  return `## ${title}\n${content}`;
}

export function renderWeeklySummaryMarkdown(params: WeeklySummaryParams, metadata: WeeklySummaryMetadata) {
  return [
    '# 本周工作汇报',
    `> ${params.startDate} 至 ${params.endDate}`,
    '## 一句话总结',
    metadata.summary,
    section('本周完成', metadata.completed),
    section('重点产出', metadata.highlights),
    section('当前问题', metadata.blockers),
    section('下周计划', metadata.nextWeek),
  ].join('\n\n');
}
