export interface RepoInfo {
  name: string;
  path: string;
}

export interface AppConfig {
  workspaceDir: string;
  reporterName: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  feishuWebhook: string;
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
