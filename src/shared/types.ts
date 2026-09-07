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

export interface AutoSyncTaskConfig {
  id: string;
  name: string;
  enabled: boolean;
  repoPaths: string[];
  projectOptionId: string;
  projectName: string;
  /** 任务级工时覆盖；null 时按 projectWorkHours[projectOptionId] → defaultWorkHours 解析 */
  workHours: number | null;
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

export interface AutoSyncConfig {
  /** 总开关；关闭后不调度任何任务 */
  enabled: boolean;
  tasks: AutoSyncTaskConfig[];
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

export const DEFAULT_AUTO_SYNC_TASK_CONFIG: AutoSyncTaskConfig = {
  id: '',
  name: '',
  enabled: true,
  repoPaths: [],
  projectOptionId: '',
  projectName: '',
  workHours: null,
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

export const DEFAULT_AUTO_SYNC_CONFIG: AutoSyncConfig = {
  enabled: false,
  tasks: [],
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

export interface AiConnectionTestPayload {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
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
  repoDisplayNames: Record<string, string>;
  reporterName: string;
  /** Git author email used as an additional commit matching condition. */
  gitAuthorEmail: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrlOptions: string[];
  aiModelOptions: string[];
  aiProfiles: AiProfile[];
  activeAiProfileId: string;
  feishuForm: FeishuFormConfig;
  autoSync: AutoSyncConfig;
}

export interface GenerateReportParams {
  repoPaths: string[];
  date: string;
  startDateTime?: string;
  endDateTime?: string;
  reporterName: string;
  gitAuthorEmail?: string;
  aiProfileId?: string;
  /** 用户补充的非 Git 工作内容，例如网页测试、上线、会议或联调。 */
  manualWorkContent?: string;
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
  authorEmail: string;
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
    manualWorkContent?: string;
  };
  structuredJson?: StructuredReportMetadata;
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
  manualWorkContent?: string;
  structuredJson?: StructuredReportMetadata;
}

export type WeeklyReflectionSourceScope = 'all' | 'published';

export interface WeeklyReflectionParams {
  projectPath: string;
  startDate: string;
  endDate: string;
  sourceScope?: WeeklyReflectionSourceScope;
  aiProfileId?: string;
}

export interface WeeklyReflectionSource {
  ref: string;
  reportId: number;
  date: string;
  projectName: string;
  report: string;
  reportStatus: DailyReportRecord['status'];
  published: boolean;
  multiProject: boolean;
  commitsCount: number;
  filesCount: number;
  structuredJson?: StructuredReportMetadata;
}

export interface WeeklyReflectionPoint {
  title: string;
  detail: string;
  evidenceRefs: string[];
}

export interface WeeklyReflectionProblem extends WeeklyReflectionPoint {
  impact: string;
  previousProblemRef?: string;
}

export interface WeeklyReflectionImprovement {
  action: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  expectedOutcome: string;
  evidenceRefs: string[];
}

export type WeeklyReflectionActionStatus = 'pending' | 'completed' | 'not_completed';

export interface WeeklyReflectionActionState {
  action: string;
  status: WeeklyReflectionActionStatus;
  updatedAt: string;
}

export interface WeeklyReflectionActionStatusUpdate {
  reflectionId: number;
  action: string;
  status: WeeklyReflectionActionStatus;
}

export interface WeeklyReflectionPreviousActionReview {
  actionRef: string;
  action: string;
  previousStatus: WeeklyReflectionActionStatus;
  suggestedStatus: WeeklyReflectionActionStatus;
  assessment: string;
  evidenceRefs: string[];
}

export interface WeeklyReflectionPreviousContext {
  reflectionId: number;
  startDate: string;
  endDate: string;
  actions: Array<{
    ref: string;
    action: string;
    status: WeeklyReflectionActionStatus;
    expectedOutcome: string;
  }>;
  problems: Array<{
    ref: string;
    title: string;
    detail: string;
    impact: string;
  }>;
}

export interface WeeklyReflectionMetadata {
  title: string;
  overview: string;
  strengths: WeeklyReflectionPoint[];
  problems: WeeklyReflectionProblem[];
  shortcomings: WeeklyReflectionPoint[];
  improvements: WeeklyReflectionImprovement[];
  previousActionReviews: WeeklyReflectionPreviousActionReview[];
  nextWeekFocus: string[];
}

export interface WeeklyReflectionProject {
  path: string;
  name: string;
  reportCount: number;
  publishedCount: number;
}

export interface WeeklyReflectionRecord {
  id: number;
  projectPath: string;
  projectName: string;
  startDate: string;
  endDate: string;
  sourceScope: WeeklyReflectionSourceScope;
  sourceReports: WeeklyReflectionSource[];
  content: string;
  structuredJson: WeeklyReflectionMetadata;
  actionStates: WeeklyReflectionActionState[];
  aiProfileId: string;
  generatedAt: string;
  updatedAt: string;
}

export type WeeklySummaryScopeType = 'all' | 'project';

export interface WeeklySummaryParams {
  startDate: string;
  endDate: string;
  projectPath?: string;
  aiProfileId?: string;
}

export interface WeeklySummarySource {
  ref: string;
  reportId: number;
  date: string;
  projectName: string;
  report: string;
  commitsCount: number;
  filesCount: number;
  multiProject: boolean;
  manualWorkContent?: string;
  structuredJson?: StructuredReportMetadata;
}

export interface WeeklySummaryItem {
  text: string;
  evidenceRefs: string[];
}

export interface WeeklySummaryMetadata {
  summary: string;
  completed: WeeklySummaryItem[];
  highlights: WeeklySummaryItem[];
  blockers: WeeklySummaryItem[];
  nextWeek: WeeklySummaryItem[];
}

export interface WeeklySummaryRecord {
  id: number;
  startDate: string;
  endDate: string;
  scopeType: WeeklySummaryScopeType;
  projectPath: string;
  projectName: string;
  sourceReports: WeeklySummarySource[];
  content: string;
  structuredJson: WeeklySummaryMetadata;
  aiProfileId: string;
  generatedAt: string;
  updatedAt: string;
}

export interface SaveWeeklySummaryPayload {
  id: number;
  content: string;
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

export type TimelineWorkType = '功能开发' | 'Bug 修复' | '重构优化' | '性能优化' | '工程优化' | '日常开发';

/** AI 结构化提取结果 — 由日报生成后的二次 AI 调用产出，存入 daily_reports.structured_json */
export interface StructuredWorkItem {
  module: string;
  description: string;
  workType: TimelineWorkType;
}

export interface StructuredReportMetadata {
  title: string;
  workItems: StructuredWorkItem[];
  achievements: string[];
  techTags: string[];
  risks: string[];
  tomorrowPlan: string[];
  milestone: boolean;
}

export interface TimelineRecord {
  id: number;
  reportId: number;
  date: string;
  title: string;
  summary: string;
  primaryType: TimelineWorkType;
  workTypes: TimelineWorkType[];
  projects: string[];
  repoPaths: string[];
  techTags: string[];
  commitHashes: string[];
  commitsCount: number;
  filesCount: number;
  milestone: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineDayGroup {
  date: string;
  recordIds: number[];
  records: TimelineRecord[];
  projects: string[];
  workTypes: TimelineWorkType[];
  commitsCount: number;
  filesCount: number;
  itemCount: number;
  milestone: boolean;
}

export interface TimelineQuery {
  startDate?: string;
  endDate?: string;
  type?: TimelineWorkType;
  project?: string;
}

export interface TimelineSnapshot {
  records: TimelineRecord[];
  days: TimelineDayGroup[];
  total: number;
  summary: {
    activeDays: number;
    totalCommits: number;
    totalFiles: number;
    milestones: number;
    projects: string[];
  };
}

export type HistoryLogStatus = 'success' | 'failed' | 'info';
export type HistoryLogType = '日报生成' | '手动同步' | '同步任务' | '错误日志';
export type HistoryLogStatusFilter = '全部状态' | '成功' | '失败';
export type HistoryLogTypeFilter = '全部类型' | HistoryLogType;

export interface HistoryLogRecord {
  id: string;
  numericId: number;
  time: string;
  type: HistoryLogType;
  project: string;
  action: string;
  status: HistoryLogStatus;
  duration: string;
  operator: string;
  trigger: string;
  file?: string;
  detail: string;
  reportRecord?: DailyReportRecord;
}

export interface HistoryLogQuery {
  keyword?: string;
  project?: string;
  type?: HistoryLogTypeFilter;
  status?: HistoryLogStatusFilter;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface HistoryLogPage {
  records: HistoryLogRecord[];
  total: number;
  page: number;
  pageSize: number;
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
  structuredJson?: StructuredReportMetadata;
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

export interface FeishuDuplicateCheckPayload extends FeishuLoginPayload {
  targetDate: string;
  projectName?: string;
  projectOptionId?: string;
  workHours: number;
}

export interface FeishuDuplicateCheckResult {
  available: boolean;
  matches: number;
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

export interface AutoSyncTaskState extends AutoSyncTaskConfig {
  nextRunAt: string;
  isRunning: boolean;
}

export interface AutoSyncState {
  enabled: boolean;
  tasks: AutoSyncTaskState[];
  isRunning: boolean;
  runningTaskId: string;
  nextRunAt: string;
  nextRunTaskId: string;
}

export interface AutoSyncTaskRunResult {
  taskId: string;
  taskName: string;
  status: AutoSyncStatus;
  message: string;
  report?: string;
  date?: string;
  timeRange?: ReportTimeRange;
  commitsCount?: number;
}

export interface AutoSyncRunResult {
  status: AutoSyncStatus;
  message: string;
  ranAt: string;
  nextRunAt: string;
  taskResults: AutoSyncTaskRunResult[];
}

export interface AutoSyncTaskValidationResult {
  taskId: string;
  taskName: string;
  valid: boolean;
  message: string;
}

export interface AutoSyncValidationResult {
  valid: boolean;
  message: string;
  results: AutoSyncTaskValidationResult[];
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
