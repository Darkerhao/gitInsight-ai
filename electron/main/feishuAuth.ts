import { BrowserWindow, session } from 'electron';
import { DEFAULT_FEISHU_FORM_CONFIG } from '../../src/shared/types.js';
import type { FeishuAuthSnapshot, FeishuDuplicateCheckPayload, FeishuDuplicateCheckResult, FeishuFormConfig, FeishuLoginPayload, FeishuSubmissionRecordsPayload } from '../../src/shared/types.js';
import { getWindowOptionsIcon, sendToMainWindow } from './windows.js';

export let feishuWindow: BrowserWindow | null = null;

export let feishuAuthSyncTimer: ReturnType<typeof setTimeout> | null = null;

export let removeFeishuAuthSessionWatcher: (() => void) | null = null;

export let lastFeishuAuthSignature = '';

export const FEISHU_PARTITION = 'persist:feishu';

export const FEISHU_LOGIN_HOME_URL = 'https://www.feishu.cn/';

export const FEISHU_SHARE_SUBMIT_PATH = '/space/api/bitable/external/share/submit';

type FeishuSubmissionRecordFocusResult = {
  recordsOpened?: boolean;
  detailOpened?: boolean;
  recordClicked?: boolean;
  action?: string;
};

function isFeishuSubmissionRecordFocusResult(value: unknown): value is FeishuSubmissionRecordFocusResult {
  return Boolean(value && typeof value === 'object');
}

