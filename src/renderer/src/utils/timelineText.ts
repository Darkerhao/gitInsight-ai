import type { TimelineDayGroup, TimelineRecord, TimelineWorkType } from '@shared/types';

/** 工作类型 → 语义色 */
export function tone(type: TimelineWorkType) {
  return ({
    '功能开发': '#67e6bd',
    'Bug 修复': '#f0b86d',
    '重构优化': '#bd9aff',
    '性能优化': '#f1d36f',
    '工程优化': '#70dff4',
    '日常开发': '#8ea3bb',
  } as const)[type];
}

/** 07-01 → 07.01 */
export function formatDate(value: string) { return value.slice(5).replace('-', '.'); }

/** 从日报 summary 中提取工作成果列表 */
export function extractAchievements(value: string) {
  const cleaned = value
    .replace(/#{1,6}\s*/g, '')
    .replace(/(?:今日工作内容|今日工作|工作成果|明日计划)\s*[：:]?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = cleaned
    .split(/(?=\d+[.、）)]\s*)|[；;]/)
    .map((item) => item.replace(/^\d+[.、）)]\s*/, '').trim())
    .filter((item) => item.length >= 6 && !item.startsWith('明日'));
  return parts.length ? parts : cleaned ? [cleaned] : [];
}

/** 压缩摘要：最多两条成果，不超过 96 字 */
export function compactSummary(item: TimelineRecord) {
  const text = extractAchievements(item.summary).slice(0, 2).join('；');
  return text.length > 96 ? `${text.slice(0, 96)}…` : text;
}

/** 显示标题：过滤掉"今日工作内容"等无区分度标题 */
export function displayTitle(item: TimelineRecord) {
  const generic = /^(今日工作内容|今日工作|工作成果)[：:]?$/.test(item.title.trim());
  if (!generic) return item.title;
  const achievement = extractAchievements(item.summary)[0] || `${item.primaryType}成果`;
  return achievement.length > 28 ? `${achievement.slice(0, 28)}…` : achievement;
}

/** 日粒度标题 */
export function dayTitle(day: TimelineDayGroup) {
  if (day.itemCount === 1) return displayTitle(day.records.at(-1) as TimelineRecord);
  const project = day.projects[0] || '工程工作';
  return `${project} · ${day.itemCount} 项工作沉淀`;
}

/** 日粒度摘要 */
export function daySummary(day: TimelineDayGroup) {
  return day.records.map((item) => displayTitle(item)).slice(0, 2).join('；');
}

/** 详情区块列表 */
export function detailSections(item: TimelineRecord) {
  const achievements = extractAchievements(item.summary);
  return achievements.length ? achievements : [compactSummary(item)].filter(Boolean);
}
