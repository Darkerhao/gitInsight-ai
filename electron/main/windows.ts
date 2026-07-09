import { BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export let mainWindow: BrowserWindow | null = null;

const APP_BACKGROUND_COLOR = '#f4f6fb';

export function getWindowIconPath() {
  const platformCandidates = process.platform === 'darwin'
    ? [
        join(process.cwd(), 'build/icons/mac/icon.icns'),
        join(process.resourcesPath, 'build/icons/mac/icon.icns'),
        join(process.cwd(), 'build', 'icon_2.png'),
        join(process.resourcesPath, 'build', 'icon_2.png'),
      ]
    : process.platform === 'linux'
    ? [
        join(process.cwd(), 'build/icon_4.png'),
        join(process.resourcesPath, 'build/icon_4.png'),
        join(process.cwd(), 'build/icons/win/icon.ico'),
        join(process.resourcesPath, 'build/icons/win/icon.ico'),
      ]
    : [
        join(process.cwd(), 'build/icons/win/icon.ico'),
        join(process.resourcesPath, 'build/icons/win/icon.ico'),
        join(process.cwd(), 'build', 'icon_1.png'),
        join(process.resourcesPath, 'build', 'icon_1.png'),
      ];
  const uniqueCandidates = [
    ...new Set(platformCandidates),
  ];
  return uniqueCandidates.find((item) => existsSync(item));
}


export function getWindowOptionsIcon() {
  return getWindowIconPath() || undefined;
}


export function toCloneable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}


export function createMainWindow() {
  const preloadPath = existsSync(join(__dirname, '../preload/index.js'))
    ? join(__dirname, '../preload/index.js')
    : join(__dirname, '../preload/preload.cjs');

  mainWindow = new BrowserWindow({
    show: false,
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 780,
    icon: getWindowOptionsIcon(),
    backgroundColor: APP_BACKGROUND_COLOR,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const createdWindow = mainWindow;
  const revealMainWindow = () => {
    if (createdWindow.isDestroyed()) return;
    if (!createdWindow.isVisible()) createdWindow.show();
  };
  const revealFallbackTimer = setTimeout(revealMainWindow, 5000);

  createdWindow.once('ready-to-show', () => {
    clearTimeout(revealFallbackTimer);
    revealMainWindow();
  });
  createdWindow.webContents.once('did-fail-load', () => {
    clearTimeout(revealFallbackTimer);
    revealMainWindow();
  });
  createdWindow.on('closed', () => {
    clearTimeout(revealFallbackTimer);
    if (mainWindow === createdWindow) mainWindow = null;
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}


export function getMainWindow() {
  return mainWindow;
}

export function sendToMainWindow(channel: string, payload: unknown) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  mainWindow.webContents.send(channel, toCloneable(payload));
  return true;
}