function buildFeishuSubmissionRecordScript(targetDate?: string) {
  return `
(() => {
  const targetDate = ${JSON.stringify(targetDate?.trim() ?? '')};
  const stateKey = '__gitInsightSubmissionRecordState';
  const now = Date.now();
  const state = window[stateKey] || (window[stateKey] = {});
  const normalizeText = (value) => String(value || '').replace(/\\s+/g, '');
  const pad = (value) => String(value).padStart(2, '0');
  const normalizeDateValue = (value) => {
    const text = normalizeText(value).replace(/[年月.-]/g, '/').replace(/日/g, '');
    const matched = text.match(/(\\d{4})\\/?(\\d{1,2})\\/?(\\d{1,2})/);
    if (!matched) return '';
    return matched[1] + '/' + pad(matched[2]) + '/' + pad(matched[3]);
  };
  const targetNormalizedDate = normalizeDateValue(targetDate);
  const fieldLabels = ['汇报标题', '所属项目', '每日工作时长', '工作内容', '汇报人'];
  const getElementView = (element) => element?.ownerDocument?.defaultView || window;
  const getCandidateDocuments = () => {
    const documents = [];
    const visited = new Set();
    const collect = (targetDocument) => {
      if (!targetDocument || visited.has(targetDocument)) return;
      visited.add(targetDocument);
      documents.push(targetDocument);
      Array.from(targetDocument.querySelectorAll('iframe,frame')).forEach((frame) => {
        try {
          collect(frame.contentDocument);
        } catch {
          // Cross-origin frames cannot be inspected from the form page.
        }
      });
    };
    collect(document);
    return documents;
  };
  const getPageText = () => getCandidateDocuments()
    .map((targetDocument) => targetDocument.body?.innerText || targetDocument.body?.textContent || '')
    .join('\\n');
  const isVisible = (element) => {
    if (!element || !element.getBoundingClientRect) return false;
    const rect = element.getBoundingClientRect();
    const style = getElementView(element).getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };
  const getVisibleElements = (selector = 'button,a,[role="button"],span,div,input,textarea') => getCandidateDocuments()
    .flatMap((targetDocument) => Array.from(targetDocument.querySelectorAll(selector)))
    .filter(isVisible);
  const clickElement = (element, action) => {
    if (!element) return false;
    element.scrollIntoView?.({ block: 'center', inline: 'center' });
    const tagName = String(element.tagName || '').toLowerCase();
    const canUseNativeClick = ['button', 'a'].includes(tagName) || element.getAttribute?.('role') === 'button';
    if (canUseNativeClick && typeof element.click === 'function') {
      element.click();
      state.lastAction = action;
      state.lastActionAt = now;
      return true;
    }

    const rect = element.getBoundingClientRect();
    const view = getElementView(element);
    const eventInit = {
      bubbles: true,
      cancelable: true,
      view,
      clientX: Math.max(1, Math.min(rect.left + rect.width / 2, view.innerWidth - 1)),
      clientY: Math.max(1, Math.min(rect.top + rect.height / 2, view.innerHeight - 1)),
    };
    element.dispatchEvent(new view.MouseEvent('mousedown', eventInit));
    element.dispatchEvent(new view.MouseEvent('mouseup', eventInit));
    element.dispatchEvent(new view.MouseEvent('click', eventInit));
    state.lastAction = action;
    state.lastActionAt = now;
    return true;
  };
  const getClickableShell = (element) => element
    ?.closest?.('button,a,[role="button"],[class*="button"],[class*="Button"],[class*="tab"],[class*="Tab"]') || element;
  const findSubmissionButton = () => {
    const labels = ['查看提交记录', '我的提交记录', '提交记录'];
    const exactButtons = getVisibleElements('button.share-form-entry-header-button,.share-form-entry-header-button,button[class*="share-form-entry-header-button"]')
      .map((element) => ({
        element: getClickableShell(element),
        rect: getClickableShell(element).getBoundingClientRect(),
        text: normalizeText(element.textContent),
      }))
      .filter(({ text }) => text.includes('查看提交记录') || !text.includes('分享'))
      .sort((a, b) => a.rect.left - b.rect.left);
    if (exactButtons[0]?.element) return exactButtons[0].element;

    return getVisibleElements()
      .map((element) => ({ element, text: normalizeText(element.textContent) }))
      .filter(({ text }) => labels.some((label) => text === label || (text.includes(label) && text.length <= 24)))
      .sort((a, b) => a.text.length - b.text.length)[0]?.element
      ?.closest('button,a,[role="button"],[class*="tab"],[class*="Tab"],[class*="record"],[class*="Record"]') || null;
  };
  const findTopRightButton = () => getVisibleElements('button,a,[role="button"],[class*="button"],[class*="Button"]')
    .map((element) => ({ element: getClickableShell(element), rect: getClickableShell(element).getBoundingClientRect(), view: getElementView(element) }))
    .filter(({ rect, view }) => (
      rect.top >= 0
      && rect.top <= 84
      && rect.right > view.innerWidth - 360
      && rect.left < view.innerWidth - 80
      && rect.width >= 48
      && rect.width <= 190
      && rect.height >= 24
      && rect.height <= 58
    ))
    .sort((a, b) => a.rect.left - b.rect.left)[0]?.element || null;
  const findTopRightPointTarget = () => {
    const pointOffsets = [220, 240, 200, 260, 180];
    for (const targetDocument of getCandidateDocuments()) {
      const view = targetDocument.defaultView || window;
      for (const offset of pointOffsets) {
        const pointTarget = targetDocument.elementFromPoint(Math.max(1, view.innerWidth - offset), 28);
        const clickable = getClickableShell(pointTarget);
        if (clickable && isVisible(clickable)) return clickable;
      }
    }
    return null;
  };
  const hasRecordsView = () => {
    const text = normalizeText(getPageText());
    return text.includes('我的提交记录') || (text.includes('返回') && text.includes('日期') && text.includes('工作内容'));
  };
  const hasTargetDetail = () => {
    if (!targetNormalizedDate) return false;
    return getVisibleElements().some((element) => {
      const rect = element.getBoundingClientRect();
      const view = getElementView(element);
      const text = normalizeText(element.innerText || element.textContent);
      return rect.left > view.innerWidth * 0.3
        && rect.width > 240
        && rect.height > 160
        && text.includes('每日日报填写')
        && text.includes('保存')
        && normalizeDateValue(text) === targetNormalizedDate;
    });
  };
  const findRecordContainerByDate = () => {
    if (!targetNormalizedDate) return null;
    const containers = [];
    const seen = new Set();
    const dateElements = getVisibleElements().filter((element) => normalizeDateValue(element.textContent) === targetNormalizedDate);
    dateElements.forEach((element) => {
      let current = element;
      let depth = 0;
      while (current && current !== element.ownerDocument.body && depth < 10) {
        if (!seen.has(current)) {
          seen.add(current);
          const rect = current.getBoundingClientRect();
          const text = normalizeText(current.innerText || current.textContent);
          const view = getElementView(current);
          const fieldCount = fieldLabels.filter((label) => text.includes(label)).length;
          if (
            rect.width > 260
            && rect.height >= 72
            && rect.height < Math.min(view.innerHeight * 0.58, 420)
            && normalizeDateValue(text) === targetNormalizedDate
            && fieldCount >= 2
          ) {
            containers.push({
              element: current,
              score: fieldCount * 100 + Math.min(rect.width, 1200) / 10 - Math.abs(rect.height - 150) / 4,
            });
          }
        }
        current = current.parentElement;
        depth += 1;
      }
    });
    containers.sort((a, b) => b.score - a.score);
    return containers[0]?.element || null;
  };
  const findRecordClickTarget = (container) => {
    const rect = container.getBoundingClientRect();
    const view = getElementView(container);
    const targetDocument = container.ownerDocument || document;
    const pointTarget = targetDocument.elementFromPoint(
      Math.max(rect.left + 1, Math.min(rect.right - 28, view.innerWidth - 2)),
      Math.max(rect.top + 1, Math.min(rect.top + rect.height / 2, view.innerHeight - 2)),
    );
    const clickableAtPoint = pointTarget?.closest?.('button,a,[role="button"]');
    if (clickableAtPoint && container.contains(clickableAtPoint) && isVisible(clickableAtPoint)) return clickableAtPoint;

    const rightClickable = Array.from(container.querySelectorAll('button,a,[role="button"]'))
      .filter(isVisible)
      .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0];
    return rightClickable || container;
  };

  if (hasTargetDetail()) {
    return { recordsOpened: true, detailOpened: true, action: 'detail-visible' };
  }

  const recordsOpened = hasRecordsView();
  if (recordsOpened && targetNormalizedDate) {
    const container = findRecordContainerByDate();
    if (container) {
      if (state.clickedDate === targetNormalizedDate && now - Number(state.clickedAt || 0) < 1200) {
        return { recordsOpened: true, recordClicked: true, action: 'waiting-detail' };
      }
      const clickTarget = findRecordClickTarget(container);
      if (clickElement(clickTarget, 'record-clicked')) {
        state.clickedDate = targetNormalizedDate;
        state.clickedAt = now;
        return { recordsOpened: true, recordClicked: true, action: 'record-clicked' };
      }
    }
    return {
      recordsOpened: true,
      recordClicked: state.clickedDate === targetNormalizedDate,
      action: 'target-date-not-found',
    };
  }

  if (recordsOpened) {
    return { recordsOpened: true, action: 'records-visible' };
  }

  if (now - Number(state.recordsButtonClickedAt || 0) < 1500) {
    return { recordsOpened: false, action: 'waiting-records' };
  }

  const button = findSubmissionButton() || findTopRightButton() || findTopRightPointTarget();
  if (button) {
    state.recordsButtonClickedAt = now;
    clickElement(button, 'records-button-clicked');
    return { recordsOpened: false, action: 'records-button-clicked' };
  }

  return { recordsOpened: false, action: 'records-button-not-found' };
})()
`;
}


