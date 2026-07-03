import { safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import {
  DEFAULT_AI_BASE_URL_OPTIONS,
  DEFAULT_AI_MODEL_OPTIONS,
  DEFAULT_AUTO_SYNC_CONFIG,
  DEFAULT_FEISHU_FORM_CONFIG,
} from '../../src/shared/types.js';
import type { AppConfig, AutoSyncConfig, AutoSyncStatus } from '../../src/shared/types.js';
import { ensureConfigDir, getConfigPath, getSecretsPath } from './paths.js';

export const DEFAULT_CONFIG: AppConfig = {
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


export function pickSensitiveConfig(config: AppConfig) {
  return {
    aiApiKey: config.aiApiKey,
    feishuForm: {
      cookie: config.feishuForm.cookie,
      csrfToken: config.feishuForm.csrfToken,
    },
  };
}


export function hasSensitiveConfig(config: AppConfig) {
  const sensitiveConfig = pickSensitiveConfig(config);
  return Boolean(sensitiveConfig.aiApiKey.trim() || sensitiveConfig.feishuForm.cookie.trim() || sensitiveConfig.feishuForm.csrfToken.trim());
}


export function stripSensitiveConfig(config: AppConfig): AppConfig {
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


export function mergeSensitiveConfig(config: AppConfig, sensitiveConfig: ReturnType<typeof pickSensitiveConfig>): AppConfig {
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


export async function loadSensitiveConfig() {
  try {
    const encrypted = JSON.parse(await readFile(getSecretsPath(), 'utf-8')) as { payload?: string };
    if (!encrypted.payload || !safeStorage.isEncryptionAvailable()) return pickSensitiveConfig(normalizeConfig());
    const raw = safeStorage.decryptString(Buffer.from(encrypted.payload, 'base64'));
    return pickSensitiveConfig(normalizeConfig(JSON.parse(raw)));
  } catch {
    return pickSensitiveConfig(normalizeConfig());
  }
}


export async function saveSensitiveConfig(config: AppConfig) {
  const sensitiveConfig = pickSensitiveConfig(config);
  if (!safeStorage.isEncryptionAvailable()) return;
  await ensureConfigDir();
  const encrypted = safeStorage.encryptString(JSON.stringify(sensitiveConfig)).toString('base64');
  await writeFile(getSecretsPath(), JSON.stringify({ payload: encrypted }, null, 2), 'utf-8');
}


export function normalizeConfig(config?: Partial<AppConfig>): AppConfig {
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


export function normalizeWorkspaceDirs(options: unknown, currentWorkspaceDir?: string) {
  const source = Array.isArray(options) ? options : [];
  return Array.from(
    new Set(
      [...source, currentWorkspaceDir]
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  );
}


export function normalizeOptions(options: unknown, fallbackOptions: string[]) {
  const source = Array.isArray(options) ? options : fallbackOptions;
  return Array.from(new Set(source.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)));
}


export function normalizeWorkHours(value: unknown, fallback = DEFAULT_FEISHU_FORM_CONFIG.defaultWorkHours) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return fallback;
  return Math.min(Math.max(normalized, 0.5), 24);
}


export function normalizeProjectWorkHours(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, hours]) => [key.trim(), normalizeWorkHours(hours)] as const)
      .filter(([key]) => key),
  );
}


export function normalizeRepoPaths(options: unknown) {
  const source = Array.isArray(options) ? options : [];
  return Array.from(new Set(source.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)));
}


export function normalizeAutoSyncTime(time: unknown) {
  if (typeof time !== 'string') return DEFAULT_AUTO_SYNC_CONFIG.time;
  const normalizedTime = time.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime) ? normalizedTime : DEFAULT_AUTO_SYNC_CONFIG.time;
}


export function normalizeAutoSyncStatus(status: unknown): AutoSyncStatus {
  return ['idle', 'running', 'success', 'failed', 'skipped'].includes(String(status)) ? (status as AutoSyncStatus) : 'idle';
}


export function normalizeAutoSyncTimeWindowMode(mode: unknown): AutoSyncConfig['timeWindowMode'] {
  return mode === 'yesterday-start-to-run' ? 'yesterday-start-to-run' : DEFAULT_AUTO_SYNC_CONFIG.timeWindowMode;
}


export function normalizeAutoSyncConfig(autoSync?: Partial<AutoSyncConfig>): AutoSyncConfig {
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


export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(getConfigPath(), 'utf-8');
    const diskConfig = normalizeConfig(JSON.parse(raw));
    const sensitiveConfig = await loadSensitiveConfig();
    return mergeSensitiveConfig(diskConfig, sensitiveConfig);
  } catch {
    return mergeSensitiveConfig(normalizeConfig(), await loadSensitiveConfig());
  }
}


export async function saveConfig(config: AppConfig) {
  await ensureConfigDir();
  const normalizedConfig = normalizeConfig(config);
  if (hasSensitiveConfig(normalizedConfig) && !safeStorage.isEncryptionAvailable()) {
    throw new Error('密钥保护不可用，已阻止保存包含 AI Key、飞书 Cookie 或 CSRF Token 的配置，避免敏感配置保存后丢失。');
  }
  await saveSensitiveConfig(normalizedConfig);
  await writeFile(getConfigPath(), JSON.stringify(stripSensitiveConfig(normalizedConfig), null, 2), 'utf-8');
  return normalizedConfig;
}

