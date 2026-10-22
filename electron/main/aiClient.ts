import type {
  AiConnectionTestPayload,
  AiConnectionTestResult,
  AppConfig,
  ReportPromptStyle,
  ReportTimeRange,
  StructuredReportMetadata,
  WeeklyReflectionMetadata,
  WeeklySummaryMetadata,
} from '../../src/shared/types.js';
import { getReportPrompt } from '../../src/shared/reportPrompt.js';
import { parseWeeklyReflectionMetadata } from '../../src/shared/weeklyReflection.js';
import { parseWeeklySummaryMetadata } from '../../src/shared/weeklySummary.js';
import { fetchWithTimeout } from './networkRequest.js';

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

async function fetchAi(url: string, init?: RequestInit, timeoutMs = 60_000) {
  return fetchWithTimeout(url, init, timeoutMs, fetchAiTransport);
}

async function fetchAiTransport(url: string, init?: RequestInit) {
  const electronNetFetch = await getElectronNetFetch();
  if (electronNetFetch) {
    try {
      return await electronNetFetch(url, init);
    } catch (electronError) {
      init?.signal?.throwIfAborted();
      try {
        return await fetch(url, init);
      } catch (nodeError) {
        init?.signal?.throwIfAborted();
        throw new Error(buildNetworkErrorMessage(url, electronError, nodeError));
      }
    }
  }

  try {
    return await fetch(url, init);
  } catch (error) {
    init?.signal?.throwIfAborted();
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

async function readAiJsonResponse(response: Response, url: string) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const responseText = await response.text();
  if (contentType.includes('text/html') || /^\s*(?:<!doctype\s+html|<html\b)/i.test(responseText)) {
    throw new Error(`请求地址 ${url} 返回了 HTML 页面而不是 JSON。请填写服务商的 API Base URL，而不是官网首页、登录页或控制台地址。`);
  }
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw new Error(`请求地址 ${url} 已响应，但返回内容不是有效 JSON。请确认接口格式与 API 地址配置正确。`);
  }
}

export async function testAiConnection(payload: AiConnectionTestPayload): Promise<AiConnectionTestResult> {
  const baseUrl = normalizeAiBaseUrl(payload.baseUrl);
  const apiKey = payload.apiKey.trim();
  const model = payload.model.trim();
  const startedAt = Date.now();

  if (!baseUrl || !apiKey || !model) {
    return {
      success: false,
      message: '请先填写接口地址、API Key 和模型名称。',
      latencyMs: 0,
    };
  }

  const config: AiRuntimeConfig = {
    aiBaseUrl: baseUrl,
    aiApiKey: apiKey,
    aiModel: model,
  };
  const chatCompletionsUrl = getChatCompletionsUrl(baseUrl);
  try {
    const response = await fetchAi(chatCompletionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
        max_tokens: 1,
        stream: false,
      }),
    });
    const latencyMs = Date.now() - startedAt;
    let responseText = '';
    try {
      responseText = await response.clone().text();
    } catch {
      responseText = '';
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType.includes('text/html') || /^\s*(?:<!doctype\s+html|<html\b)/i.test(responseText)) {
      return {
        success: false,
        message: `请求地址 ${chatCompletionsUrl} 返回了 HTML 页面而不是 JSON。当前接口可能是网站首页、登录页或缺少 API 路径；请按服务商文档填写正确的 OpenAI 兼容 API Base URL（常见格式会包含 /v1）。`,
        latencyMs,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        message: await buildAiErrorMessage(config, response, responseText || (await response.text())),
        latencyMs,
      };
    }

    try {
      const data = (responseText ? JSON.parse(responseText) : await readAiJsonResponse(response, chatCompletionsUrl)) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      if (!Array.isArray(data.choices) || data.choices.length === 0) {
        return {
          success: false,
          message: '接口已响应，但返回格式不是有效的 Chat Completions 结果。',
          latencyMs,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '接口返回内容无法解析，请确认 OpenAI 兼容接口地址配置正确。',
        latencyMs,
      };
    }

    return {
      success: true,
      message: `连接成功，模型 ${model} 已响应。`,
      latencyMs,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'AI 接口连接失败，请检查网络和配置。',
      latencyMs: Date.now() - startedAt,
    };
  }
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