export function requireFeishuConfigValue(value: string, label: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new Error(`请先填写${label}`);
  }
  return normalizedValue;
}

function buildFeishuDuplicateCheckScript(payload: Pick<FeishuDuplicateCheckPayload, 'targetDate' | 'projectName' | 'projectOptionId' | 'workHours'>) {
  return `
(() => {
  const targetDate = ${JSON.stringify(payload.targetDate.trim())};
  const projectName = ${JSON.stringify(payload.projectName?.trim() || '')};
  const projectOptionId = ${JSON.stringify(payload.projectOptionId?.trim() || '')};
  const targetHours = Number(${JSON.stringify(payload.workHours)});
  const normalize = (value) => String(value || '').replace(/\\s+/g, '');
  const normalizeDate = (value) => {
    const matched = normalize(value).replace(/[年月.-]/g, '/').replace(/日/g, '').match(/(\\d{4})\\/?(\\d{1,2})\\/?(\\d{1,2})/);
    return matched ? matched[1] + '/' + String(matched[2]).padStart(2, '0') + '/' + String(matched[3]).padStart(2, '0') : '';
  };
  const date = normalizeDate(targetDate);
  const documents = [document, ...Array.from(document.querySelectorAll('iframe,frame')).flatMap((frame) => {
    try { return frame.contentDocument ? [frame.contentDocument] : []; } catch { return []; }
  })];
  const text = documents.map((doc) => doc.body?.innerText || '').join('\\n');
  if (!text || !/(我的提交记录|提交记录)/.test(text)) return { available: false, matches: 0 };
  const cards = documents.flatMap((doc) => Array.from(doc.querySelectorAll('body *')))
    .filter((element) => {
      const value = normalize(element.innerText || element.textContent);
      if (value.length < 20 || value.length > 1800 || !normalizeDate(value).includes(date)) return false;
      if (!value.includes('所属项目') && !value.includes('工作时长') && !value.includes('每日工作时长')) return false;
      return !Array.from(element.children || []).some((child) => normalize(child.innerText || child.textContent).includes(date));
    });
  const project = normalize(projectName) || normalize(projectOptionId);
  const matches = cards.filter((card) => {
    const value = normalize(card.innerText || card.textContent);
    if (project && !value.includes(project)) return false;
    const hours = value.match(/(?:每日工作时长|工作时长)[：:]?([0-9]+(?:\\.[0-9]+)?)/);
    return hours ? Number(hours[1]) === targetHours : false;
  }).length;
  return { available: true, matches };
})()
`;
}


