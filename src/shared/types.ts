export interface RepoInfo {
  name: string;
  path: string;
}

export type AppEdition = 'lite' | 'standard';

export interface FeishuFormConfig {
  endpoint: string;
  shareToken: string;
  csrfToken: string;
  cookie: string;
  reporterUserId: string;
  reporterName: string;
  reporterAvatarUrl: string;
  projectOptionId: string;
  projectName: string;
  defaultWorkHours: number;
  projectWorkHours: Record<string, number>;
  questionId: string;
  dateFieldId: string;
  userFieldId: string;
  projectFieldId: string;
  hoursFieldId: string;
  contentFieldId: string;
}

export type AutoSyncStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped';
export type AutoSyncTimeWindowMode = 'full-day' | 'yesterday-start-to-run';

export interface AutoSyncConfig {
  enabled: boolean;
  time: string;
  timeWindowMode: AutoSyncTimeWindowMode;
  windowStartTime: string;
  lastRunAt: string;
  lastSuccessAt: string;
  lastStatus: AutoSyncStatus;
  lastMessage: string;
  lastRunKey: string;
  lastScheduledRunKey: string;
  lastSuccessKey: string;
}

export const DEFAULT_FEISHU_FORM_CONFIG: FeishuFormConfig = {
  endpoint: '',
  shareToken: '',
  csrfToken: '',
  cookie: '',
  reporterUserId: '',
  reporterName: '',
  reporterAvatarUrl: '',
  projectOptionId: '',
  projectName: '',
  defaultWorkHours: 8,
  projectWorkHours: {},
  questionId: '',
  dateFieldId: '',
  userFieldId: '',
  projectFieldId: '',
  hoursFieldId: '',
  contentFieldId: '',
};

export const DEFAULT_AUTO_SYNC_CONFIG: AutoSyncConfig = {
  enabled: false,
  time: '18:30',
  timeWindowMode: 'full-day',
  windowStartTime: '09:00',
  lastRunAt: '',
  lastSuccessAt: '',
  lastStatus: 'idle',
  lastMessage: '',
  lastRunKey: '',
  lastScheduledRunKey: '',
  lastSuccessKey: '',
};

export const DEFAULT_AI_BASE_URL_OPTIONS = ['https://api.openai.com/v1', 'https://api.deepseek.com'];
export const DEFAULT_AI_MODEL_OPTIONS = ['gpt-4o-mini', 'deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash'];

export interface AiProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export const DEFAULT_AI_PROFILE_ID = 'default';

export const DEFAULT_AI_PROFILE: AiProfile = {
  id: DEFAULT_AI_PROFILE_ID,
  name: '默认配置',
  baseUrl: DEFAULT_AI_BASE_URL_OPTIONS[0],
  apiKey: '',
  model: DEFAULT_AI_MODEL_OPTIONS[0],
  enabled: true,
};

export interface AppConfig {
  workspaceDir: string;
  workspaceDirs: string[];
  selectedRepoPaths: string[];
  ignoredRepoPaths: string[];
  pinnedRepoPaths: string[];
  reporterName: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrlOptions: string[];
  aiModelOptions: string[];
  aiProfiles: AiProfile[];
  activeAiProfileId: string;
  feishuForm: FeishuFormConfig;
  autoSync: AutoSyncConfig;
  tokenProxy: TokenProxyConfig;
  modelPricing: ModelPricing[];
}

export interface GenerateReportParams {
  repoPaths: string[];
  date: string;
  startDateTime?: string;
  endDateTime?: string;
  reporterName: string;
  aiProfileId?: string;
}

export interface ReportTimeRange {
  startDateTime: string;
  endDateTime: string;
  label: string;
}

export interface CommitEntry {
  hash: string;
  date: string;
  author: string;
  message: string;
  files: string[];
  show: string;
}

export interface ReportResult {
  report: string;
  commits: CommitEntry[];
  repos: RepoInfo[];
  generatedAt: string;
  timeRange: ReportTimeRange;
  historyId?: number;
  rawInput: {
    gitLogs: string;
    files: string;
    diff: string;
  };
}

export interface DailyReportRecord {
  id: number;
  date: string;
  timeRange?: ReportTimeRange;
  reporterName: string;
  repoNames: string[];
  repoPaths: string[];
  report: string;
  status: 'draft' | 'success' | 'failed';
  commitsCount: number;
  filesCount: number;
  generatedAt: string;
  updatedAt: string;
}

