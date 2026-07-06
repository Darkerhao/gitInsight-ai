import type { AppConfig, ReportTimeRange } from '../../src/shared/types.js';

type AiRuntimeConfig = {
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiProfileName?: string;
};

type AiFetch = (url: string, init?: RequestInit) => Promise<Response>;

let cachedElectronNetFetch: AiFetch | null | undefined;

async function getElectronNetFetch(): Promise<AiFetch | null> {
  if (cachedElectronNetFetch !== undefined) return cachedElectronNetFetch;

  cachedElectronNetFetch = null;
  if (!process.versions.electron) return cachedElectronNetFetch;

  try {
    const electron = await import('electron');
    if (typeof electron.net?.fetch === 'function') {
      cachedElectronNetFetch = electron.net.fetch.bind(electron.net) as AiFetch;
    }
  } catch {
    cachedElectronNetFetch = null;
  }

  return cachedElectronNetFetch;
}

function collectErrorDetails(error: unknown): string[] {
  if (!error || typeof error !== 'object') return [];

  const value = error as { code?: unknown; reason?: unknown; message?: unknown; cause?: unknown };
  const details = [value.code, value.reason, value.message]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());

  return [...details, ...collectErrorDetails(value.cause)];
}

function getHostForMessage(url: string) {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function buildNetworkErrorMessage(url: string, error: unknown, fallbackError?: unknown) {
  const detail = [...collectErrorDetails(error), ...collectErrorDetails(fallbackError)]
    .filter((item, index, all) => all.indexOf(item) === index)
    .join('；');
  const hasTlsError = /TLS|SSL|CERT|handshake|EPROTO|ERR_SSL/i.test(detail);
  const host = getHostForMessage(url);

  return [
    `AI接口网络请求失败：无法连接 ${host}`,
    detail ? `底层错误：${detail}` : '',
    hasTlsError
      ? '这通常表示中转站的 TLS/证书策略与当前运行环境不兼容，已尝试使用 Electron Chromium 网络栈和 Node fetch。请确认该地址能在本机浏览器正常访问，或更换支持 OpenAI Chat Completions 的 HTTPS 中转地址。'
      : '请检查接口地址、网络代理、系统证书和服务商状态。',
  ]
    .filter(Boolean)
    .join('。');
}

async function fetchAi(url: string, init?: RequestInit) {
  const electronNetFetch = await getElectronNetFetch();
  if (electronNetFetch) {
    try {
      return await electronNetFetch(url, init);
    } catch (electronError) {
      try {
        return await fetch(url, init);
      } catch (nodeError) {
        throw new Error(buildNetworkErrorMessage(url, electronError, nodeError));
      }
    }
  }

  try {
    return await fetch(url, init);
  } catch (error) {
    throw new Error(buildNetworkErrorMessage(url, error));
  }
}

export function normalizeAiBaseUrl(aiBaseUrl: string) {
  return aiBaseUrl.trim().replace(/\/+$/, '');
}


export function resolveAiConfig(config: AppConfig, aiProfileId?: string): AiRuntimeConfig {
  const selectedId = aiProfileId || config.activeAiProfileId;
  const profile = config.aiProfiles.find((item) => item.id === selectedId) ?? config.aiProfiles[0];
  if (!profile) {
    return {
      aiBaseUrl: config.aiBaseUrl,
      aiApiKey: config.aiApiKey,
      aiModel: config.aiModel,
    };
  }

  return {
    aiBaseUrl: profile.baseUrl,
    aiApiKey: profile.enabled === false ? '' : profile.apiKey,
    aiModel: profile.model,
    aiProfileName: profile.name,
  };
}


export function getChatCompletionsUrl(aiBaseUrl: string) {
  const baseUrl = normalizeAiBaseUrl(aiBaseUrl);
  return baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
}


export function getModelsUrl(aiBaseUrl: string) {
  const baseUrl = normalizeAiBaseUrl(aiBaseUrl);
  return baseUrl.endsWith('/chat/completions') ? baseUrl.replace(/\/chat\/completions$/, '/models') : `${baseUrl}/models`;
}


export function parseAiError(detail: string) {
  if (!detail) return '';
  try {
    const data = JSON.parse(detail) as { error?: unknown; message?: unknown };
    if (typeof data.error === 'string') return data.error;
    if (typeof data.message === 'string') return data.message;
    if (data.error && typeof data.error === 'object' && 'message' in data.error) {
      const message = (data.error as { message?: unknown }).message;
      return typeof message === 'string' ? message : detail;
    }
  } catch {
    return detail;
  }
  return detail;
}


export function isUnsupportedModelError(status: number, detail: string) {
  const message = parseAiError(detail);
  return status === 404 && /模型|model/i.test(message) && /不支持|unsupported|not\s+support/i.test(message);
}


export async function fetchAvailableModels(config: AiRuntimeConfig) {
  try {
    const response = await fetchAi(getModelsUrl(config.aiBaseUrl), {
      headers: { Authorization: `Bearer ${config.aiApiKey}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.data)) return [];
    return data.data
      .map((item: { id?: unknown }) => item.id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, 20);
  } catch {
    return [];
  }
}


export async function buildAiErrorMessage(config: AiRuntimeConfig, response: Response, detail: string) {
  const parsedDetail = parseAiError(detail);
  if (isUnsupportedModelError(response.status, detail)) {
    const models = await fetchAvailableModels(config);
    const modelTips = models.length
      ? `；/models 可查询到的模型包括：${models.join('、')}。注意：模型列表不一定代表当前 /chat/completions 接口全部可用`
      : '；同时未能从 /models 获取可用模型列表';
    return `AI接口调用失败：当前接口不支持模型 ${config.aiModel}${modelTips}。请在 AI 设置中更换为服务方明确支持 Chat Completions 的模型。原始错误：${parsedDetail || `${response.status} ${response.statusText}`}`;
  }
  return `AI接口调用失败：${response.status} ${response.statusText}${parsedDetail ? `，返回内容：${parsedDetail.slice(0, 500)}` : ''}`;
}


export async function callAiReport(config: AiRuntimeConfig, rawInput: { gitLogs: string; files: string; diff: string }, timeRange: ReportTimeRange) {
  const prompt = `你是一名资深软件研发工程师。

请根据以下Git提交记录、修改文件和代码变更内容，总结所选时间段内的工作内容。

要求：
1. 不要出现commit、git等技术词汇。
2. 使用正式工作日报语言。
3. 每条正文描述控制在30-100字，模块/功能标识不计入字数。
4. 按实际功能归纳。
5. 相同模块合并总结。
6. 输出3-5条工作内容。
7. 自动生成明日计划。
8. 只能依据提供的Git数据、修改文件和代码变更总结，禁止补写未出现的工作内容。
9. “今日工作内容”每一条必须包含模块名称、页面/场景名称、具体功能名称，并统一以“【模块/功能：一级模块 / 页面或场景 / 具体功能】”开头。
10. 模块/功能名称优先从业务模块、页面、组件、接口、路由、配置项、字段语义或文件路径中归纳；无法确定完整层级时至少输出最具体的页面或功能名称，不要写“相关模块”。
11. 不要省略“【模块/功能：一级模块 / 页面或场景 / 具体功能】”前缀，不要只输出问题描述或优化描述。
12. 示例格式：1. 【模块/功能：资产数据大屏 / 下钻页面 / 合同到期预警列表】修复签订公司字段映射错误，保证列表数据准确展示。

时间范围：
${timeRange.label}

Git数据：
${rawInput.gitLogs}

修改文件：
${rawInput.files}

代码变更：
${rawInput.diff}

输出格式：

今日工作内容：

1. 【模块/功能：一级模块 / 页面或场景 / 具体功能】
2. 【模块/功能：一级模块 / 页面或场景 / 具体功能】
3. 【模块/功能：一级模块 / 页面或场景 / 具体功能】

工作成果：

1.
2.

明日计划：

1.
2.`;

  const chatCompletionsUrl = getChatCompletionsUrl(config.aiBaseUrl);

  const response = await fetchAi(chatCompletionsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.aiApiKey}`,
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages: [
        { role: 'system', content: '你是一名严谨的中文工作日报助手。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(await buildAiErrorMessage(config, response, detail));
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new Error('AI接口未返回有效内容');
  }
  return content.trim();
}

