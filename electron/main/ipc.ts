import type { CoinTransactionQuery } from '../../src/shared/coinWorkshop.js';
import { getCoinWorkshop, purchaseCoinItem, equipCoinItem, harvestCoinPlant, listCoinTransactions } from './coinWorkshop.js';
import { exportDataBackup, restoreDataBackup } from './backup.js';
import { dialog, ipcMain, shell } from 'electron';
import { APP_LINKS } from '../../src/shared/appUpdate.js';
import type { AppLink } from '../../src/shared/appUpdate.js';
import { checkForAppUpdates, downloadAppUpdate, getAppUpdateState, installAppUpdate, setAutomaticUpdates } from './appUpdate.js';
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
  GenerateFromMaterialParams,
  MaterialRole,
  RoleMaterialPayload,
  HistoryLogQuery,
  SaveDailyReportPayload,
  SyncFeishuDailyPayload,
  WeeklyReflectionActionStatusUpdate,
  WeeklyReflectionParams,
  SaveWeeklySummaryPayload,
  WeeklySummaryParams,
} from '../../src/shared/types.js';
import { getAutoSyncState, runAutoSync, saveConfigAndReschedule, validateAutoSync } from './autoSync.js';
import { getCheckinWalletSnapshot, importCheckinWallet, runDailyCheckin, spendCheckinCoins } from './checkinWallet.js';
import { loadConfig } from './config.js';
import { getDatabase, getDailyReportById, loadMaterialReport, loadRoleMaterial, saveRoleMaterial, getStorageInfo, listDailyReports, listErrorLogs, listHistoryProjects, listSyncLogs, queryHistoryLogs, saveDailyReport } from './database.js';
import { getTimelineSnapshot } from './timeline.js';
import type { TimelineQuery } from '../../src/shared/types.js';
import { listFeishuFieldOptions, listFeishuProjectOptions, syncFeishuDaily, testSubmitFeishuForm } from './feishuForm.js';
import { openFeishuLogin, openFeishuSubmissionRecords } from './feishuAuth.js';
import { generateReport } from './report.js';
import { generateReportFromMaterial } from './materialReport.js';
import { scanRepositories } from './repoScan.js';
import { getMainWindow } from './windows.js';
import { testAiConnection } from './aiClient.js';
import { generateWeeklyReflection, getWeeklyReflectionHistory, getWeeklyReflectionProjects, getWeeklyReflectionSources, updateWeeklyReflectionActionStatus } from './reflection.js';
import { generateWeeklySummary, getWeeklySummary, getWeeklySummaryHistory, getWeeklySummarySources, saveWeeklySummary } from './weeklySummary.js';
import { changePageZoom, clampPageZoom } from '../../src/shared/pageZoom.js';

