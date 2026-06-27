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
  questionId: string;
  dateFieldId: string;
  userFieldId: string;
  projectFieldId: string;
  hoursFieldId: string;
  contentFieldId: string;
}

export const DEFAULT_FEISHU_FORM_CONFIG: FeishuFormConfig = {
  endpoint: 'https://icnjr29mp9ya.feishu.cn/space/api/bitable/share/content',
  shareToken: '',
  csrfToken: '',
  cookie: '',
  reporterUserId: '7626227711668767954',
  reporterName: '贾浩',
  reporterAvatarUrl: '',
  projectOptionId: '',
  projectName: '',
  defaultWorkHours: 8,
  questionId: 'tableQuestion_7a05c16c-6fcc-43be-bf96-455d85da6751',
  dateFieldId: 'fldQ6sCh5m',
  userFieldId: 'fldkcFfIZ7',
  projectFieldId: 'fldGVvQPfg',
  hoursFieldId: 'fldtg8B2x4',
  contentFieldId: 'fldCODa6wU',
};

export interface AppConfig {
  workspaceDir: string;
  reporterName: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  feishuForm: FeishuFormConfig;
}

export interface GenerateReportParams {
  repoPaths: string[];
  date: string;
  reporterName: string;
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
  rawInput: {
    gitLogs: string;
    files: string;
    diff: string;
  };
}

export interface SyncFeishuDailyPayload {
  config: FeishuFormConfig;
  report: string;
  date: string;
  reporterName: string;
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

export interface FeishuProjectOptionsPayload {
  config: FeishuFormConfig;
}
