import { app } from 'electron';
import electronUpdater from 'electron-updater';
import type { AppUpdater, UpdateInfo } from 'electron-updater';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { AppUpdateState } from '../../src/shared/appUpdate.js';
import { writeFileAtomically } from './atomicFile.js';
import { sendToMainWindow } from './windows.js';

const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
let updater: AppUpdater | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let checkTask: Promise<AppUpdateState> | null = null;
let downloadTask: Promise<AppUpdateState> | null = null;
let preferenceQueue: Promise<unknown> = Promise.resolve();
let stopped = false;
let state: AppUpdateState = {
  status: 'idle', supported: false, autoUpdate: true,
  currentVersion: app.getVersion(), latestVersion: '', releaseNotes: '', releaseDate: '',
  lastCheckedAt: '', message: '', progress: null,
};

function preferencesPath() {
  return join(app.getPath('userData'), 'updater-settings.json');
}

export function getAppUpdateState(): AppUpdateState {
  return { ...state, progress: state.progress ? { ...state.progress } : null };
}

function publish(patch: Partial<AppUpdateState>): AppUpdateState {
  state = { ...state, ...patch };
  sendToMainWindow('app-update:state', state);
  return getAppUpdateState();
}

function unsupportedReason(): string {
  if (!app.isPackaged) return '开发环境不检查更新，请在正式安装版中使用。';
  if (process.platform === 'win32') {
    const executable = app.getPath('exe');
    if (process.env.PORTABLE_EXECUTABLE_FILE || !existsSync(join(dirname(executable), `Uninstall ${basename(executable)}`))) {
      return '当前为免安装版本，请先使用 Windows 安装版，即可在应用内自动更新。';
    }
    return '';
  }
  if (process.platform === 'linux') {
    if (process.env.APPIMAGE) return '';
    const packageTypeFile = join(process.resourcesPath, 'package-type');
    if (existsSync(packageTypeFile) && ['deb', 'rpm'].includes(readFileSync(packageTypeFile, 'utf8').trim())) return '';
    return '当前安装方式不支持自动更新，请使用 AppImage、deb 或 rpm 安装包。';
  }
  if (process.platform === 'darwin') return '当前 macOS 发行版尚未签名，暂不支持应用内更新，请在更新日志中下载新版。';
  return '当前系统暂不支持应用内更新。';
}

function releaseDetails(info: UpdateInfo) {
  return {
    latestVersion: info.version,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes
      : (info.releaseNotes ?? []).map(note => `${note.version}\n${note.note || ''}`).join('\n\n'),
    releaseDate: info.releaseDate || '',
  };
}

function reportError(error: unknown): AppUpdateState {
  const code = (error as { code?: string })?.code;
  const detail = error instanceof Error ? error.message : String(error);
  const message = code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'
    ? '最新发布尚未提供更新文件，请稍后重试。'
    : /checksum|sha512|signature|签名/i.test(`${code} ${detail}`)
      ? '更新包校验失败，请重新下载。'
      : '更新失败，请检查网络连接后重试。';
  return publish({ status: 'error', message });
}

function scheduleCheck(delay: number) {
  clearTimeout(timer);
  timer = undefined;
  if (stopped || !state.supported || !state.autoUpdate) return;
  timer = setTimeout(async () => {
    await checkForAppUpdates();
    scheduleCheck(CHECK_INTERVAL);
  }, delay);
  timer.unref();
}

export async function initializeAppUpdates(): Promise<void> {
  try {
    const preferences: unknown = JSON.parse(await readFile(preferencesPath(), 'utf8'));
    if (!preferences || typeof preferences !== 'object' || typeof (preferences as { autoUpdate?: unknown }).autoUpdate !== 'boolean') {
      throw new Error('Invalid update preferences');
    }
    state.autoUpdate = (preferences as { autoUpdate: boolean }).autoUpdate;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      state.autoUpdate = false;
      publish({ status: 'error', message: '自动更新设置读取失败，请重新设置开关。' });
    }
  }
  const reason = unsupportedReason();
  if (reason) {
    publish({ status: 'unsupported', message: reason });
    return;
  }

  updater = electronUpdater.autoUpdater;
  updater.autoDownload = false;
  // BaseUpdater registers its quit hook only when this is true at download time.
  // Keep it armed for manual downloads too; our earlier quit listener applies the latest preference.
  updater.autoInstallOnAppQuit = true;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.on('checking-for-update', () => publish({
    status: 'checking', message: '', progress: null, latestVersion: '', releaseNotes: '', releaseDate: '',
  }));
  updater.on('update-not-available', () => publish({
    status: 'not-available', message: '', lastCheckedAt: new Date().toISOString(),
  }));
  updater.on('update-available', info => publish({
    ...releaseDetails(info), status: 'available', message: '', lastCheckedAt: new Date().toISOString(),
  }));
  updater.on('download-progress', progress => publish({
    status: 'downloading', progress: {
      percent: Math.min(100, Math.max(0, progress.percent)),
      transferred: progress.transferred, total: progress.total, bytesPerSecond: progress.bytesPerSecond,
    },
  }));
  updater.on('update-downloaded', info => publish({ ...releaseDetails(info), status: 'downloaded', message: '', progress: null }));
  updater.on('error', reportError);
  publish({ supported: true });
  scheduleCheck(15_000);
}

export function checkForAppUpdates(): Promise<AppUpdateState> {
  if (!updater || downloadTask || state.status === 'downloaded') return Promise.resolve(getAppUpdateState());
  if (checkTask) return checkTask;
  checkTask = (async () => {
    try {
      const result = await updater!.checkForUpdates();
      if (!result) return publish({ status: 'unsupported', supported: false, message: '当前安装方式不支持应用内更新。' });
      if (result.isUpdateAvailable && state.autoUpdate) void downloadAppUpdate();
      return getAppUpdateState();
    } catch (error) {
      return reportError(error);
    } finally {
      checkTask = null;
    }
  })();
  return checkTask;
}

export function downloadAppUpdate(): Promise<AppUpdateState> {
  if (downloadTask) return downloadTask;
  if (!updater || state.status === 'downloaded') return Promise.resolve(getAppUpdateState());
  if (state.status !== 'available' && !(state.status === 'error' && state.latestVersion)) {
    return Promise.reject(new Error('请先检查并找到新版本，再下载更新。'));
  }
  publish({ status: 'downloading', message: '', progress: null });
  downloadTask = (async () => {
    try {
      await updater!.downloadUpdate();
      return getAppUpdateState();
    } catch (error) {
      return reportError(error);
    } finally {
      downloadTask = null;
    }
  })();
  return downloadTask;
}

export async function setAutomaticUpdates(enabled: boolean): Promise<AppUpdateState> {
  if (typeof enabled !== 'boolean') throw new Error('自动更新开关必须为布尔值。');
  const operation = preferenceQueue.then(async () => {
    await writeFileAtomically(preferencesPath(), JSON.stringify({ autoUpdate: enabled }, null, 2));
    publish({ autoUpdate: enabled });
    scheduleCheck(0);
    return getAppUpdateState();
  });
  preferenceQueue = operation.catch(() => {});
  return operation;
}

export function installAppUpdate(): void {
  if (!updater || state.status !== 'downloaded') throw new Error('请等待更新下载完成后再安装。');
  updater.quitAndInstall(true, true);
}

export function stopAppUpdates(): void {
  stopped = true;
  clearTimeout(timer);
  timer = undefined;
  if (updater) updater.autoInstallOnAppQuit = state.autoUpdate;
}
