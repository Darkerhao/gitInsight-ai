import { DEFAULT_FEISHU_FORM_CONFIG } from '../../src/shared/types.js';
import type {
  FeishuFieldOption,
  FeishuFormConfig,
  FeishuProjectOption,
  FeishuProjectOptionsPayload,
  FeishuSubmitResult,
  FeishuTestSubmitPayload,
  SyncFeishuDailyPayload,
} from '../../src/shared/types.js';
import { normalizeWorkHours } from './config.js';
import { recordErrorLog, recordSyncLog } from './database.js';
import {
  getFeishuCookieHeader,
  getFeishuCsrfToken,
  getFeishuRequestContext,
  getFeishuShareToken,
  parseFeishuEndpointUrl,
  requireFeishuConfigValue,
  resolveFeishuAuth,
} from './feishuAuth.js';

export function dateToFeishuDateValue(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error('日报日期格式不正确');
  }
  return Date.UTC(year, month - 1, day);
}


export function extractReportSection(report: string, sectionTitle: string) {
  const lines = report.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim().startsWith(sectionTitle));
  if (startIndex < 0) return '';

  const sectionLines: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    const trimmed = line.trim();
    if (/^(今日工作内容|工作成果|工作时长|明日计划|汇报人|日期)[：:]/.test(trimmed)) {
      break;
    }
    if (trimmed) sectionLines.push(trimmed);
  }
  return sectionLines.join('\n').trim();
}


function buildFeishuReporterUser(formConfig: FeishuFormConfig, reporterName: string) {
  const reporterUser: { userId: string; name: string; enName: string; notify: boolean; avatarUrl?: string } = {
    userId: requireFeishuConfigValue(formConfig.reporterUserId, '飞书汇报人 userId'),
    name: requireFeishuConfigValue(reporterName, '飞书汇报人名称'),
    enName: reporterName,
    notify: false,
  };

  if (formConfig.reporterAvatarUrl.trim()) {
    reporterUser.avatarUrl = formConfig.reporterAvatarUrl.trim();
  }

  return reporterUser;
}


function buildFeishuFormDataFromContent(options: {
  config: FeishuFormConfig;
  date: string;
  reporterName: string;
  workContent: string;
  workHours: number;
}) {
  const formConfig = options.config;
  const reporterUser = buildFeishuReporterUser(formConfig, options.reporterName);

  return {
    [requireFeishuConfigValue(formConfig.dateFieldId, '日期字段 ID')]: {
      type: 5,
      value: dateToFeishuDateValue(options.date),
    },
    [requireFeishuConfigValue(formConfig.userFieldId, '汇报人字段 ID')]: {
      type: 11,
      value: {
        users: [reporterUser],
      },
    },
    [requireFeishuConfigValue(formConfig.questionId, '明细表问题 ID')]: {
      type: 21,
      value: [
        {
          [requireFeishuConfigValue(formConfig.projectFieldId, '所属项目字段 ID')]: {
            type: 4,
            value: [requireFeishuConfigValue(formConfig.projectOptionId, '所属项目选项 ID')],
          },
          [requireFeishuConfigValue(formConfig.hoursFieldId, '工作时长字段 ID')]: {
            type: 2,
            value: options.workHours,
          },
          [requireFeishuConfigValue(formConfig.contentFieldId, '工作内容字段 ID')]: {
            type: 1,
            value: [
              {
                type: 'text',
                text: options.workContent,
              },
            ],
          },
        },
      ],
    },
  };
}


export function buildFeishuFormData(payload: SyncFeishuDailyPayload) {
  const formConfig = payload.config;
  const reporterName = formConfig.reporterName.trim() || payload.reporterName.trim();
  const workContent = extractReportSection(payload.report, '今日工作内容') || payload.report.trim();
  const selectedWorkHours = normalizeWorkHours(payload.workHours, formConfig.defaultWorkHours || DEFAULT_FEISHU_FORM_CONFIG.defaultWorkHours);
  return buildFeishuFormDataFromContent({
    config: formConfig,
    date: payload.date,
    reporterName,
    workContent,
    workHours: selectedWorkHours,
  });
}


export function getFeishuContentMetaUrl(config: FeishuFormConfig) {
  const endpoint = requireFeishuConfigValue(config.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(config), '飞书表单 shareToken');
  const url = parseFeishuEndpointUrl(endpoint);
  url.pathname = '/space/api/bitable/external/share/content_meta';
  url.search = '';
  url.searchParams.set('shareToken', shareToken);
  return url.toString();
}