export function registerIpcHandlers() {
  const requireMainWindow = (event: Electron.IpcMainInvokeEvent) => {
    if (event.sender !== getMainWindow()?.webContents) throw new Error('此操作仅限应用主窗口。');
  };
  function handle(channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown) {
    ipcMain.handle(channel, (event, ...args) => {
      requireMainWindow(event);
      return listener(event, ...args);
    });
  }
  handle('app-update:get-state', () => getAppUpdateState());
  handle('app-update:check', () => checkForAppUpdates());
  handle('app-update:download', () => downloadAppUpdate());
  handle('app-update:set-automatic', (_event, enabled: boolean) => setAutomaticUpdates(enabled));
  handle('app-update:install', () => installAppUpdate());
  handle('app:open-link', async (_event, link: AppLink) => {
    if (link !== 'home' && link !== 'releases') throw new Error('不支持的应用链接。');
    await shell.openExternal(APP_LINKS[link]);
  });
  const generations = new Map<string, { owner: number; controller: AbortController }>();
  handle('app:load-config', async () => loadConfig());
  handle('app:save-config', async (_event, config: AppConfig) => saveConfigAndReschedule(config));
  handle('ai:test-connection', async (_event, payload: AiConnectionTestPayload) => testAiConnection(payload));
  handle('dialog:select-directory', async () => {
    const mainWindow = getMainWindow();
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  handle('repo:scan', async (_event, workspaceDir: string) => scanRepositories(workspaceDir));
  handle('report:generate', async (event, params: GenerateReportParams) => {
    const requestId = params.requestId;
    if (!requestId) return generateReport(params);
    if (generations.has(requestId)) throw new Error('生成请求已存在');
    const controller = new AbortController();
    const cancel = () => controller.abort(new Error('已取消生成'));
    generations.set(requestId, { owner: event.sender.id, controller });
    event.sender.once('destroyed', cancel);
    try {
      return await generateReport(params, controller.signal);
    } finally {
      generations.delete(requestId);
      event.sender.removeListener('destroyed', cancel);
    }
  });
  handle('report:cancel-generation', (event, requestId: string) => {
    const generation = generations.get(requestId);
    if (generation?.owner === event.sender.id) generation.controller.abort(new Error('已取消生成'));
  });
  handle('report:generate-from-material', async (_event, params: GenerateFromMaterialParams) => generateReportFromMaterial(params));
  handle('role-material:save', async (_event, payload: RoleMaterialPayload) => saveRoleMaterial(payload));
  handle('role-material:load', async (_event, params: { role: MaterialRole; date: string }) => loadRoleMaterial(params.role, params.date));
  handle('material-report:load', async (_event, params: { role: MaterialRole; date: string }) => loadMaterialReport(params.role, params.date));
  handle('daily-report:get', async (_event, id: number) => getDailyReportById(id));
  handle('daily-report:list', async (_event, limit?: number) => listDailyReports(limit));
  handle('daily-report:save', async (_event, payload: SaveDailyReportPayload) => saveDailyReport(payload));
  handle('timeline:get-snapshot', async (_event, query?: TimelineQuery) =>
    getTimelineSnapshot(query, await getDatabase()),
  );
  handle('view:get-zoom-factor', (event) => event.sender.getZoomFactor());
  handle('view:set-zoom-factor', (event, factor: number) => {
    const next = clampPageZoom(factor);
    event.sender.setZoomFactor(next);
    return next;
  });
  handle('view:change-zoom-factor', (event, delta: number) => {
    const next = changePageZoom(event.sender.getZoomFactor(), delta);
    event.sender.setZoomFactor(next);
    return next;
  });
  handle('sync-log:list', async (_event, limit?: number) => listSyncLogs(limit));
  handle('error-log:list', async (_event, limit?: number) => listErrorLogs(limit));
  handle('history-log:query', async (_event, query?: HistoryLogQuery) => queryHistoryLogs(query));
  handle('history-log:list-projects', async () => listHistoryProjects());
  handle('weekly-reflection:list-projects', async () => getWeeklyReflectionProjects());
  handle('weekly-reflection:list-sources', async (_event, params: WeeklyReflectionParams) => getWeeklyReflectionSources(params));
  handle('weekly-reflection:list', async (_event, limit?: number) => getWeeklyReflectionHistory(limit));
  handle('weekly-reflection:generate', async (_event, params: WeeklyReflectionParams) => generateWeeklyReflection(params));
  handle('weekly-reflection:update-improvement-status', async (_event, payload: WeeklyReflectionActionStatusUpdate) =>
    updateWeeklyReflectionActionStatus(payload),
  );
  handle('weekly-summary:list-sources', async (_event, params: WeeklySummaryParams) => getWeeklySummarySources(params));
  handle('weekly-summary:list', async (_event, limit?: number) => getWeeklySummaryHistory(limit));
  handle('weekly-summary:get', async (_event, id: number) => getWeeklySummary(id));
  handle('weekly-summary:generate', async (_event, params: WeeklySummaryParams) => generateWeeklySummary(params));
  handle('weekly-summary:save', async (_event, payload: SaveWeeklySummaryPayload) => saveWeeklySummary(payload));
  handle('storage:info', async () => getStorageInfo());
  handle('storage:export-backup', async () => exportDataBackup());
  handle('storage:restore-backup', async () => restoreDataBackup());
  handle('coin-workshop:get', () => getCoinWorkshop());
  handle('coin-workshop:purchase', (_event, itemId: string) => purchaseCoinItem(itemId));
  handle('coin-workshop:equip', (_event, itemId: string) => equipCoinItem(itemId));
  handle('coin-workshop:harvest', (_event, plantId: number) => harvestCoinPlant(plantId));
  handle('coin-workshop:transactions', (_event, query?: CoinTransactionQuery) => listCoinTransactions(query));
  handle('checkin-wallet:get-snapshot', async () => getCheckinWalletSnapshot());
  handle('checkin-wallet:daily-checkin', async () => runDailyCheckin());
  handle('checkin-wallet:import-local', async (_event, payload: CheckinWalletImportPayload) => importCheckinWallet(payload));
  handle('checkin-wallet:spend', async (_event, payload: CheckinCoinSpendPayload) => spendCheckinCoins(payload));
  handle('feishu:login', async (_event, payload: FeishuLoginPayload) => openFeishuLogin(payload));
  handle('feishu:open-submission-records', async (_event, payload: FeishuSubmissionRecordsPayload) => openFeishuSubmissionRecords(payload));
  handle('feishu:list-fields', async (_event, payload: FeishuProjectOptionsPayload) => listFeishuFieldOptions(payload));
  handle('feishu:list-projects', async (_event, payload: FeishuProjectOptionsPayload) => listFeishuProjectOptions(payload));
  handle('feishu:test-submit', async (_event, payload: FeishuTestSubmitPayload) => testSubmitFeishuForm(payload));
  handle('report:sync-feishu', async (_event, payload: SyncFeishuDailyPayload) => syncFeishuDaily(payload));
  handle('auto-sync:get-state', async () => getAutoSyncState(await loadConfig()));
  handle('auto-sync:validate', async (_event, config: AppConfig, taskId?: string) => validateAutoSync(config, taskId));
  handle('auto-sync:run-now', async (_event, config: AppConfig, taskId?: string) => {
    await saveConfigAndReschedule(config);
    return runAutoSync('manual', taskId);
  });
}
