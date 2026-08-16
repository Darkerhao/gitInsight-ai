import { dialog, ipcMain } from 'electron';
import type {
  AppConfig,
  AiConnectionTestPayload,
  CheckinCoinSpendPayload,
  CheckinWalletImportPayload,
  FeishuLoginPayload,
  FeishuProjectOptionsPayload,
  FeishuSubmissionRecordsPayload,
  FeishuTestSubmitPayload,
  GenerateReportParams,
  HistoryLogQuery,
  SaveDailyReportPayload,
  SyncFeishuDailyPayload,
  WeeklyReflectionParams,
} from '../../src/shared/types.js';
import { getAutoSyncState, runAutoSync, saveConfigAndReschedule, validateAutoSync } from './autoSync.js';
import { getCheckinWalletSnapshot, importCheckinWallet, runDailyCheckin, spendCheckinCoins } from './checkinWallet.js';
import { loadConfig } from './config.js';
import { getDatabase, getStorageInfo, listDailyReports, listErrorLogs, listHistoryProjects, listSyncLogs, queryHistoryLogs, saveDailyReport } from './database.js';
import { getTimelineSnapshot } from './timeline.js';
import type { TimelineQuery } from '../../src/shared/types.js';
import { listFeishuFieldOptions, listFeishuProjectOptions, syncFeishuDaily, testSubmitFeishuForm } from './feishuForm.js';
import { openFeishuLogin, openFeishuSubmissionRecords } from './feishuAuth.js';
import { generateReport } from './report.js';
import { scanRepositories } from './repoScan.js';
import { getMainWindow } from './windows.js';
import { testAiConnection } from './aiClient.js';
import { generateWeeklyReflection, getWeeklyReflectionHistory, getWeeklyReflectionProjects, getWeeklyReflectionSources } from './reflection.js';

export function registerIpcHandlers() {
  ipcMain.handle('app:load-config', async () => loadConfig());
  ipcMain.handle('app:save-config', async (_event, config: AppConfig) => saveConfigAndReschedule(config));
  ipcMain.handle('ai:test-connection', async (_event, payload: AiConnectionTestPayload) => testAiConnection(payload));
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
  ipcMain.handle('timeline:get-snapshot', async (_event, query?: TimelineQuery) =>
    getTimelineSnapshot(query, await getDatabase()),
  );
  ipcMain.handle('sync-log:list', async (_event, limit?: number) => listSyncLogs(limit));
  ipcMain.handle('error-log:list', async (_event, limit?: number) => listErrorLogs(limit));
  ipcMain.handle('history-log:query', async (_event, query?: HistoryLogQuery) => queryHistoryLogs(query));
  ipcMain.handle('history-log:list-projects', async () => listHistoryProjects());
  ipcMain.handle('weekly-reflection:list-projects', async () => getWeeklyReflectionProjects());
  ipcMain.handle('weekly-reflection:list-sources', async (_event, params: WeeklyReflectionParams) => getWeeklyReflectionSources(params));
  ipcMain.handle('weekly-reflection:list', async (_event, limit?: number) => getWeeklyReflectionHistory(limit));
  ipcMain.handle('weekly-reflection:generate', async (_event, params: WeeklyReflectionParams) => generateWeeklyReflection(params));
  ipcMain.handle('storage:info', async () => getStorageInfo());
  ipcMain.handle('checkin-wallet:get-snapshot', async () => getCheckinWalletSnapshot());
  ipcMain.handle('checkin-wallet:daily-checkin', async () => runDailyCheckin());
  ipcMain.handle('checkin-wallet:import-local', async (_event, payload: CheckinWalletImportPayload) => importCheckinWallet(payload));
  ipcMain.handle('checkin-wallet:spend', async (_event, payload: CheckinCoinSpendPayload) => spendCheckinCoins(payload));
  ipcMain.handle('feishu:login', async (_event, payload: FeishuLoginPayload) => openFeishuLogin(payload));
  ipcMain.handle('feishu:open-submission-records', async (_event, payload: FeishuSubmissionRecordsPayload) => openFeishuSubmissionRecords(payload));
  ipcMain.handle('feishu:list-fields', async (_event, payload: FeishuProjectOptionsPayload) => listFeishuFieldOptions(payload));
  ipcMain.handle('feishu:list-projects', async (_event, payload: FeishuProjectOptionsPayload) => listFeishuProjectOptions(payload));
  ipcMain.handle('feishu:test-submit', async (_event, payload: FeishuTestSubmitPayload) => testSubmitFeishuForm(payload));
  ipcMain.handle('report:sync-feishu', async (_event, payload: SyncFeishuDailyPayload) => syncFeishuDaily(payload));
  ipcMain.handle('auto-sync:get-state', async () => getAutoSyncState(await loadConfig()));
  ipcMain.handle('auto-sync:validate', async (_event, config: AppConfig, taskId?: string) => validateAutoSync(config, taskId));
  ipcMain.handle('auto-sync:run-now', async (_event, config: AppConfig, taskId?: string) => {
    await saveConfigAndReschedule(config);
    return runAutoSync('manual', taskId);
  });
}
