import { safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import {
  DEFAULT_AI_BASE_URL_OPTIONS,
  DEFAULT_AI_PROFILE,
  DEFAULT_AI_PROFILE_ID,
  DEFAULT_AI_MODEL_OPTIONS,
  DEFAULT_AUTO_SYNC_CONFIG,
  DEFAULT_FEISHU_FORM_CONFIG,
} from '../../src/shared/types.js';
import type { AiProfile, AppConfig, AutoSyncConfig, AutoSyncStatus } from '../../src/shared/types.js';
import { normalizeRepoDisplayNames } from '../../src/shared/repositoryName.js';
import { ensureConfigDir, getConfigPath, getSecretsPath } from './paths.js';

export const DEFAULT_CONFIG: AppConfig = {
  workspaceDir: '',
  workspaceDirs: [],
  selectedRepoPaths: [],
  ignoredRepoPaths: [],
  pinnedRepoPaths: [],
  repoDisplayNames: {},
  reporterName: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiBaseUrlOptions: [...DEFAULT_AI_BASE_URL_OPTIONS],
  aiModelOptions: [...DEFAULT_AI_MODEL_OPTIONS],
  aiProfiles: [{ ...DEFAULT_AI_PROFILE }],
  activeAiProfileId: DEFAULT_AI_PROFILE_ID,
  feishuForm: { ...DEFAULT_FEISHU_FORM_CONFIG },
  autoSync: { ...DEFAULT_AUTO_SYNC_CONFIG },
};


export function pickSensitiveConfig(config: AppConfig) {
  return {
    aiApiKey: config.aiApiKey,
    aiProfiles: config.aiProfiles.map((profile) => ({
      id: profile.id,
      apiKey: profile.apiKey,
    })),
    feishuForm: {
      cookie: config.feishuForm.cookie,
      csrfToken: config.feishuForm.csrfToken,
    },
  };
}


export function hasSensitiveConfig(config: AppConfig) {
  const sensitiveConfig = pickSensitiveConfig(config);
  return Boolean(
    sensitiveConfig.aiApiKey.trim() ||
      sensitiveConfig.aiProfiles.some((profile) => profile.apiKey.trim()) ||
      sensitiveConfig.feishuForm.cookie.trim() ||
      sensitiveConfig.feishuForm.csrfToken.trim(),
  );
}


export function stripSensitiveConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    aiApiKey: '',
    aiProfiles: config.aiProfiles.map((profile) => ({
      ...profile,
      apiKey: '',
    })),
    feishuForm: {
      ...config.feishuForm,
      cookie: '',
      csrfToken: '',
    },
  };
}