export interface SyncLogRecord {
  id: number;
  reportId?: number;
  date: string;
  triggerType: 'manual' | 'scheduled';
  status: AutoSyncStatus | 'success' | 'failed';
  message: string;
  ranAt: string;
  durationMs?: number;
}

export interface ErrorLogRecord {
  id: number;
  scope: string;
  message: string;
  detail: string;
  createdAt: string;
}

export interface StorageInfo {
  appVersion: string;
  appEdition: AppEdition;
  appEditionLabel: string;
  appName: string;
  userDataPath: string;
  configPath: string;
  secretsPath: string;
  databasePath: string;
  configSize: number;
  secretsSize: number;
  databaseSize: number;
  reportsCount: number;
  syncLogsCount: number;
  errorLogsCount: number;
  encryptionAvailable: boolean;
}

export interface SaveDailyReportPayload {
  id?: number;
  date: string;
  timeRange?: ReportTimeRange;
  reporterName: string;
  repoNames: string[];
  repoPaths: string[];
  report: string;
  status: DailyReportRecord['status'];
  commitsCount: number;
  filesCount: number;
  generatedAt?: string;
  rawInput?: ReportResult['rawInput'];
}

export interface SyncFeishuDailyPayload {
  config: FeishuFormConfig;
  report: string;
  date: string;
  reporterName: string;
  workHours?: number;
  reportId?: number;
  triggerType?: 'manual' | 'scheduled';
}

export interface FeishuLoginPayload {
  config: FeishuFormConfig;
}

export interface FeishuSubmissionRecordsPayload extends FeishuLoginPayload {
  targetDate?: string;
}

export interface FeishuAuthSnapshot {
  endpoint: string;
  shareToken: string;
  cookie: string;
  csrfToken: string;
}

export interface FeishuTestSubmitPayload {
  config: FeishuFormConfig;
  date: string;
}

export interface FeishuSubmitResult {
  code: number;
  msg: string;
  data?: unknown;
}

export interface FeishuProjectOption {
  id: string;
  name: string;
  color?: number;
}

export interface FeishuFieldOption {
  id: string;
  name: string;
  type: number | string;
  typeLabel: string;
}

export interface FeishuProjectOptionsPayload {
  config: FeishuFormConfig;
}

export interface AutoSyncState extends AutoSyncConfig {
  isRunning: boolean;
  nextRunAt: string;
}

export interface AutoSyncRunResult {
  status: AutoSyncStatus;
  message: string;
  ranAt: string;
  nextRunAt: string;
  report?: string;
  date?: string;
  timeRange?: ReportTimeRange;
  commitsCount?: number;
}

export interface AutoSyncValidationResult {
  valid: boolean;
  message: string;
}

export type JiaziFarmResourceType = 'water' | 'sunlight' | 'nutrient';

/** 农场元信息（farm-wide，单行）：甲子周期 + 已解锁的作物档次与地块数 */
export interface JiaziFarmState {
  cycleStartDate: string;
  unlockedCropTier: number;
  unlockedPlotCount: number;
  updatedAt: string;
}

/** 作物等级树的一档；unlocked/canAfford 由后端按当前进度与甲币余额算出 */
export interface JiaziFarmCropTier {
  tier: number;
  name: string;
  growthToHarvest: number;
  harvestReward: number;
  unlockCost: number;
  unlocked: boolean;
  canAfford: boolean;
}

/** 单块地：种植的作物档次 + 资源/成长/收获进度 */
export interface JiaziFarmPlot {
  slot: number;
  cropTier: number;
  cropName: string;
  water: number;
  sunlight: number;
  nutrient: number;
  growth: number;
  level: number;
  totalHarvests: number;
  growthToHarvest: number;
  canHarvest: boolean;
  harvestReward: number;
  updatedAt: string;
}

/** 下一块可解锁地块的定价信息 */
export interface JiaziFarmPlotUnlock {
  nextSlot: number;
  cost: number;
  canAfford: boolean;
  maxed: boolean;
}

