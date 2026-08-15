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
import type { AiProfile, AppConfig } from '../../src/shared/types.js';
import { normalizeRepoDisplayNames } from '../../src/shared/repositoryName.js';
import {
  normalizeAutoSyncConfig,
  normalizeProjectWorkHours,
  normalizeRepoPaths,
  normalizeWorkHours,
} from './autoSyncCore.js';
import { ensureConfigDir, getConfigPath, getSecretsPath } from './paths.js';

export {
  normalizeAutoSyncConfig,
  normalizeAutoSyncStatus,
  normalizeAutoSyncTime,
  normalizeAutoSyncTimeWindowMode,
  normalizeProjectWorkHours,
  normalizeRepoPaths,
  normalizeTaskWorkHours,
  normalizeWorkHours,
} from './autoSyncCore.js';

export const DEFAULT_CONFIG: AppConfig = {
  workspaceDir: '',
  workspaceDirs: [],
  selectedRepoPaths: [],
  ignoredRepoPaths: [],
  pinnedRepoPaths: [],
  repoDisplayNames: {},
  reporterName: '',
  gitAuthorEmail: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiBaseUrlOptions: [...DEFAULT_AI_BASE_URL_OPTIONS],
  aiModelOptions: [...DEFAULT_AI_MODEL_OPTIONS],
  aiProfiles: [{ ...DEFAULT_AI_PROFILE }],
  activeAiProfileId: DEFAULT_AI_PROFILE_ID,
  feishuForm: { ...DEFAULT_FEISHU_FORM_CONFIG },
  autoSync: { ...DEFAULT_AUTO_SYNC_CONFIG, tasks: [] },
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
  const selectedRepoPaths = normalizeRepoPaths(config?.selectedRepoPaths).filter((item) => !ignoredRepoPathSet.has(item.toLocaleLowerCase()));
  const aiProfiles = normalizeAiProfiles(config?.aiProfiles, config);
  const activeAiProfileId = normalizeActiveAiProfileId(config?.activeAiProfileId, aiProfiles);
  const activeAiProfile = aiProfiles.find((profile) => profile.id === activeAiProfileId) ?? aiProfiles[0] ?? DEFAULT_AI_PROFILE;
  return {
    ...DEFAULT_CONFIG,
    ...configWithoutTokenStats,
    workspaceDirs,
    workspaceDir: config?.workspaceDir || workspaceDirs[0] || '',
    gitAuthorEmail: typeof config?.gitAuthorEmail === 'string' ? config.gitAuthorEmail.trim() : '',
    selectedRepoPaths,
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
    autoSync: normalizeAutoSyncConfig(config?.autoSync, {
      feishuForm: config?.feishuForm,
      selectedRepoPaths,
    }),
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
