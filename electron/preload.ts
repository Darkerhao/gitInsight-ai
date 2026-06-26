import { contextBridge, ipcRenderer } from 'electron';
import type { AppConfig, GenerateReportParams, RepoInfo, ReportResult } from '../src/shared/types.js';

contextBridge.exposeInMainWorld('api', {
  loadConfig: () => ipcRenderer.invoke('app:load-config') as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke('app:save-config', config) as Promise<AppConfig>,
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory') as Promise<string | null>,
  scanRepositories: (workspaceDir: string) => ipcRenderer.invoke('repo:scan', workspaceDir) as Promise<RepoInfo[]>,
  generateReport: (params: GenerateReportParams) => ipcRenderer.invoke('report:generate', params) as Promise<ReportResult>,
  pushFeishu: (payload: { webhook: string; report: string }) => ipcRenderer.invoke('report:push', payload) as Promise<boolean>,
});

