/// <reference types="vite/client" />

import type { AppConfig, GenerateReportParams, RepoInfo, ReportResult } from '@shared/types';

declare global {
  interface Window {
    api: {
      loadConfig: () => Promise<AppConfig>;
      saveConfig: (config: AppConfig) => Promise<AppConfig>;
      selectDirectory: () => Promise<string | null>;
      scanRepositories: (workspaceDir: string) => Promise<RepoInfo[]>;
      generateReport: (params: GenerateReportParams) => Promise<ReportResult>;
      pushFeishu: (payload: { webhook: string; report: string }) => Promise<boolean>;
    };
  }
}

export {};
