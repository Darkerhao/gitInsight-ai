import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppConfig,
  AutoSyncRunResult,
  AutoSyncState,
  AutoSyncValidationResult,
  DailyReportRecord,
  ErrorLogRecord,
  FeishuAuthSnapshot,
  FeishuFieldOption,
  FeishuLoginPayload,
  FeishuProjectOption,
  FeishuProjectOptionsPayload,
  FeishuSubmitResult,
  FeishuTestSubmitPayload,
  GenerateReportParams,
  RepoInfo,
  ReportResult,
  SaveDailyReportPayload,
  StorageInfo,
  SyncLogRecord,
  SyncFeishuDailyPayload,
} from '../src/shared/types.js';

contextBridge.exposeInMainWorld('api', {
  loadConfig: () => ipcRenderer.invoke('app:load-config') as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('app:save-config', config) as Promise<AppConfig>,
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory') as Promise<string | null>,
  scanRepositories: (workspaceDir: string) => ipcRenderer.invoke('repo:scan', workspaceDir) as Promise<RepoInfo[]>,
  generateReport: (params: GenerateReportParams) => ipcRenderer.invoke('report:generate', params) as Promise<ReportResult>,
  loginFeishu: (payload: FeishuLoginPayload) => ipcRenderer.invoke('feishu:login', payload) as Promise<FeishuAuthSnapshot>,
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
  saveDailyReport: (payload: SaveDailyReportPayload) =>
    ipcRenderer.invoke('daily-report:save', payload) as Promise<DailyReportRecord>,
  onAutoSyncUpdated: (callback: (state: AutoSyncState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AutoSyncState) => callback(state);
    ipcRenderer.on('auto-sync:updated', listener);
    return () => ipcRenderer.removeListener('auto-sync:updated', listener);
  },
  onFeishuAuthUpdated: (callback: (snapshot: FeishuAuthSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: FeishuAuthSnapshot) => callback(snapshot);
    ipcRenderer.on('feishu:auth-updated', listener);
    return () => ipcRenderer.removeListener('feishu:auth-updated', listener);
  },
});