export function mergeSensitiveConfig(config: AppConfig, sensitiveConfig: ReturnType<typeof pickSensitiveConfig>): AppConfig {
  const sensitiveAiProfileMap = new Map(sensitiveConfig.aiProfiles.map((profile) => [profile.id, profile.apiKey]));
  const aiProfiles = config.aiProfiles.map((profile) => {
    const profileApiKey = sensitiveAiProfileMap.get(profile.id);
    const legacyApiKey = profile.id === config.activeAiProfileId ? sensitiveConfig.aiApiKey : '';
    return {
      ...profile,
      apiKey: profileApiKey || legacyApiKey || profile.apiKey,
    };
  });
  const activeAiProfile = aiProfiles.find((profile) => profile.id === config.activeAiProfileId) ?? aiProfiles[0];

  return {
    ...config,
    aiProfiles,
    aiApiKey: activeAiProfile?.apiKey || sensitiveConfig.aiApiKey || config.aiApiKey,
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


export function createLegacyAiProfile(config?: Partial<AppConfig>): AiProfile {
  return {
    ...DEFAULT_AI_PROFILE,
    baseUrl: typeof config?.aiBaseUrl === 'string' && config.aiBaseUrl.trim() ? config.aiBaseUrl.trim() : DEFAULT_AI_PROFILE.baseUrl,
    apiKey: typeof config?.aiApiKey === 'string' ? config.aiApiKey.trim() : '',
    model: typeof config?.aiModel === 'string' && config.aiModel.trim() ? config.aiModel.trim() : DEFAULT_AI_PROFILE.model,
  };
}


export function normalizeAiProfiles(options: unknown, config?: Partial<AppConfig>) {
  const legacyProfile = createLegacyAiProfile(config);
  const source = Array.isArray(options) && options.length ? options : [legacyProfile];
  const usedIds = new Set<string>();
  const profiles = source
    .map((item, index): AiProfile | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const rawProfile = item as Partial<AiProfile>;
      const fallbackId = index === 0 ? legacyProfile.id : `profile-${index + 1}`;
      const rawId = typeof rawProfile.id === 'string' ? rawProfile.id.trim() : '';
      const id = rawId || fallbackId;
      if (usedIds.has(id)) return null;
      usedIds.add(id);

      const name = typeof rawProfile.name === 'string' && rawProfile.name.trim()
        ? rawProfile.name.trim()
        : id === DEFAULT_AI_PROFILE_ID
          ? DEFAULT_AI_PROFILE.name
          : `AI 配置 ${index + 1}`;
      const baseUrl = typeof rawProfile.baseUrl === 'string' && rawProfile.baseUrl.trim()
        ? rawProfile.baseUrl.trim()
        : legacyProfile.baseUrl;
      const apiKey = typeof rawProfile.apiKey === 'string' ? rawProfile.apiKey.trim() : '';
      const model = typeof rawProfile.model === 'string' && rawProfile.model.trim() ? rawProfile.model.trim() : legacyProfile.model;

      return {
        id,
        name,
        baseUrl,
        apiKey,
        model,
        enabled: rawProfile.enabled !== false,
      };
    })
    .filter((item): item is AiProfile => Boolean(item));

  return profiles.length ? profiles : [legacyProfile];
}


export function normalizeActiveAiProfileId(value: unknown, aiProfiles: AiProfile[]) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return aiProfiles.some((profile) => profile.id === candidate) ? candidate : aiProfiles[0]?.id || DEFAULT_AI_PROFILE_ID;
}


export function normalizeConfig(config?: Partial<AppConfig>): AppConfig {
  const configWithoutTokenStats = { ...(config ?? {}) } as Partial<AppConfig> & Record<string, unknown>;
  delete configWithoutTokenStats.tokenProxy;
  delete configWithoutTokenStats.modelPricing;
  const workspaceDirs = normalizeWorkspaceDirs(config?.workspaceDirs, config?.workspaceDir);
  const ignoredRepoPaths = normalizeRepoPaths(config?.ignoredRepoPaths);
  const ignoredRepoPathSet = new Set(ignoredRepoPaths.map((item) => item.toLocaleLowerCase()));
  const aiProfiles = normalizeAiProfiles(config?.aiProfiles, config);
  const activeAiProfileId = normalizeActiveAiProfileId(config?.activeAiProfileId, aiProfiles);
  const activeAiProfile = aiProfiles.find((profile) => profile.id === activeAiProfileId) ?? aiProfiles[0] ?? DEFAULT_AI_PROFILE;
  return {
    ...DEFAULT_CONFIG,
    ...configWithoutTokenStats,
    workspaceDirs,
    workspaceDir: config?.workspaceDir || workspaceDirs[0] || '',
    selectedRepoPaths: normalizeRepoPaths(config?.selectedRepoPaths).filter((item) => !ignoredRepoPathSet.has(item.toLocaleLowerCase())),
    ignoredRepoPaths,
    pinnedRepoPaths: normalizeRepoPaths(config?.pinnedRepoPaths).filter((item) => !ignoredRepoPathSet.has(item.toLocaleLowerCase())),
    repoDisplayNames: normalizeRepoDisplayNames(config?.repoDisplayNames),
    aiBaseUrl: activeAiProfile.baseUrl,
    aiApiKey: activeAiProfile.apiKey,
    aiModel: activeAiProfile.model,
    aiBaseUrlOptions: normalizeOptions(
      [...(Array.isArray(config?.aiBaseUrlOptions) ? config.aiBaseUrlOptions : DEFAULT_AI_BASE_URL_OPTIONS), ...aiProfiles.map((profile) => profile.baseUrl)],
      DEFAULT_AI_BASE_URL_OPTIONS,
    ),
    aiModelOptions: normalizeOptions(
      [...(Array.isArray(config?.aiModelOptions) ? config.aiModelOptions : DEFAULT_AI_MODEL_OPTIONS), ...aiProfiles.map((profile) => profile.model)],
      DEFAULT_AI_MODEL_OPTIONS,
    ),
    aiProfiles,
    activeAiProfileId,
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
