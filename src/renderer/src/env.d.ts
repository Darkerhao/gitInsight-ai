/// <reference types="vite/client" />

import type {
  AppConfig,
  FeishuLoginPayload,
  FeishuProjectOption,
  FeishuProjectOptionsPayload,
  FeishuSubmitResult,
  FeishuTestSubmitPayload,
  GenerateReportParams,
  RepoInfo,
  ReportResult,
  SyncFeishuDailyPayload,
} from '@shared/types';

declare global {
  interface Window {
    api: {
      loadConfig: () => Promise<AppConfig>;
      saveConfig: (config: AppConfig) => Promise<AppConfig>;
      selectDirectory: () => Promise<string | null>;
      scanRepositories: (workspaceDir: string) => Promise<RepoInfo[]>;
      generateReport: (params: GenerateReportParams) => Promise<ReportResult>;
      loginFeishu: (payload: FeishuLoginPayload) => Promise<boolean>;
      listFeishuProjects: (payload: FeishuProjectOptionsPayload) => Promise<FeishuProjectOption[]>;
      testSubmitFeishu: (payload: FeishuTestSubmitPayload) => Promise<FeishuSubmitResult>;
      syncFeishuDaily: (payload: SyncFeishuDailyPayload) => Promise<boolean>;
    };
  }
}

export {};
