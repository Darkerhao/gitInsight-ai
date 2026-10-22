export interface RepoInfo {
  name: string;
  path: string;
}


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
  repoFeishuProjects?: Record<string, RepoFeishuProject>;
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

export interface RepoFeishuProject extends FeishuProjectOption {
  shareToken: string;
  projectFieldId: string;
}

export type ReportPromptStyle = 'concise' | 'standard' | 'detailed' | 'custom';

export interface GenerateReportParams {
  requestId?: string;
  repoPaths: string[];
  date: string;
  startDateTime?: string;
  endDateTime?: string;
  reporterName: string;
  gitAuthorEmail?: string;
  aiProfileId?: string;
  /** 本次生成使用的日报表达风格；未传时保持标准风格。 */
  promptStyle?: ReportPromptStyle;
  /** 自定义模式下使用的完整生成要求，工作素材由系统自动追加。 */
  customPrompt?: string;
  /** 用户补充的非 Git 工作内容，例如网页测试、上线、会议或联调。 */
  manualWorkContent?: string;
}

export type ReportRole = 'developer' | 'projectManager' | 'productManager';

/** 素材角色（研发以外的、事实来源不是 Git 的角色）。 */
export type MaterialRole = Exclude<ReportRole, 'developer'>;

/** 素材表单的单个分区定义（用于渲染分区粘贴区）。 */
export interface MaterialSectionDef {
  key: string;
  label: string;
  placeholder: string;
}

/** 用户填写后的单个分区内容。 */
export interface MaterialSection {
  key: string;
  label: string;
  content: string;
}

export interface GenerateFromMaterialParams {
  role: MaterialRole;
  date: string;
  reporterName: string;
  aiProfileId?: string;
  sections: MaterialSection[];
  extraNotes: string;
}

export interface MaterialReportResult {
  report: string;
  role: MaterialRole;
  date: string;
  generatedAt: string;
}

export interface RoleMaterialPayload {
  role: MaterialRole;
  date: string;
  sections: MaterialSection[];
  extraNotes: string;
}

export interface RoleMaterialRecord extends RoleMaterialPayload {
  updatedAt: string;
}

/** 项目经理日报的素材分区：事实来源是项目推进事实，而非 Git。 */
export const PROJECT_MANAGER_SECTIONS: MaterialSectionDef[] = [
  { key: 'progress', label: '今日推进事项', placeholder: '今天实际推进的任务、决策或落地情况，一行一条' },
  { key: 'milestone', label: '项目里程碑进度', placeholder: '关键里程碑当前进度、是否按期、偏差说明' },
  { key: 'blocker', label: '阻塞与风险', placeholder: '当前阻塞、风险点及影响范围，需要谁协助' },
  { key: 'coordination', label: '协调事项', placeholder: '需要跨团队/资源协调的事项与对接人' },
  { key: 'meeting', label: '会议结论', placeholder: '今日会议达成的关键结论与后续动作' },
  { key: 'resource', label: '成员/资源状态', placeholder: '成员投入、请假、资源到位情况等' },
  { key: 'tomorrow', label: '明日项目安排', placeholder: '明日计划推进的重点事项' },
];

/** 产品经理日报的素材分区：事实来源是产品工作事实，而非 Git。 */
export const PRODUCT_MANAGER_SECTIONS: MaterialSectionDef[] = [
  { key: 'requirement', label: '需求进展', placeholder: '各需求当前状态、推进情况，一行一条' },
  { key: 'prd', label: 'PRD/原型/评审', placeholder: '今日产出或评审的 PRD、原型、方案及结论' },
  { key: 'feedback', label: '用户反馈', placeholder: '收集到的用户反馈、诉求或数据洞察' },
  { key: 'acceptance', label: '验收情况', placeholder: '今日验收的功能、结论及遗留问题' },
  { key: 'planning', label: '版本规划', placeholder: '版本节奏、范围调整或排期变化' },
  { key: 'pending', label: '待确认问题', placeholder: '待与研发/测试/业务方确认的问题' },
  { key: 'collaboration', label: '协同事项', placeholder: '与研发、测试、业务方的协同与对接事项' },
];

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
    materialRole?: MaterialRole;
    material?: RoleMaterialPayload;
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
  materialRole?: MaterialRole;
  material?: RoleMaterialPayload;
  rawInput?: ReportResult['rawInput'];
  /** 当前已保存版本是否有成功同步记录；编辑保存后失效。 */
  published?: boolean;
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

export interface SyncFeishuDailyResult {
  success: true;
  warning?: string;
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
  reason?: string;
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

export interface BackupOperationResult {
  canceled: boolean;
  filePath?: string;
}
