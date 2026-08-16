import type {
  DailyReportRecord,
  WeeklyReflectionParams,
  WeeklyReflectionProject,
  WeeklyReflectionRecord,
  WeeklyReflectionSource,
} from '../../src/shared/types.js';
import {
  normalizeWeeklyReflectionParams,
  parseWeeklyReflectionMetadata,
  selectWeeklyReflectionSources,
} from '../../src/shared/weeklyReflection.js';
import { renderWeeklyReflectionMarkdown } from '../../src/shared/weeklyReflectionMarkdown.js';

type Database = import('sql.js').Database;
type DailyReportMapper = (row: Record<string, unknown>) => DailyReportRecord;

export function ensureReflectionSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS project_reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_type TEXT NOT NULL,
      project_path TEXT NOT NULL,
      project_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      source_scope TEXT NOT NULL,
      source_report_ids_json TEXT NOT NULL,
      source_snapshot_json TEXT NOT NULL,
      structured_json TEXT NOT NULL,
      ai_profile_id TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_reflections_scope
      ON project_reflections(period_type, project_path, start_date, end_date, source_scope);
    CREATE INDEX IF NOT EXISTS idx_project_reflections_updated_at ON project_reflections(updated_at);
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

export function queryWeeklyReflectionSources(
  db: Database,
  params: WeeklyReflectionParams,
  mapDailyReport: DailyReportMapper,
) {
  const normalized = normalizeWeeklyReflectionParams(params);
  const reports = selectRows(
    db,
    'SELECT * FROM daily_reports WHERE date >= ? AND date <= ? ORDER BY date ASC, id ASC',
    [normalized.startDate, normalized.endDate],
  ).map(mapDailyReport);
  const successfulSyncReportIds = new Set(
    selectRows(db, "SELECT DISTINCT report_id FROM sync_logs WHERE status = 'success' AND report_id IS NOT NULL")
      .map((row) => Number(row.report_id))
      .filter((id) => id > 0),
  );
  return selectWeeklyReflectionSources(reports, successfulSyncReportIds, normalized);
}

export function queryWeeklyReflectionProjects(db: Database, mapDailyReport: DailyReportMapper): WeeklyReflectionProject[] {
  const reports = selectRows(db, 'SELECT * FROM daily_reports ORDER BY date DESC, id DESC').map(mapDailyReport);
  const successfulSyncReportIds = new Set(
    selectRows(db, "SELECT DISTINCT report_id FROM sync_logs WHERE status = 'success' AND report_id IS NOT NULL")
      .map((row) => Number(row.report_id))
      .filter((id) => id > 0),
  );
  const projects = new Map<string, WeeklyReflectionProject>();

  for (const report of reports) {
    report.repoPaths.forEach((path, index) => {
      if (!path) return;
      const current = projects.get(path) ?? {
        path,
        name: report.repoNames[index] || '未命名项目',
        reportCount: 0,
        publishedCount: 0,
      };
      current.reportCount += 1;
      if (successfulSyncReportIds.has(report.id)) current.publishedCount += 1;
      projects.set(path, current);
    });
  }
  return [...projects.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

function parseSources(value: unknown): WeeklyReflectionSource[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as WeeklyReflectionSource[]) : [];
  } catch {
    return [];
  }
}

function rowToRecord(row: Record<string, unknown>): WeeklyReflectionRecord {
  const sourceReports = parseSources(row.source_snapshot_json);
  const structuredJson = parseWeeklyReflectionMetadata(String(row.structured_json || '{}'));
  const params: WeeklyReflectionParams = {
    projectPath: String(row.project_path || ''),
    startDate: String(row.start_date || ''),
    endDate: String(row.end_date || ''),
    sourceScope: row.source_scope === 'published' ? 'published' : 'all',
  };
  return {
    id: Number(row.id) || 0,
    projectPath: params.projectPath,
    projectName: String(row.project_name || ''),
    startDate: params.startDate,
    endDate: params.endDate,
    sourceScope: params.sourceScope || 'all',
    sourceReports,
    content: renderWeeklyReflectionMarkdown(params, structuredJson, sourceReports),
    structuredJson,
    aiProfileId: String(row.ai_profile_id || ''),
    generatedAt: String(row.generated_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export function queryWeeklyReflections(db: Database, limit = 20): WeeklyReflectionRecord[] {
  return selectRows(
    db,
    "SELECT * FROM project_reflections WHERE period_type = 'week' ORDER BY updated_at DESC LIMIT ?",
    [Math.max(1, Math.min(Number(limit) || 20, 100))],
  ).map(rowToRecord);
}

export type SaveWeeklyReflectionPayload = Omit<WeeklyReflectionRecord, 'id' | 'updatedAt' | 'content'> & {
  id?: number;
};

export function upsertWeeklyReflection(db: Database, payload: SaveWeeklyReflectionPayload): WeeklyReflectionRecord {
  const normalized = normalizeWeeklyReflectionParams(payload);
  const existing = selectRows(
    db,
    `SELECT id FROM project_reflections
     WHERE period_type = 'week' AND project_path = ? AND start_date = ? AND end_date = ? AND source_scope = ? LIMIT 1`,
    [normalized.projectPath, normalized.startDate, normalized.endDate, normalized.sourceScope],
  );
  const id = payload.id || Number(existing[0]?.id) || 0;
  const now = new Date().toISOString();
  const values = [
    payload.projectPath,
    payload.projectName,
    payload.startDate,
    payload.endDate,
    payload.sourceScope,
    JSON.stringify(payload.sourceReports.map((source) => source.reportId)),
    JSON.stringify(payload.sourceReports),
    JSON.stringify(payload.structuredJson),
    payload.aiProfileId,
    payload.generatedAt,
    now,
  ];

  if (id) {
    db.run(
      `UPDATE project_reflections
       SET project_path = ?, project_name = ?, start_date = ?, end_date = ?, source_scope = ?,
           source_report_ids_json = ?, source_snapshot_json = ?, structured_json = ?, ai_profile_id = ?,
           generated_at = ?, updated_at = ? WHERE id = ?`,
      [...values, id],
    );
  } else {
    db.run(
      `INSERT INTO project_reflections
       (period_type, project_path, project_name, start_date, end_date, source_scope, source_report_ids_json,
        source_snapshot_json, structured_json, ai_profile_id, generated_at, updated_at)
       VALUES ('week', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values,
    );
  }

  const recordId = id || Number(db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0]) || 0;
  const row = selectRows(db, 'SELECT * FROM project_reflections WHERE id = ? LIMIT 1', [recordId])[0];
  if (!row) throw new Error('周反思保存后无法读取记录');
  return rowToRecord(row);
}
