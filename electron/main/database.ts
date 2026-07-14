import { app, safeStorage } from 'electron';
import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs from 'sql.js';
import { APP_EDITION, APP_EDITION_LABEL, APP_PRODUCT_NAME } from '../../src/shared/edition.js';
import type {
  AutoSyncStatus,
  DailyReportRecord,
  ErrorLogRecord,
  GenerateReportParams,
  HistoryLogPage,
  HistoryLogQuery,
  HistoryLogRecord,
  HistoryLogStatus,
  HistoryLogType,
  ReportResult,
  ReportTimeRange,
  SaveDailyReportPayload,
  StorageInfo,
  SyncLogRecord,
} from '../../src/shared/types.js';
import { ensureConfigDir, getConfigPath, getDatabasePath, getSecretsPath } from './paths.js';
import { backfillTimelineSnapshots, ensureTimelineSchema, upsertTimelineSnapshot } from './timeline.js';

export let sqlDatabase: import('sql.js').Database | null = null;


export function countRawInputFiles(rawInput?: ReportResult['rawInput']) {
  return rawInput?.files.split(/\r?\n/).filter(Boolean).length ?? 0;
}


export async function getDatabase() {
  if (sqlDatabase) return sqlDatabase;
  await ensureConfigDir();
  const SQL = await initSqlJs({
    locateFile: (file) => {
      const unpackedPath = join(process.resourcesPath, 'app.asar.unpacked', 'node_modules/sql.js/dist', file);
      if (existsSync(unpackedPath)) return unpackedPath;
      return join(process.cwd(), 'node_modules/sql.js/dist', file);
    },
  });
  const databasePath = getDatabasePath();
  sqlDatabase = existsSync(databasePath) ? new SQL.Database(await readFile(databasePath)) : new SQL.Database();
  sqlDatabase.run(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      start_datetime TEXT,
      end_datetime TEXT,
      time_range_label TEXT,
      reporter_name TEXT NOT NULL,
      repo_names_json TEXT NOT NULL,
      repo_paths_json TEXT NOT NULL,
      report TEXT NOT NULL,
      status TEXT NOT NULL,
      commits_count INTEGER NOT NULL DEFAULT 0,
      files_count INTEGER NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      raw_input_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date);
    CREATE INDEX IF NOT EXISTS idx_daily_reports_updated_at ON daily_reports(updated_at);

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      date TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      ran_at TEXT NOT NULL,
      duration_ms INTEGER,
      FOREIGN KEY(report_id) REFERENCES daily_reports(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sync_logs_ran_at ON sync_logs(ran_at);

    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      message TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jiazi_farm_state (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      cycle_start_date TEXT NOT NULL,
      water INTEGER NOT NULL DEFAULT 0,
      sunlight INTEGER NOT NULL DEFAULT 0,
      nutrient INTEGER NOT NULL DEFAULT 0,
      growth INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      total_harvests INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jiazi_farm_task_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      task_key TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      reward_amount INTEGER NOT NULL,
      growth_amount INTEGER NOT NULL,
      claimed_at TEXT NOT NULL,
      UNIQUE(date, task_key)
    );
    CREATE INDEX IF NOT EXISTS idx_jiazi_farm_task_claims_date ON jiazi_farm_task_claims(date);

    CREATE TABLE IF NOT EXISTS jiazi_farm_harvests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      ganzhi_name TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      level INTEGER NOT NULL,
      resources_summary_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_jiazi_farm_harvests_created_at ON jiazi_farm_harvests(created_at);

    CREATE TABLE IF NOT EXISTS jiazi_farm_plots (
      slot INTEGER PRIMARY KEY,
      crop_tier INTEGER NOT NULL DEFAULT 1,
      water INTEGER NOT NULL DEFAULT 0,
      sunlight INTEGER NOT NULL DEFAULT 0,
      nutrient INTEGER NOT NULL DEFAULT 0,
      growth INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      total_harvests INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkin_wallet (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      coins INTEGER NOT NULL DEFAULT 0,
      last_checkin_date TEXT NOT NULL DEFAULT '',
      streak INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkin_coin_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref_key TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_checkin_coin_transactions_created_at ON checkin_coin_transactions(created_at);

  `);
  ensureDailyReportTimeRangeColumns(sqlDatabase);
  ensureJiaziFarmPlots(sqlDatabase);
  ensureTimelineSchema(sqlDatabase);
  await backfillTimelineSnapshots(sqlDatabase);
  await persistDatabase();
  return sqlDatabase;
}


export async function persistDatabase() {
  if (!sqlDatabase) return;
  await ensureConfigDir();
  await writeFile(getDatabasePath(), sqlDatabase.export());
}


export function parseJsonArray(value: unknown) {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}


export function ensureDailyReportTimeRangeColumns(db: import('sql.js').Database) {
  const columns = new Set((db.exec('PRAGMA table_info(daily_reports)')[0]?.values ?? []).map((row) => String(row[1])));
  if (!columns.has('start_datetime')) db.run('ALTER TABLE daily_reports ADD COLUMN start_datetime TEXT');
  if (!columns.has('end_datetime')) db.run('ALTER TABLE daily_reports ADD COLUMN end_datetime TEXT');
  if (!columns.has('time_range_label')) db.run('ALTER TABLE daily_reports ADD COLUMN time_range_label TEXT');
  if (!columns.has('structured_json')) db.run('ALTER TABLE daily_reports ADD COLUMN structured_json TEXT');
}


/**
 * 农场多地块迁移：为 jiazi_farm_state 补充「已解锁作物档次/地块数」两列，
 * 并把老用户的单行农场进度迁移进 jiazi_farm_plots 的 slot=1，保住已有成长/等级。
 */
export function ensureJiaziFarmPlots(db: import('sql.js').Database) {
  const stateColumns = new Set(
    (db.exec('PRAGMA table_info(jiazi_farm_state)')[0]?.values ?? []).map((row) => String(row[1])),
  );
  if (!stateColumns.has('unlocked_crop_tier')) {
    db.run('ALTER TABLE jiazi_farm_state ADD COLUMN unlocked_crop_tier INTEGER NOT NULL DEFAULT 1');
  }
  if (!stateColumns.has('unlocked_plot_count')) {
    db.run('ALTER TABLE jiazi_farm_state ADD COLUMN unlocked_plot_count INTEGER NOT NULL DEFAULT 1');
  }

  const plotCount = Number(db.exec('SELECT COUNT(*) AS count FROM jiazi_farm_plots')[0]?.values[0]?.[0]) || 0;
  if (plotCount > 0) return;

  const legacyRows = db.exec(
    'SELECT water, sunlight, nutrient, growth, level, total_harvests, updated_at FROM jiazi_farm_state WHERE id = 1',
  )[0]?.values[0];
  if (!legacyRows) return;

  const [water, sunlight, nutrient, growth, level, totalHarvests, updatedAt] = legacyRows;
  db.run(
    `INSERT INTO jiazi_farm_plots
      (slot, crop_tier, water, sunlight, nutrient, growth, level, total_harvests, updated_at)
     VALUES (1, 1, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(water) || 0,
      Number(sunlight) || 0,
      Number(nutrient) || 0,
      Number(growth) || 0,
      Number(level) || 1,
      Number(totalHarvests) || 0,
      String(updatedAt || new Date().toISOString()),
    ],
  );
}


export function rowToDailyReportTimeRange(row: Record<string, unknown>): ReportTimeRange | undefined {
  const startDateTime = String(row.start_datetime || '').trim();
  const endDateTime = String(row.end_datetime || '').trim();
  if (!startDateTime || !endDateTime) return undefined;

  return {
    startDateTime,
    endDateTime,
    label: String(row.time_range_label || '').trim() || `${startDateTime} 至 ${endDateTime}`,
  };
}


export function rowToDailyReportRecord(row: Record<string, unknown>): DailyReportRecord {
  return {
    id: Number(row.id) || 0,
    date: String(row.date || ''),
    timeRange: rowToDailyReportTimeRange(row),
    reporterName: String(row.reporter_name || ''),
    repoNames: parseJsonArray(row.repo_names_json),
    repoPaths: parseJsonArray(row.repo_paths_json),
    report: String(row.report || ''),
    status: ['draft', 'success', 'failed'].includes(String(row.status)) ? (String(row.status) as DailyReportRecord['status']) : 'draft',
    commitsCount: Number(row.commits_count) || 0,
    filesCount: Number(row.files_count) || 0,
    generatedAt: String(row.generated_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}


export function normalizeSyncTrigger(value: unknown): SyncLogRecord['triggerType'] {
  return value === 'scheduled' ? 'scheduled' : 'manual';
}


export function normalizeSyncStatus(value: unknown): SyncLogRecord['status'] {
  return ['idle', 'running', 'success', 'failed', 'skipped'].includes(String(value))
    ? (String(value) as SyncLogRecord['status'])
    : 'failed';
}


export function rowToSyncLogRecord(row: Record<string, unknown>): SyncLogRecord {
  const reportId = Number(row.report_id);
  const durationMs = Number(row.duration_ms);
  return {
    id: Number(row.id) || 0,
    reportId: Number.isFinite(reportId) && reportId > 0 ? reportId : undefined,
    date: String(row.date || ''),
    triggerType: normalizeSyncTrigger(row.trigger_type),
    status: normalizeSyncStatus(row.status),
    message: String(row.message || ''),
    ranAt: String(row.ran_at || ''),
    durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
  };
}


export function rowToErrorLogRecord(row: Record<string, unknown>): ErrorLogRecord {
  return {
    id: Number(row.id) || 0,
    scope: String(row.scope || ''),
    message: String(row.message || ''),
    detail: String(row.detail || ''),
    createdAt: String(row.created_at || ''),
  };
}


function normalizeHistoryQuery(query: HistoryLogQuery = {}) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const pageSize = Math.max(1, Math.min(Math.floor(Number(query.pageSize) || 10), 100));

  return {
    keyword: String(query.keyword || '').trim().toLocaleLowerCase('zh-CN'),
    project: String(query.project || '全部项目').trim() || '全部项目',
    type: query.type || '全部类型',
    status: query.status || '全部状态',
    startDate: String(query.startDate || '').trim(),
    endDate: String(query.endDate || '').trim(),
    page,
    pageSize,
  };
}


type NormalizedHistoryQuery = ReturnType<typeof normalizeHistoryQuery>;


function toHistoryDateBoundary(value: string, isEnd = false) {
  if (!value) return '';
  if (value.includes('T')) return new Date(value).toISOString();
  return new Date(`${value}${isEnd ? 'T23:59:59.999' : 'T00:00:00.000'}`).toISOString();
}


function buildHistoryDateWhere(columnName: string, query: NormalizedHistoryQuery) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.startDate) {
    where.push(`${columnName} >= ?`);
    params.push(toHistoryDateBoundary(query.startDate));
  }
  if (query.endDate) {
    where.push(`${columnName} <= ?`);
    params.push(toHistoryDateBoundary(query.endDate, true));
  }
  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}


function selectRows(db: import('sql.js').Database, sql: string, params: unknown[] = []) {
  const statement = db.prepare(sql);
  const rows: Record<string, unknown>[] = [];
  try {
    statement.bind(params);
    while (statement.step()) {
      rows.push(statement.getAsObject());
    }
  } finally {
    statement.free();
  }
  return rows;
}


function selectCount(db: import('sql.js').Database, sql: string, params: unknown[] = []) {
  return Number(selectRows(db, sql, params)[0]?.count) || 0;
}


function buildHistoryWhere(
  dateColumn: string,
  query: NormalizedHistoryQuery,
  options: {
    keywordColumns: string[];
    projectColumn?: string;
    statusSql?: string;
    statusParams?: unknown[];
  },
) {
  const dateFilter = buildHistoryDateWhere(dateColumn, query);
  const where = dateFilter.whereSql ? [dateFilter.whereSql.replace(/^WHERE /, '')] : [];
  const params = [...dateFilter.params];

  if (query.keyword) {
    where.push(`(${options.keywordColumns.map((column) => `LOWER(COALESCE(${column}, '')) LIKE ?`).join(' OR ')})`);
    const keyword = `%${query.keyword}%`;
    params.push(...options.keywordColumns.map(() => keyword));
  }
  if (query.project !== '全部项目' && options.projectColumn) {
    where.push(`COALESCE(${options.projectColumn}, '') LIKE ?`);
    params.push(`%${query.project}%`);
  }
  if (query.status !== '全部状态' && options.statusSql) {
    where.push(options.statusSql);
    params.push(...(options.statusParams ?? []));
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}


function buildDailyReportAction(item: DailyReportRecord) {
  const action = `${item.date} 日报${item.status === 'draft' ? '草稿保存' : '生成'}`;
  return item.timeRange?.label ? `${action}（${item.timeRange.label}）` : action;
}


function formatHistoryProject(repoNames: string[], fallback = '未记录项目') {
  return repoNames.length ? repoNames.join('、') : fallback;
}


function formatHistoryDuration(durationMs?: number) {
  return durationMs == null ? '-' : `${Math.round(durationMs / 1000)}秒`;
}


function syncStatusToHistoryStatus(status: SyncLogRecord['status']): HistoryLogStatus {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  return 'info';
}


function rowToDailyReportHistoryLog(row: Record<string, unknown>): HistoryLogRecord {
  const record = rowToDailyReportRecord(row);
  return {
    id: `report-${record.id}`,
    numericId: record.id,
    time: record.updatedAt || record.generatedAt,
    type: '日报生成',
    project: formatHistoryProject(record.repoNames),
    action: buildDailyReportAction(record),
    status: record.status === 'failed' ? 'failed' : 'success',
    duration: '-',
    operator: record.reporterName || '未设置',
    trigger: '手动触发',
    file: `项目日报-${record.date}.md`,
    detail: record.report,
    reportRecord: record,
  };
}


function rowToSyncHistoryLog(row: Record<string, unknown>): HistoryLogRecord {
  const record = rowToSyncLogRecord(row);
  const repoNames = parseJsonArray(row.report_repo_names_json);
  const reporterName = String(row.report_reporter_name || '').trim();
  const type: HistoryLogType = record.triggerType === 'scheduled' ? '同步任务' : '手动同步';
  return {
    id: `sync-${record.id}`,
    numericId: record.id,
    time: record.ranAt,
    type,
    project: formatHistoryProject(repoNames, '当前配置项目'),
    action: record.message,
    status: syncStatusToHistoryStatus(record.status),
    duration: formatHistoryDuration(record.durationMs),
    operator: record.triggerType === 'scheduled' ? '系统' : reporterName || '未设置',
    trigger: record.triggerType === 'scheduled' ? '自动触发' : '手动触发',
    detail: record.message,
  };
}


function rowToErrorHistoryLog(row: Record<string, unknown>): HistoryLogRecord {
  const record = rowToErrorLogRecord(row);
  return {
    id: `error-${record.id}`,
    numericId: record.id,
    time: record.createdAt,
    type: '错误日志',
    project: '系统',
    action: record.message,
    status: 'failed',
    duration: '-',
    operator: '系统',
    trigger: record.scope,
    detail: record.detail || record.message,
  };
}


export async function getDailyReportById(id: number) {
  const db = await getDatabase();
  const statement = db.prepare('SELECT * FROM daily_reports WHERE id = ? LIMIT 1');
  try {
    statement.bind([id]);
    return statement.step() ? rowToDailyReportRecord(statement.getAsObject()) : null;
  } finally {
    statement.free();
  }
}


export async function saveDailyReport(payload: SaveDailyReportPayload): Promise<DailyReportRecord> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const generatedAt = payload.generatedAt || now;
  const repoNamesJson = JSON.stringify(payload.repoNames);
  const repoPathsJson = JSON.stringify(payload.repoPaths);
  const rawInputJson = payload.rawInput ? JSON.stringify(payload.rawInput) : null;
  const structuredJson = payload.structuredJson ? JSON.stringify(payload.structuredJson) : null;
  const timeRange = payload.timeRange?.startDateTime && payload.timeRange.endDateTime ? payload.timeRange : null;
  const startDateTime = timeRange?.startDateTime ?? null;
  const endDateTime = timeRange?.endDateTime ?? null;
  const timeRangeLabel = timeRange?.label ?? null;

  if (payload.id) {
    db.run(
      `UPDATE daily_reports
       SET date = ?, reporter_name = ?, repo_names_json = ?, repo_paths_json = ?, report = ?, status = ?,
           commits_count = ?, files_count = ?, generated_at = ?, updated_at = ?,
           start_datetime = COALESCE(?, start_datetime),
           end_datetime = COALESCE(?, end_datetime),
           time_range_label = COALESCE(?, time_range_label),
           raw_input_json = COALESCE(?, raw_input_json),
           structured_json = COALESCE(?, structured_json)
       WHERE id = ?`,
      [
        payload.date,
        payload.reporterName,
        repoNamesJson,
        repoPathsJson,
        payload.report,
        payload.status,
        payload.commitsCount,
        payload.filesCount,
        generatedAt,
        now,
        startDateTime,
        endDateTime,
        timeRangeLabel,
        rawInputJson,
        structuredJson,
        payload.id,
      ],
    );
    const record = (await getDailyReportById(payload.id)) as DailyReportRecord;
    await upsertTimelineSnapshot(record.id, db);
    await persistDatabase();
    return record;
  }

  db.run(
    `INSERT INTO daily_reports
      (date, start_datetime, end_datetime, time_range_label, reporter_name, repo_names_json, repo_paths_json, report, status, commits_count, files_count, generated_at, updated_at, raw_input_json, structured_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.date,
      startDateTime,
      endDateTime,
      timeRangeLabel,
      payload.reporterName,
      repoNamesJson,
      repoPathsJson,
      payload.report,
      payload.status,
      payload.commitsCount,
      payload.filesCount,
      generatedAt,
      now,
      rawInputJson,
      structuredJson,
    ],
  );
  const idResult = db.exec('SELECT last_insert_rowid() AS id');
  const id = Number(idResult[0]?.values[0]?.[0]) || 0;
  const record = (await getDailyReportById(id)) as DailyReportRecord;
  await upsertTimelineSnapshot(record.id, db);
  await persistDatabase();
  return record;
}


export async function listDailyReports(limit = 10): Promise<DailyReportRecord[]> {
  const db = await getDatabase();
  const statement = db.prepare('SELECT * FROM daily_reports ORDER BY updated_at DESC LIMIT ?');
  const records: DailyReportRecord[] = [];
  try {
    statement.bind([Math.max(1, Math.min(Number(limit) || 10, 100))]);
    while (statement.step()) {
      records.push(rowToDailyReportRecord(statement.getAsObject()));
    }
  } finally {
    statement.free();
  }
  return records;
}


export async function listSyncLogs(limit = 20): Promise<SyncLogRecord[]> {
  const db = await getDatabase();
  const statement = db.prepare('SELECT * FROM sync_logs ORDER BY ran_at DESC LIMIT ?');
  const records: SyncLogRecord[] = [];
  try {
    statement.bind([Math.max(1, Math.min(Number(limit) || 20, 200))]);
    while (statement.step()) {
      records.push(rowToSyncLogRecord(statement.getAsObject()));
    }
  } finally {
    statement.free();
  }
  return records;
}


export async function listErrorLogs(limit = 20): Promise<ErrorLogRecord[]> {
  const db = await getDatabase();
  const statement = db.prepare('SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ?');
  const records: ErrorLogRecord[] = [];
  try {
    statement.bind([Math.max(1, Math.min(Number(limit) || 20, 200))]);
    while (statement.step()) {
      records.push(rowToErrorLogRecord(statement.getAsObject()));
    }
  } finally {
    statement.free();
  }
  return records;
}


export async function queryHistoryLogs(query: HistoryLogQuery = {}): Promise<HistoryLogPage> {
  const db = await getDatabase();
  const normalizedQuery = normalizeHistoryQuery(query);
  const records: HistoryLogRecord[] = [];
  const candidateLimit = normalizedQuery.page * normalizedQuery.pageSize;
  let total = 0;

  if (normalizedQuery.type === '全部类型' || normalizedQuery.type === '日报生成') {
    const filter = buildHistoryWhere('updated_at', normalizedQuery, {
      keywordColumns: [
        'date',
        'reporter_name',
        'repo_names_json',
        'report',
        "'日报生成'",
        "'手动触发'",
        "'项目日报-' || date || '.md'",
        "date || CASE WHEN status = 'draft' THEN ' 日报草稿保存' ELSE ' 日报生成' END",
      ],
      projectColumn: 'repo_names_json',
      statusSql: normalizedQuery.status === '成功' ? "status != 'failed'" : "status = 'failed'",
    });
    total += selectCount(db, `SELECT COUNT(*) AS count FROM daily_reports ${filter.whereSql}`, filter.params);
    records.push(
      ...selectRows(
        db,
        `SELECT * FROM daily_reports ${filter.whereSql} ORDER BY updated_at DESC LIMIT ?`,
        [...filter.params, candidateLimit],
      ).map(rowToDailyReportHistoryLog),
    );
  }

  if (normalizedQuery.type === '全部类型' || normalizedQuery.type === '手动同步' || normalizedQuery.type === '同步任务') {
    const triggerType = normalizedQuery.type === '手动同步' ? 'manual' : normalizedQuery.type === '同步任务' ? 'scheduled' : '';
    const filter = buildHistoryWhere('sync_logs.ran_at', normalizedQuery, {
      keywordColumns: [
        'sync_logs.message',
        'daily_reports.repo_names_json',
        'daily_reports.reporter_name',
        'sync_logs.trigger_type',
        "CASE WHEN sync_logs.trigger_type = 'scheduled' THEN '同步任务' ELSE '手动同步' END",
        "CASE WHEN sync_logs.trigger_type = 'scheduled' THEN '自动触发' ELSE '手动触发' END",
      ],
      projectColumn: 'daily_reports.repo_names_json',
      statusSql: normalizedQuery.status === '成功' ? "sync_logs.status = 'success'" : "sync_logs.status = 'failed'",
    });
    const triggerWhere = triggerType ? `${filter.whereSql ? ' AND' : 'WHERE'} sync_logs.trigger_type = ?` : '';
    const filterParams = triggerType ? [...filter.params, triggerType] : filter.params;
    const fromSql = `FROM sync_logs LEFT JOIN daily_reports ON daily_reports.id = sync_logs.report_id ${filter.whereSql}${triggerWhere}`;
    total += selectCount(db, `SELECT COUNT(*) AS count ${fromSql}`, filterParams);
    records.push(
      ...selectRows(
        db,
        `SELECT sync_logs.*, daily_reports.repo_names_json AS report_repo_names_json, daily_reports.reporter_name AS report_reporter_name
         ${fromSql}
         ORDER BY sync_logs.ran_at DESC LIMIT ?`,
        [...filterParams, candidateLimit],
      ).map(rowToSyncHistoryLog),
    );
  }

  if (normalizedQuery.type === '全部类型' || normalizedQuery.type === '错误日志') {
    const filter = buildHistoryWhere('created_at', normalizedQuery, {
      keywordColumns: ['scope', 'message', 'detail', "'错误日志'", "'系统'"],
      statusSql: normalizedQuery.status === '成功' ? '0 = 1' : '1 = 1',
    });
    total += selectCount(db, `SELECT COUNT(*) AS count FROM error_logs ${filter.whereSql}`, filter.params);
    records.push(
      ...selectRows(
        db,
        `SELECT * FROM error_logs ${filter.whereSql} ORDER BY created_at DESC LIMIT ?`,
        [...filter.params, candidateLimit],
      ).map(rowToErrorHistoryLog),
    );
  }

  const filteredRecords = records.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const start = (normalizedQuery.page - 1) * normalizedQuery.pageSize;

  return {
    records: filteredRecords.slice(start, start + normalizedQuery.pageSize),
    total,
    page: normalizedQuery.page,
    pageSize: normalizedQuery.pageSize,
  };
}


export async function listHistoryProjects() {
  const db = await getDatabase();
  const names = new Set<string>();
  for (const row of selectRows(db, 'SELECT repo_names_json FROM daily_reports')) {
    parseJsonArray(row.repo_names_json).forEach((name) => names.add(name));
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}


export async function countTableRows(tableName: 'daily_reports' | 'sync_logs' | 'error_logs') {
  const db = await getDatabase();
  const result = db.exec(`SELECT COUNT(*) AS count FROM ${tableName}`);
  return Number(result[0]?.values[0]?.[0]) || 0;
}


export async function getFileSize(filePath: string) {
  try {
    return (await stat(filePath)).size;
  } catch {
    return 0;
  }
}


export async function getStorageInfo(): Promise<StorageInfo> {
  await getDatabase();
  return {
    appVersion: app.getVersion(),
    appEdition: APP_EDITION,
    appEditionLabel: APP_EDITION_LABEL,
    appName: APP_PRODUCT_NAME,
    userDataPath: app.getPath('userData'),
    configPath: getConfigPath(),
    secretsPath: getSecretsPath(),
    databasePath: getDatabasePath(),
    configSize: await getFileSize(getConfigPath()),
    secretsSize: await getFileSize(getSecretsPath()),
    databaseSize: await getFileSize(getDatabasePath()),
    reportsCount: await countTableRows('daily_reports'),
    syncLogsCount: await countTableRows('sync_logs'),
    errorLogsCount: await countTableRows('error_logs'),
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
  };
}


export async function recordGeneratedReport(params: GenerateReportParams, result: ReportResult) {
  return saveDailyReport({
    date: params.date,
    reporterName: params.reporterName,
    repoNames: result.repos.map((item) => item.name),
    repoPaths: result.repos.map((item) => item.path),
    report: result.report,
    status: result.commits.length ? 'success' : 'failed',
    commitsCount: result.commits.length,
    filesCount: countRawInputFiles(result.rawInput),
    generatedAt: result.generatedAt,
    timeRange: result.timeRange,
    rawInput: result.rawInput,
    structuredJson: result.structuredJson,
  });
}


export async function recordSyncLog(payload: {
  reportId?: number;
  date: string;
  triggerType: string;
  status: AutoSyncStatus | 'success' | 'failed';
  message: string;
  ranAt?: string;
  durationMs?: number;
}) {
  const db = await getDatabase();
  db.run(
    `INSERT INTO sync_logs (report_id, date, trigger_type, status, message, ran_at, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.reportId ?? null,
      payload.date,
      payload.triggerType,
      payload.status,
      payload.message,
      payload.ranAt || new Date().toISOString(),
      payload.durationMs ?? null,
    ],
  );
  await persistDatabase();
}


export async function recordErrorLog(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '未知错误');
  const detail = error instanceof Error ? error.stack || '' : '';
  const db = await getDatabase();
  db.run('INSERT INTO error_logs (scope, message, detail, created_at) VALUES (?, ?, ?, ?)', [
    scope,
    message,
    detail,
    new Date().toISOString(),
  ]);
  await persistDatabase();
}

