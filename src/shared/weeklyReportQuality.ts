export interface WeeklyQualityDraft {
  key: string;
  date: string;
  projectName: string;
  report: string;
  commitsCount: number;
  filesCount: number;
}

export interface WeeklyQualityResult {
  score: 'good' | 'warning' | 'empty';
  label: string;
  issues: string[];
}

function normalizeText(value: string) {
  return value.replace(/[\s\p{P}\p{S}]+/gu, '').toLowerCase();
}

export function checkWeeklyReportQuality(draft: WeeklyQualityDraft): WeeklyQualityResult {
  const text = draft.report.trim();
  const issues: string[] = [];
  if (!text) return { score: 'empty', label: '待生成', issues: ['日报正文为空'] };
  if (text.length < 24) issues.push('正文较短，建议补充具体工作结果');
  if (!draft.commitsCount && !draft.filesCount) issues.push('没有关联提交或影响文件');
  if (!/(完成|修复|新增|优化|上线|处理|实现|发布|测试|排查|调整)/u.test(text)) issues.push('缺少明确的工作动作');
  if (!/(结果|完成|支持|提升|解决|通过|交付|下一步|计划)/u.test(text)) issues.push('缺少结果或下一步信息');
  return { score: issues.length ? 'warning' : 'good', label: issues.length ? '建议完善' : '内容良好', issues };
}

export function findWeeklyDuplicateKeys(drafts: WeeklyQualityDraft[]) {
  const groups = new Map<string, string[]>();
  for (const draft of drafts) {
    const normalized = normalizeText(draft.report);
    if (!normalized) continue;
    const keys = groups.get(normalized) ?? [];
    keys.push(draft.key);
    groups.set(normalized, keys);
  }
  return new Set([...groups.values()].filter((keys) => keys.length > 1).flat());
}

