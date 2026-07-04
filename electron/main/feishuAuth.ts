import { BrowserWindow, session } from 'electron';
import { DEFAULT_FEISHU_FORM_CONFIG } from '../../src/shared/types.js';
import type { FeishuAuthSnapshot, FeishuFormConfig, FeishuLoginPayload } from '../../src/shared/types.js';
import { getWindowOptionsIcon, sendToMainWindow } from './windows.js';

export let feishuWindow: BrowserWindow | null = null;

export let feishuAuthSyncTimer: ReturnType<typeof setTimeout> | null = null;

export let removeFeishuAuthSessionWatcher: (() => void) | null = null;

export let lastFeishuAuthSignature = '';

export const FEISHU_PARTITION = 'persist:feishu';

export const FEISHU_LOGIN_HOME_URL = 'https://www.feishu.cn/';

export const FEISHU_SHARE_SUBMIT_PATH = '/space/api/bitable/external/share/submit';

const FEISHU_SUBMISSION_RECORD_SCRIPT = `
(() => {
  const normalizeText = (value) => String(value || '').replace(/\\s+/g, '');
  const labels = ['我的提交记录', '提交记录'];
  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const elements = Array.from(document.querySelectorAll('button,a,[role="button"],span,div'));
  const candidates = elements
    .map((element) => ({ element, text: normalizeText(element.textContent) }))
    .filter(({ element, text }) => isVisible(element) && labels.some((label) => text === label || (text.includes(label) && text.length <= 24)))
    .sort((a, b) => a.text.length - b.text.length);
  const target = candidates[0]?.element;
  if (!target) return normalizeText(document.body?.textContent).includes('我的提交记录');
  const clickable = target.closest('button,a,[role="button"],[class*="tab"],[class*="Tab"],[class*="record"],[class*="Record"]') || target;
  clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return true;
})()
`;


export function requireFeishuConfigValue(value: string, label: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new Error(`请先填写${label}`);
  }
  return normalizedValue;
}


export function getFeishuRequestContext(endpoint: string, shareToken: string) {
  const url = new URL(endpoint);
  return {
    origin: url.origin,
    referer: `${url.origin}/share/base/form/${shareToken}?chunked=false`,
  };
}


export function getFeishuFormPageUrl(config: FeishuFormConfig) {
  const endpoint = requireFeishuConfigValue(config.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(config), '飞书表单 shareToken');
  const { referer } = getFeishuRequestContext(endpoint, shareToken);
  return referer;
}


