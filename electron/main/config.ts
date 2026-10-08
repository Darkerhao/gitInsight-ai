import { safeStorage } from 'electron';
import { readFile, rm } from 'node:fs/promises';
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
import { writeFileAtomically } from './atomicFile.js';

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


async function loadSensitiveConfig() {
  const contents = await readOptionalFile(getSecretsPath());
  if (contents === null) return pickSensitiveConfig(normalizeConfig());
  const encrypted = parseConfigObject(contents) as { payload?: string };
  if (typeof encrypted.payload !== 'string' || !encrypted.payload) throw new Error('密钥文件格式无效。');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('密钥保护不可用，无法读取现有密钥配置。');
  const raw = safeStorage.decryptString(Buffer.from(encrypted.payload, 'base64'));
  return pickSensitiveConfig(normalizeConfig(parseConfigObject(raw)));
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


let configQueue: Promise<unknown> = Promise.resolve();

function queueConfig<T>(operation: () => Promise<T>): Promise<T> {
  const result = configQueue.then(operation);
  configQueue = result.catch(() => {});
  return result;
}

async function readOptionalFile(filename: string): Promise<string | null> {
  try {
    return await readFile(filename, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function parseConfigObject(contents: string): Partial<AppConfig> & Record<string, unknown> {
  const parsed: unknown = JSON.parse(contents);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('配置文件格式无效。');
  return parsed as Partial<AppConfig> & Record<string, unknown>;
}

// The journal contains the previous pair (secrets stay encrypted). A crash or
// failed second replacement must never pair a new secret with an old config.
async function recoverConfigTransactionUnlocked(): Promise<void> {
  const journalPath = `${getConfigPath()}.transaction.json`;
  const contents = await readOptionalFile(journalPath);
  if (contents === null) return;
  const previous = parseConfigObject(contents);
  if (![previous.config, previous.secrets].every(value => value === null || typeof value === 'string')) {
    throw new Error('配置恢复文件格式无效，已停止读取。');
  }
  for (const [filename, value] of [[getSecretsPath(), previous.secrets], [getConfigPath(), previous.config]] as const) {
    if (value === null) await rm(filename, { force: true });
    else await writeFileAtomically(filename, value as string);
  }
  await rm(journalPath);
}

export function recoverConfigTransaction(): Promise<void> {
  return queueConfig(recoverConfigTransactionUnlocked);
}

async function loadConfigUnlocked(): Promise<AppConfig> {
  await recoverConfigTransactionUnlocked();
  const raw = await readOptionalFile(getConfigPath());
  const diskConfig = normalizeConfig(raw === null ? undefined : parseConfigObject(raw));
  return mergeSensitiveConfig(diskConfig, await loadSensitiveConfig());
}

export function loadConfig(): Promise<AppConfig> {
  return queueConfig(loadConfigUnlocked);
}

async function saveConfigUnlocked(config: AppConfig): Promise<AppConfig> {
  await recoverConfigTransactionUnlocked();
  await ensureConfigDir();
  const normalizedConfig = normalizeConfig(config);
  if (hasSensitiveConfig(normalizedConfig) && !safeStorage.isEncryptionAvailable()) {
    throw new Error('密钥保护不可用，已阻止保存包含 AI Key、飞书 Cookie 或 CSRF Token 的配置，避免敏感配置保存后丢失。');
  }
  const sensitiveConfig = hasSensitiveConfig(normalizedConfig)
    ? JSON.stringify({ payload: safeStorage.encryptString(JSON.stringify(pickSensitiveConfig(normalizedConfig))).toString('base64') }, null, 2)
    : null;
  const journalPath = `${getConfigPath()}.transaction.json`;
  const previous = {
    config: await readOptionalFile(getConfigPath()),
    secrets: await readOptionalFile(getSecretsPath()),
  };
  await writeFileAtomically(journalPath, JSON.stringify(previous));
  try {
    if (sensitiveConfig === null) await rm(getSecretsPath(), { force: true });
    else await writeFileAtomically(getSecretsPath(), sensitiveConfig);
    await writeFileAtomically(getConfigPath(), JSON.stringify(stripSensitiveConfig(normalizedConfig), null, 2));
    await rm(journalPath);
  } catch (error) {
    try {
      await recoverConfigTransactionUnlocked();
    } catch (recoveryError) {
      throw new AggregateError([error, recoveryError], '配置保存失败，旧配置尚未恢复；请检查磁盘后重新启动。');
    }
    throw error;
  }
  return normalizedConfig;
}

export function saveConfig(config: AppConfig): Promise<AppConfig> {
  return queueConfig(() => saveConfigUnlocked(config));
}

export function updateConfig(mutator: (config: AppConfig) => AppConfig): Promise<AppConfig> {
  return queueConfig(async () => saveConfigUnlocked(mutator(await loadConfigUnlocked())));
}