export async function fetchAvailableModels(config: AiRuntimeConfig, signal?: AbortSignal) {
  try {
    const response = await fetchAi(getModelsUrl(config.aiBaseUrl), {
      signal,
      headers: { Authorization: `Bearer ${config.aiApiKey}` },
    }, 10_000);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.data)) return [];
    return data.data
      .map((item: { id?: unknown }) => item.id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, 20);
  } catch {
    signal?.throwIfAborted();
    return [];
  }
}


export async function buildAiErrorMessage(config: AiRuntimeConfig, response: Response, detail: string, signal?: AbortSignal) {
  const parsedDetail = parseAiError(detail);
  if ([408, 504, 524].includes(response.status)) {
    return `AI 接口上游响应超时（${response.status}）。服务商可能正在排队或模型处理时间过长，请稍后重试、确认模型名称，或更换可用的 API 节点。${parsedDetail ? ` 原始错误：${parsedDetail.slice(0, 300)}` : ''}`;
  }
  if (isUnsupportedModelError(response.status, detail)) {
    const models = await fetchAvailableModels(config, signal);
    const modelTips = models.length
      ? `；/models 可查询到的模型包括：${models.join('、')}。注意：模型列表不一定代表当前 /chat/completions 接口全部可用`
      : '；同时未能从 /models 获取可用模型列表';
    return `AI接口调用失败：当前接口不支持模型 ${config.aiModel}${modelTips}。请在 AI 设置中更换为服务方明确支持 Chat Completions 的模型。原始错误：${parsedDetail || `${response.status} ${response.statusText}`}`;
  }
  return `AI接口调用失败：${response.status} ${response.statusText}${parsedDetail ? `，返回内容：${parsedDetail.slice(0, 500)}` : ''}`;
}


export async function callAiReport(
  config: AiRuntimeConfig,
  rawInput: { gitLogs: string; files: string; diff: string; manualWorkContent?: string },
  timeRange: ReportTimeRange,
  promptStyle: ReportPromptStyle = 'standard',
  signal?: AbortSignal,
  customPrompt?: string,
) {
  const instructions = promptStyle === 'custom' ? customPrompt?.trim() : getReportPrompt(promptStyle);
  if (!instructions) throw new Error('请填写自定义日报提示词');
  const prompt = `${instructions}

---

时间范围：
${timeRange.label}

Git数据：
${rawInput.gitLogs}

用户补充的非 Git 工作内容：
${rawInput.manualWorkContent || '无'}

修改文件：
${rawInput.files}

代码变更：
${rawInput.diff}

---
`;

  const chatCompletionsUrl = getChatCompletionsUrl(config.aiBaseUrl);
  const response = await fetchAi(chatCompletionsUrl, {
    signal,
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
    throw new Error(await buildAiErrorMessage(config, response, detail, signal));
  }

  const data = (await readAiJsonResponse(response, chatCompletionsUrl)) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI接口未返回有效内容');
  }

  return content.trim();
}


