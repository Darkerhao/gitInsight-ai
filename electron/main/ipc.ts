import { dialog, ipcMain } from 'electron';
import type {
  AppConfig,
  CheckinCoinSpendPayload,
  CheckinWalletImportPayload,
  FeishuLoginPayload,
  FeishuProjectOptionsPayload,
  FeishuSubmissionRecordsPayload,
  FeishuTestSubmitPayload,
  GenerateReportParams,
  JiaziFarmHarvestPayload,
  JiaziFarmPlantPayload,
  JiaziFarmQuickRipenPayload,
  JiaziFarmTaskPayload,
  JiaziFarmWaterPayload,
  SaveDailyReportPayload,
  SyncFeishuDailyPayload,
} from '../../src/shared/types.js';
import { getAutoSyncState, runAutoSync, saveConfigAndReschedule, validateAutoSync } from './autoSync.js';
import { getCheckinWalletSnapshot, importCheckinWallet, runDailyCheckin, spendCheckinCoins } from './checkinWallet.js';
import { loadConfig, saveConfig } from './config.js';
import { getStorageInfo, listDailyReports, listErrorLogs, listSyncLogs, saveDailyReport } from './database.js';
import { listFeishuFieldOptions, listFeishuProjectOptions, syncFeishuDaily, testSubmitFeishuForm } from './feishuForm.js';
import { openFeishuLogin, openFeishuSubmissionRecords } from './feishuAuth.js';
import {
  claimJiaziFarmTask,
  getJiaziFarmSnapshot,
  harvestJiaziFarm,
  plantCrop,
  quickRipenPlot,
  unlockCropTier,
  unlockPlot,
  waterPlot,
} from './jiaziFarm.js';
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
  ipcMain.handle('checkin-wallet:get-snapshot', async () => getCheckinWalletSnapshot());
  ipcMain.handle('checkin-wallet:daily-checkin', async () => runDailyCheckin());
  ipcMain.handle('checkin-wallet:import-local', async (_event, payload: CheckinWalletImportPayload) => importCheckinWallet(payload));
  ipcMain.handle('checkin-wallet:spend', async (_event, payload: CheckinCoinSpendPayload) => spendCheckinCoins(payload));
  ipcMain.handle('jiazi-farm:get-snapshot', async (_event, date?: string) => getJiaziFarmSnapshot(date));
  ipcMain.handle('jiazi-farm:claim-task', async (_event, payload: JiaziFarmTaskPayload) => claimJiaziFarmTask(payload));
  ipcMain.handle('jiazi-farm:harvest', async (_event, payload: JiaziFarmHarvestPayload) => harvestJiaziFarm(payload));
  ipcMain.handle('jiazi-farm:water', async (_event, payload: JiaziFarmWaterPayload) => waterPlot(payload));
  ipcMain.handle('jiazi-farm:quick-ripen', async (_event, payload: JiaziFarmQuickRipenPayload) => quickRipenPlot(payload));
  ipcMain.handle('jiazi-farm:plant', async (_event, payload: JiaziFarmPlantPayload) => plantCrop(payload));
  ipcMain.handle('jiazi-farm:unlock-crop-tier', async (_event, date?: string) => unlockCropTier(date));
  ipcMain.handle('jiazi-farm:unlock-plot', async (_event, date?: string) => unlockPlot(date));
  ipcMain.handle('feishu:login', async (_event, payload: FeishuLoginPayload) => openFeishuLogin(payload));
  ipcMain.handle('feishu:open-submission-records', async (_event, payload: FeishuSubmissionRecordsPayload) => openFeishuSubmissionRecords(payload));
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
