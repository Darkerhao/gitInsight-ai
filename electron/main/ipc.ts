import { dialog, ipcMain } from 'electron';
import type {
  AppConfig,
  FeishuLoginPayload,
  FeishuProjectOptionsPayload,
  FeishuTestSubmitPayload,
  GenerateReportParams,
  SaveDailyReportPayload,
  SyncFeishuDailyPayload,
} from '../../src/shared/types.js';
import { getAutoSyncState, runAutoSync, saveConfigAndReschedule, validateAutoSync } from './autoSync.js';
import { loadConfig, saveConfig } from './config.js';
import { getStorageInfo, listDailyReports, listErrorLogs, listSyncLogs, saveDailyReport } from './database.js';
import { listFeishuFieldOptions, listFeishuProjectOptions, syncFeishuDaily, testSubmitFeishuForm } from './feishuForm.js';
import { openFeishuLogin, openFeishuSubmissionRecords } from './feishuAuth.js';
import { generateReport } from './report.js';
import { scanRepositories } from './repoScan.js';
import { getMainWindow } from './windows.js';

export function registerIpcHandlers() {
  ipcMain.handle('app:load-config', async () => loadConfig());
  ipcMain.handle('app:save-config', async (_event, config: AppConfig) => saveConfigAndReschedule(config));
  ipcMain.handle('dialog:select-directory', async () => {
    const mainWindow = getMainWindow();
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle('repo:scan', async (_event, workspaceDir: string) => scanRepositories(workspaceDir));
  ipcMain.handle('report:generate', async (_event, params: GenerateReportParams) => generateReport(params));
  ipcMain.handle('daily-report:list', async (_event, limit?: number) => listDailyReports(limit));
  ipcMain.handle('daily-report:save', async (_event, payload: SaveDailyReportPayload) => saveDailyReport(payload));
  ipcMain.handle('sync-log:list', async (_event, limit?: number) => listSyncLogs(limit));
  ipcMain.handle('error-log:list', async (_event, limit?: number) => listErrorLogs(limit));
  ipcMain.handle('storage:info', async () => getStorageInfo());
  ipcMain.handle('feishu:login', async (_event, payload: FeishuLoginPayload) => openFeishuLogin(payload));
  ipcMain.handle('feishu:open-submission-records', async (_event, payload: FeishuLoginPayload) => openFeishuSubmissionRecords(payload));
  ipcMain.handle('feishu:list-fields', async (_event, payload: FeishuProjectOptionsPayload) => listFeishuFieldOptions(payload));
  ipcMain.handle('feishu:list-projects', async (_event, payload: FeishuProjectOptionsPayload) => listFeishuProjectOptions(payload));
  ipcMain.handle('feishu:test-submit', async (_event, payload: FeishuTestSubmitPayload) => testSubmitFeishuForm(payload));
  ipcMain.handle('report:sync-feishu', async (_event, payload: SyncFeishuDailyPayload) => syncFeishuDaily(payload));
  ipcMain.handle('auto-sync:get-state', async () => getAutoSyncState(await loadConfig()));
  ipcMain.handle('auto-sync:validate', async (_event, config: AppConfig) => validateAutoSync(config));
  ipcMain.handle('auto-sync:run-now', async (_event, config: AppConfig) => {
    await saveConfig(config);
    return runAutoSync('manual');
  });
}