export function parseFeishuSnapshot(meta: unknown) {
  const data = meta as { data?: { snapshot?: unknown } };
  const snapshotRaw = data?.data?.snapshot;
  if (typeof snapshotRaw !== 'string') {
    throw new Error('飞书表单解析失败：接口未返回 snapshot');
  }

  return JSON.parse(snapshotRaw) as {
    fieldMap?: Record<
      string,
      {
        id?: unknown;
        name?: unknown;
        type?: unknown;
        property?: {
          options?: Array<{ id?: unknown; name?: unknown; color?: unknown }>;
        };
      }
    >;
  };
}


export function getFeishuFieldTypeLabel(type: unknown) {
  const typeMap: Record<string, string> = {
    '1': '文本',
    '2': '数字',
    '4': '单选',
    '5': '日期',
    '11': '人员',
    '21': '明细表',
  };
  return typeMap[String(type)] ?? `类型 ${String(type || '未知')}`;
}


export function parseFeishuFieldOptions(meta: unknown): FeishuFieldOption[] {
  const snapshot = parseFeishuSnapshot(meta);
  const fieldEntries = Object.entries(snapshot.fieldMap ?? {});
  return fieldEntries
    .map(([key, field]) => {
      const id = typeof field.id === 'string' && field.id.trim() ? field.id.trim() : key;
      const name = typeof field.name === 'string' && field.name.trim() ? field.name.trim() : id;
      const type = typeof field.type === 'number' || typeof field.type === 'string' ? field.type : '';
      return {
        id,
        name,
        type,
        typeLabel: getFeishuFieldTypeLabel(type),
      };
    })
    .filter((field) => field.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}


export function parseFeishuProjectOptions(meta: unknown, projectFieldId: string): FeishuProjectOption[] {
  const snapshot = parseFeishuSnapshot(meta);
  const options = snapshot.fieldMap?.[projectFieldId]?.property?.options;
  if (!Array.isArray(options)) {
    throw new Error(`飞书项目列表解析失败：未找到字段 ${projectFieldId} 的 options`);
  }

  return options
    .map((option) => ({
      id: typeof option.id === 'string' ? option.id : '',
      name: typeof option.name === 'string' ? option.name : '',
      color: typeof option.color === 'number' ? option.color : undefined,
    }))
    .filter((option) => option.id && option.name);
}


export async function fetchFeishuContentMeta(formConfig: FeishuFormConfig, label: string) {
  const endpoint = requireFeishuConfigValue(formConfig.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(formConfig), '飞书表单 shareToken');
  const { origin, referer } = getFeishuRequestContext(endpoint, shareToken);
  const cookie = await getFeishuCookieHeader(origin, formConfig.cookie);
  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    origin,
    referer,
  };
  if (cookie) {
    headers.cookie = cookie;
  }

  const response = await fetch(getFeishuContentMetaUrl(formConfig), {
    headers: {
      ...headers,
    },
  });
  const detail = await response.text();

  if (!response.ok) {
    throw new Error(`${label}：${response.status} ${response.statusText}${detail ? `，返回：${detail.slice(0, 500)}` : ''}`);
  }

  let meta: unknown;
  try {
    meta = JSON.parse(detail);
  } catch {
    throw new Error(`${label}：接口返回内容不是 JSON：${detail.slice(0, 500)}`);
  }

  const result = meta as { code?: number; msg?: string };
  if (result.code !== 0) {
    if (result.msg === 'Login Required') {
      throw new Error(`${label}：飞书登录态无效或已过期，请先点击“登录飞书”完成登录，或填写完整有效的飞书 Cookie`);
    }
    throw new Error(`${label}：${result.msg || `code=${result.code}`}`);
  }

  return meta;
}


export async function listFeishuFieldOptions(payload: FeishuProjectOptionsPayload): Promise<FeishuFieldOption[]> {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const meta = await fetchFeishuContentMeta(formConfig, '获取飞书字段列表失败');
  return parseFeishuFieldOptions(meta);
}


export async function listFeishuProjectOptions(payload: FeishuProjectOptionsPayload): Promise<FeishuProjectOption[]> {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const meta = await fetchFeishuContentMeta(formConfig, '获取飞书项目列表失败');

  return parseFeishuProjectOptions(meta, requireFeishuConfigValue(formConfig.projectFieldId, '所属项目字段 ID'));
}


