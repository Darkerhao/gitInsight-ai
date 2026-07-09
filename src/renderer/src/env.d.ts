/// <reference types="vite/client" />

import type {
  AppConfig,
  AutoSyncRunResult,
  AutoSyncState,
  AutoSyncValidationResult,
  CheckinCoinSpendPayload,
  CheckinResult,
  CheckinWalletImportPayload,
  CheckinWalletSnapshot,
  FeishuAuthSnapshot,
  FeishuFieldOption,
  FeishuLoginPayload,
  FeishuProjectOption,
  FeishuProjectOptionsPayload,
  FeishuSubmissionRecordsPayload,
  FeishuSubmitResult,
  FeishuTestSubmitPayload,
  GenerateReportParams,
  JiaziFarmHarvestPayload,
  JiaziFarmPlantPayload,
  JiaziFarmQuickRipenPayload,
  JiaziFarmSnapshot,
  JiaziFarmTaskPayload,
  JiaziFarmWaterPayload,
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
      loginFeishu: (payload: FeishuLoginPayload) => Promise<FeishuAuthSnapshot>;
      openFeishuSubmissionRecords: (payload: FeishuSubmissionRecordsPayload) => Promise<boolean>;
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
      getCheckinWalletSnapshot: () => Promise<CheckinWalletSnapshot>;
      runDailyCheckin: () => Promise<CheckinResult>;
      importCheckinWallet: (payload: CheckinWalletImportPayload) => Promise<CheckinWalletSnapshot>;
      spendCheckinCoins: (payload: CheckinCoinSpendPayload) => Promise<CheckinWalletSnapshot>;
      getJiaziFarmSnapshot: (date?: string) => Promise<JiaziFarmSnapshot>;
      claimJiaziFarmTask: (payload: JiaziFarmTaskPayload) => Promise<JiaziFarmSnapshot>;
      harvestJiaziFarm: (payload: JiaziFarmHarvestPayload) => Promise<JiaziFarmSnapshot>;
      waterJiaziPlot: (payload: JiaziFarmWaterPayload) => Promise<JiaziFarmSnapshot>;
      quickRipenJiaziPlot: (payload: JiaziFarmQuickRipenPayload) => Promise<JiaziFarmSnapshot>;
      plantJiaziCrop: (payload: JiaziFarmPlantPayload) => Promise<JiaziFarmSnapshot>;
      unlockJiaziCropTier: (date?: string) => Promise<JiaziFarmSnapshot>;
      unlockJiaziPlot: (date?: string) => Promise<JiaziFarmSnapshot>;
      saveDailyReport: (payload: import('@shared/types').SaveDailyReportPayload) => Promise<import('@shared/types').DailyReportRecord>;
      onAutoSyncUpdated: (callback: (state: AutoSyncState) => void) => () => void;
      onCheckinWalletUpdated: (callback: (snapshot: CheckinWalletSnapshot) => void) => () => void;
      onFeishuAuthUpdated: (callback: (snapshot: FeishuAuthSnapshot) => void) => () => void;
    };
  }
}

export {};