export function parseFeishuEndpointUrl(endpoint: string) {
  try {
    const url = new URL(endpoint.trim());
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('invalid protocol');
    }
    return url;
  } catch {
    throw new Error('飞书表单提交接口地址格式不正确，请填写以 https:// 开头的完整地址');
  }
}


export function getFeishuRequestContext(endpoint: string, shareToken: string) {
  const url = parseFeishuEndpointUrl(endpoint);
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
    return parseFeishuEndpointUrl(endpoint).origin;
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

  const origin = parseFeishuEndpointUrl(endpoint).origin;
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


async function clickFeishuSubmissionRecordsButtonByPosition(targetWindow: BrowserWindow) {
  if (targetWindow.isDestroyed()) return;
  const { width } = targetWindow.getContentBounds();
  const x = Math.max(1, width - 220);
  const y = 28;
  targetWindow.webContents.sendInputEvent({ type: 'mouseMove', x, y });
  targetWindow.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
  targetWindow.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
  await wait(650);
}


export async function focusFeishuSubmissionRecords(targetWindow: BrowserWindow, targetDate?: string) {
  const shouldOpenDetail = Boolean(targetDate?.trim());
  let recordsOpened = false;
  let recordClicked = false;
  let targetDateNotFoundAttempts = 0;
  let nativeClickAttempts = 0;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (targetWindow.isDestroyed()) return false;
    try {
      const result = await targetWindow.webContents.executeJavaScript(buildFeishuSubmissionRecordScript(targetDate), true);
      if (typeof result === 'boolean' && result) return true;
      if (isFeishuSubmissionRecordFocusResult(result)) {
        if (result.detailOpened) return true;
        if (result.recordsOpened) recordsOpened = true;
        if (!shouldOpenDetail && recordsOpened) return true;
        if (result.recordClicked) recordClicked = true;
        if (result.action === 'target-date-not-found') {
          targetDateNotFoundAttempts += 1;
          if (targetDateNotFoundAttempts >= 6) return true;
        } else if (recordsOpened && !result.recordClicked) {
          targetDateNotFoundAttempts = 0;
        }
      }
    } catch {
      // The page may still be navigating; retry shortly.
    }
    if (!recordsOpened && attempt >= 4 && nativeClickAttempts < 2) {
      nativeClickAttempts += 1;
      await clickFeishuSubmissionRecordsButtonByPosition(targetWindow);
    }
    await wait(350);
  }
  return recordsOpened || recordClicked;
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


export async function openFeishuSubmissionRecords(payload: FeishuSubmissionRecordsPayload) {
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
    const openedRecords = await focusFeishuSubmissionRecords(feishuWindow, payload.targetDate);
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
  const openedRecords = await focusFeishuSubmissionRecords(feishuWindow, payload.targetDate);
  const snapshot = await readFeishuAuthSnapshot(formConfig);
  emitFeishuAuthSnapshot(snapshot);
  return openedRecords;
}

export async function checkFeishuDuplicate(payload: FeishuDuplicateCheckPayload): Promise<FeishuDuplicateCheckResult> {
  const formConfig = { ...DEFAULT_FEISHU_FORM_CONFIG, ...payload.config };
  const targetUrl = getFeishuFormPageUrl(formConfig);
  watchFeishuAuthSession(formConfig);
  if (!feishuWindow || feishuWindow.isDestroyed()) {
    await openFeishuSubmissionRecords({ config: formConfig });
  } else {
    feishuWindow.show();
    feishuWindow.focus();
    await feishuWindow.loadURL(targetUrl);
    await focusFeishuSubmissionRecords(feishuWindow);
  }
  if (!feishuWindow || feishuWindow.isDestroyed()) return { available: false, matches: 0 };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const result = await feishuWindow.webContents.executeJavaScript(buildFeishuDuplicateCheckScript(payload), true);
      if (result && typeof result === 'object' && 'available' in result) return result as FeishuDuplicateCheckResult;
    } catch {
      // The records page may still be rendering.
    }
    await wait(400);
  }
  return { available: false, matches: 0 };
}


export function disposeFeishuAuthWatchers() {
  if (feishuAuthSyncTimer) {
    clearTimeout(feishuAuthSyncTimer);
    feishuAuthSyncTimer = null;
  }
  removeFeishuAuthSessionWatcher?.();
}
