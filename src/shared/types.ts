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

export interface AutoSyncConfig {
  enabled: boolean;
  time: string;
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
  commitsCount?: number;
}

export interface AutoSyncValidationResult {
  valid: boolean;
  message: string;
}
