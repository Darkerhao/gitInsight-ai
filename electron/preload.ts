import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppConfig,
  AutoSyncRunResult,
  AutoSyncState,
  AutoSyncValidationResult,
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
  GenerateReportParams,
  JiaziFarmHarvestPayload,
  JiaziFarmPlantPayload,
  JiaziFarmQuickRipenPayload,
  JiaziFarmSnapshot,
  JiaziFarmTaskPayload,
  JiaziFarmWaterPayload,
  RepoInfo,
  ReportResult,
  SaveDailyReportPayload,
  StorageInfo,
  SyncLogRecord,
  SyncFeishuDailyPayload,
  TokenProxyConfig,
  TokenScanProgress,
  TokenScanRecord,
  TokenProxyStatus,
  ApiUsageRecord,
  UsageFilter,
  UsageStats,
} from '../src/shared/types.js';

contextBridge.exposeInMainWorld('api', {
  loadConfig: () => ipcRenderer.invoke('app:load-config') as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('app:save-config', config) as Promise<AppConfig>,
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory') as Promise<string | null>,
  scanRepositories: (workspaceDir: string) => ipcRenderer.invoke('repo:scan', workspaceDir) as Promise<RepoInfo[]>,
  generateReport: (params: GenerateReportParams) => ipcRenderer.invoke('report:generate', params) as Promise<ReportResult>,
  loginFeishu: (payload: FeishuLoginPayload) => ipcRenderer.invoke('feishu:login', payload) as Promise<FeishuAuthSnapshot>,
  openFeishuSubmissionRecords: (payload: FeishuSubmissionRecordsPayload) =>
    ipcRenderer.invoke('feishu:open-submission-records', payload) as Promise<boolean>,
  listFeishuFields: (payload: FeishuProjectOptionsPayload) =>
    ipcRenderer.invoke('feishu:list-fields', payload) as Promise<FeishuFieldOption[]>,
  listFeishuProjects: (payload: FeishuProjectOptionsPayload) =>
    ipcRenderer.invoke('feishu:list-projects', payload) as Promise<FeishuProjectOption[]>,
  testSubmitFeishu: (payload: FeishuTestSubmitPayload) =>
    ipcRenderer.invoke('feishu:test-submit', payload) as Promise<FeishuSubmitResult>,
  syncFeishuDaily: (payload: SyncFeishuDailyPayload) => ipcRenderer.invoke('report:sync-feishu', payload) as Promise<boolean>,
  getAutoSyncState: () => ipcRenderer.invoke('auto-sync:get-state') as Promise<AutoSyncState>,
  validateAutoSync: (config: AppConfig) => ipcRenderer.invoke('auto-sync:validate', config) as Promise<AutoSyncValidationResult>,
  runAutoSyncNow: (config: AppConfig) => ipcRenderer.invoke('auto-sync:run-now', config) as Promise<AutoSyncRunResult>,
  listDailyReports: (limit?: number) => ipcRenderer.invoke('daily-report:list', limit) as Promise<DailyReportRecord[]>,
  listSyncLogs: (limit?: number) => ipcRenderer.invoke('sync-log:list', limit) as Promise<SyncLogRecord[]>,
  listErrorLogs: (limit?: number) => ipcRenderer.invoke('error-log:list', limit) as Promise<ErrorLogRecord[]>,
  getStorageInfo: () => ipcRenderer.invoke('storage:info') as Promise<StorageInfo>,
  getCheckinWalletSnapshot: () =>
    ipcRenderer.invoke('checkin-wallet:get-snapshot') as Promise<CheckinWalletSnapshot>,
  runDailyCheckin: () =>
    ipcRenderer.invoke('checkin-wallet:daily-checkin') as Promise<CheckinResult>,
  importCheckinWallet: (payload: CheckinWalletImportPayload) =>
    ipcRenderer.invoke('checkin-wallet:import-local', payload) as Promise<CheckinWalletSnapshot>,
  spendCheckinCoins: (payload: CheckinCoinSpendPayload) =>
    ipcRenderer.invoke('checkin-wallet:spend', payload) as Promise<CheckinWalletSnapshot>,
  getJiaziFarmSnapshot: (date?: string) =>
    ipcRenderer.invoke('jiazi-farm:get-snapshot', date) as Promise<JiaziFarmSnapshot>,
  claimJiaziFarmTask: (payload: JiaziFarmTaskPayload) =>
    ipcRenderer.invoke('jiazi-farm:claim-task', payload) as Promise<JiaziFarmSnapshot>,
  harvestJiaziFarm: (payload: JiaziFarmHarvestPayload) =>
    ipcRenderer.invoke('jiazi-farm:harvest', payload) as Promise<JiaziFarmSnapshot>,
  waterJiaziPlot: (payload: JiaziFarmWaterPayload) =>
    ipcRenderer.invoke('jiazi-farm:water', payload) as Promise<JiaziFarmSnapshot>,
  quickRipenJiaziPlot: (payload: JiaziFarmQuickRipenPayload) =>
    ipcRenderer.invoke('jiazi-farm:quick-ripen', payload) as Promise<JiaziFarmSnapshot>,
  plantJiaziCrop: (payload: JiaziFarmPlantPayload) =>
    ipcRenderer.invoke('jiazi-farm:plant', payload) as Promise<JiaziFarmSnapshot>,
  unlockJiaziCropTier: (date?: string) =>
    ipcRenderer.invoke('jiazi-farm:unlock-crop-tier', date) as Promise<JiaziFarmSnapshot>,
  unlockJiaziPlot: (date?: string) =>
    ipcRenderer.invoke('jiazi-farm:unlock-plot', date) as Promise<JiaziFarmSnapshot>,
  saveDailyReport: (payload: SaveDailyReportPayload) =>
    ipcRenderer.invoke('daily-report:save', payload) as Promise<DailyReportRecord>,
  // Token 统计
  runTokenScan: (repoPaths: string[]) =>
    ipcRenderer.invoke('token-scan:run', repoPaths) as Promise<TokenScanRecord[]>,
  listTokenScans: (limit?: number) =>
    ipcRenderer.invoke('token-scan:list', limit) as Promise<TokenScanRecord[]>,
  startTokenProxy: (proxyConfig: TokenProxyConfig) =>
    ipcRenderer.invoke('token-proxy:start', proxyConfig) as Promise<{ port: number }>,
  stopTokenProxy: () =>
    ipcRenderer.invoke('token-proxy:stop') as Promise<void>,
  getTokenProxyStatus: () =>
    ipcRenderer.invoke('token-proxy:status') as Promise<TokenProxyStatus>,
  listApiUsage: (filter?: UsageFilter) =>
    ipcRenderer.invoke('api-usage:list', filter) as Promise<ApiUsageRecord[]>,
  getUsageStats: (filter?: UsageFilter) =>
    ipcRenderer.invoke('api-usage:stats', filter) as Promise<UsageStats>,
  onTokenScanProgress: (callback: (progress: TokenScanProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: TokenScanProgress) => callback(progress);
    ipcRenderer.on('token-scan:progress', listener);
    return () => ipcRenderer.removeListener('token-scan:progress', listener);
  },
  onAutoSyncUpdated: (callback: (state: AutoSyncState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AutoSyncState) => callback(state);
    ipcRenderer.on('auto-sync:updated', listener);
    return () => ipcRenderer.removeListener('auto-sync:updated', listener);
  },
  onCheckinWalletUpdated: (callback: (snapshot: CheckinWalletSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: CheckinWalletSnapshot) => callback(snapshot);
    ipcRenderer.on('checkin-wallet:updated', listener);
    return () => ipcRenderer.removeListener('checkin-wallet:updated', listener);
  },
  onFeishuAuthUpdated: (callback: (snapshot: FeishuAuthSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: FeishuAuthSnapshot) => callback(snapshot);
    ipcRenderer.on('feishu:auth-updated', listener);
    return () => ipcRenderer.removeListener('feishu:auth-updated', listener);
  },
});
