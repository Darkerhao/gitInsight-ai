import { contextBridge, ipcRenderer } from 'electron';
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
  HistoryLogPage,
  HistoryLogQuery,
  TimelineQuery,
  TimelineSnapshot,
  RepoInfo,
  ReportResult,
  SaveDailyReportPayload,
  StorageInfo,
  SyncLogRecord,
  SyncFeishuDailyPayload,
  WeeklyReflectionParams,
  WeeklyReflectionProject,
  WeeklyReflectionRecord,
  WeeklyReflectionSource,
} from '../src/shared/types.js';

contextBridge.exposeInMainWorld('api', {
  loadConfig: () => ipcRenderer.invoke('app:load-config') as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('app:save-config', config) as Promise<AppConfig>,
  testAiConnection: (payload: AiConnectionTestPayload) =>
    ipcRenderer.invoke('ai:test-connection', payload) as Promise<AiConnectionTestResult>,
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
  validateAutoSync: (config: AppConfig, taskId?: string) =>
    ipcRenderer.invoke('auto-sync:validate', config, taskId) as Promise<AutoSyncValidationResult>,
  runAutoSyncNow: (config: AppConfig, taskId?: string) =>
    ipcRenderer.invoke('auto-sync:run-now', config, taskId) as Promise<AutoSyncRunResult>,
  listDailyReports: (limit?: number) => ipcRenderer.invoke('daily-report:list', limit) as Promise<DailyReportRecord[]>,
  listSyncLogs: (limit?: number) => ipcRenderer.invoke('sync-log:list', limit) as Promise<SyncLogRecord[]>,
  listErrorLogs: (limit?: number) => ipcRenderer.invoke('error-log:list', limit) as Promise<ErrorLogRecord[]>,
  queryHistoryLogs: (query?: HistoryLogQuery) => ipcRenderer.invoke('history-log:query', query) as Promise<HistoryLogPage>,
  listHistoryProjects: () => ipcRenderer.invoke('history-log:list-projects') as Promise<string[]>,
  listWeeklyReflectionProjects: () => ipcRenderer.invoke('weekly-reflection:list-projects') as Promise<WeeklyReflectionProject[]>,
  listWeeklyReflectionSources: (params: WeeklyReflectionParams) =>
    ipcRenderer.invoke('weekly-reflection:list-sources', params) as Promise<WeeklyReflectionSource[]>,
  listWeeklyReflections: (limit?: number) =>
    ipcRenderer.invoke('weekly-reflection:list', limit) as Promise<WeeklyReflectionRecord[]>,
  generateWeeklyReflection: (params: WeeklyReflectionParams) =>
    ipcRenderer.invoke('weekly-reflection:generate', params) as Promise<WeeklyReflectionRecord>,
  getStorageInfo: () => ipcRenderer.invoke('storage:info') as Promise<StorageInfo>,
  getCheckinWalletSnapshot: () =>
    ipcRenderer.invoke('checkin-wallet:get-snapshot') as Promise<CheckinWalletSnapshot>,
  runDailyCheckin: () =>
    ipcRenderer.invoke('checkin-wallet:daily-checkin') as Promise<CheckinResult>,
  importCheckinWallet: (payload: CheckinWalletImportPayload) =>
    ipcRenderer.invoke('checkin-wallet:import-local', payload) as Promise<CheckinWalletSnapshot>,
  spendCheckinCoins: (payload: CheckinCoinSpendPayload) =>
    ipcRenderer.invoke('checkin-wallet:spend', payload) as Promise<CheckinWalletSnapshot>,
  saveDailyReport: (payload: SaveDailyReportPayload) =>
    ipcRenderer.invoke('daily-report:save', payload) as Promise<DailyReportRecord>,
  getTimelineSnapshot: (query?: TimelineQuery) =>
    ipcRenderer.invoke('timeline:get-snapshot', query) as Promise<TimelineSnapshot>,
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