export function buildFeishuTestFormData(config: FeishuFormConfig, date: string) {
  const reporterName = requireFeishuConfigValue(config.reporterName, '飞书汇报人名称');
  return buildFeishuFormDataFromContent({
    config,
    date,
    reporterName,
    workContent: `[GitInsight 测试记录] 表单连通性验证，请勿作为正式日报统计。提交时间：${new Date().toISOString()}`,
    workHours: normalizeWorkHours(config.defaultWorkHours, DEFAULT_FEISHU_FORM_CONFIG.defaultWorkHours),
  });
}


export async function testSubmitFeishuForm(payload: FeishuTestSubmitPayload): Promise<FeishuSubmitResult> {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const endpoint = requireFeishuConfigValue(formConfig.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(getFeishuShareToken(formConfig), '飞书表单 shareToken');
  const data = buildFeishuTestFormData(formConfig, payload.date);
  const requestId = `gitinsight-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const auth = await resolveFeishuAuth(formConfig, '飞书测试提交失败');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      cookie: auth.cookie,
      origin: auth.origin,
      referer: auth.referer,
      'request-id': requestId,
      'x-csrftoken': auth.csrfToken,
      'x-request-id': requestId,
    },
    body: JSON.stringify({
      shareToken,
      data: JSON.stringify(data),
      preUploadEnable: false,
    }),
  });
  const result = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    text: await response.text(),
  };

  if (!result.ok) {
    throw new Error(`飞书测试提交失败：${result.status} ${result.statusText}${result.text ? `，返回：${result.text.slice(0, 500)}` : ''}`);
  }

  let parsed: FeishuSubmitResult;
  try {
    parsed = JSON.parse(result.text) as FeishuSubmitResult;
  } catch {
    throw new Error(`飞书测试提交失败：接口返回内容不是 JSON：${result.text.slice(0, 500)}`);
  }

  if (parsed.code !== 0) {
    if (parsed.msg === 'Login Required') {
      throw new Error('飞书测试提交失败：飞书登录态无效或已过期，请重新点击“登录飞书”完成登录');
    }
    throw new Error(`飞书测试提交失败：${parsed.msg || `code=${parsed.code}`}`);
  }

  return parsed;
}


export async function syncFeishuDaily(payload: SyncFeishuDailyPayload) {
  const formConfig: FeishuFormConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const startedAt = Date.now();
  try {
    const auth = await resolveFeishuAuth(formConfig, '同步飞书日报失败');
    const requestId = `gitinsight-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const response = await fetch(auth.endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        cookie: auth.cookie,
        origin: auth.origin,
        referer: auth.referer,
        'request-id': requestId,
        'x-csrftoken': auth.csrfToken,
        'x-request-id': requestId,
      },
      body: JSON.stringify({
        shareToken: auth.shareToken,
        data: JSON.stringify(buildFeishuFormData({ ...payload, config: formConfig })),
        preUploadEnable: false,
      }),
    });

    const detail = await response.text();
    if (!response.ok) {
      throw new Error(`同步飞书日报失败：${response.status} ${response.statusText}${detail ? `，返回：${detail.slice(0, 500)}` : ''}`);
    }

    let result: { code?: number; msg?: string } = {};
    try {
      result = JSON.parse(detail);
    } catch {
      throw new Error(`同步飞书日报失败：接口返回内容不是 JSON：${detail.slice(0, 500)}`);
    }

    if (result.code !== 0) {
      throw new Error(`同步飞书日报失败：${result.msg || `code=${result.code}`}`);
    }

    await recordSyncLog({
      reportId: payload.reportId,
      date: payload.date,
      triggerType: payload.triggerType || 'manual',
      status: 'success',
      message: '同步飞书日报成功',
      durationMs: Date.now() - startedAt,
    });
    return true;
  } catch (error) {
    await recordSyncLog({
      reportId: payload.reportId,
      date: payload.date,
      triggerType: payload.triggerType || 'manual',
      status: 'failed',
      message: error instanceof Error ? error.message : '同步飞书失败',
      durationMs: Date.now() - startedAt,
    });
    await recordErrorLog('syncFeishuDaily', error);
    throw error;
  }
}

