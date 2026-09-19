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
  promptStyle: ReportPromptStyle = 'standard',
) {
  const styleRequirements: Record<ReportPromptStyle, { name: string; instruction: string }> = {
    concise: {
      name: '简短精炼',
      instruction: '完整覆盖输入中已明确的工作事项，优先保留具体模块、具体功能和关键执行动作，仅压缩修饰性语言，不得删除关键事实。正文每条25-55字，按实际工作量自然分条。',
    },
    standard: {
      name: '标准均衡',
      instruction: '完整覆盖输入中已明确的工作事项，清楚描述具体对象、实际执行动作及可确认的结果或问题。正文每条35-80字，按实际工作量自然分条。',
    },
    detailed: {
      name: '具体详细',
      instruction: '在输入信息范围内完整说明具体模块、功能对象、执行动作、问题处理和实际结果；优先保留字段、接口、数据逻辑、校验、交互、异常处理等可确认细节，不得遗漏已明确的工作事项。正文每条50-120字，按实际工作量自然分条；工作量较少时不要凑数。',
    },
  };
  const style = styleRequirements[promptStyle];
  const prompt = `你是一名资深软件研发工程师，同时也是一名严谨的研发工作日报整理助手。

你的任务是根据 Git 提交记录、修改文件、代码变更内容以及用户补充的非 Git 工作，准确还原指定时间范围内实际完成的研发工作。

你的首要目标不是“把内容写得好听”，而是让不了解代码细节的管理者，仅通过日报就能清楚知道研发人员今天具体改了什么、做了哪些工作、涉及哪些模块、解决了什么问题。

## 一、信息可信度与事实边界

只能依据以下信息生成日报：
1. Git 提交记录
2. 修改文件
3. 代码变更内容
4. 用户补充的非 Git 工作内容

禁止根据常识、文件名称、业务经验或上下文自行推测不存在的功能、需求、业务结果或工作事项。
用户补充的非 Git 工作内容属于用户明确确认已经完成的工作，必须纳入日报。
如果代码只能证明“修改了某处逻辑”，但无法证明具体业务目的，则只描述已经能够确认的实际修改，不得擅自补充原因。

## 二、核心生成原则：优先写“具体做了什么”

每一条“今日工作内容”都应该尽可能回答：改了什么对象 → 做了什么具体动作 → 产生了什么实际结果或解决了什么问题。

优先提取页面、功能、组件、接口、路由、字段、数据结构、参数、状态、配置项、表单、列表、弹窗、查询条件、筛选逻辑、排序逻辑、计算逻辑、数据映射、校验规则、异常处理、权限逻辑、文件路径、公共方法、类型定义、API 调用和页面交互等具体信息。

不要停留在“优化、完善、调整、修复”这一层，要继续向下提取具体修改对象和动作。

错误示例：
【资产管理 / 合同管理】优化合同相关功能。

正确示例：
【资产管理 / 合同管理】调整合同列表签订公司字段映射，修正合同到期天数计算及剩余天数排序逻辑。

## 三、代码变更是重要事实依据

需要主动从代码变更中识别真实发生的研发动作，包括新增、删除、修改、替换、拆分、合并、重构、字段增改、数据映射调整、计算或排序或筛选逻辑调整、校验与异常处理、接口参数与返回数据处理、页面交互与展示、状态处理、配置、公共方法、类型定义、边界条件、空值处理和数据兼容问题。

如果一个功能包含多个明确的修改动作，可以在同一条日报中自然串联。

## 四、禁止泛化和空洞表达

“优化功能、完善功能、优化体验、提升稳定性、提升性能、修复问题、处理问题、调整逻辑、优化代码、完善业务逻辑、完成相关开发、处理异常、增强系统能力、提高数据准确性”等表达不能单独作为工作内容。

如果使用这些词，必须说明具体对象以及实际完成的动作。

错误示例：
【用户管理 / 用户列表】优化用户管理功能。

正确示例：
【用户管理 / 用户列表】调整用户状态筛选条件及列表数据处理逻辑，补充空数据场景下的展示处理。

## 五、不要把“修改文件”直接当成工作内容

文件路径只能帮助判断模块和功能，不能直接把文件名改写成日报。必须结合代码变更判断具体工作，不要使用文件名作为模块标签或工作描述。

## 六、按实际功能归纳，但不能为了归纳而丢失细节

同一个页面、组件或业务模块存在多个相关修改时，可以合并成一条，但合并不能导致具体工作事项消失。

例如同一个合同列表同时修改签订公司字段映射、剩余天数计算、到期排序和空数据展示时，可以写为：
【合同管理 / 合同列表】调整签订公司字段映射，修正剩余天数计算和到期排序逻辑，并补充空数据场景展示处理。

不得概括为：
【合同管理 / 合同列表】优化合同列表相关功能。

## 七、工作条数完全按照实际工作量决定

不设固定条数。一个明确且较大的功能可以拆成多条，多个非常细小且属于同一功能的修改可以合并。
禁止为了达到条数而人为拆分，也禁止为了简洁而强行合并。

## 八、模块标签要求

“今日工作内容”每一条必须以模块标签开头，格式为“【一级模块 / 具体功能】”。
只有在同名功能较多或者必须通过页面或场景才能准确定位时，才使用“【一级模块 / 页面或场景 / 具体功能】”。

模块标签优先根据业务模块、页面、功能、组件、接口、路由、配置、字段语义和文件路径确定。
禁止使用“【相关模块】”“【其他】”“【系统功能】”“【代码优化】”“【功能模块】”等无法准确定位工作的标签。

## 九、日报语言

使用正式、自然、专业的研发工作日报语言，不要写成代码提交记录。
输出中禁止出现 commit、git、hash、diff、提交、提交记录等词汇。
可以使用调整、新增、修复、重构、拆分、补充、修改、优化、完善等正常研发语言，但这些动词后面必须尽可能跟随具体对象。

## 十、工作成果不要重复工作内容

“工作成果”不是重新复述今天改了什么，应该描述此次工作的业务结果或质量收益，避免重复字段名、实现细节和排序逻辑。

## 十一、明日计划

明日计划只能根据今天实际工作合理安排，优先写回归验证、功能联调、边界场景验证、同类问题排查、异常数据验证、兼容性验证、上线前检查和风险收敛，不要简单重复今天已经完成的工作。
如果当前输入不足以判断明确的明日计划，则输出基于今日工作最合理的验证计划，不得虚构新的开发需求。

## 十二、风格要求

本次日报风格：${style.name}

${style.instruction}

无论采用哪种风格，都必须优先保证事实完整和具体工作动作完整，其次再控制篇幅。
不能为了满足字数限制而删除关键工作对象、关键修改动作或关键结果。

## 十三、最终自检

生成日报前必须在内部检查：
1. 每条工作内容是否能看出具体改了什么？
2. 是否说明了实际执行的动作？
3. 是否避免了只有“优化、完善、修复”而没有具体内容的空话？
4. 是否遗漏用户明确补充的非 Git 工作？
5. 是否遗漏代码变更中能够确认的重要工作？
6. 是否把多个相关修改合理归纳？
7. 是否存在根据经验自行补写的内容？
8. 模块标签是否能够准确定位工作？
9. 工作成果是否与今日工作内容重复？
10. 明日计划是否只是重复今天的工作？
11. 输出中是否出现 commit、git 等技术词汇？

如果某条内容过于笼统，必须回到输入数据重新提取具体修改对象和动作。

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

输出格式：

今日工作内容：

1. 【一级模块 / 具体功能】具体工作内容

工作成果：

1. 业务结果或质量收益

明日计划：

1. 回归验证或风险收敛计划

只输出上述日报内容，不输出分析过程、判断过程、原始代码、Git 信息或额外解释。`;

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
