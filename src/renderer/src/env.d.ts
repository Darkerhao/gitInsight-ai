/// <reference types="vite/client" />

import type {
  AppConfig,
  AiConnectionTestPayload,
  AiConnectionTestResult,
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
  HistoryLogPage,
  HistoryLogQuery,
  RepoInfo,
  ReportResult,
  SyncFeishuDailyPayload,
  WeeklyReflectionActionStatusUpdate,
  WeeklyReflectionParams,
  WeeklyReflectionProject,
  WeeklyReflectionRecord,
  WeeklyReflectionSource,
  SaveWeeklySummaryPayload,
  WeeklySummaryParams,
  WeeklySummaryRecord,
  WeeklySummarySource,
} from '@shared/types';

declare global {
  interface Window {
    api: {
      loadConfig: () => Promise<AppConfig>;
      saveConfig: (config: AppConfig) => Promise<AppConfig>;
      testAiConnection: (payload: AiConnectionTestPayload) => Promise<AiConnectionTestResult>;
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
      validateAutoSync: (config: AppConfig, taskId?: string) => Promise<AutoSyncValidationResult>;
      runAutoSyncNow: (config: AppConfig, taskId?: string) => Promise<AutoSyncRunResult>;
      listDailyReports: (limit?: number) => Promise<import('@shared/types').DailyReportRecord[]>;
      listSyncLogs: (limit?: number) => Promise<import('@shared/types').SyncLogRecord[]>;
      listErrorLogs: (limit?: number) => Promise<import('@shared/types').ErrorLogRecord[]>;
      queryHistoryLogs: (query?: HistoryLogQuery) => Promise<HistoryLogPage>;
      listHistoryProjects: () => Promise<string[]>;
      listWeeklyReflectionProjects: () => Promise<WeeklyReflectionProject[]>;
      listWeeklyReflectionSources: (params: WeeklyReflectionParams) => Promise<WeeklyReflectionSource[]>;
      listWeeklyReflections: (limit?: number) => Promise<WeeklyReflectionRecord[]>;
      generateWeeklyReflection: (params: WeeklyReflectionParams) => Promise<WeeklyReflectionRecord>;
      updateWeeklyReflectionImprovementStatus: (payload: WeeklyReflectionActionStatusUpdate) => Promise<WeeklyReflectionRecord>;
      listWeeklySummarySources: (params: WeeklySummaryParams) => Promise<WeeklySummarySource[]>;
      listWeeklySummaries: (limit?: number) => Promise<WeeklySummaryRecord[]>;
      getWeeklySummary: (id: number) => Promise<WeeklySummaryRecord | null>;
      generateWeeklySummary: (params: WeeklySummaryParams) => Promise<WeeklySummaryRecord>;
      saveWeeklySummary: (payload: SaveWeeklySummaryPayload) => Promise<WeeklySummaryRecord>;
      getStorageInfo: () => Promise<import('@shared/types').StorageInfo>;
      getCheckinWalletSnapshot: () => Promise<CheckinWalletSnapshot>;
      runDailyCheckin: () => Promise<CheckinResult>;
      importCheckinWallet: (payload: CheckinWalletImportPayload) => Promise<CheckinWalletSnapshot>;
      spendCheckinCoins: (payload: CheckinCoinSpendPayload) => Promise<CheckinWalletSnapshot>;
      saveDailyReport: (payload: import('@shared/types').SaveDailyReportPayload) => Promise<import('@shared/types').DailyReportRecord>;
      getTimelineSnapshot: (query?: import('@shared/types').TimelineQuery) => Promise<import('@shared/types').TimelineSnapshot>;
      getZoomFactor: () => Promise<number>;
      setZoomFactor: (factor: number) => Promise<number>;
      changeZoomFactor: (delta: number) => Promise<number>;
      onAutoSyncUpdated: (callback: (state: AutoSyncState) => void) => () => void;
      onCheckinWalletUpdated: (callback: (snapshot: CheckinWalletSnapshot) => void) => () => void;
      onFeishuAuthUpdated: (callback: (snapshot: FeishuAuthSnapshot) => void) => () => void;
    };
  }
}

export {};
