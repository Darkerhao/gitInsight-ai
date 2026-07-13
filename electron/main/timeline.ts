import type { Database } from 'sql.js';
import type { TimelineDayGroup, TimelineQuery, TimelineRecord, TimelineSnapshot, TimelineWorkType } from '../../src/shared/types.js';

type ReportRow = Record<string, unknown>;

const TYPE_RULES: Array<{ type: TimelineWorkType; keywords: string[]; weight: number }> = [
  { type: 'Bug 修复', keywords: ['修复', '异常', '错误', '崩溃', 'bug', 'fix', '问题'], weight: 3 },
  { type: '性能优化', keywords: ['性能', '提速', '缓存', '耗时', '内存', '优化加载'], weight: 3 },
  { type: '重构优化', keywords: ['重构', '收敛', '抽取', '解耦', '类型治理', 'refactor'], weight: 3 },
  { type: '工程优化', keywords: ['构建', '测试', '配置', '脚本', '工程', '诊断', '类型检查'], weight: 2 },
  { type: '功能开发', keywords: ['新增', '增加', '实现', '支持', '上线', '开发', 'feat'], weight: 2 },
];

export function ensureTimelineSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS timeline_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL UNIQUE,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      primary_type TEXT NOT NULL,
      work_types_json TEXT NOT NULL,
      projects_json TEXT NOT NULL,
      repo_paths_json TEXT NOT NULL,
      tech_tags_json TEXT NOT NULL,
      commit_hashes_json TEXT NOT NULL,
      commits_count INTEGER NOT NULL DEFAULT 0,
      files_count INTEGER NOT NULL DEFAULT 0,
      energy INTEGER NOT NULL DEFAULT 0,
      milestone INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(report_id) REFERENCES daily_reports(id)
    );
    CREATE INDEX IF NOT EXISTS idx_timeline_snapshots_date ON timeline_snapshots(date);
    CREATE INDEX IF NOT EXISTS idx_timeline_snapshots_primary_type ON timeline_snapshots(primary_type);
  `);
}

function parseArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeText(value: unknown) {
  return String(value ?? '').replace(/\r/g, '').trim();
}

function detectWorkTypes(text: string): TimelineWorkType[] {
  const normalized = text.toLowerCase();
  const scores = new Map<TimelineWorkType, number>();
  for (const rule of TYPE_RULES) {
    const hits = rule.keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())).length;
    if (hits > 0) scores.set(rule.type, hits * rule.weight);
  }
  if (!scores.size) return ['日常开发'];
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);
}

function extractTitle(report: string, primaryType: TimelineWorkType) {
  const line = report
    .split('\n')
    .map((item) => item.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').replace(/^#+\s*/, '').trim())
    .find((item) => item && !['今日工作', '工作成果', '明日计划'].includes(item));
  return (line || `${primaryType}成果沉淀`).slice(0, 48);
}

function extractTechTags(text: string) {
  const candidates = ['Vue', 'React', 'TypeScript', 'JavaScript', 'Electron', 'Node.js', 'ECharts', 'Element Plus', 'Ant Design Vue', 'Git', '飞书', 'API', 'SQL'];
  const normalized = text.toLowerCase();
  return candidates.filter((item) => normalized.includes(item.toLowerCase()));
}

function extractCommitHashes(rawInputJson: unknown) {
  if (typeof rawInputJson !== 'string') return [];
  try {
    const raw = JSON.parse(rawInputJson) as { gitLogs?: string };
    if (!raw.gitLogs) return [];
    // git log 格式: __COMMIT__<40-hex-hash>\t...  — 只提取紧跟标记的完整 hash
    return Array.from(raw.gitLogs.matchAll(/__COMMIT__([0-9a-f]{40})\b/gi) ?? [], (match) => match[1]).slice(0, 50);
  } catch {
    return [];
  }
}

function rowToTimelineRecord(row: ReportRow): TimelineRecord {
  return {
    id: Number(row.id) || 0,
    reportId: Number(row.report_id) || 0,
    date: String(row.date || ''),
    title: String(row.title || ''),
    summary: String(row.summary || ''),
    primaryType: String(row.primary_type || '日常开发') as TimelineWorkType,
    workTypes: parseArray(row.work_types_json) as TimelineWorkType[],
    projects: parseArray(row.projects_json),
    repoPaths: parseArray(row.repo_paths_json),
    techTags: parseArray(row.tech_tags_json),
    commitHashes: parseArray(row.commit_hashes_json),
    commitsCount: Number(row.commits_count) || 0,
    filesCount: Number(row.files_count) || 0,
    milestone: Number(row.milestone) === 1,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export function aggregateTimelineRecords(records: TimelineRecord[]): TimelineDayGroup[] {
  const groups = new Map<string, TimelineRecord[]>();
  for (const record of records) {
    const current = groups.get(record.date) ?? [];
    current.push(record);
    groups.set(record.date, current);
  }
  return Array.from(groups, ([date, dayRecords]) => ({
    date,
    recordIds: dayRecords.map((item) => item.id),
    records: dayRecords,
    projects: Array.from(new Set(dayRecords.flatMap((item) => item.projects))),
    workTypes: Array.from(new Set(dayRecords.flatMap((item) => item.workTypes))),
    commitsCount: dayRecords.reduce((sum, item) => sum + item.commitsCount, 0),
    filesCount: dayRecords.reduce((sum, item) => sum + item.filesCount, 0),
    itemCount: dayRecords.length,
    milestone: dayRecords.some((item) => item.milestone),
  }));
}

export async function backfillTimelineSnapshots(db: Database): Promise<void> {
  const missingReports = db.exec(
    `SELECT daily_reports.id FROM daily_reports
     LEFT JOIN timeline_snapshots ON timeline_snapshots.report_id = daily_reports.id
     WHERE timeline_snapshots.id IS NULL AND daily_reports.status != 'failed'`,
  )[0]?.values ?? [];
  for (const row of missingReports) await upsertTimelineSnapshot(Number(row[0]), db);
}

export async function upsertTimelineSnapshot(reportId: number, db: Database): Promise<TimelineRecord> {
  const statement = db.prepare('SELECT * FROM daily_reports WHERE id = ? LIMIT 1');
  let reportRow: ReportRow | null = null;
  try {
    statement.bind([reportId]);
    if (statement.step()) reportRow = statement.getAsObject();
  } finally {
    statement.free();
  }
  if (!reportRow) throw new Error(`日报记录不存在：${reportId}`);

  const report = normalizeText(reportRow.report);
  const rawText = `${report}\n${normalizeText(reportRow.raw_input_json)}`;
  const workTypes = detectWorkTypes(report);
  const primaryType = workTypes[0];
  const projects = parseArray(reportRow.repo_names_json);
  const repoPaths = parseArray(reportRow.repo_paths_json);
  const commitsCount = Number(reportRow.commits_count) || 0;
  const filesCount = Number(reportRow.files_count) || 0;
  const milestone = /上线|发布|完成|突破|里程碑/.test(report) || commitsCount >= 10;
  const now = new Date().toISOString();
  const existing = db.exec(`SELECT created_at FROM timeline_snapshots WHERE report_id = ${Number(reportId)}`)[0]?.values[0];
  const createdAt = String(existing?.[0] || now);
  const values = [
    reportId,
    String(reportRow.date || ''),
    extractTitle(report, primaryType),
    report.slice(0, 500),
    primaryType,
    JSON.stringify(workTypes),
    JSON.stringify(projects),
    JSON.stringify(repoPaths),
    JSON.stringify(extractTechTags(rawText)),
    JSON.stringify(extractCommitHashes(reportRow.raw_input_json)),
    commitsCount,
    filesCount,
    0, /* energy: 保留列但不再计算，待未来定义明确语义后启用 */
    milestone ? 1 : 0,
    createdAt,
    now,
  ];
  db.run(
    `INSERT INTO timeline_snapshots
      (report_id, date, title, summary, primary_type, work_types_json, projects_json, repo_paths_json,
       tech_tags_json, commit_hashes_json, commits_count, files_count, energy, milestone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(report_id) DO UPDATE SET
       date=excluded.date, title=excluded.title, summary=excluded.summary, primary_type=excluded.primary_type,
       work_types_json=excluded.work_types_json, projects_json=excluded.projects_json, repo_paths_json=excluded.repo_paths_json,
       tech_tags_json=excluded.tech_tags_json, commit_hashes_json=excluded.commit_hashes_json,
       commits_count=excluded.commits_count, files_count=excluded.files_count, energy=excluded.energy,
       milestone=excluded.milestone, updated_at=excluded.updated_at`,
    values,
  );
  const result = db.prepare('SELECT * FROM timeline_snapshots WHERE report_id = ? LIMIT 1');
  try {
    result.bind([reportId]);
    if (!result.step()) throw new Error('成长快照写入失败');
    return rowToTimelineRecord(result.getAsObject());
  } finally {
    result.free();
  }
}

export async function getTimelineSnapshot(query: TimelineQuery | undefined, db: Database): Promise<TimelineSnapshot> {
  query ??= {};
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (query.startDate) { conditions.push('date >= ?'); params.push(query.startDate); }
  if (query.endDate) { conditions.push('date <= ?'); params.push(query.endDate); }
  if (query.type) { conditions.push('primary_type = ?'); params.push(query.type); }
  if (query.project) { conditions.push('projects_json LIKE ?'); params.push(`%"${query.project}"%`); }
  const statement = db.prepare(`SELECT * FROM timeline_snapshots ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY date ASC, id ASC`);
  const records: TimelineRecord[] = [];
  try {
    statement.bind(params);
    while (statement.step()) records.push(rowToTimelineRecord(statement.getAsObject()));
  } finally {
    statement.free();
  }
  return {
    records,
    days: aggregateTimelineRecords(records),
    total: records.length,
    summary: {
      activeDays: new Set(records.map((item) => item.date)).size,
      totalCommits: records.reduce((sum, item) => sum + item.commitsCount, 0),
      totalFiles: records.reduce((sum, item) => sum + item.filesCount, 0),
      milestones: records.filter((item) => item.milestone).length,
      projects: Array.from(new Set(records.flatMap((item) => item.projects))),
    },
  };
}
