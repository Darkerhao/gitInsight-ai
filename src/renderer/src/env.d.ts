/// <reference types="vite/client" />

import type {
  AppConfig,
  AutoSyncRunResult,
  AutoSyncState,
  AutoSyncValidationResult,
  FeishuAuthSnapshot,
  FeishuFieldOption,
  FeishuLoginPayload,
  FeishuProjectOption,
  FeishuProjectOptionsPayload,
  FeishuSubmitResult,
  FeishuTestSubmitPayload,
  GenerateFromMaterialParams,
  GenerateReportParams,
  MaterialReportResult,
  MaterialRole,
  RepoInfo,
  ReportResult,
  RoleMaterialPayload,
  RoleMaterialRecord,
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
      generateReportFromMaterial: (params: GenerateFromMaterialParams) => Promise<MaterialReportResult>;
      saveRoleMaterial: (payload: RoleMaterialPayload) => Promise<RoleMaterialRecord>;
      loadRoleMaterial: (role: MaterialRole, date: string) => Promise<RoleMaterialRecord | null>;
      loginFeishu: (payload: FeishuLoginPayload) => Promise<FeishuAuthSnapshot>;
      listFeishuFields: (payload: FeishuProjectOptionsPayload) => Promise<FeishuFieldOption[]>;
      listFeishuProjects: (payload: FeishuProjectOptionsPayload) => Promise<FeishuProjectOption[]>;
      testSubmitFeishu: (payload: FeishuTestSubmitPayload) => Promise<FeishuSubmitResult>;
      syncFeishuDaily: (payload: SyncFeishuDailyPayload) => Promise<boolean>;
      getAutoSyncState: () => Promise<AutoSyncState>;
      validateAutoSync: (config: AppConfig) => Promise<AutoSyncValidationResult>;
      runAutoSyncNow: (config: AppConfig) => Promise<AutoSyncRunResult>;
      listDailyReports: (limit?: number) => Promise<import('@shared/types').DailyReportRecord[]>;
      listSyncLogs: (limit?: number) => Promise<import('@shared/types').SyncLogRecord[]>;
      listErrorLogs: (limit?: number) => Promise<import('@shared/types').ErrorLogRecord[]>;
      getStorageInfo: () => Promise<import('@shared/types').StorageInfo>;
      saveDailyReport: (payload: import('@shared/types').SaveDailyReportPayload) => Promise<import('@shared/types').DailyReportRecord>;
      onAutoSyncUpdated: (callback: (state: AutoSyncState) => void) => () => void;
      onFeishuAuthUpdated: (callback: (snapshot: FeishuAuthSnapshot) => void) => () => void;
    };
  }
}

export {};
