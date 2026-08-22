import type {
  DailyReportRecord,
  SaveWeeklySummaryPayload,
  WeeklySummaryMetadata,
  WeeklySummaryParams,
  WeeklySummaryRecord,
  WeeklySummarySource,
} from '../../src/shared/types.js';
import {
  normalizeWeeklySummaryParams,
  parseWeeklySummaryMetadata,
  selectWeeklySummarySources,
} from '../../src/shared/weeklySummary.js';
import { renderWeeklySummaryMarkdown } from '../../src/shared/weeklySummaryMarkdown.js';

type Database = import('sql.js').Database;
type DailyReportMapper = (row: Record<string, unknown>) => DailyReportRecord;

export function ensureWeeklySummarySchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      project_path TEXT NOT NULL DEFAULT '',
      project_name TEXT NOT NULL,
      source_report_ids_json TEXT NOT NULL,
      source_snapshot_json TEXT NOT NULL,
      structured_json TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      ai_profile_id TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reports_scope
      ON weekly_reports(start_date, end_date, scope_type, project_path);
    CREATE INDEX IF NOT EXISTS idx_weekly_reports_updated_at ON weekly_reports(updated_at);
  `);
}

function selectRows(db: Database, sql: string, params: unknown[] = []) {
  const statement = db.prepare(sql);
  const rows: Record<string, unknown>[] = [];
  try {
    statement.bind(params);
    while (statement.step()) rows.push(statement.getAsObject());
  } finally {
    statement.free();
  }
  return rows;
}

function parseSources(value: unknown): WeeklySummarySource[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as WeeklySummarySource[] : [];
  } catch {
    throw new Error('周报来源数据损坏');
  }
}

function rowToRecord(row: Record<string, unknown>): WeeklySummaryRecord {
  const params: WeeklySummaryParams = {
    startDate: String(row.start_date || ''),
    endDate: String(row.end_date || ''),
    projectPath: String(row.project_path || '') || undefined,
  };
  const structuredJson = parseWeeklySummaryMetadata(String(row.structured_json || '{}'));
  const content = String(row.content_markdown || '') || renderWeeklySummaryMarkdown(params, structuredJson);
  return {
    id: Number(row.id) || 0,
    startDate: params.startDate,
    endDate: params.endDate,
    scopeType: row.scope_type === 'project' ? 'project' : 'all',
    projectPath: params.projectPath || '',
    projectName: String(row.project_name || ''),
    sourceReports: parseSources(row.source_snapshot_json),
    content,
    structuredJson,
    aiProfileId: String(row.ai_profile_id || ''),
    generatedAt: String(row.generated_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export function queryWeeklySummarySources(
  db: Database,
  params: WeeklySummaryParams,
  mapDailyReport: DailyReportMapper,
) {
  const normalized = normalizeWeeklySummaryParams(params);
  const rows = selectRows(
    db,
    'SELECT * FROM daily_reports WHERE date >= ? AND date <= ? ORDER BY date ASC, updated_at DESC, id DESC',
    [normalized.startDate, normalized.endDate],
  );
  return selectWeeklySummarySources(rows.map(mapDailyReport), normalized);
}

export function queryWeeklySummaryRecords(db: Database, limit = 20) {
  return selectRows(
    db,
    'SELECT * FROM weekly_reports ORDER BY updated_at DESC LIMIT ?',
    [Math.max(1, Math.min(Number(limit) || 20, 100))],
  ).map(rowToRecord);
}

export function queryWeeklySummaryById(db: Database, id: number) {
  const row = selectRows(db, 'SELECT * FROM weekly_reports WHERE id = ? LIMIT 1', [id])[0];
  return row ? rowToRecord(row) : null;
}

export type SaveGeneratedWeeklySummary = {
  startDate: string;
  endDate: string;
  scopeType: 'all' | 'project';
  projectPath?: string;
  projectName: string;
  sourceReports: WeeklySummarySource[];
  structuredJson: WeeklySummaryMetadata;
  aiProfileId: string;
  generatedAt: string;
};

export function upsertWeeklySummary(db: Database, payload: SaveGeneratedWeeklySummary) {
  const normalized = normalizeWeeklySummaryParams({ ...payload, projectPath: payload.projectPath });
  const projectPath = normalized.projectPath || '';
  const existing = selectRows(
    db,
    'SELECT id, content_markdown FROM weekly_reports WHERE start_date = ? AND end_date = ? AND scope_type = ? AND project_path = ? LIMIT 1',
    [normalized.startDate, normalized.endDate, payload.scopeType, projectPath],
  )[0];
  const id = Number(existing?.id) || 0;
  const now = new Date().toISOString();
  const content = renderWeeklySummaryMarkdown(normalized, payload.structuredJson);
  const values = [
    normalized.startDate,
    normalized.endDate,
    payload.scopeType,
    projectPath,
    payload.projectName,
    JSON.stringify(payload.sourceReports.map((source) => source.reportId)),
    JSON.stringify(payload.sourceReports),
    JSON.stringify(payload.structuredJson),
    content,
    payload.aiProfileId,
    payload.generatedAt,
    now,
  ];
  if (id) {
    db.run(
      `UPDATE weekly_reports SET start_date = ?, end_date = ?, scope_type = ?, project_path = ?, project_name = ?,
       source_report_ids_json = ?, source_snapshot_json = ?, structured_json = ?, content_markdown = ?, ai_profile_id = ?,
       generated_at = ?, updated_at = ? WHERE id = ?`,
      [...values, id],
    );
  } else {
    db.run(
      `INSERT INTO weekly_reports
       (start_date, end_date, scope_type, project_path, project_name, source_report_ids_json, source_snapshot_json,
        structured_json, content_markdown, ai_profile_id, generated_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values,
    );
  }
  const recordId = id || Number(db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0]) || 0;
  const row = selectRows(db, 'SELECT * FROM weekly_reports WHERE id = ? LIMIT 1', [recordId])[0];
  if (!row) throw new Error('周报保存后无法读取记录');
  return rowToRecord(row);
}

export function saveWeeklySummaryContent(db: Database, payload: SaveWeeklySummaryPayload) {
  if (!Number.isInteger(payload.id) || payload.id <= 0) throw new Error('周报记录无效');
  if (!payload.content.trim()) throw new Error('周报内容不能为空');
  const current = queryWeeklySummaryById(db, payload.id);
  if (!current) throw new Error('周报记录不存在');
  db.run('UPDATE weekly_reports SET content_markdown = ?, updated_at = ? WHERE id = ?', [payload.content.trim(), new Date().toISOString(), payload.id]);
  return queryWeeklySummaryById(db, current.id) as WeeklySummaryRecord;
}
