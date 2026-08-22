import type {
  AiConnectionTestPayload,
  AiConnectionTestResult,
  AppConfig,
  ReportTimeRange,
  StructuredReportMetadata,
  WeeklyReflectionMetadata,
  WeeklySummaryMetadata,
} from '../../src/shared/types.js';
import { parseWeeklyReflectionMetadata } from '../../src/shared/weeklyReflection.js';
import { parseWeeklySummaryMetadata } from '../../src/shared/weeklySummary.js';

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
  if ([408, 504, 524].includes(response.status)) {
    return `AI 接口上游响应超时（${response.status}）。服务商可能正在排队或模型处理时间过长，请稍后重试、确认模型名称，或更换可用的 API 节点。${parsedDetail ? ` 原始错误：${parsedDetail.slice(0, 300)}` : ''}`;
  }
  if (isUnsupportedModelError(response.status, detail)) {
    const models = await fetchAvailableModels(config);
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
) {
  const prompt = `你是一名资深软件研发工程师。

请根据以下 Git 提交记录、修改文件、代码变更内容以及用户补充的非 Git 工作，总结所选时间段内的工作内容。

要求：
1. 不要出现commit、git等技术词汇。
2. 使用正式工作日报语言。
3. 每条正文描述控制在25-70字，模块标签不计入字数。
4. 按实际功能归纳。
5. 相同模块合并总结。
6. 通常根据工作量输出1-3条工作内容；用户补充多项工作时应合理合并，但不得遗漏已明确提供的事项。
7. 自动生成1-2条明日计划。
8. 只能依据提供的Git数据、修改文件、代码变更和“用户补充的非 Git 工作内容”总结，禁止补写未出现的工作内容；用户补充内容必须被视为已确认事实。
9. “今日工作内容”每一条必须以轻量模块标签开头，格式为“【一级模块 / 具体功能】”。只有区分同名功能或定位必须依赖场景时，才使用“【一级模块 / 页面或场景 / 具体功能】”。
10. 模块标签优先从业务模块、页面、组件、接口、路由、配置项、字段语义或文件路径中归纳；无法确定完整层级时至少输出最具体的页面或功能名称，不要写“相关模块”。
11. 不要省略模块标签，不要输出“模块/功能：”这类说明文字，不要只输出问题描述或优化描述。
12. “工作成果”描述业务结果或质量收益，避免重复今日工作中的字段名、实现细节和排序逻辑。
13. “明日计划”聚焦回归验证、同类问题排查或风险收敛，避免复述今日工作。
14. 示例格式：1. 【资产数据大屏 / 合同到期预警列表】修复签订公司映射与剩余天数排序问题，确保预警列表展示准确。
15. 输出格式中的占位词仅用于说明格式，实际输出必须替换为真实模块、真实功能和真实工作内容。

时间范围：
${timeRange.label}

Git数据：
${rawInput.gitLogs}

用户补充的非 Git 工作内容（这是用户明确完成的工作，请优先纳入日报，不要臆造未提供的细节）：
${rawInput.manualWorkContent || '无'}

修改文件：
${rawInput.files}

代码变更：
${rawInput.diff}

输出格式：

今日工作内容：

1. 【一级模块 / 具体功能】具体工作内容

工作成果：

1. 业务结果或质量收益

明日计划：

1. 回归验证或风险收敛计划`;

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
2. workItems：每条工作事项包含 module（模块名）、description（工作描述）、workType（从以下六选一：功能开发、Bug 修复、重构优化、性能优化、工程优化、日常开发）。
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
): Promise<StructuredReportMetadata | null> {
  try {
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
          { role: 'system', content: '你是一个 JSON 数据提取助手，只输出合法 JSON。' },
          { role: 'user', content: STRUCTURED_EXTRACT_PROMPT + reportText },
        ],
        temperature: 0,
      }),
    });

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
