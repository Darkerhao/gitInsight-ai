import { app, BrowserWindow, powerMonitor } from 'electron';
import { clearAutoSyncTimer, refreshAutoSyncSchedule } from './main/autoSync.js';
import { loadConfig } from './main/config.js';
import { disposeFeishuAuthWatchers } from './main/feishuAuth.js';
import { registerIpcHandlers } from './main/ipc.js';
import { startTokenProxy, stopTokenProxy } from './main/tokenProxy.js';
import { createMainWindow } from './main/windows.js';

app.whenReady().then(async () => {
  registerIpcHandlers();
  createMainWindow();
  await refreshAutoSyncSchedule();

  // 自动启动 Token 代理
  try {
    const config = await loadConfig();
    if (config.tokenProxy.enabled) {
      await startTokenProxy(config.tokenProxy);
    }
  } catch {
    // 代理启动失败不影响主应用
  }

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
  void stopTokenProxy();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
