import type { CoinTransactionPage, CoinTransactionQuery, CoinWorkshopSnapshot } from './coinWorkshop.js';
import type { AppLink, AppUpdateState } from './appUpdate.js';
import type {
  AiConnectionTestPayload,
  AiConnectionTestResult,
  AppConfig,
  AutoSyncRunResult,
  AutoSyncState,
  AutoSyncValidationResult,
  BackupOperationResult,
  CheckinCoinSpendPayload,
  CheckinResult,
  CheckinWalletImportPayload,
  CheckinWalletSnapshot,
  DailyReportRecord,
  ErrorLogRecord,
  FeishuAuthSnapshot,
  FeishuFieldOption,
  FeishuLoginPayload,
  FeishuProjectOption,
  FeishuProjectOptionsPayload,
  FeishuSubmissionRecordsPayload,
  FeishuSubmitResult,
  FeishuTestSubmitPayload,
  GenerateFromMaterialParams,
  GenerateReportParams,
  HistoryLogPage,
  HistoryLogQuery,
  MaterialReportResult,
  MaterialRole,
  RepoInfo,
  ReportResult,
  RoleMaterialPayload,
  RoleMaterialRecord,
  SaveDailyReportPayload,
  SaveWeeklySummaryPayload,
  StorageInfo,
  SyncFeishuDailyPayload,
  SyncFeishuDailyResult,
  SyncLogRecord,
  TimelineQuery,
  TimelineSnapshot,
  WeeklyReflectionActionStatusUpdate,
  WeeklyReflectionParams,
  WeeklyReflectionProject,
  WeeklyReflectionRecord,
  WeeklyReflectionSource,
  WeeklySummaryParams,
  WeeklySummaryRecord,
  WeeklySummarySource,
} from './types.js';

export interface GitInsightApi {
  getAppUpdateState: () => Promise<AppUpdateState>;
  checkForAppUpdates: () => Promise<AppUpdateState>;
  downloadAppUpdate: () => Promise<AppUpdateState>;
  setAutomaticUpdates: (enabled: boolean) => Promise<AppUpdateState>;
  installAppUpdate: () => Promise<void>;
  openAppLink: (link: AppLink) => Promise<void>;
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => () => void;
  loadConfig: () => Promise<AppConfig>;
  saveConfig: (config: AppConfig) => Promise<AppConfig>;
  testAiConnection: (payload: AiConnectionTestPayload) => Promise<AiConnectionTestResult>;
  selectDirectory: () => Promise<string | null>;
  scanRepositories: (workspaceDir: string) => Promise<RepoInfo[]>;
  generateReport: (params: GenerateReportParams) => Promise<ReportResult>;
  cancelReportGeneration: (requestId: string) => Promise<void>;
  loginFeishu: (payload: FeishuLoginPayload) => Promise<FeishuAuthSnapshot>;
  openFeishuSubmissionRecords: (payload: FeishuSubmissionRecordsPayload) => Promise<boolean>;
  listFeishuFields: (payload: FeishuProjectOptionsPayload) => Promise<FeishuFieldOption[]>;
  listFeishuProjects: (payload: FeishuProjectOptionsPayload) => Promise<FeishuProjectOption[]>;
  testSubmitFeishu: (payload: FeishuTestSubmitPayload) => Promise<FeishuSubmitResult>;
  syncFeishuDaily: (payload: SyncFeishuDailyPayload) => Promise<SyncFeishuDailyResult>;
  getAutoSyncState: () => Promise<AutoSyncState>;
  validateAutoSync: (config: AppConfig, taskId?: string) => Promise<AutoSyncValidationResult>;
  runAutoSyncNow: (config: AppConfig, taskId?: string) => Promise<AutoSyncRunResult>;
  generateReportFromMaterial: (params: GenerateFromMaterialParams) => Promise<MaterialReportResult>;
  saveRoleMaterial: (payload: RoleMaterialPayload) => Promise<RoleMaterialRecord>;
  loadRoleMaterial: (role: MaterialRole, date: string) => Promise<RoleMaterialRecord | null>;
  loadMaterialReport: (role: MaterialRole, date: string) => Promise<DailyReportRecord | null>;
  getDailyReport: (id: number) => Promise<DailyReportRecord | null>;
  listDailyReports: (limit?: number) => Promise<DailyReportRecord[]>;
  listSyncLogs: (limit?: number) => Promise<SyncLogRecord[]>;
  listErrorLogs: (limit?: number) => Promise<ErrorLogRecord[]>;
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
  getStorageInfo: () => Promise<StorageInfo>;
  exportDataBackup: () => Promise<BackupOperationResult>;
  restoreDataBackup: () => Promise<BackupOperationResult>;
  getCoinWorkshop: () => Promise<CoinWorkshopSnapshot>;
  purchaseCoinItem: (itemId: string) => Promise<CoinWorkshopSnapshot>;
  equipCoinItem: (itemId: string) => Promise<CoinWorkshopSnapshot>;
  harvestCoinPlant: (plantId: number) => Promise<CoinWorkshopSnapshot>;
  listCoinTransactions: (query?: CoinTransactionQuery) => Promise<CoinTransactionPage>;
  getCheckinWalletSnapshot: () => Promise<CheckinWalletSnapshot>;
  runDailyCheckin: () => Promise<CheckinResult>;
  importCheckinWallet: (payload: CheckinWalletImportPayload) => Promise<CheckinWalletSnapshot>;
  spendCheckinCoins: (payload: CheckinCoinSpendPayload) => Promise<CheckinWalletSnapshot>;
  saveDailyReport: (payload: SaveDailyReportPayload) => Promise<DailyReportRecord>;
  getTimelineSnapshot: (query?: TimelineQuery) => Promise<TimelineSnapshot>;
  getZoomFactor: () => Promise<number>;
  setZoomFactor: (factor: number) => Promise<number>;
  changeZoomFactor: (delta: number) => Promise<number>;
  onAutoSyncUpdated: (callback: (state: AutoSyncState) => void) => () => void;
  onCheckinWalletUpdated: (callback: (snapshot: CheckinWalletSnapshot) => void) => () => void;
  onFeishuAuthUpdated: (callback: (snapshot: FeishuAuthSnapshot) => void) => () => void;
}
