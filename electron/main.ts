import { app, BrowserWindow, dialog, ipcMain, powerMonitor, safeStorage, session } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import initSqlJs from 'sql.js';
import {
  DEFAULT_AI_BASE_URL_OPTIONS,
  DEFAULT_AI_MODEL_OPTIONS,
  DEFAULT_AUTO_SYNC_CONFIG,
  DEFAULT_FEISHU_FORM_CONFIG,
} from '../src/shared/types.js';
import type {
  AppConfig,
  AutoSyncConfig,
  AutoSyncRunResult,
  AutoSyncState,
  AutoSyncStatus,
  CommitEntry,
  DailyReportRecord,
  ErrorLogRecord,
  FeishuAuthSnapshot,
  FeishuFieldOption,
  FeishuFormConfig,
  FeishuLoginPayload,
  FeishuProjectOption,
  FeishuProjectOptionsPayload,
  FeishuSubmitResult,
  FeishuTestSubmitPayload,
  GenerateFromMaterialParams,
  GenerateReportParams,
  MaterialReportResult,
  MaterialRole,
  MaterialSection,
  RepoInfo,
  ReportResult,
  ReportTimeRange,
  RoleMaterialPayload,
  RoleMaterialRecord,
  SaveDailyReportPayload,
  StorageInfo,
  SyncLogRecord,
  SyncFeishuDailyPayload,
} from '../src/shared/types.js';

const DEFAULT_CONFIG: AppConfig = {
  workspaceDir: '',
  workspaceDirs: [],
  selectedRepoPaths: [],
  ignoredRepoPaths: [],
  pinnedRepoPaths: [],
  reporterName: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiBaseUrlOptions: [...DEFAULT_AI_BASE_URL_OPTIONS],
  aiModelOptions: [...DEFAULT_AI_MODEL_OPTIONS],
  feishuForm: { ...DEFAULT_FEISHU_FORM_CONFIG },
  autoSync: { ...DEFAULT_AUTO_SYNC_CONFIG },
};

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'coverage', '.idea', '.vscode']);
const CONFIG_FILE = 'config.json';
const SECRETS_FILE = 'secrets.json';
const DB_FILE = 'gitinsight.db';

let mainWindow: BrowserWindow | null = null;
let feishuWindow: BrowserWindow | null = null;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let feishuAuthSyncTimer: ReturnType<typeof setTimeout> | null = null;
let removeFeishuAuthSessionWatcher: (() => void) | null = null;
let lastFeishuAuthSignature = '';
let autoSyncRunning = false;
let sqlDatabase: import('sql.js').Database | null = null;

const FEISHU_PARTITION = 'persist:feishu';
const FEISHU_LOGIN_HOME_URL = 'https://www.feishu.cn/';
const FEISHU_SHARE_SUBMIT_PATH = '/space/api/bitable/external/share/submit';

function getWindowIconPath() {
  const platformCandidates = process.platform === 'darwin'
    ? [
        join(process.cwd(), 'build/icons/mac/icon.icns'),
        join(process.resourcesPath, 'build/icons/mac/icon.icns'),
        join(process.cwd(), 'build', 'icon_2.png'),
        join(process.resourcesPath, 'build', 'icon_2.png'),
      ]
    : process.platform === 'linux'
    ? [
        join(process.cwd(), 'build/icon_4.png'),
        join(process.resourcesPath, 'build/icon_4.png'),
        join(process.cwd(), 'build/icons/win/icon.ico'),
        join(process.resourcesPath, 'build/icons/win/icon.ico'),
      ]
    : [
        join(process.cwd(), 'build/icons/win/icon.ico'),
        join(process.resourcesPath, 'build/icons/win/icon.ico'),
        join(process.cwd(), 'build', 'icon_1.png'),
        join(process.resourcesPath, 'build', 'icon_1.png'),
      ];
  const uniqueCandidates = [
    ...new Set(platformCandidates),
  ];
  return uniqueCandidates.find((item) => existsSync(item));
}

function getWindowOptionsIcon() {
  return getWindowIconPath() || undefined;
}

function getConfigPath() {
  return join(app.getPath('userData'), CONFIG_FILE);
}

function getSecretsPath() {
  return join(app.getPath('userData'), SECRETS_FILE);
}

function getDatabasePath() {
  return join(app.getPath('userData'), DB_FILE);
}

function toCloneable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function ensureConfigDir() {
  await mkdir(app.getPath('userData'), { recursive: true });
}

function pickSensitiveConfig(config: AppConfig) {
  return {
    aiApiKey: config.aiApiKey,
    feishuForm: {
      cookie: config.feishuForm.cookie,
      csrfToken: config.feishuForm.csrfToken,
    },
  };
}

function hasSensitiveConfig(config: AppConfig) {
  const sensitiveConfig = pickSensitiveConfig(config);
  return Boolean(sensitiveConfig.aiApiKey.trim() || sensitiveConfig.feishuForm.cookie.trim() || sensitiveConfig.feishuForm.csrfToken.trim());
}

function stripSensitiveConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    aiApiKey: '',
    feishuForm: {
      ...config.feishuForm,
      cookie: '',
      csrfToken: '',
    },
  };
}

function mergeSensitiveConfig(config: AppConfig, sensitiveConfig: ReturnType<typeof pickSensitiveConfig>): AppConfig {
  return {
    ...config,
    aiApiKey: sensitiveConfig.aiApiKey || config.aiApiKey,
    feishuForm: {
      ...config.feishuForm,
      cookie: sensitiveConfig.feishuForm.cookie || config.feishuForm.cookie,
      csrfToken: sensitiveConfig.feishuForm.csrfToken || config.feishuForm.csrfToken,
    },
  };
}

async function loadSensitiveConfig() {
  try {
    const encrypted = JSON.parse(await readFile(getSecretsPath(), 'utf-8')) as { payload?: string };
    if (!encrypted.payload || !safeStorage.isEncryptionAvailable()) return pickSensitiveConfig(normalizeConfig());
    const raw = safeStorage.decryptString(Buffer.from(encrypted.payload, 'base64'));
    return pickSensitiveConfig(normalizeConfig(JSON.parse(raw)));
  } catch {
    return pickSensitiveConfig(normalizeConfig());
  }
}

async function saveSensitiveConfig(config: AppConfig) {
  const sensitiveConfig = pickSensitiveConfig(config);
  if (!safeStorage.isEncryptionAvailable()) return;
  await ensureConfigDir();
  const encrypted = safeStorage.encryptString(JSON.stringify(sensitiveConfig)).toString('base64');
  await writeFile(getSecretsPath(), JSON.stringify({ payload: encrypted }, null, 2), 'utf-8');
}

function countRawInputFiles(rawInput?: ReportResult['rawInput']) {
  return rawInput?.files.split(/\r?\n/).filter(Boolean).length ?? 0;
}

function normalizeConfig(config?: Partial<AppConfig>): AppConfig {
  const workspaceDirs = normalizeWorkspaceDirs(config?.workspaceDirs, config?.workspaceDir);
  const ignoredRepoPaths = normalizeRepoPaths(config?.ignoredRepoPaths);
  const ignoredRepoPathSet = new Set(ignoredRepoPaths.map((item) => item.toLocaleLowerCase()));
  return {
    ...DEFAULT_CONFIG,
    ...config,
    workspaceDirs,
    workspaceDir: config?.workspaceDir || workspaceDirs[0] || '',
    selectedRepoPaths: normalizeRepoPaths(config?.selectedRepoPaths).filter((item) => !ignoredRepoPathSet.has(item.toLocaleLowerCase())),
    ignoredRepoPaths,
    pinnedRepoPaths: normalizeRepoPaths(config?.pinnedRepoPaths).filter((item) => !ignoredRepoPathSet.has(item.toLocaleLowerCase())),
    aiBaseUrlOptions: normalizeOptions(config?.aiBaseUrlOptions, DEFAULT_AI_BASE_URL_OPTIONS),
    aiModelOptions: normalizeOptions(config?.aiModelOptions, DEFAULT_AI_MODEL_OPTIONS),
    feishuForm: {
      ...DEFAULT_FEISHU_FORM_CONFIG,
      ...(config?.feishuForm ?? {}),
      defaultWorkHours: normalizeWorkHours(config?.feishuForm?.defaultWorkHours),
      projectWorkHours: normalizeProjectWorkHours(config?.feishuForm?.projectWorkHours),
    },
    autoSync: normalizeAutoSyncConfig(config?.autoSync),
  };
}

