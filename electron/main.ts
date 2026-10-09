import { app, BrowserWindow, dialog, powerMonitor } from 'electron';
import { clearAutoSyncTimer, refreshAutoSyncSchedule } from './main/autoSync.js';
import { applyPendingRestore } from './main/backup.js';
import { initializeAppUpdates, stopAppUpdates } from './main/appUpdate.js';
import { loadConfig } from './main/config.js';
import { disposeFeishuAuthWatchers } from './main/feishuAuth.js';
import { registerIpcHandlers } from './main/ipc.js';
import { createMainWindow, mainWindow } from './main/windows.js';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let initialized = false;
  let stopping = false;

  // Register before the updater's quit hook. app.exit() also emits quit, but skips before-quit.
  app.on('quit', stopAppUpdates);

  function stopWithError(error: unknown) {
    if (stopping) return;
    stopping = true;
    clearAutoSyncTimer();
    dialog.showErrorBox('GitInsight AI 无法继续运行', error instanceof Error ? error.message : String(error));
    app.quit();
  }

  app.on('second-instance', () => {
    if (!initialized || stopping) return;
    if (!mainWindow) createMainWindow();
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });

  void app.whenReady().then(async () => {
    await applyPendingRestore();
    if (stopping) return;
    await loadConfig();
    if (stopping) return;
    await initializeAppUpdates();
    if (stopping) return;
    registerIpcHandlers();
    createMainWindow();
    await refreshAutoSyncSchedule();
    initialized = true;

    powerMonitor.on('resume', () => {
      if (!stopping) void refreshAutoSyncSchedule().catch(stopWithError);
    });
  }).catch(stopWithError);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    stopping = true;
    clearAutoSyncTimer();
    disposeFeishuAuthWatchers();
  });

  app.on('activate', () => {
    if (initialized && !stopping && BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}
