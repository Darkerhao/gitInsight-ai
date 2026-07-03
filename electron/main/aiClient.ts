import type { AppConfig, ReportTimeRange } from '../../src/shared/types.js';

export function normalizeAiBaseUrl(aiBaseUrl: string) {
  return aiBaseUrl.trim().replace(/\/+$/, '');
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


export async function fetchAvailableModels(config: AppConfig) {
  try {
    const response = await fetch(getModelsUrl(config.aiBaseUrl), {
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


export async function buildAiErrorMessage(config: AppConfig, response: Response, detail: string) {
  const parsedDetail = parseAiError(detail);
  if (isUnsupportedModelError(response.status, detail)) {
    const models = await fetchAvailableModels(config);
    const modelTips = models.length
      ? `；/models 可查询到的模型包括：${models.join('、')}。注意：模型列表不一定代表当前 /chat/completions 接口全部可用`
      : '；同时未能从 /models 获取可用模型列表';
    return `AI接口调用失败：当前接口不支持模型 ${config.aiModel}${modelTips}。请在基础配置中更换为服务方明确支持 Chat Completions 的模型。原始错误：${parsedDetail || `${response.status} ${response.statusText}`}`;
  }
  return `AI接口调用失败：${response.status} ${response.statusText}${parsedDetail ? `，返回内容：${parsedDetail.slice(0, 500)}` : ''}`;
}


export async function callAiReport(config: AppConfig, rawInput: { gitLogs: string; files: string; diff: string }, timeRange: ReportTimeRange) {
  const prompt = `你是一名资深软件研发工程师。

请根据以下Git提交记录、修改文件和代码变更内容，总结所选时间段内的工作内容。

要求：
1. 不要出现commit、git等技术词汇。
2. 使用正式工作日报语言。
3. 每条内容控制在30-80字。
4. 按实际功能归纳。
5. 相同模块合并总结。
6. 输出3-5条工作内容。
7. 自动生成明日计划。
8. 只能依据提供的Git数据、修改文件和代码变更总结，禁止补写未出现的工作内容。

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

1.
2.
3.

工作成果：

1.
2.

明日计划：

1.
2.`;

  const chatCompletionsUrl = getChatCompletionsUrl(config.aiBaseUrl);

  const response = await fetch(chatCompletionsUrl, {
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