function normalizeWorkspaceDirs(options: unknown, currentWorkspaceDir?: string) {
  const source = Array.isArray(options) ? options : [];
  return Array.from(
    new Set(
      [...source, currentWorkspaceDir]
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function normalizeOptions(options: unknown, fallbackOptions: string[]) {
  const source = Array.isArray(options) ? options : fallbackOptions;
  return Array.from(new Set(source.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)));
}

function normalizeWorkHours(value: unknown, fallback = DEFAULT_FEISHU_FORM_CONFIG.defaultWorkHours) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return fallback;
  return Math.min(Math.max(normalized, 0.5), 24);
}

function normalizeProjectWorkHours(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, hours]) => [key.trim(), normalizeWorkHours(hours)] as const)
      .filter(([key]) => key),
  );
}

function normalizeRepoPaths(options: unknown) {
  const source = Array.isArray(options) ? options : [];
  return Array.from(new Set(source.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)));
}

function normalizeAutoSyncTime(time: unknown) {
  if (typeof time !== 'string') return DEFAULT_AUTO_SYNC_CONFIG.time;
  const normalizedTime = time.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime) ? normalizedTime : DEFAULT_AUTO_SYNC_CONFIG.time;
}

function normalizeAutoSyncStatus(status: unknown): AutoSyncStatus {
  return ['idle', 'running', 'success', 'failed', 'skipped'].includes(String(status)) ? (status as AutoSyncStatus) : 'idle';
}

function normalizeAutoSyncTimeWindowMode(mode: unknown): AutoSyncConfig['timeWindowMode'] {
  return mode === 'yesterday-start-to-run' ? 'yesterday-start-to-run' : DEFAULT_AUTO_SYNC_CONFIG.timeWindowMode;
}

function normalizeAutoSyncConfig(autoSync?: Partial<AutoSyncConfig>): AutoSyncConfig {
  return {
    ...DEFAULT_AUTO_SYNC_CONFIG,
    ...(autoSync ?? {}),
    enabled: Boolean(autoSync?.enabled),
    time: normalizeAutoSyncTime(autoSync?.time),
    timeWindowMode: normalizeAutoSyncTimeWindowMode(autoSync?.timeWindowMode),
    windowStartTime: normalizeAutoSyncTime(autoSync?.windowStartTime ?? DEFAULT_AUTO_SYNC_CONFIG.windowStartTime),
    lastRunAt: typeof autoSync?.lastRunAt === 'string' ? autoSync.lastRunAt : '',
    lastSuccessAt: typeof autoSync?.lastSuccessAt === 'string' ? autoSync.lastSuccessAt : '',
    lastStatus: normalizeAutoSyncStatus(autoSync?.lastStatus),
    lastMessage: typeof autoSync?.lastMessage === 'string' ? autoSync.lastMessage : '',
    lastRunKey: typeof autoSync?.lastRunKey === 'string' ? autoSync.lastRunKey : '',
    lastScheduledRunKey: typeof autoSync?.lastScheduledRunKey === 'string' ? autoSync.lastScheduledRunKey : '',
    lastSuccessKey: typeof autoSync?.lastSuccessKey === 'string' ? autoSync.lastSuccessKey : '',
  };
}

async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(getConfigPath(), 'utf-8');
    const diskConfig = normalizeConfig(JSON.parse(raw));
    const sensitiveConfig = await loadSensitiveConfig();
    return mergeSensitiveConfig(diskConfig, sensitiveConfig);
  } catch {
    return mergeSensitiveConfig(normalizeConfig(), await loadSensitiveConfig());
  }
}

async function saveConfig(config: AppConfig, options: { reschedule?: boolean; notify?: boolean } = {}) {
  const { reschedule = true, notify = true } = options;
  await ensureConfigDir();
  const normalizedConfig = normalizeConfig(config);
  if (hasSensitiveConfig(normalizedConfig) && !safeStorage.isEncryptionAvailable()) {
    throw new Error('密钥保护不可用，已阻止保存包含 AI Key、飞书 Cookie 或 CSRF Token 的配置，避免敏感配置保存后丢失。');
  }
  await saveSensitiveConfig(normalizedConfig);
  await writeFile(getConfigPath(), JSON.stringify(stripSensitiveConfig(normalizedConfig), null, 2), 'utf-8');
  if (reschedule) {
    scheduleAutoSync(normalizedConfig);
  }
  if (notify) {
    emitAutoSyncState(normalizedConfig);
  }
  return normalizedConfig;
}

async function getDatabase() {
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

    CREATE TABLE IF NOT EXISTS role_materials (
      role TEXT NOT NULL,
      date TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      extra_notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (role, date)
    );
  `);
  ensureDailyReportTimeRangeColumns(sqlDatabase);
  await persistDatabase();
  return sqlDatabase;
}

async function persistDatabase() {
  if (!sqlDatabase) return;
  await ensureConfigDir();
  await writeFile(getDatabasePath(), sqlDatabase.export());
}

function parseJsonArray(value: unknown) {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function ensureDailyReportTimeRangeColumns(db: import('sql.js').Database) {
  const columns = new Set((db.exec('PRAGMA table_info(daily_reports)')[0]?.values ?? []).map((row) => String(row[1])));
  if (!columns.has('start_datetime')) db.run('ALTER TABLE daily_reports ADD COLUMN start_datetime TEXT');
  if (!columns.has('end_datetime')) db.run('ALTER TABLE daily_reports ADD COLUMN end_datetime TEXT');
  if (!columns.has('time_range_label')) db.run('ALTER TABLE daily_reports ADD COLUMN time_range_label TEXT');
}

function rowToDailyReportTimeRange(row: Record<string, unknown>): ReportTimeRange | undefined {
  const startDateTime = String(row.start_datetime || '').trim();
  const endDateTime = String(row.end_datetime || '').trim();
  if (!startDateTime || !endDateTime) return undefined;

  return {
    startDateTime,
    endDateTime,
    label: String(row.time_range_label || '').trim() || `${startDateTime} 至 ${endDateTime}`,
  };
}

function rowToDailyReportRecord(row: Record<string, unknown>): DailyReportRecord {
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

function normalizeSyncTrigger(value: unknown): SyncLogRecord['triggerType'] {
  return value === 'scheduled' ? 'scheduled' : 'manual';
}

function normalizeSyncStatus(value: unknown): SyncLogRecord['status'] {
  return ['idle', 'running', 'success', 'failed', 'skipped'].includes(String(value))
    ? (String(value) as SyncLogRecord['status'])
    : 'failed';
}

function rowToSyncLogRecord(row: Record<string, unknown>): SyncLogRecord {
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

function rowToErrorLogRecord(row: Record<string, unknown>): ErrorLogRecord {
  return {
    id: Number(row.id) || 0,
    scope: String(row.scope || ''),
    message: String(row.message || ''),
    detail: String(row.detail || ''),
    createdAt: String(row.created_at || ''),
  };
}

async function getDailyReportById(id: number) {
  const db = await getDatabase();
  const statement = db.prepare('SELECT * FROM daily_reports WHERE id = ? LIMIT 1');
  try {
    statement.bind([id]);
    return statement.step() ? rowToDailyReportRecord(statement.getAsObject()) : null;
  } finally {
    statement.free();
  }
}

async function saveDailyReport(payload: SaveDailyReportPayload): Promise<DailyReportRecord> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const generatedAt = payload.generatedAt || now;
  const repoNamesJson = JSON.stringify(payload.repoNames);
  const repoPathsJson = JSON.stringify(payload.repoPaths);
  const rawInputJson = payload.rawInput ? JSON.stringify(payload.rawInput) : null;
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
           raw_input_json = COALESCE(?, raw_input_json)
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
        payload.id,
      ],
    );
    await persistDatabase();
    return (await getDailyReportById(payload.id)) as DailyReportRecord;
  }

  db.run(
    `INSERT INTO daily_reports
      (date, start_datetime, end_datetime, time_range_label, reporter_name, repo_names_json, repo_paths_json, report, status, commits_count, files_count, generated_at, updated_at, raw_input_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ],
  );
  const idResult = db.exec('SELECT last_insert_rowid() AS id');
  const id = Number(idResult[0]?.values[0]?.[0]) || 0;
  await persistDatabase();
  return (await getDailyReportById(id)) as DailyReportRecord;
}