export interface JiaziFarmTask {
  key: 'daily_visit' | 'report_generated' | 'feishu_synced' | 'git_activity';
  title: string;
  description: string;
  resourceType: JiaziFarmResourceType;
  rewardAmount: number;
  growthAmount: number;
  available: boolean;
  claimed: boolean;
  claimedAt: string;
}

export interface JiaziFarmHarvestRecord {
  id: number;
  date: string;
  ganzhiName: string;
  cropName: string;
  level: number;
  resourcesSummary: Partial<Record<JiaziFarmResourceType, number>>;
  createdAt: string;
}

export interface JiaziFarmSnapshot {
  date: string;
  state: JiaziFarmState;
  plots: JiaziFarmPlot[];
  cropTiers: JiaziFarmCropTier[];
  plotUnlock: JiaziFarmPlotUnlock;
  tasks: JiaziFarmTask[];
  harvestRecords: JiaziFarmHarvestRecord[];
  ganzhiName: string;
  cycleDay: number;
  seasonLabel: string;
  /** 甲币余额（读钱包），供农场内商店判断买得起与否 */
  coins: number;
  /** 浇灌一次的花费与增益（前端展示定价用） */
  waterPack: { cost: number; resourceAmount: number; growthAmount: number };
  /** 一键催熟的每点成长单价 */
  coinPerGrowth: number;
}

export interface JiaziFarmTaskPayload {
  date?: string;
  plotSlot: number;
  taskKey: JiaziFarmTask['key'];
}

export interface JiaziFarmHarvestPayload {
  date?: string;
  plotSlot: number;
}

export interface JiaziFarmWaterPayload {
  date?: string;
  plotSlot: number;
  resourceType: JiaziFarmResourceType;
}

export interface JiaziFarmQuickRipenPayload {
  date?: string;
  plotSlot: number;
}

export interface JiaziFarmPlantPayload {
  date?: string;
  plotSlot: number;
  cropTier: number;
}

export interface CheckinWallet {
  coins: number;
  lastCheckinDate: string;
  streak: number;
  updatedAt: string;
}

export interface CheckinWalletSnapshot {
  wallet: CheckinWallet;
  today: string;
  checkedInToday: boolean;
}

export interface CheckinResult extends CheckinWalletSnapshot {
  rewardCoins: number;
}

export interface CheckinWalletImportPayload {
  coins: number;
  lastCheckinDate: string;
  streak: number;
}

export interface CheckinCoinSpendPayload {
  amount: number;
  reason: string;
  refKey?: string;
}

// ─── Token 统计 ─────────────────────────────────────

export interface TokenScanRecord {
  id: number;
  repoPath: string;
  repoName: string;
  totalFiles: number;
  totalTokens: number;
  breakdown: Record<string, number>;
  scannedAt: string;
}

