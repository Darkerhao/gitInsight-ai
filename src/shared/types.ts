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
  feishuForm: FeishuFormConfig;
  autoSync: AutoSyncConfig;
}

export interface GenerateReportParams {
  repoPaths: string[];
  date: string;
  startDateTime?: string;
  endDateTime?: string;
  reporterName: string;
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
