import { app, dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { open, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_AI_PROFILE, DEFAULT_AUTO_SYNC_TASK_CONFIG, DEFAULT_FEISHU_FORM_CONFIG } from '../../src/shared/types.js';
import type { AppConfig, BackupOperationResult } from '../../src/shared/types.js';
import { writeFileAtomically } from './atomicFile.js';
import { DEFAULT_CONFIG, loadConfig, normalizeConfig, recoverConfigTransaction, stripSensitiveConfig } from './config.js';
import { getDatabase, loadSqlEngine } from './database.js';
import { ensureConfigDir, getConfigPath, getDatabasePath, getSecretsPath } from './paths.js';

const FORMAT = 'gitinsight-backup';
const VERSION = 1;
export const MAX_BACKUP_BYTES = 192 * 1024 * 1024;
const MAX_DATABASE_BYTES = 128 * 1024 * 1024;
const MAX_CONFIG_BYTES = 1024 * 1024;
const filters = [{ name: '码迹 AI 数据备份', extensions: ['gitinsight-backup'] }];
let restoring = false;

interface DataBackup {
  format: typeof FORMAT;
  version: typeof VERSION;
  createdAt: string;
  appVersion: string;
  config: AppConfig;
  database: string;
}

// Every actively used table/column must exist before a restore can replace live data.
const requiredColumns: Record<string, string[]> = {
  daily_reports: ['id', 'date', 'start_datetime', 'end_datetime', 'time_range_label', 'reporter_name', 'repo_names_json',
    'repo_paths_json', 'report', 'status', 'commits_count', 'files_count', 'generated_at', 'updated_at', 'raw_input_json', 'structured_json'],
  sync_logs: ['id', 'report_id', 'date', 'trigger_type', 'status', 'message', 'ran_at', 'duration_ms'],
  error_logs: ['id', 'scope', 'message', 'detail', 'created_at'],
  checkin_wallet: ['id', 'coins', 'last_checkin_date', 'streak', 'updated_at'],
  checkin_coin_transactions: ['id', 'type', 'amount', 'balance_after', 'reason', 'ref_key', 'created_at'],
  project_reflections: ['id', 'period_type', 'project_path', 'project_name', 'start_date', 'end_date', 'source_scope',
    'source_report_ids_json', 'source_snapshot_json', 'structured_json', 'action_state_json', 'ai_profile_id', 'generated_at', 'updated_at'],
  weekly_reports: ['id', 'start_date', 'end_date', 'scope_type', 'project_path', 'project_name', 'source_report_ids_json',
    'source_snapshot_json', 'structured_json', 'content_markdown', 'ai_profile_id', 'generated_at', 'updated_at'],
  timeline_snapshots: ['id', 'report_id', 'date', 'title', 'summary', 'primary_type', 'work_types_json', 'projects_json',
    'repo_paths_json', 'tech_tags_json', 'commit_hashes_json', 'commits_count', 'files_count', 'energy', 'milestone', 'created_at', 'updated_at'],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validateConfigFields(value: unknown, defaults: object) {
  if (!isObject(value)) throw new Error('备份配置结构无效。');
  for (const [key, fallback] of Object.entries(defaults)) {
    const current = value[key];
    if (fallback === null ? current !== null && (typeof current !== 'number' || !Number.isFinite(current))
      : typeof current !== typeof fallback || (typeof current === 'number' && !Number.isFinite(current))) {
      throw new Error(`备份配置字段无效：${key}`);
    }
    if (Array.isArray(fallback) && (!Array.isArray(current)
      || (key !== 'aiProfiles' && current.some(item => typeof item !== 'string')))) throw new Error(`备份配置字段无效：${key}`);
  }
}

function portableConfig(value: unknown): AppConfig {
  if (!isObject(value) || !isObject(value.feishuForm) || !isObject(value.autoSync)
    || !Array.isArray(value.autoSync.tasks) || !Array.isArray(value.aiProfiles)) throw new Error('备份配置结构无效。');
  validateConfigFields(value, DEFAULT_CONFIG);
  validateConfigFields(value.feishuForm, DEFAULT_FEISHU_FORM_CONFIG);
  value.aiProfiles.forEach(profile => validateConfigFields(profile, DEFAULT_AI_PROFILE));
  value.autoSync.tasks.forEach(task => validateConfigFields(task, DEFAULT_AUTO_SYNC_TASK_CONFIG));
  if (typeof value.autoSync.enabled !== 'boolean' || !isObject(value.feishuForm.projectWorkHours)
    || Object.values(value.feishuForm.projectWorkHours).some(item => typeof item !== 'number' || !Number.isFinite(item))) {
    throw new Error('备份同步或工时配置无效。');
  }
  if (!isObject(value.repoDisplayNames) || Object.values(value.repoDisplayNames).some(item => typeof item !== 'string')) {
    throw new Error('备份仓库名称配置无效。');
  }
  const normalized = stripSensitiveConfig(normalizeConfig(value as unknown as AppConfig));
  // Use current public keys only: old or unknown fields must not carry credentials into a portable file.
  const config = Object.fromEntries(Object.keys(DEFAULT_CONFIG).map(key => [key, normalized[key as keyof AppConfig]])) as unknown as AppConfig;
  config.feishuForm = Object.fromEntries(Object.keys(DEFAULT_FEISHU_FORM_CONFIG)
    .map(key => [key, normalized.feishuForm[key as keyof AppConfig['feishuForm']]])) as unknown as AppConfig['feishuForm'];
  config.feishuForm.shareToken = '';
  config.feishuForm.endpoint = '';
  return config;
}

async function readBoundedFile(filename: string, limit: number): Promise<Buffer> {
  const file = await open(filename, 'r');
  try {
    const size = (await file.stat()).size;
    if (size > limit) throw new Error('备份或数据文件大小超过上限。');
    const buffer = Buffer.alloc(size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, null);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > size) throw new Error('读取期间文件发生变化，请重试。');
    return buffer.subarray(0, offset);
  } finally {
    await file.close();
  }
}

async function validateBackup(value: unknown): Promise<{ backup: DataBackup; database: Buffer }> {
  if (!isObject(value) || value.format !== FORMAT || value.version !== VERSION
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
    || typeof value.appVersion !== 'string' || typeof value.database !== 'string') throw new Error('备份格式或版本不支持。');
  const config = portableConfig(value.config);
  if (Buffer.byteLength(JSON.stringify(value.config)) > MAX_CONFIG_BYTES) throw new Error('备份配置大小超过上限。');
  if (value.database.length > Math.ceil(MAX_DATABASE_BYTES / 3) * 4) throw new Error('备份数据库大小超过上限。');
  const database = Buffer.from(value.database, 'base64');
  if (database.length > MAX_DATABASE_BYTES || database.toString('base64') !== value.database
    || database.subarray(0, 16).toString() !== 'SQLite format 3\0') throw new Error('备份数据库格式无效或大小超过上限。');
  const SQL = await loadSqlEngine();
  const db = new SQL.Database(database);
  try {
    const integrity = db.exec('PRAGMA integrity_check')[0]?.values;
    if (integrity?.length !== 1 || integrity[0]?.[0] !== 'ok') throw new Error('备份数据库完整性校验失败。');
    for (const [table, required] of Object.entries(requiredColumns)) {
      const tableType = db.exec(`SELECT type FROM sqlite_master WHERE name = '${table}'`)[0]?.values[0]?.[0];
      const columns = new Set((db.exec(`PRAGMA table_info(${table})`)[0]?.values ?? []).map(row => String(row[1])));
      if (tableType !== 'table' || required.some(column => !columns.has(column))) throw new Error(`备份数据库缺少必需表或字段：${table}`);
    }
  } finally {
    db.close();
  }
  return { backup: { format: FORMAT, version: VERSION, createdAt: value.createdAt, appVersion: value.appVersion, config, database: value.database }, database };
}

export async function exportDataBackup(): Promise<BackupOperationResult> {
  const result = await dialog.showSaveDialog({ title: '导出数据备份', defaultPath: `码迹AI-${new Date().toISOString().slice(0, 10)}.gitinsight-backup`, filters });
  if (result.canceled || !result.filePath) return { canceled: true };
  const config = portableConfig(await loadConfig());
  const db = await getDatabase();
  const data = db.export();
  if (data.length > MAX_DATABASE_BYTES) throw new Error('数据库大小超过备份上限（128 MB）。');
  const { backup } = await validateBackup({ format: FORMAT, version: VERSION, createdAt: new Date().toISOString(),
    appVersion: app.getVersion(), config, database: Buffer.from(data).toString('base64') });
  const contents = JSON.stringify(backup);
  if (Buffer.byteLength(contents) > MAX_BACKUP_BYTES) throw new Error('备份文件大小超过上限。');
  await writeFileAtomically(result.filePath, contents);
  return { canceled: false, filePath: result.filePath };
}

export async function restoreDataBackup(): Promise<BackupOperationResult> {
  if (restoring) throw new Error('正在准备恢复，请勿重复操作。');
  restoring = true;
  try {
    const pendingPath = join(app.getPath('userData'), 'restore-pending.json');
    if (existsSync(pendingPath)) throw new Error('已有待恢复备份，请重启应用完成恢复。');
    const result = await dialog.showOpenDialog({ title: '选择数据备份', properties: ['openFile'], filters });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const { backup } = await validateBackup(JSON.parse((await readBoundedFile(result.filePaths[0], MAX_BACKUP_BYTES)).toString('utf8')));
    const confirmation = await dialog.showMessageBox({ type: 'warning', title: '恢复数据并重启',
      message: '恢复将替换当前全部本地数据和已保存配置。',
      detail: '应用会先在本地数据目录保留恢复前快照，再应用备份。未保存的编辑会丢失；恢复后自动同步关闭，请重新配置 AI 密钥并连接飞书。',
      buttons: ['恢复并重启', '取消'], defaultId: 1, cancelId: 1, noLink: true });
    if (confirmation.response !== 0) return { canceled: true };
    await ensureConfigDir();
    await writeFileAtomically(pendingPath, JSON.stringify({ id: randomUUID(), backup }));
    app.relaunch();
    app.exit(0);
    return { canceled: false };
  } finally {
    restoring = false;
  }
}

async function originalFile(filename: string, limit: number) {
  try {
    return (await readBoundedFile(filename, limit)).toString('base64');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Run before loading config, opening the database, registering IPC or starting tasks. */
export async function applyPendingRestore(): Promise<void> {
  const pendingPath = join(app.getPath('userData'), 'restore-pending.json');
  let raw: Buffer;
  try {
    raw = await readBoundedFile(pendingPath, MAX_BACKUP_BYTES + 1024);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const pending: unknown = JSON.parse(raw.toString('utf8'));
  if (!isObject(pending) || typeof pending.id !== 'string' || !/^[a-f0-9-]{36}$/.test(pending.id)) throw new Error('待恢复文件无效。');
  const { backup, database } = await validateBackup(pending.backup);
  await recoverConfigTransaction();
  const originalPath = join(app.getPath('userData'), `restore-original-${pending.id}.json`);
  // This immutable private snapshot includes encrypted credentials. Retries never capture a partially restored state.
  if (!existsSync(originalPath)) {
    const files = {
      config: await originalFile(getConfigPath(), MAX_CONFIG_BYTES),
      secrets: await originalFile(getSecretsPath(), MAX_CONFIG_BYTES),
      database: await originalFile(getDatabasePath(), MAX_DATABASE_BYTES),
    };
    await writeFileAtomically(originalPath, JSON.stringify({ createdAt: new Date().toISOString(), files }));
  }
  backup.config.autoSync.enabled = false;
  for (const task of backup.config.autoSync.tasks) task.enabled = false;
  await writeFileAtomically(getDatabasePath(), database);
  await writeFileAtomically(getConfigPath(), JSON.stringify(backup.config, null, 2));
  await rm(getSecretsPath(), { force: true });
  // Any failure above retains both pending and original snapshot; startup must stop and the next launch retries.
  await rm(pendingPath);
}