const STRUCTURED_EXTRACT_PROMPT = `你是一个工作日报结构化分析助手。请将以下日报内容提取为 JSON 格式。

规则：
1. title：用一句话概括当天最核心的工作（不超过30字），不要使用"今日工作内容"等通用标题。
2. workItems：逐项保留原日报中的工作事项，不得合并或遗漏。每条包含 module（模块名）、description（工作描述）、workType（工作类型），并保留“具体对象 + 实际动作 + 结果或问题”三个维度，不得把具体修改压缩成笼统的模块描述。
   - description 必须能够让没有阅读代码的人理解实际完成了什么工作。
   - description 禁止仅输出“优化XX”“完善XX”“修复XX”“调整XX”等概括性描述。
   - description 必须保留原日报中能够确认的具体页面、功能、字段、接口、数据逻辑、校验、交互或异常处理等信息。
   - module 应提取业务模块、页面或功能，而不是文件名或技术实现名称。
   - workType 必须根据实际工作内容从以下六类中选择：
     - 功能开发：新增业务能力或功能。
     - Bug 修复：解决已有功能的明确异常或错误。
     - 重构优化：调整代码结构、抽取公共逻辑、降低重复等，不以新增业务能力为主要目的。
     - 性能优化：明确针对执行效率、请求次数、渲染性能、资源占用等进行优化。
     - 工程优化：构建、配置、开发工具、依赖、CI/CD、工程基础设施等。
     - 日常开发：无法明确归入以上类型的常规研发工作。
   - 如果同一工作同时涉及多个动作，以主要工作目标归类，不要为了分类而虚构工作类型。
3. achievements：工作成果列表，每条是一个独立成果描述。
4. techTags：涉及的技术栈标签（如 Vue、TypeScript、Electron 等），只提取实际出现的。
5. risks：风险或待确认项，没有则返回空数组。
6. tomorrowPlan：明日计划列表，没有则返回空数组。
7. milestone：布尔值，如果当天有上线、发布、完成重要功能等里程碑事件则为 true。

只输出合法 JSON，不要包含任何解释文字或 markdown 标记。

日报内容：
`;

/**
 * 从已生成的日报文本中提取结构化元数据。
 * 这是一次轻量 AI 调用（输入短、temperature 0），失败时返回 null 不影响主流程。
 */
export async function callAiStructuredExtract(
  config: AiRuntimeConfig,
  reportText: string,
  signal?: AbortSignal,
): Promise<StructuredReportMetadata | null> {
  try {
    const chatCompletionsUrl = getChatCompletionsUrl(config.aiBaseUrl);
    const response = await fetchAi(chatCompletionsUrl, {
      signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.aiApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel,
        messages: [
          { role: 'system', content: '你是一个 JSON 数据提取助手，只输出合法 JSON。' },
          { role: 'user', content: STRUCTURED_EXTRACT_PROMPT + reportText },
        ],
        temperature: 0,
      }),
    }, 20_000);

    if (!response.ok) return null;

    const data = (await readAiJsonResponse(response, chatCompletionsUrl)) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const rawContent = data.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    if (!content) return null;

    // 兼容模型输出 ```json ... ``` 包裹的情况
    const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonStr) as StructuredReportMetadata;

    // 基础校验
    if (!parsed.title || !Array.isArray(parsed.workItems)) return null;
    return parsed;
  } catch {
    signal?.throwIfAborted();
    // 结构化提取失败不影响主流程，静默降级
    return null;
  }
}


export async function callAiWeeklyReflection(
  config: AiRuntimeConfig,
  prompt: string,
): Promise<WeeklyReflectionMetadata> {
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
        { role: 'system', content: '你是一名严谨的中文项目复盘助手，只输出合法 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(await buildAiErrorMessage(config, response, detail));
  }

  const data = (await readAiJsonResponse(response, chatCompletionsUrl)) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI接口未返回有效的周反思内容');
  }
  return parseWeeklyReflectionMetadata(content);
}

export async function callAiWeeklySummary(
  config: AiRuntimeConfig,
  prompt: string,
): Promise<WeeklySummaryMetadata> {
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
        { role: 'system', content: '你是一名严谨的中文研发周报助手，只输出合法 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(await buildAiErrorMessage(config, response, detail));
  }
  const data = (await readAiJsonResponse(response, chatCompletionsUrl)) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI接口未返回有效的周报内容');
  return parseWeeklySummaryMetadata(content);
}

export async function callAiMaterialReport(config: AiRuntimeConfig, prompt: string): Promise<string> {
  const url = getChatCompletionsUrl(config.aiBaseUrl);
  const response = await fetchAi(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.aiApiKey}` },
    body: JSON.stringify({ model: config.aiModel, temperature: 0.3, messages: [
      { role: 'system', content: '你是一名严谨的中文日报助手，只依据用户提供的工作素材整理，绝不编造。' },
      { role: 'user', content: prompt },
    ] }),
  });
  if (!response.ok) throw new Error(await buildAiErrorMessage(config, response, await response.text()));
  const data = await readAiJsonResponse(response, url) as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI接口未返回有效的日报内容');
  return content.trim();
}