async function listDailyReports(limit = 10): Promise<DailyReportRecord[]> {
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

function normalizeMaterialSections(value: unknown): MaterialSection[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        key: String(item.key || ''),
        label: String(item.label || ''),
        content: String(item.content || ''),
      }))
      .filter((section) => section.key);
  } catch {
    return [];
  }
}

async function saveRoleMaterial(payload: RoleMaterialPayload): Promise<RoleMaterialRecord> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const sectionsJson = JSON.stringify(payload.sections ?? []);
  db.run(
    `INSERT INTO role_materials (role, date, sections_json, extra_notes, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(role, date) DO UPDATE SET
       sections_json = excluded.sections_json,
       extra_notes = excluded.extra_notes,
       updated_at = excluded.updated_at`,
    [payload.role, payload.date, sectionsJson, payload.extraNotes ?? '', now],
  );
  await persistDatabase();
  return {
    role: payload.role,
    date: payload.date,
    sections: normalizeMaterialSections(sectionsJson),
    extraNotes: payload.extraNotes ?? '',
    updatedAt: now,
  };
}

async function loadRoleMaterial(role: MaterialRole, date: string): Promise<RoleMaterialRecord | null> {
  const db = await getDatabase();
  const statement = db.prepare('SELECT * FROM role_materials WHERE role = ? AND date = ? LIMIT 1');
  try {
    statement.bind([role, date]);
    if (!statement.step()) return null;
    const row = statement.getAsObject();
    return {
      role,
      date,
      sections: normalizeMaterialSections(row.sections_json),
      extraNotes: String(row.extra_notes || ''),
      updatedAt: String(row.updated_at || ''),
    };
  } finally {
    statement.free();
  }
}

