import { app, BrowserWindow, powerMonitor } from 'electron';
import { clearAutoSyncTimer, refreshAutoSyncSchedule } from './main/autoSync.js';
import { disposeFeishuAuthWatchers } from './main/feishuAuth.js';
import { registerIpcHandlers } from './main/ipc.js';
import { createMainWindow } from './main/windows.js';

app.whenReady().then(async () => {
  registerIpcHandlers();
  createMainWindow();
  await refreshAutoSyncSchedule();

  powerMonitor.on('resume', () => {
    void refreshAutoSyncSchedule();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  clearAutoSyncTimer();
  disposeFeishuAuthWatchers();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