export interface ApiUsageRecord {
  id: number;
  source: 'proxy' | 'report';
  projectName: string | null;
  projectPath: string | null;
  model: string;
  provider: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  inputCostUsd: string;
  outputCostUsd: string;
  cacheReadCostUsd: string;
  cacheCreationCostUsd: string;
  totalCostUsd: string;
  requestPath: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface ProxyTarget {
  id: string;
  name: string;
  targetBaseUrl: string;
  apiKey: string;
  pathPrefix: string;
}

export interface TokenProxyConfig {
  enabled: boolean;
  port: number;
  targets: ProxyTarget[];
}

export const DEFAULT_TOKEN_PROXY_CONFIG: TokenProxyConfig = {
  enabled: false,
  port: 18921,
  targets: [],
};

export interface ModelPricing {
  model: string;
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M?: number;
  cacheCreationPer1M?: number;
  /** @deprecated Use cacheReadPer1M. Kept for existing saved configs. */
  cachedPer1M?: number;
}

export const DEFAULT_MODEL_PRICING: ModelPricing[] = [
  { model: 'gpt-4o', inputPer1M: 2.5, outputPer1M: 10, cacheReadPer1M: 1.25 },
  { model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.6, cacheReadPer1M: 0.075 },
  { model: 'gpt-5', inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125 },
  { model: 'gpt-5-mini', inputPer1M: 0.25, outputPer1M: 2, cacheReadPer1M: 0.025 },
  { model: 'gpt-5-nano', inputPer1M: 0.05, outputPer1M: 0.4, cacheReadPer1M: 0.005 },
  { model: 'gpt-5-codex', inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125 },
  { model: 'gpt-5.1', inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125 },
  { model: 'gpt-5.1-codex', inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125 },
  { model: 'gpt-5.2', inputPer1M: 1.75, outputPer1M: 14, cacheReadPer1M: 0.175 },
  { model: 'gpt-5.2-codex', inputPer1M: 1.75, outputPer1M: 14, cacheReadPer1M: 0.175 },
  { model: 'claude-sonnet', inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheCreationPer1M: 3.75 },
  { model: 'claude-sonnet-4', inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheCreationPer1M: 3.75 },
  { model: 'claude-sonnet-4-5', inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.3, cacheCreationPer1M: 3.75 },
  { model: 'claude-haiku', inputPer1M: 1, outputPer1M: 5, cacheReadPer1M: 0.1, cacheCreationPer1M: 1.25 },
  { model: 'claude-opus', inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.5, cacheCreationPer1M: 18.75 },
  { model: 'claude-opus-4-8', inputPer1M: 5, outputPer1M: 25, cacheReadPer1M: 0.5, cacheCreationPer1M: 6.25 },
  { model: 'gemini-3-pro-preview', inputPer1M: 2, outputPer1M: 12, cacheReadPer1M: 0.2 },
  { model: 'gemini-3-flash-preview', inputPer1M: 0.5, outputPer1M: 3, cacheReadPer1M: 0.05 },
  { model: 'gemini-2.5-pro', inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.125 },
  { model: 'gemini-2.5-flash', inputPer1M: 0.3, outputPer1M: 2.5, cacheReadPer1M: 0.03 },
  { model: 'deepseek-chat', inputPer1M: 0.27, outputPer1M: 1.1 },
  { model: 'deepseek-v4-flash', inputPer1M: 0.14, outputPer1M: 0.28, cacheReadPer1M: 0.014 },
  { model: 'deepseek-v4-pro', inputPer1M: 1.68, outputPer1M: 3.36, cacheReadPer1M: 0.168 },
  { model: 'kimi-k2.7-code', inputPer1M: 0.95, outputPer1M: 4, cacheReadPer1M: 0.16 },
  { model: 'kimi-k2-0905', inputPer1M: 0.55, outputPer1M: 2.2, cacheReadPer1M: 0.1 },
  { model: 'glm-5.2', inputPer1M: 1.4, outputPer1M: 4.4, cacheReadPer1M: 0.26 },
  { model: 'glm-5.1', inputPer1M: 1.4, outputPer1M: 4.4, cacheReadPer1M: 0.26 },
  { model: 'qwen3-coder-plus', inputPer1M: 0.65, outputPer1M: 3.25, cacheReadPer1M: 0.13 },
  { model: 'qwen3-coder-flash', inputPer1M: 0.195, outputPer1M: 0.975, cacheReadPer1M: 0.039 },
  { model: 'qwen3.7-max', inputPer1M: 2.5, outputPer1M: 7.5, cacheReadPer1M: 0.25 },
  { model: 'qwen3.7-plus', inputPer1M: 0.4, outputPer1M: 1.6, cacheReadPer1M: 0.08 },
  { model: 'doubao-seed-2-1-pro', inputPer1M: 0.1176, outputPer1M: 0.5882, cacheReadPer1M: 0.0235 },
  { model: 'doubao-seed-2-1-turbo', inputPer1M: 0.0353, outputPer1M: 0.1176, cacheReadPer1M: 0.0071 },
];

export interface TokenScanProgress {
  repoName: string;
  scannedFiles: number;
  totalFiles: number;
  currentTokens: number;
}

export interface TokenProxyStatus {
  running: boolean;
  port: number;
  requestCount: number;
}

export interface UsageFilter {
  projectName?: string;
  model?: string;
  startDate?: string;
  endDate?: string;
  source?: 'proxy' | 'report';
  limit?: number;
}

export interface UsageStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalCostUsd: string;
  cacheHitRate: number;
  requestCount: number;
  byProject: { projectName: string; totalTokens: number; totalCostUsd: string; requestCount: number }[];
  byModel: { model: string; totalTokens: number; totalCostUsd: string; requestCount: number }[];
  byDate: { date: string; totalTokens: number; totalCostUsd: string; requestCount: number }[];
}