export function extractFeishuShareToken(value: string) {
  const source = value.trim();
  if (!source) return '';

  try {
    const url = new URL(source);
    const queryToken = url.searchParams.get('shareToken')?.trim();
    if (queryToken) return queryToken;

    const formToken = url.pathname.match(/\/share\/base\/form\/([^/?#]+)/)?.[1];
    if (formToken) return decodeURIComponent(formToken);
  } catch {
    // The value may already be a raw token or a partial URL.
  }

  const rawToken = source.match(/\bshr[a-zA-Z0-9_-]+\b/)?.[0];
  return rawToken ?? '';
}


export function getFeishuShareToken(config: FeishuFormConfig) {
  return config.shareToken.trim() || extractFeishuShareToken(config.endpoint);
}


export function getCurrentFeishuWindowShareToken() {
  if (!feishuWindow || feishuWindow.isDestroyed()) return '';
  return extractFeishuShareToken(feishuWindow.webContents.getURL());
}


export function getCurrentFeishuWindowOrigin() {
  if (!feishuWindow || feishuWindow.isDestroyed()) return '';
  try {
    const url = new URL(feishuWindow.webContents.getURL());
    return url.origin;
  } catch {
    return '';
  }
}


export function inferFeishuSubmitEndpoint(origin: string) {
  return origin ? `${origin}${FEISHU_SHARE_SUBMIT_PATH}` : '';
}


export function getFeishuLoginTargetUrl(config: FeishuFormConfig) {
  const endpoint = config.endpoint.trim();
  const shareToken = getFeishuShareToken(config);
  if (!endpoint) {
    return FEISHU_LOGIN_HOME_URL;
  }
  if (!shareToken) {
    return new URL(endpoint).origin;
  }
  const { referer } = getFeishuRequestContext(endpoint, shareToken);
  return referer;
}


export async function getFeishuCookieHeader(origin: string, fallbackCookie: string) {
  const feishuSession = feishuWindow && !feishuWindow.isDestroyed() ? feishuWindow.webContents.session : session.fromPartition(FEISHU_PARTITION);
  const cookies = await feishuSession.cookies.get({ url: origin });
  const sessionCookie = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  return sessionCookie || fallbackCookie.trim();
}


export function getCookieValue(cookieHeader: string, names: string[]) {
  const cookieMap = new Map(
    cookieHeader
      .split(';')
      .map((item) => {
        const index = item.indexOf('=');
        if (index < 0) return [item.trim(), ''] as const;
        return [item.slice(0, index).trim(), item.slice(index + 1).trim()] as const;
      })
      .filter(([key]) => key),
  );
  const matchedValue = names.map((name) => cookieMap.get(name)).find((value) => value);
  return matchedValue ? decodeURIComponent(matchedValue) : '';
}


export function getFeishuCsrfToken(cookieHeader: string, fallbackCsrfToken: string) {
  return getCookieValue(cookieHeader, ['_csrf_token', 'swp_csrf_token']) || fallbackCsrfToken.trim();
}


export async function readFeishuAuthSnapshot(config: FeishuFormConfig): Promise<FeishuAuthSnapshot> {
  const currentOrigin = getCurrentFeishuWindowOrigin();
  const currentShareToken = getCurrentFeishuWindowShareToken();
  const shareToken = getFeishuShareToken(config) || currentShareToken;
  const endpoint = config.endpoint.trim() || (currentShareToken ? inferFeishuSubmitEndpoint(currentOrigin) : '');
  if (!endpoint) {
    return {
      endpoint,
      shareToken,
      cookie: config.cookie.trim(),
      csrfToken: config.csrfToken.trim(),
    };
  }

  const origin = new URL(endpoint).origin;
  const cookie = await getFeishuCookieHeader(origin, config.cookie);
  return {
    endpoint,
    shareToken,
    cookie,
    csrfToken: getFeishuCsrfToken(cookie, config.csrfToken),
  };
}


export function shouldEmitFeishuAuthSnapshot(snapshot: FeishuAuthSnapshot) {
  return Boolean(snapshot.shareToken || snapshot.cookie || snapshot.csrfToken);
}


export function emitFeishuAuthSnapshot(snapshot: FeishuAuthSnapshot) {
  if (!shouldEmitFeishuAuthSnapshot(snapshot)) return;

  const signature = JSON.stringify(snapshot);
  if (signature === lastFeishuAuthSignature) return;
  if (sendToMainWindow('feishu:auth-updated', snapshot)) {
    lastFeishuAuthSignature = signature;
  }
}


export function scheduleFeishuAuthSync(config: FeishuFormConfig) {
  if (feishuAuthSyncTimer) {
    clearTimeout(feishuAuthSyncTimer);
  }

  feishuAuthSyncTimer = setTimeout(() => {
    void readFeishuAuthSnapshot(config)
      .then(emitFeishuAuthSnapshot)
      .catch((error) => {
        console.warn('Failed to sync Feishu auth snapshot:', error);
      });
  }, 500);
}


export function watchFeishuAuthSession(config: FeishuFormConfig) {
  removeFeishuAuthSessionWatcher?.();
  const feishuSession = session.fromPartition(FEISHU_PARTITION);
  const listener = () => scheduleFeishuAuthSync(config);
  feishuSession.cookies.on('changed', listener);
  removeFeishuAuthSessionWatcher = () => {
    feishuSession.cookies.removeListener('changed', listener);
    removeFeishuAuthSessionWatcher = null;
  };
}


export async function resolveFeishuAuth(formConfig: FeishuFormConfig, label: string) {
  const endpoint = requireFeishuConfigValue(formConfig.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(formConfig), '飞书表单 shareToken');
  const { origin, referer } = getFeishuRequestContext(endpoint, shareToken);
  const cookie = await getFeishuCookieHeader(origin, formConfig.cookie);
  const csrfToken = getFeishuCsrfToken(cookie, formConfig.csrfToken);

  if (!cookie) {
    throw new Error(`${label}：未找到飞书登录态，请先点击“登录飞书”完成登录，或填写完整有效的飞书 Cookie`);
  }
  if (!csrfToken) {
    throw new Error(`${label}：未在飞书登录态中找到 _csrf_token 或 swp_csrf_token，请重新登录飞书后再试`);
  }

  return { endpoint, shareToken, origin, referer, cookie, csrfToken };
}


function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


export async function focusFeishuSubmissionRecords(targetWindow: BrowserWindow) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (targetWindow.isDestroyed()) return false;
    try {
      const opened = await targetWindow.webContents.executeJavaScript(FEISHU_SUBMISSION_RECORD_SCRIPT, true);
      if (opened) return true;
    } catch {
      // The page may still be navigating; retry shortly.
    }
    await wait(350);
  }
  return false;
}


export async function openFeishuLogin(payload: FeishuLoginPayload) {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const targetUrl = getFeishuLoginTargetUrl(formConfig);
  watchFeishuAuthSession(formConfig);

  if (feishuWindow && !feishuWindow.isDestroyed()) {
    feishuWindow.show();
    feishuWindow.focus();
    await feishuWindow.loadURL(targetUrl);
    const snapshot = await readFeishuAuthSnapshot(formConfig);
    emitFeishuAuthSnapshot(snapshot);
    return snapshot;
  }

  feishuWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 960,
    minHeight: 720,
    title: '登录飞书',
    icon: getWindowOptionsIcon(),
    webPreferences: {
      partition: FEISHU_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  feishuWindow.on('closed', () => {
    feishuWindow = null;
  });
  feishuWindow.webContents.on('did-navigate', () => scheduleFeishuAuthSync(formConfig));
  feishuWindow.webContents.on('did-navigate-in-page', () => scheduleFeishuAuthSync(formConfig));
  feishuWindow.webContents.on('did-finish-load', () => scheduleFeishuAuthSync(formConfig));

  await feishuWindow.loadURL(targetUrl);
  const snapshot = await readFeishuAuthSnapshot(formConfig);
  emitFeishuAuthSnapshot(snapshot);
  return snapshot;
}


export async function openFeishuSubmissionRecords(payload: FeishuLoginPayload) {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const targetUrl = getFeishuFormPageUrl(formConfig);
  watchFeishuAuthSession(formConfig);

  if (feishuWindow && !feishuWindow.isDestroyed()) {
    feishuWindow.setTitle('飞书提交记录');
    feishuWindow.show();
    feishuWindow.focus();
    await feishuWindow.loadURL(targetUrl);
    const openedRecords = await focusFeishuSubmissionRecords(feishuWindow);
    const snapshot = await readFeishuAuthSnapshot(formConfig);
    emitFeishuAuthSnapshot(snapshot);
    return openedRecords;
  }

  feishuWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 960,
    minHeight: 720,
    title: '飞书提交记录',
    icon: getWindowOptionsIcon(),
    webPreferences: {
      partition: FEISHU_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  feishuWindow.on('closed', () => {
    feishuWindow = null;
  });
  feishuWindow.webContents.on('did-navigate', () => scheduleFeishuAuthSync(formConfig));
  feishuWindow.webContents.on('did-navigate-in-page', () => scheduleFeishuAuthSync(formConfig));
  feishuWindow.webContents.on('did-finish-load', () => scheduleFeishuAuthSync(formConfig));

  await feishuWindow.loadURL(targetUrl);
  const openedRecords = await focusFeishuSubmissionRecords(feishuWindow);
  const snapshot = await readFeishuAuthSnapshot(formConfig);
  emitFeishuAuthSnapshot(snapshot);
  return openedRecords;
}


export function disposeFeishuAuthWatchers() {
  if (feishuAuthSyncTimer) {
    clearTimeout(feishuAuthSyncTimer);
    feishuAuthSyncTimer = null;
  }
  removeFeishuAuthSessionWatcher?.();
}