async function listSyncLogs(limit = 20): Promise<SyncLogRecord[]> {
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

async function listErrorLogs(limit = 20): Promise<ErrorLogRecord[]> {
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

async function countTableRows(tableName: 'daily_reports' | 'sync_logs' | 'error_logs') {
  const db = await getDatabase();
  const result = db.exec(`SELECT COUNT(*) AS count FROM ${tableName}`);
  return Number(result[0]?.values[0]?.[0]) || 0;
}

async function getFileSize(filePath: string) {
  try {
    return (await stat(filePath)).size;
  } catch {
    return 0;
  }
}

async function getStorageInfo(): Promise<StorageInfo> {
  await getDatabase();
  return {
    appVersion: app.getVersion(),
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

async function recordGeneratedReport(params: GenerateReportParams, result: ReportResult) {
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
  });
}

async function recordSyncLog(payload: {
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

async function recordErrorLog(scope: string, error: unknown) {
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

function toLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getScheduledDate(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = normalizeAutoSyncTime(time).split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function buildAutoSyncTaskKey(config: AppConfig, date: string) {
  const repoKey = normalizeRepoPaths(config.selectedRepoPaths)
    .map((item) => item.toLocaleLowerCase())
    .sort()
    .join('|');
  const timeWindowKey = [
    normalizeAutoSyncTimeWindowMode(config.autoSync.timeWindowMode),
    normalizeAutoSyncTime(config.autoSync.windowStartTime),
  ].join('@');
  return [
    date,
    normalizeAuthorName(config.reporterName),
    config.feishuForm.projectOptionId.trim(),
    timeWindowKey,
    repoKey,
  ].join('::');
}

function buildAutoSyncReportWindow(config: AppConfig, now = new Date()) {
  const date = toLocalDateString(now);

  if (normalizeAutoSyncTimeWindowMode(config.autoSync.timeWindowMode) === 'yesterday-start-to-run') {
    const startDate = shiftDateString(date, -1);
    return {
      date,
      startDateTime: normalizeDateTimeValue(`${startDate}T${normalizeAutoSyncTime(config.autoSync.windowStartTime)}:00`),
      endDateTime: normalizeDateTimeValue(formatDateTimeForGit(now).replace(' ', 'T')),
    };
  }

  return {
    date,
    startDateTime: normalizeDateTimeValue(`${date}T00:00:00`),
    endDateTime: normalizeDateTimeValue(`${nextDateString(date)}T00:00:00`),
  };
}

function getNextAutoSyncRunDate(config: AppConfig, now = new Date()) {
  if (!config.autoSync.enabled) return null;

  const today = toLocalDateString(now);
  const scheduledToday = getScheduledDate(today, config.autoSync.time);
  const todayTaskKey = buildAutoSyncTaskKey(config, today);

  if (now.getTime() < scheduledToday.getTime()) {
    return scheduledToday;
  }

  if (config.autoSync.lastSuccessKey === todayTaskKey || config.autoSync.lastScheduledRunKey === todayTaskKey) {
    return getScheduledDate(nextDateString(today), config.autoSync.time);
  }

  return now;
}

function getAutoSyncState(config: AppConfig): AutoSyncState {
  const nextRunDate = getNextAutoSyncRunDate(config);
  return {
    ...config.autoSync,
    isRunning: autoSyncRunning,
    nextRunAt: nextRunDate ? nextRunDate.toISOString() : '',
  };
}

function emitAutoSyncState(config: AppConfig) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('auto-sync:updated', toCloneable(getAutoSyncState(config)));
}

function clearAutoSyncTimer() {
  if (!autoSyncTimer) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = null;
}

function scheduleAutoSync(config: AppConfig) {
  clearAutoSyncTimer();
  const nextRunDate = getNextAutoSyncRunDate(config);
  emitAutoSyncState(config);

  if (!nextRunDate) return;

  const delay = Math.max(0, nextRunDate.getTime() - Date.now());
  autoSyncTimer = setTimeout(() => {
    void runAutoSync('scheduled');
  }, Math.min(delay, 2_147_483_647));
}

async function refreshAutoSyncSchedule() {
  scheduleAutoSync(await loadConfig());
}

async function updateAutoSyncStatus(
  status: AutoSyncStatus,
  message: string,
  options: {
    runKey: string;
    ranAt: string;
    scheduled: boolean;
    success?: boolean;
  },
) {
  const latestConfig = await loadConfig();
  const autoSync: AutoSyncConfig = {
    ...latestConfig.autoSync,
    lastRunAt: options.ranAt,
    lastStatus: status,
    lastMessage: message,
    lastRunKey: options.runKey,
    lastScheduledRunKey: options.scheduled ? options.runKey : latestConfig.autoSync.lastScheduledRunKey,
    lastSuccessAt: options.success ? options.ranAt : latestConfig.autoSync.lastSuccessAt,
    lastSuccessKey: options.success ? options.runKey : latestConfig.autoSync.lastSuccessKey,
  };
  return saveConfig({ ...latestConfig, autoSync }, { reschedule: false });
}

function buildAutoSyncRunResult(
  config: AppConfig,
  status: AutoSyncStatus,
  message: string,
  ranAt: string,
  report?: string,
  commitsCount?: number,
  date?: string,
  timeRange?: ReportTimeRange,
): AutoSyncRunResult {
  return toCloneable({
    status,
    message,
    ranAt,
    nextRunAt: getAutoSyncState(config).nextRunAt,
    report,
    date,
    timeRange,
    commitsCount,
  });
}

async function hasGitMetadata(dir: string) {
  try {
    const info = await stat(join(dir, '.git'));
    return info.isDirectory() || info.isFile();
  } catch {
    return false;
  }
}

async function scanRepositories(rootDir: string): Promise<RepoInfo[]> {
  const repos: RepoInfo[] = [];
  const stack = [resolve(rootDir)];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    if (await hasGitMetadata(current)) {
      repos.push({ name: basename(current), path: current });
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      stack.push(join(current, entry.name));
    }
  }

  return repos.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

function shiftDateString(date: string, deltaDays: number) {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + deltaDays);
  const shiftedYear = shifted.getFullYear();
  const shiftedMonth = String(shifted.getMonth() + 1).padStart(2, '0');
  const shiftedDay = String(shifted.getDate()).padStart(2, '0');
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}

function nextDateString(date: string) {
  return shiftDateString(date, 1);
}

type NormalizedReportTimeRange = ReportTimeRange & {
  startMs: number;
  endMs: number;
};

function parseLocalDateTimeMs(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second = '0'] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getTime();
}

function normalizeDateTimeValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return value.trim();
  const [, year, month, day, hour, minute, second = '00'] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second.padStart(2, '0')}`;
}

function formatDateTimeForDisplay(value: string) {
  return normalizeDateTimeValue(value).replace('T', ' ').replace(/:00$/, '');
}

function formatDateTimeForGit(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function normalizeReportTimeRange(params: GenerateReportParams): NormalizedReportTimeRange {
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

async function collectGitData(repoPath: string, timeRange: NormalizedReportTimeRange) {
  const git = simpleGit(repoPath);
  const marker = '__COMMIT__';
  // git log 的 --since/--until 过滤的是 committer date，但日报关心的是 author date：
  // 提交被 rebase / merge 后 committer date 会被刷新到处理那一刻，author date 仍是当初写代码的时间。
  // 因此这里只用宽松的 committer-date 下界做粗筛（committer date 一般 ≥ author date），不设 --until，
  // 再在 JS 里按 author date(%ad) 精确筛到目标时间段，避免漏掉「前一时间段写、之后才合并」的提交。
  const coarseSince = formatDateTimeForGit(new Date(timeRange.startMs - 2 * 24 * 60 * 60 * 1000));

  const logOutput = await git.raw([
    'log',
    `--since=${coarseSince}`,
    `--pretty=format:${marker}%H%x09%ad%x09%an%x09%s`,
    '--date=iso-strict',
    '--name-only',
    '--no-merges',
  ]);

  const commits: CommitEntry[] = [];
  let current: CommitEntry | null = null;

  for (const rawLine of logOutput.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line.startsWith(marker)) {
      const [hash, commitDate, author, message] = line.slice(marker.length).split('\t');
      const authoredMs = new Date(commitDate).getTime();
      if (Number.isNaN(authoredMs) || authoredMs < timeRange.startMs || authoredMs >= timeRange.endMs) {
        current = null; // 非目标时间段创作，跳过该提交（其 --name-only 文件行也随之忽略）
        continue;
      }
      current = { hash, date: commitDate, author, message, files: [], show: '' };
      commits.push(current);
      continue;
    }
    if (current && !line.startsWith(' ')) {
      current.files.push(line.trim());
    }
  }

  for (const commit of commits) {
    const show = await git.raw([
      'show',
      commit.hash,
      '--stat',
      '--summary',
      '--format=medium',
      '--no-ext-diff',
      '--unified=3',
    ]);
    commit.show = show.slice(0, 4000);
  }

  return formatCollectedGitData(commits);
}

function normalizeAuthorName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function filterCommitsByReporter(commits: CommitEntry[], reporterName: string) {
  const normalizedReporterName = normalizeAuthorName(reporterName);
  if (!normalizedReporterName) return commits;
  return commits.filter((commit) => normalizeAuthorName(commit.author) === normalizedReporterName);
}

function formatCollectedGitData(commits: CommitEntry[]) {
  const gitLogs = commits
    .map((commit, index) => {
      const fileList = commit.files.length ? commit.files.join(', ') : '无';
      return `${index + 1}. ${commit.date} | 作者: ${commit.author} | ${commit.message} | 文件: ${fileList}`;
    })
    .join('\n');

  const files = [...new Set(commits.flatMap((commit) => commit.files))].join('\n');
  const diff = commits.map((commit) => `### ${commit.hash}\n${commit.show}`).join('\n\n').slice(0, 12000);

  return { commits, gitLogs, files, diff };
}

function normalizeAiBaseUrl(aiBaseUrl: string) {
  return aiBaseUrl.trim().replace(/\/+$/, '');
}

function getChatCompletionsUrl(aiBaseUrl: string) {
  const baseUrl = normalizeAiBaseUrl(aiBaseUrl);
  return baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
}

function getModelsUrl(aiBaseUrl: string) {
  const baseUrl = normalizeAiBaseUrl(aiBaseUrl);
  return baseUrl.endsWith('/chat/completions') ? baseUrl.replace(/\/chat\/completions$/, '/models') : `${baseUrl}/models`;
}

function parseAiError(detail: string) {
  if (!detail) return '';
  try {
    const data = JSON.parse(detail) as { error?: unknown; message?: unknown };
    if (typeof data.error === 'string') return data.error;
    if (typeof data.message === 'string') return data.message;
    if (data.error && typeof data.error === 'object' && 'message' in data.error) {
      const message = (data.error as { message?: unknown }).message;
      return typeof message === 'string' ? message : detail;
    }
  } catch {
    return detail;
  }
  return detail;
}

function isUnsupportedModelError(status: number, detail: string) {
  const message = parseAiError(detail);
  return status === 404 && /模型|model/i.test(message) && /不支持|unsupported|not\s+support/i.test(message);
}

async function fetchAvailableModels(config: AppConfig) {
  try {
    const response = await fetch(getModelsUrl(config.aiBaseUrl), {
      headers: { Authorization: `Bearer ${config.aiApiKey}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.data)) return [];
    return data.data
      .map((item: { id?: unknown }) => item.id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, 20);
  } catch {
    return [];
  }
}

async function buildAiErrorMessage(config: AppConfig, response: Response, detail: string) {
  const parsedDetail = parseAiError(detail);
  if (isUnsupportedModelError(response.status, detail)) {
    const models = await fetchAvailableModels(config);
    const modelTips = models.length
      ? `；/models 可查询到的模型包括：${models.join('、')}。注意：模型列表不一定代表当前 /chat/completions 接口全部可用`
      : '；同时未能从 /models 获取可用模型列表';
    return `AI接口调用失败：当前接口不支持模型 ${config.aiModel}${modelTips}。请在基础配置中更换为服务方明确支持 Chat Completions 的模型。原始错误：${parsedDetail || `${response.status} ${response.statusText}`}`;
  }
  return `AI接口调用失败：${response.status} ${response.statusText}${parsedDetail ? `，返回内容：${parsedDetail.slice(0, 500)}` : ''}`;
}

async function callAiReport(config: AppConfig, rawInput: { gitLogs: string; files: string; diff: string }, timeRange: ReportTimeRange) {
  const prompt = `你是一名资深软件研发工程师。

请根据以下Git提交记录、修改文件和代码变更内容，总结所选时间段内的工作内容。

要求：
1. 不要出现commit、git等技术词汇。
2. 使用正式工作日报语言。
3. 每条内容控制在30-80字。
4. 按实际功能归纳。
5. 相同模块合并总结。
6. 输出3-5条工作内容。
7. 自动生成明日计划。
8. 只能依据提供的Git数据、修改文件和代码变更总结，禁止补写未出现的工作内容。

时间范围：
${timeRange.label}

Git数据：
${rawInput.gitLogs}

修改文件：
${rawInput.files}

代码变更：
${rawInput.diff}

输出格式：

今日工作内容：

1.
2.
3.

工作成果：

1.
2.

明日计划：

1.
2.`;

  const chatCompletionsUrl = getChatCompletionsUrl(config.aiBaseUrl);

  const response = await fetch(chatCompletionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.aiApiKey}`,
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages: [
        { role: 'system', content: '你是一名严谨的中文工作日报助手。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(await buildAiErrorMessage(config, response, detail));
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('AI接口未返回有效内容');
  }
  return content.trim();
}

function formatNumbered(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function fallbackReport(repoNames: string[], date: string, reporterName: string, commits: CommitEntry[], timeRange: ReportTimeRange) {
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

async function generateReport(params: GenerateReportParams): Promise<ReportResult> {
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

const MATERIAL_ROLE_LABELS: Record<MaterialRole, string> = {
  projectManager: '项目经理',
  productManager: '产品经理',
};

/** 把用户填写的分区素材拼成给 AI 或 fallback 使用的文本；空分区会被跳过。 */
function formatMaterialSections(sections: MaterialSection[], extraNotes: string) {
  const filledSections = sections.filter((section) => section.content.trim());
  const sectionText = filledSections
    .map((section) => `【${section.label}】\n${section.content.trim()}`)
    .join('\n\n');
  const normalizedNotes = extraNotes.trim();
  const notesText = normalizedNotes ? `\n\n【补充说明】\n${normalizedNotes}` : '';
  return {
    hasContent: Boolean(filledSections.length || normalizedNotes),
    text: `${sectionText}${notesText}`.trim(),
  };
}

async function callAiMaterialReport(config: AppConfig, params: GenerateFromMaterialParams, materialText: string) {
  const roleLabel = MATERIAL_ROLE_LABELS[params.role];
  const prompt = `你是一名资深${roleLabel}。

请根据以下我提供的工作素材，整理成一份正式的中文${roleLabel}日报。

要求：
1. 使用正式工作日报语言，条理清晰。
2. 按素材中的分区归纳，同类事项合并表述。
3. 只能依据我提供的素材整理，禁止补写、推断或编造素材中未出现的任何内容、结论或数据。
4. 如某方面素材为空，则该部分不输出，不要用占位内容填充。
5. 保留关键事实（进度、结论、风险、待确认事项等），不要丢失信息。

日期：${params.date}
汇报人：${params.reporterName}

工作素材：
${materialText}`;

  const chatCompletionsUrl = getChatCompletionsUrl(config.aiBaseUrl);

  const response = await fetch(chatCompletionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.aiApiKey}`,
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages: [
        { role: 'system', content: `你是一名严谨的中文${roleLabel}日报助手，只依据用户提供的素材整理，绝不编造。` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(await buildAiErrorMessage(config, response, detail));
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('AI接口未返回有效内容');
  }
  return content.trim();
}

/** 无 AI Key 或调用失败时，把素材结构化排版成日报，不做任何推断。 */
function fallbackMaterialReport(params: GenerateFromMaterialParams) {
  const roleLabel = MATERIAL_ROLE_LABELS[params.role];
  const filledSections = params.sections.filter((section) => section.content.trim());
  const sectionBlocks = filledSections.map((section, index) => {
    const items = section.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return [`${index + 1}、${section.label}`, '', formatNumbered(items)].join('\n');
  });
  const normalizedNotes = params.extraNotes.trim();
  const notesBlock = normalizedNotes ? ['补充说明：', '', normalizedNotes] : [];

  return [
    `${params.date} ${roleLabel}日报`,
    '',
    ...(sectionBlocks.length ? [sectionBlocks.join('\n\n')] : ['本时间段暂无填写的工作素材。']),
    ...(notesBlock.length ? ['', ...notesBlock] : []),
    '',
    `汇报人：${params.reporterName}`,
    `日期：${params.date}`,
  ].join('\n');
}

async function generateReportFromMaterial(params: GenerateFromMaterialParams): Promise<MaterialReportResult> {
  const config = await loadConfig();
  const generatedAt = new Date().toISOString();
  const { hasContent, text } = formatMaterialSections(params.sections, params.extraNotes);

  if (!hasContent) {
    throw new Error('请至少填写一项工作素材后再生成日报');
  }

  let report = '';
  if (config.aiApiKey) {
    try {
      report = await callAiMaterialReport(config, params, text);
    } catch (error) {
      report = fallbackMaterialReport(params);
      report = `${report}\n\nAI提示：${error instanceof Error ? error.message : '调用失败'}`;
    }
  } else {
    report = fallbackMaterialReport(params);
    report = `${report}\n\nAI提示：请先在设置中配置 OpenAI 兼容接口。`;
  }

  return { report, role: params.role, date: params.date, generatedAt };
}

function requireFeishuConfigValue(value: string, label: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new Error(`请先填写${label}`);
  }
  return normalizedValue;
}

function dateToFeishuDateValue(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error('日报日期格式不正确');
  }
  return Date.UTC(year, month - 1, day);
}

function extractReportSection(report: string, sectionTitle: string) {
  const lines = report.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim().startsWith(sectionTitle));
  if (startIndex < 0) return '';

  const sectionLines: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    const trimmed = line.trim();
    if (/^(今日工作内容|工作成果|工作时长|明日计划|汇报人|日期)[：:]/.test(trimmed)) {
      break;
    }
    if (trimmed) sectionLines.push(trimmed);
  }
  return sectionLines.join('\n').trim();
}

function buildFeishuFormData(payload: SyncFeishuDailyPayload) {
  const formConfig = payload.config;
  const reporterName = formConfig.reporterName.trim() || payload.reporterName.trim();
  const workContent = extractReportSection(payload.report, '今日工作内容') || payload.report.trim();
  const selectedWorkHours = normalizeWorkHours(payload.workHours, formConfig.defaultWorkHours || DEFAULT_FEISHU_FORM_CONFIG.defaultWorkHours);
  const reporterUser: { userId: string; name: string; enName: string; notify: boolean; avatarUrl?: string } = {
    userId: requireFeishuConfigValue(formConfig.reporterUserId, '飞书汇报人 userId'),
    name: requireFeishuConfigValue(reporterName, '飞书汇报人名称'),
    enName: reporterName,
    notify: false,
  };

  if (formConfig.reporterAvatarUrl.trim()) {
    reporterUser.avatarUrl = formConfig.reporterAvatarUrl.trim();
  }

  return {
    [requireFeishuConfigValue(formConfig.dateFieldId, '日期字段 ID')]: {
      type: 5,
      value: dateToFeishuDateValue(payload.date),
    },
    [requireFeishuConfigValue(formConfig.userFieldId, '汇报人字段 ID')]: {
      type: 11,
      value: {
        users: [reporterUser],
      },
    },
    [requireFeishuConfigValue(formConfig.questionId, '明细表问题 ID')]: {
      type: 21,
      value: [
        {
          [requireFeishuConfigValue(formConfig.projectFieldId, '所属项目字段 ID')]: {
            type: 4,
            value: [requireFeishuConfigValue(formConfig.projectOptionId, '所属项目选项 ID')],
          },
          [requireFeishuConfigValue(formConfig.hoursFieldId, '工作时长字段 ID')]: {
            type: 2,
            value: selectedWorkHours,
          },
          [requireFeishuConfigValue(formConfig.contentFieldId, '工作内容字段 ID')]: {
            type: 1,
            value: [
              {
                type: 'text',
                text: workContent,
              },
            ],
          },
        },
      ],
    },
  };
}

function getFeishuRequestContext(endpoint: string, shareToken: string) {
  const url = new URL(endpoint);
  return {
    origin: url.origin,
    referer: `${url.origin}/share/base/form/${shareToken}?chunked=false`,
  };
}

function getFeishuFormPageUrl(config: FeishuFormConfig) {
  const endpoint = requireFeishuConfigValue(config.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(config), '飞书表单 shareToken');
  const { referer } = getFeishuRequestContext(endpoint, shareToken);
  return referer;
}

function extractFeishuShareToken(value: string) {
  const source = value.trim();
  if (!source) return '';

  try {
    const url = new URL(source);
    const queryToken = url.searchParams.get('shareToken')?.trim();
    if (queryToken) return queryToken;

    const formToken = url.pathname.match(/\/share\/base\/form\/([^/?#]+)/)?.[1];
    if (formToken) return decodeURIComponent(formToken);
  } catch {
    // The value may already be a raw token or a partial URL.
  }

  const rawToken = source.match(/\bshr[a-zA-Z0-9_-]+\b/)?.[0];
  return rawToken ?? '';
}

function getFeishuShareToken(config: FeishuFormConfig) {
  return config.shareToken.trim() || extractFeishuShareToken(config.endpoint);
}

function getCurrentFeishuWindowShareToken() {
  if (!feishuWindow || feishuWindow.isDestroyed()) return '';
  return extractFeishuShareToken(feishuWindow.webContents.getURL());
}

function getCurrentFeishuWindowOrigin() {
  if (!feishuWindow || feishuWindow.isDestroyed()) return '';
  try {
    const url = new URL(feishuWindow.webContents.getURL());
    return url.origin;
  } catch {
    return '';
  }
}

function inferFeishuSubmitEndpoint(origin: string) {
  return origin ? `${origin}${FEISHU_SHARE_SUBMIT_PATH}` : '';
}

function getFeishuLoginTargetUrl(config: FeishuFormConfig) {
  const endpoint = config.endpoint.trim();
  const shareToken = getFeishuShareToken(config);
  if (!endpoint) {
    return FEISHU_LOGIN_HOME_URL;
  }
  if (!shareToken) {
    return new URL(endpoint).origin;
  }
  const { referer } = getFeishuRequestContext(endpoint, shareToken);
  return referer;
}

function getFeishuContentMetaUrl(config: FeishuFormConfig) {
  const endpoint = requireFeishuConfigValue(config.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(config), '飞书表单 shareToken');
  const url = new URL(endpoint);
  url.pathname = '/space/api/bitable/external/share/content_meta';
  url.search = '';
  url.searchParams.set('shareToken', shareToken);
  return url.toString();
}

async function getFeishuCookieHeader(origin: string, fallbackCookie: string) {
  const feishuSession = feishuWindow && !feishuWindow.isDestroyed() ? feishuWindow.webContents.session : session.fromPartition(FEISHU_PARTITION);
  const cookies = await feishuSession.cookies.get({ url: origin });
  const sessionCookie = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  return sessionCookie || fallbackCookie.trim();
}

function getCookieValue(cookieHeader: string, names: string[]) {
  const cookieMap = new Map(
    cookieHeader
      .split(';')
      .map((item) => {
        const index = item.indexOf('=');
        if (index < 0) return [item.trim(), ''] as const;
        return [item.slice(0, index).trim(), item.slice(index + 1).trim()] as const;
      })
      .filter(([key]) => key),
  );
  const matchedValue = names.map((name) => cookieMap.get(name)).find((value) => value);
  return matchedValue ? decodeURIComponent(matchedValue) : '';
}

function getFeishuCsrfToken(cookieHeader: string, fallbackCsrfToken: string) {
  return getCookieValue(cookieHeader, ['_csrf_token', 'swp_csrf_token']) || fallbackCsrfToken.trim();
}

async function readFeishuAuthSnapshot(config: FeishuFormConfig): Promise<FeishuAuthSnapshot> {
  const currentOrigin = getCurrentFeishuWindowOrigin();
  const currentShareToken = getCurrentFeishuWindowShareToken();
  const shareToken = getFeishuShareToken(config) || currentShareToken;
  const endpoint = config.endpoint.trim() || (currentShareToken ? inferFeishuSubmitEndpoint(currentOrigin) : '');
  if (!endpoint) {
    return {
      endpoint,
      shareToken,
      cookie: config.cookie.trim(),
      csrfToken: config.csrfToken.trim(),
    };
  }

  const origin = new URL(endpoint).origin;
  const cookie = await getFeishuCookieHeader(origin, config.cookie);
  return {
    endpoint,
    shareToken,
    cookie,
    csrfToken: getFeishuCsrfToken(cookie, config.csrfToken),
  };
}

function shouldEmitFeishuAuthSnapshot(snapshot: FeishuAuthSnapshot) {
  return Boolean(snapshot.shareToken || snapshot.cookie || snapshot.csrfToken);
}

function emitFeishuAuthSnapshot(snapshot: FeishuAuthSnapshot) {
  if (!mainWindow || mainWindow.isDestroyed() || !shouldEmitFeishuAuthSnapshot(snapshot)) return;

  const signature = JSON.stringify(snapshot);
  if (signature === lastFeishuAuthSignature) return;
  lastFeishuAuthSignature = signature;
  mainWindow.webContents.send('feishu:auth-updated', snapshot);
}

function scheduleFeishuAuthSync(config: FeishuFormConfig) {
  if (feishuAuthSyncTimer) {
    clearTimeout(feishuAuthSyncTimer);
  }

  feishuAuthSyncTimer = setTimeout(() => {
    void readFeishuAuthSnapshot(config)
      .then(emitFeishuAuthSnapshot)
      .catch((error) => {
        console.warn('Failed to sync Feishu auth snapshot:', error);
      });
  }, 500);
}

function watchFeishuAuthSession(config: FeishuFormConfig) {
  removeFeishuAuthSessionWatcher?.();
  const feishuSession = session.fromPartition(FEISHU_PARTITION);
  const listener = () => scheduleFeishuAuthSync(config);
  feishuSession.cookies.on('changed', listener);
  removeFeishuAuthSessionWatcher = () => {
    feishuSession.cookies.removeListener('changed', listener);
    removeFeishuAuthSessionWatcher = null;
  };
}

async function resolveFeishuAuth(formConfig: FeishuFormConfig, label: string) {
  const endpoint = requireFeishuConfigValue(formConfig.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(formConfig), '飞书表单 shareToken');
  const { origin, referer } = getFeishuRequestContext(endpoint, shareToken);
  const cookie = await getFeishuCookieHeader(origin, formConfig.cookie);
  const csrfToken = getFeishuCsrfToken(cookie, formConfig.csrfToken);

  if (!cookie) {
    throw new Error(`${label}：未找到飞书登录态，请先点击“登录飞书”完成登录，或填写完整有效的飞书 Cookie`);
  }
  if (!csrfToken) {
    throw new Error(`${label}：未在飞书登录态中找到 _csrf_token 或 swp_csrf_token，请重新登录飞书后再试`);
  }

  return { endpoint, shareToken, origin, referer, cookie, csrfToken };
}

async function validateAutoSyncConfig(config: AppConfig) {
  const repoPaths = normalizeRepoPaths(config.selectedRepoPaths);
  if (!repoPaths.length) {
    throw new Error('请至少选择一个项目后再启用自动同步');
  }
  requireFeishuConfigValue(config.reporterName, '汇报人');

  const formConfig: FeishuFormConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...config.feishuForm,
  };
  requireFeishuConfigValue(formConfig.projectOptionId, '飞书所属项目');
  requireFeishuConfigValue(formConfig.reporterUserId, '飞书汇报人 userId');
  requireFeishuConfigValue(formConfig.questionId, '明细表问题 ID');
  requireFeishuConfigValue(formConfig.dateFieldId, '日期字段 ID');
  requireFeishuConfigValue(formConfig.userFieldId, '汇报人字段 ID');
  requireFeishuConfigValue(formConfig.projectFieldId, '所属项目字段 ID');
  requireFeishuConfigValue(formConfig.hoursFieldId, '工作时长字段 ID');
  requireFeishuConfigValue(formConfig.contentFieldId, '工作内容字段 ID');
  await resolveFeishuAuth(formConfig, '自动同步配置校验失败');
}

async function validateAutoSync(config: AppConfig) {
  try {
    await validateAutoSyncConfig(normalizeConfig(config));
    return { valid: true, message: '自动同步配置可用' };
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : '自动同步配置不可用' };
  }
}

function parseFeishuSnapshot(meta: unknown) {
  const data = meta as { data?: { snapshot?: unknown } };
  const snapshotRaw = data?.data?.snapshot;
  if (typeof snapshotRaw !== 'string') {
    throw new Error('飞书表单解析失败：接口未返回 snapshot');
  }

  return JSON.parse(snapshotRaw) as {
    fieldMap?: Record<
      string,
      {
        id?: unknown;
        name?: unknown;
        type?: unknown;
        property?: {
          options?: Array<{ id?: unknown; name?: unknown; color?: unknown }>;
        };
      }
    >;
  };
}

function getFeishuFieldTypeLabel(type: unknown) {
  const typeMap: Record<string, string> = {
    '1': '文本',
    '2': '数字',
    '4': '单选',
    '5': '日期',
    '11': '人员',
    '21': '明细表',
  };
  return typeMap[String(type)] ?? `类型 ${String(type || '未知')}`;
}

function parseFeishuFieldOptions(meta: unknown): FeishuFieldOption[] {
  const snapshot = parseFeishuSnapshot(meta);
  const fieldEntries = Object.entries(snapshot.fieldMap ?? {});
  return fieldEntries
    .map(([key, field]) => {
      const id = typeof field.id === 'string' && field.id.trim() ? field.id.trim() : key;
      const name = typeof field.name === 'string' && field.name.trim() ? field.name.trim() : id;
      const type = typeof field.type === 'number' || typeof field.type === 'string' ? field.type : '';
      return {
        id,
        name,
        type,
        typeLabel: getFeishuFieldTypeLabel(type),
      };
    })
    .filter((field) => field.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

function parseFeishuProjectOptions(meta: unknown, projectFieldId: string): FeishuProjectOption[] {
  const snapshot = parseFeishuSnapshot(meta);
  const options = snapshot.fieldMap?.[projectFieldId]?.property?.options;
  if (!Array.isArray(options)) {
    throw new Error(`飞书项目列表解析失败：未找到字段 ${projectFieldId} 的 options`);
  }

  return options
    .map((option) => ({
      id: typeof option.id === 'string' ? option.id : '',
      name: typeof option.name === 'string' ? option.name : '',
      color: typeof option.color === 'number' ? option.color : undefined,
    }))
    .filter((option) => option.id && option.name);
}

async function fetchFeishuContentMeta(formConfig: FeishuFormConfig, label: string) {
  const endpoint = requireFeishuConfigValue(formConfig.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(formConfig), '飞书表单 shareToken');
  const { origin, referer } = getFeishuRequestContext(endpoint, shareToken);
  const cookie = await getFeishuCookieHeader(origin, formConfig.cookie);
  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    origin,
    referer,
  };
  if (cookie) {
    headers.cookie = cookie;
  }

  const response = await fetch(getFeishuContentMetaUrl(formConfig), {
    headers: {
      ...headers,
    },
  });
  const detail = await response.text();

  if (!response.ok) {
    throw new Error(`${label}：${response.status} ${response.statusText}${detail ? `，返回：${detail.slice(0, 500)}` : ''}`);
  }

  let meta: unknown;
  try {
    meta = JSON.parse(detail);
  } catch {
    throw new Error(`${label}：接口返回内容不是 JSON：${detail.slice(0, 500)}`);
  }

  const result = meta as { code?: number; msg?: string };
  if (result.code !== 0) {
    if (result.msg === 'Login Required') {
      throw new Error(`${label}：飞书登录态无效或已过期，请先点击“登录飞书”完成登录，或填写完整有效的飞书 Cookie`);
    }
    throw new Error(`${label}：${result.msg || `code=${result.code}`}`);
  }

  return meta;
}

async function listFeishuFieldOptions(payload: FeishuProjectOptionsPayload): Promise<FeishuFieldOption[]> {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const meta = await fetchFeishuContentMeta(formConfig, '获取飞书字段列表失败');
  return parseFeishuFieldOptions(meta);
}

async function listFeishuProjectOptions(payload: FeishuProjectOptionsPayload): Promise<FeishuProjectOption[]> {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const meta = await fetchFeishuContentMeta(formConfig, '获取飞书项目列表失败');

  return parseFeishuProjectOptions(meta, requireFeishuConfigValue(formConfig.projectFieldId, '所属项目字段 ID'));
}

function buildFeishuTestFormData(config: FeishuFormConfig, date: string) {
  const reporterName = requireFeishuConfigValue(config.reporterName, '飞书汇报人名称');
  const reporterUser: { userId: string; name: string; enName: string; notify: boolean; avatarUrl?: string } = {
    userId: requireFeishuConfigValue(config.reporterUserId, '飞书汇报人 userId'),
    name: reporterName,
    enName: reporterName,
    notify: false,
  };

  if (config.reporterAvatarUrl.trim()) {
    reporterUser.avatarUrl = config.reporterAvatarUrl.trim();
  }

  return {
    [requireFeishuConfigValue(config.dateFieldId, '日期字段 ID')]: {
      type: 5,
      value: dateToFeishuDateValue(date),
    },
    [requireFeishuConfigValue(config.userFieldId, '汇报人字段 ID')]: {
      type: 11,
      value: {
        users: [reporterUser],
      },
    },
    [requireFeishuConfigValue(config.questionId, '明细表问题 ID')]: {
      type: 21,
      value: [
        {
          [requireFeishuConfigValue(config.projectFieldId, '所属项目字段 ID')]: {
            type: 4,
            value: [requireFeishuConfigValue(config.projectOptionId, '所属项目选项 ID')],
          },
          [requireFeishuConfigValue(config.hoursFieldId, '工作时长字段 ID')]: {
            type: 2,
            value: config.defaultWorkHours || 8,
          },
          [requireFeishuConfigValue(config.contentFieldId, '工作内容字段 ID')]: {
            type: 1,
            value: [
              {
                type: 'text',
                text: `[GitInsight 测试记录] 表单连通性验证，请勿作为正式日报统计。提交时间：${new Date().toISOString()}`,
              },
            ],
          },
        },
      ],
    },
  };
}

async function openFeishuLogin(payload: FeishuLoginPayload) {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const targetUrl = getFeishuLoginTargetUrl(formConfig);
  watchFeishuAuthSession(formConfig);

  if (feishuWindow && !feishuWindow.isDestroyed()) {
    feishuWindow.show();
    feishuWindow.focus();
    await feishuWindow.loadURL(targetUrl);
    const snapshot = await readFeishuAuthSnapshot(formConfig);
    emitFeishuAuthSnapshot(snapshot);
    return snapshot;
  }

  feishuWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 960,
    minHeight: 720,
    title: '登录飞书',
    icon: getWindowOptionsIcon(),
    webPreferences: {
      partition: FEISHU_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  feishuWindow.on('closed', () => {
    feishuWindow = null;
  });
  feishuWindow.webContents.on('did-navigate', () => scheduleFeishuAuthSync(formConfig));
  feishuWindow.webContents.on('did-navigate-in-page', () => scheduleFeishuAuthSync(formConfig));
  feishuWindow.webContents.on('did-finish-load', () => scheduleFeishuAuthSync(formConfig));

  await feishuWindow.loadURL(targetUrl);
  const snapshot = await readFeishuAuthSnapshot(formConfig);
  emitFeishuAuthSnapshot(snapshot);
  return snapshot;
}

async function testSubmitFeishuForm(payload: FeishuTestSubmitPayload): Promise<FeishuSubmitResult> {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const endpoint = requireFeishuConfigValue(formConfig.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(formConfig), '飞书表单 shareToken');
  const data = buildFeishuTestFormData(formConfig, payload.date);
  const requestId = `gitinsight-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const auth = await resolveFeishuAuth(formConfig, '飞书测试提交失败');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      cookie: auth.cookie,
      origin: auth.origin,
      referer: auth.referer,
      'request-id': requestId,
      'x-csrftoken': auth.csrfToken,
      'x-request-id': requestId,
    },
    body: JSON.stringify({
      shareToken,
      data: JSON.stringify(data),
      preUploadEnable: false,
    }),
  });
  const result = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    text: await response.text(),
  };

  if (!result.ok) {
    throw new Error(`飞书测试提交失败：${result.status} ${result.statusText}${result.text ? `，返回：${result.text.slice(0, 500)}` : ''}`);
  }

  let parsed: FeishuSubmitResult;
  try {
    parsed = JSON.parse(result.text) as FeishuSubmitResult;
  } catch {
    throw new Error(`飞书测试提交失败：接口返回内容不是 JSON：${result.text.slice(0, 500)}`);
  }

  if (parsed.code !== 0) {
    if (parsed.msg === 'Login Required') {
      throw new Error('飞书测试提交失败：飞书登录态无效或已过期，请重新点击“登录飞书”完成登录');
    }
    throw new Error(`飞书测试提交失败：${parsed.msg || `code=${parsed.code}`}`);
  }

  return parsed;
}

async function syncFeishuDaily(payload: SyncFeishuDailyPayload) {
  const formConfig: FeishuFormConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const startedAt = Date.now();
  try {
    const auth = await resolveFeishuAuth(formConfig, '同步飞书日报失败');
    const requestId = `gitinsight-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const response = await fetch(auth.endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        cookie: auth.cookie,
        origin: auth.origin,
        referer: auth.referer,
        'request-id': requestId,
        'x-csrftoken': auth.csrfToken,
        'x-request-id': requestId,
      },
      body: JSON.stringify({
        shareToken: auth.shareToken,
        data: JSON.stringify(buildFeishuFormData({ ...payload, config: formConfig })),
        preUploadEnable: false,
      }),
    });

    const detail = await response.text();
    if (!response.ok) {
      throw new Error(`同步飞书日报失败：${response.status} ${response.statusText}${detail ? `，返回：${detail.slice(0, 500)}` : ''}`);
    }

    let result: { code?: number; msg?: string } = {};
    try {
      result = JSON.parse(detail);
    } catch {
      throw new Error(`同步飞书日报失败：接口返回内容不是 JSON：${detail.slice(0, 500)}`);
    }

    if (result.code !== 0) {
      throw new Error(`同步飞书日报失败：${result.msg || `code=${result.code}`}`);
    }

    await recordSyncLog({
      reportId: payload.reportId,
      date: payload.date,
      triggerType: payload.triggerType || 'manual',
      status: 'success',
      message: '同步飞书日报成功',
      durationMs: Date.now() - startedAt,
    });
    return true;
  } catch (error) {
    await recordSyncLog({
      reportId: payload.reportId,
      date: payload.date,
      triggerType: payload.triggerType || 'manual',
      status: 'failed',
      message: error instanceof Error ? error.message : '同步飞书失败',
      durationMs: Date.now() - startedAt,
    });
    await recordErrorLog('syncFeishuDaily', error);
    throw error;
  }
}

async function runAutoSync(trigger: 'scheduled' | 'manual'): Promise<AutoSyncRunResult> {
  const initialConfig = await loadConfig();
  const runDate = new Date();
  const initialReportWindow = buildAutoSyncReportWindow(initialConfig, runDate);
  const runKey = buildAutoSyncTaskKey(initialConfig, initialReportWindow.date);
  const ranAt = runDate.toISOString();
  const isScheduled = trigger === 'scheduled';

  if (autoSyncRunning) {
    return buildAutoSyncRunResult(initialConfig, 'skipped', '已有自动同步任务正在执行', ranAt);
  }

  if (isScheduled && !initialConfig.autoSync.enabled) {
    return buildAutoSyncRunResult(initialConfig, 'skipped', '自动同步未启用', ranAt);
  }

  if (isScheduled && initialConfig.autoSync.lastSuccessKey === runKey) {
    const savedConfig = await updateAutoSyncStatus('skipped', '今日相同配置已成功同步，本次跳过', {
      runKey,
      ranAt,
      scheduled: isScheduled,
    });
    return buildAutoSyncRunResult(savedConfig, 'skipped', '今日相同配置已成功同步，本次跳过', ranAt);
  }

  autoSyncRunning = true;
  await updateAutoSyncStatus('running', '自动同步执行中', { runKey, ranAt, scheduled: isScheduled });

  try {
    const config = await loadConfig();
    await validateAutoSyncConfig(config);

    const repoPaths = normalizeRepoPaths(config.selectedRepoPaths);
    const reportWindow = buildAutoSyncReportWindow(config, runDate);
    const result = await generateReport({
      repoPaths,
      date: reportWindow.date,
      startDateTime: reportWindow.startDateTime,
      endDateTime: reportWindow.endDateTime,
      reporterName: config.reporterName,
    });

    if (!result.commits.length) {
      const message = '跳过：未匹配到可生成日报的提交记录';
      const savedConfig = await updateAutoSyncStatus('skipped', message, { runKey, ranAt, scheduled: isScheduled });
      return buildAutoSyncRunResult(savedConfig, 'skipped', message, ranAt, result.report, 0, reportWindow.date, result.timeRange);
    }

    await syncFeishuDaily({
      config: config.feishuForm,
      report: result.report,
      date: reportWindow.date,
      reporterName: config.reporterName,
      reportId: result.historyId,
      triggerType: trigger,
    });

    const message = `已自动同步 ${result.commits.length} 条记录到飞书日报表（${result.timeRange.label}）`;
    const savedConfig = await updateAutoSyncStatus('success', message, {
      runKey,
      ranAt,
      scheduled: isScheduled,
      success: true,
    });
    return buildAutoSyncRunResult(savedConfig, 'success', message, ranAt, result.report, result.commits.length, reportWindow.date, result.timeRange);
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动同步失败';
    const savedConfig = await updateAutoSyncStatus('failed', message, { runKey, ranAt, scheduled: isScheduled });
    return buildAutoSyncRunResult(savedConfig, 'failed', message, ranAt);
  } finally {
    autoSyncRunning = false;
    await refreshAutoSyncSchedule();
  }
}

function createWindow() {
  const preloadPath = existsSync(join(__dirname, '../preload/index.js'))
    ? join(__dirname, '../preload/index.js')
    : join(__dirname, '../preload/preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 780,
    icon: getWindowOptionsIcon(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  ipcMain.handle('app:load-config', async () => loadConfig());
  ipcMain.handle('app:save-config', async (_event, config: AppConfig) => saveConfig(config));
  ipcMain.handle('dialog:select-directory', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle('repo:scan', async (_event, workspaceDir: string) => scanRepositories(workspaceDir));
  ipcMain.handle('report:generate', async (_event, params: GenerateReportParams) => generateReport(params));
  ipcMain.handle('report:generate-from-material', async (_event, params: GenerateFromMaterialParams) => generateReportFromMaterial(params));
  ipcMain.handle('role-material:save', async (_event, payload: RoleMaterialPayload) => saveRoleMaterial(payload));
  ipcMain.handle('role-material:load', async (_event, params: { role: MaterialRole; date: string }) =>
    loadRoleMaterial(params.role, params.date),
  );
  ipcMain.handle('daily-report:list', async (_event, limit?: number) => listDailyReports(limit));
  ipcMain.handle('daily-report:save', async (_event, payload: SaveDailyReportPayload) => saveDailyReport(payload));
  ipcMain.handle('sync-log:list', async (_event, limit?: number) => listSyncLogs(limit));
  ipcMain.handle('error-log:list', async (_event, limit?: number) => listErrorLogs(limit));
  ipcMain.handle('storage:info', async () => getStorageInfo());
  ipcMain.handle('feishu:login', async (_event, payload: FeishuLoginPayload) => openFeishuLogin(payload));
  ipcMain.handle('feishu:list-fields', async (_event, payload: FeishuProjectOptionsPayload) => listFeishuFieldOptions(payload));
  ipcMain.handle('feishu:list-projects', async (_event, payload: FeishuProjectOptionsPayload) => listFeishuProjectOptions(payload));
  ipcMain.handle('feishu:test-submit', async (_event, payload: FeishuTestSubmitPayload) => testSubmitFeishuForm(payload));
  ipcMain.handle('report:sync-feishu', async (_event, payload: SyncFeishuDailyPayload) => syncFeishuDaily(payload));
  ipcMain.handle('auto-sync:get-state', async () => getAutoSyncState(await loadConfig()));
  ipcMain.handle('auto-sync:validate', async (_event, config: AppConfig) => validateAutoSync(config));
  ipcMain.handle('auto-sync:run-now', async (_event, config: AppConfig) => {
    await saveConfig(config, { reschedule: false });
    return runAutoSync('manual');
  });

  createWindow();
  await refreshAutoSyncSchedule();

  powerMonitor.on('resume', () => {
    void refreshAutoSyncSchedule();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  clearAutoSyncTimer();
  if (feishuAuthSyncTimer) {
    clearTimeout(feishuAuthSyncTimer);
    feishuAuthSyncTimer = null;
  }
  removeFeishuAuthSessionWatcher?.();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
