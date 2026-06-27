import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import { DEFAULT_FEISHU_FORM_CONFIG } from '../src/shared/types.js';
import type {
  AppConfig,
  CommitEntry,
  FeishuFormConfig,
  FeishuLoginPayload,
  FeishuProjectOption,
  FeishuProjectOptionsPayload,
  FeishuSubmitResult,
  FeishuTestSubmitPayload,
  GenerateReportParams,
  RepoInfo,
  ReportResult,
  SyncFeishuDailyPayload,
} from '../src/shared/types.js';

const DEFAULT_CONFIG: AppConfig = {
  workspaceDir: '',
  reporterName: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  feishuForm: { ...DEFAULT_FEISHU_FORM_CONFIG },
};

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'coverage', '.idea', '.vscode']);
const CONFIG_FILE = 'config.json';

let mainWindow: BrowserWindow | null = null;
let feishuWindow: BrowserWindow | null = null;

const FEISHU_PARTITION = 'persist:feishu';

function getConfigPath() {
  return join(app.getPath('userData'), CONFIG_FILE);
}

async function ensureConfigDir() {
  await mkdir(app.getPath('userData'), { recursive: true });
}

function normalizeConfig(config?: Partial<AppConfig>): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    feishuForm: {
      ...DEFAULT_FEISHU_FORM_CONFIG,
      ...(config?.feishuForm ?? {}),
    },
  };
}

async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(getConfigPath(), 'utf-8');
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return normalizeConfig();
  }
}

async function saveConfig(config: AppConfig) {
  await ensureConfigDir();
  const normalizedConfig = normalizeConfig(config);
  await writeFile(getConfigPath(), JSON.stringify(normalizedConfig, null, 2), 'utf-8');
  return normalizedConfig;
}

async function hasGitMetadata(dir: string) {
  try {
    const info = await stat(join(dir, '.git'));
    return info.isDirectory() || info.isFile();
  } catch {
    return false;
  }
}

async function scanRepositories(rootDir: string): Promise<RepoInfo[]> {
  const repos: RepoInfo[] = [];
  const stack = [resolve(rootDir)];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    if (await hasGitMetadata(current)) {
      repos.push({ name: basename(current), path: current });
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      stack.push(join(current, entry.name));
    }
  }

  return repos.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

function shiftDateString(date: string, deltaDays: number) {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + deltaDays);
  const shiftedYear = shifted.getFullYear();
  const shiftedMonth = String(shifted.getMonth() + 1).padStart(2, '0');
  const shiftedDay = String(shifted.getDate()).padStart(2, '0');
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}

function nextDateString(date: string) {
  return shiftDateString(date, 1);
}

// 目标当天在本地时区的起始毫秒数（用于 author date 的半开区间 [start, end) 判定）。
function dateToLocalMs(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

async function collectGitData(repoPath: string, date: string) {
  const git = simpleGit(repoPath);
  const marker = '__COMMIT__';
  // git log 的 --since/--until 过滤的是 committer date，但日报关心的是 author date：
  // 提交被 rebase / merge 后 committer date 会被刷新到处理那一刻，author date 仍是当初写代码的时间。
  // 因此这里只用宽松的 committer-date 下界做粗筛（committer date 一般 ≥ author date），不设 --until，
  // 再在 JS 里按 author date(%ad) 精确筛到目标当天，避免漏掉「当天写、隔天才合并」的提交。
  const dayStartMs = dateToLocalMs(date);
  const dayEndMs = dateToLocalMs(nextDateString(date));
  const coarseSince = `${shiftDateString(date, -2)} 00:00:00`;

  const logOutput = await git.raw([
    'log',
    `--since=${coarseSince}`,
    `--pretty=format:${marker}%H%x09%ad%x09%an%x09%s`,
    '--date=iso-strict',
    '--name-only',
    '--no-merges',
  ]);

  const commits: CommitEntry[] = [];
  let current: CommitEntry | null = null;

  for (const rawLine of logOutput.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line.startsWith(marker)) {
      const [hash, commitDate, author, message] = line.slice(marker.length).split('\t');
      const authoredMs = new Date(commitDate).getTime();
      if (Number.isNaN(authoredMs) || authoredMs < dayStartMs || authoredMs >= dayEndMs) {
        current = null; // 非目标当天创作，跳过该提交（其 --name-only 文件行也随之忽略）
        continue;
      }
      current = { hash, date: commitDate, author, message, files: [], show: '' };
      commits.push(current);
      continue;
    }
    if (current && !line.startsWith(' ')) {
      current.files.push(line.trim());
    }
  }

  for (const commit of commits) {
    const show = await git.raw([
      'show',
      commit.hash,
      '--stat',
      '--summary',
      '--format=medium',
      '--no-ext-diff',
      '--unified=3',
    ]);
    commit.show = show.slice(0, 4000);
  }

  return formatCollectedGitData(commits);
}

function normalizeAuthorName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function filterCommitsByReporter(commits: CommitEntry[], reporterName: string) {
  const normalizedReporterName = normalizeAuthorName(reporterName);
  if (!normalizedReporterName) return commits;
  return commits.filter((commit) => normalizeAuthorName(commit.author) === normalizedReporterName);
}

function formatCollectedGitData(commits: CommitEntry[]) {
  const gitLogs = commits
    .map((commit, index) => {
      const fileList = commit.files.length ? commit.files.join(', ') : '无';
      return `${index + 1}. ${commit.date} | 作者: ${commit.author} | ${commit.message} | 文件: ${fileList}`;
    })
    .join('\n');

  const files = [...new Set(commits.flatMap((commit) => commit.files))].join('\n');
  const diff = commits.map((commit) => `### ${commit.hash}\n${commit.show}`).join('\n\n').slice(0, 12000);

  return { commits, gitLogs, files, diff };
}

function normalizeAiBaseUrl(aiBaseUrl: string) {
  return aiBaseUrl.trim().replace(/\/+$/, '');
}

function getChatCompletionsUrl(aiBaseUrl: string) {
  const baseUrl = normalizeAiBaseUrl(aiBaseUrl);
  return baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
}

function getModelsUrl(aiBaseUrl: string) {
  const baseUrl = normalizeAiBaseUrl(aiBaseUrl);
  return baseUrl.endsWith('/chat/completions') ? baseUrl.replace(/\/chat\/completions$/, '/models') : `${baseUrl}/models`;
}

function parseAiError(detail: string) {
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

function isUnsupportedModelError(status: number, detail: string) {
  const message = parseAiError(detail);
  return status === 404 && /模型|model/i.test(message) && /不支持|unsupported|not\s+support/i.test(message);
}

async function fetchAvailableModels(config: AppConfig) {
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

async function buildAiErrorMessage(config: AppConfig, response: Response, detail: string) {
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

async function callAiReport(config: AppConfig, rawInput: { gitLogs: string; files: string; diff: string }) {
  const prompt = `你是一名资深软件研发工程师。

请根据以下Git提交记录、修改文件和代码变更内容，总结今天的工作内容。

要求：
1. 不要出现commit、git等技术词汇。
2. 使用正式工作日报语言。
3. 每条内容控制在30-80字。
4. 按实际功能归纳。
5. 相同模块合并总结。
6. 输出3-5条工作内容。
7. 自动生成明日计划。
8. 只能依据提供的Git数据、修改文件和代码变更总结，禁止补写未出现的工作内容。

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

function formatNumbered(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function fallbackReport(repoNames: string[], date: string, reporterName: string, commits: CommitEntry[]) {
  const workItems = commits.slice(0, 5).map((commit) => {
    const topic = commit.message.replace(/^(\w+)(\(.+?\))?:\s*/, '') || '相关模块';
    const modules = commit.files.slice(0, 2).join('、') || repoNames[0] || '当前项目';
    return `围绕${topic}完成 ${modules} 相关优化与修复，持续提升业务稳定性与交互可用性。`;
  });
  const resultItems = commits.length
    ? [
        `完成 ${Math.min(commits.length, 5)} 项当日研发变更梳理，并整理为结构化日报内容。`,
        `覆盖 ${repoNames.join('、') || '当前项目'} 的主要改动线索，便于后续同步与复盘。`,
      ]
    : ['完成日报基础信息整理，当前日期暂无可用研发记录。'];
  const planItems = commits.length
    ? commits.slice(0, 2).map((commit) => {
        const topic = commit.message.replace(/^(\w+)(\(.+?\))?:\s*/, '') || '当前模块';
        return `继续推进${topic}相关联调、验证与收尾工作。`;
      })
    : ['推进当前模块联调与问题收敛。', '补充后续功能迭代所需的日报素材。'];

  return [
    '今日工作内容：',
    '',
    formatNumbered(workItems.length ? workItems : ['完成基础环境搭建与日报生成流程联调。']),
    '',
    '工作成果：',
    '',
    formatNumbered(resultItems),
    '',
    '工作时长：',
    '',
    '8小时',
    '',
    '明日计划：',
    '',
    formatNumbered(planItems),
    '',
    `汇报人：${reporterName}`,
    `日期：${date}`,
  ].join('\n');
}

async function generateReport(params: GenerateReportParams): Promise<ReportResult> {
  const config = await loadConfig();
  const repos = params.repoPaths.map((repoPath) => ({ name: basename(repoPath), path: repoPath }));
  const allRepoDataList = await Promise.all(params.repoPaths.map((repoPath) => collectGitData(repoPath, params.date)));
  const repoDataList = allRepoDataList.map((item) => {
    const commits = filterCommitsByReporter(item.commits, params.reporterName);
    return formatCollectedGitData(commits);
  });
  const commits = repoDataList.flatMap((item) => item.commits);
  const allCommits = allRepoDataList.flatMap((item) => item.commits);
  const rawInput = {
    gitLogs: repoDataList
      .map((item, index) => `## ${repos[index]?.name ?? `项目${index + 1}`}\n${item.gitLogs || '当日无记录'}`)
      .join('\n\n'),
    files: [...new Set(repoDataList.flatMap((item) => item.files.split('\n').filter(Boolean)))].join('\n'),
    diff: repoDataList
      .map((item, index) => `## ${repos[index]?.name ?? `项目${index + 1}`}\n${item.diff || '当日无代码变更摘要'}`)
      .join('\n\n')
      .slice(0, 12000),
  };

  if (!commits.length) {
    const matchedTip = allCommits.length
      ? `所选日期存在 ${allCommits.length} 条提交记录，但没有匹配到汇报人“${params.reporterName}”的提交。`
      : '所选日期未采集到代码提交记录。';
    const report = [
      '今日工作内容：',
      '',
      `1. ${matchedTip}暂不生成推测性日报内容。`,
      '',
      '工作成果：',
      '',
      '1. 已完成所选仓库的提交记录扫描，但未发现可用于日报生成的研发变更。',
      '',
      '明日计划：',
      '',
      '1. 请确认工作日期、仓库路径、汇报人名称与 Git 作者名称后重新生成日报。',
      '',
      `汇报人：${params.reporterName}`,
      `日期：${params.date}`,
    ].join('\n');

    return { report, commits, repos, rawInput };
  }

  let report = '';
  if (config.aiApiKey) {
    try {
      report = await callAiReport(config, rawInput);
    } catch (error) {
      report = fallbackReport(repos.map((item) => item.name), params.date, params.reporterName, commits);
      report = `${report}\n\nAI提示：${error instanceof Error ? error.message : '调用失败'}`;
    }
  } else {
    report = fallbackReport(repos.map((item) => item.name), params.date, params.reporterName, commits);
    report = `${report}\n\nAI提示：请先在设置中配置 OpenAI 兼容接口。`;
  }

  return { report, commits, repos, rawInput };
}

function requireFeishuConfigValue(value: string, label: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    throw new Error(`请先填写${label}`);
  }
  return normalizedValue;
}

function dateToFeishuDateValue(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error('日报日期格式不正确');
  }
  return Date.UTC(year, month - 1, day);
}

function extractReportSection(report: string, sectionTitle: string) {
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

function extractWorkHours(report: string, fallbackHours: number) {
  const match = report.match(/工作时长[：:]\s*([0-9]+(?:\.[0-9]+)?)/);
  const parsedHours = match ? Number(match[1]) : fallbackHours;
  if (!Number.isFinite(parsedHours) || parsedHours <= 0) return fallbackHours;
  return parsedHours;
}

function buildFeishuFormData(payload: SyncFeishuDailyPayload) {
  const formConfig = payload.config;
  const reporterName = formConfig.reporterName.trim() || payload.reporterName.trim();
  const workContent = extractReportSection(payload.report, '今日工作内容') || payload.report.trim();
  const reporterUser: { userId: string; name: string; enName: string; notify: boolean; avatarUrl?: string } = {
    userId: requireFeishuConfigValue(formConfig.reporterUserId, '飞书汇报人 userId'),
    name: requireFeishuConfigValue(reporterName, '飞书汇报人名称'),
    enName: reporterName,
    notify: false,
  };

  if (formConfig.reporterAvatarUrl.trim()) {
    reporterUser.avatarUrl = formConfig.reporterAvatarUrl.trim();
  }

  return {
    [requireFeishuConfigValue(formConfig.dateFieldId, '日期字段 ID')]: {
      type: 5,
      value: dateToFeishuDateValue(payload.date),
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
            value: extractWorkHours(payload.report, formConfig.defaultWorkHours || 8),
          },
          [requireFeishuConfigValue(formConfig.contentFieldId, '工作内容字段 ID')]: {
            type: 1,
            value: [
              {
                type: 'text',
                text: workContent,
              },
            ],
          },
        },
      ],
    },
  };
}

function getFeishuRequestContext(endpoint: string, shareToken: string) {
  const url = new URL(endpoint);
  return {
    origin: url.origin,
    referer: `${url.origin}/share/base/form/${shareToken}?chunked=false`,
  };
}

function getFeishuFormPageUrl(config: FeishuFormConfig) {
  const endpoint = requireFeishuConfigValue(config.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(config.shareToken, '飞书表单 shareToken');
  const { referer } = getFeishuRequestContext(endpoint, shareToken);
  return referer;
}

function getFeishuContentMetaUrl(config: FeishuFormConfig) {
  const endpoint = requireFeishuConfigValue(config.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(config.shareToken, '飞书表单 shareToken');
  const url = new URL(endpoint);
  url.pathname = '/space/api/bitable/external/share/content_meta';
  url.search = '';
  url.searchParams.set('shareToken', shareToken);
  return url.toString();
}

async function getFeishuCookieHeader(origin: string, fallbackCookie: string) {
  const feishuSession = feishuWindow && !feishuWindow.isDestroyed() ? feishuWindow.webContents.session : session.fromPartition(FEISHU_PARTITION);
  const cookies = await feishuSession.cookies.get({ url: origin });
  const sessionCookie = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  return sessionCookie || fallbackCookie.trim();
}

function getCookieValue(cookieHeader: string, names: string[]) {
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

function getFeishuCsrfToken(cookieHeader: string, fallbackCsrfToken: string) {
  return getCookieValue(cookieHeader, ['_csrf_token', 'swp_csrf_token']) || fallbackCsrfToken.trim();
}

function parseFeishuProjectOptions(meta: unknown, projectFieldId: string): FeishuProjectOption[] {
  const data = meta as { data?: { snapshot?: unknown } };
  const snapshotRaw = data?.data?.snapshot;
  if (typeof snapshotRaw !== 'string') {
    throw new Error('飞书项目列表解析失败：接口未返回 snapshot');
  }

  const snapshot = JSON.parse(snapshotRaw) as {
    fieldMap?: Record<string, { property?: { options?: Array<{ id?: unknown; name?: unknown; color?: unknown }> } }>;
  };
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

async function listFeishuProjectOptions(payload: FeishuProjectOptionsPayload): Promise<FeishuProjectOption[]> {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const endpoint = requireFeishuConfigValue(formConfig.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(formConfig.shareToken, '飞书表单 shareToken');
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
    throw new Error(`获取飞书项目列表失败：${response.status} ${response.statusText}${detail ? `，返回：${detail.slice(0, 500)}` : ''}`);
  }

  let meta: unknown;
  try {
    meta = JSON.parse(detail);
  } catch {
    throw new Error(`获取飞书项目列表失败：接口返回内容不是 JSON：${detail.slice(0, 500)}`);
  }

  const result = meta as { code?: number; msg?: string };
  if (result.code !== 0) {
    if (result.msg === 'Login Required') {
      throw new Error('获取飞书项目列表失败：飞书登录态无效或已过期，请先点击“登录飞书”完成登录，或填写完整有效的飞书 Cookie');
    }
    throw new Error(`获取飞书项目列表失败：${result.msg || `code=${result.code}`}`);
  }

  return parseFeishuProjectOptions(meta, requireFeishuConfigValue(formConfig.projectFieldId, '所属项目字段 ID'));
}

function buildFeishuTestFormData(config: FeishuFormConfig, date: string) {
  const reporterName = requireFeishuConfigValue(config.reporterName, '飞书汇报人名称');
  const reporterUser: { userId: string; name: string; enName: string; notify: boolean; avatarUrl?: string } = {
    userId: requireFeishuConfigValue(config.reporterUserId, '飞书汇报人 userId'),
    name: reporterName,
    enName: reporterName,
    notify: false,
  };

  if (config.reporterAvatarUrl.trim()) {
    reporterUser.avatarUrl = config.reporterAvatarUrl.trim();
  }

  return {
    [requireFeishuConfigValue(config.dateFieldId, '日期字段 ID')]: {
      type: 5,
      value: dateToFeishuDateValue(date),
    },
    [requireFeishuConfigValue(config.userFieldId, '汇报人字段 ID')]: {
      type: 11,
      value: {
        users: [reporterUser],
      },
    },
    [requireFeishuConfigValue(config.questionId, '明细表问题 ID')]: {
      type: 21,
      value: [
        {
          [requireFeishuConfigValue(config.projectFieldId, '所属项目字段 ID')]: {
            type: 4,
            value: [requireFeishuConfigValue(config.projectOptionId, '所属项目选项 ID')],
          },
          [requireFeishuConfigValue(config.hoursFieldId, '工作时长字段 ID')]: {
            type: 2,
            value: config.defaultWorkHours || 8,
          },
          [requireFeishuConfigValue(config.contentFieldId, '工作内容字段 ID')]: {
            type: 1,
            value: [
              {
                type: 'text',
                text: '测试提交管道：Electron persist:feishu 登录态验证。',
              },
            ],
          },
        },
      ],
    },
  };
}

async function openFeishuLogin(payload: FeishuLoginPayload) {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const targetUrl = getFeishuFormPageUrl(formConfig);

  if (feishuWindow && !feishuWindow.isDestroyed()) {
    feishuWindow.show();
    feishuWindow.focus();
    await feishuWindow.loadURL(targetUrl);
    return true;
  }

  feishuWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 960,
    minHeight: 720,
    title: '登录飞书',
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

  await feishuWindow.loadURL(targetUrl);
  return true;
}

async function testSubmitFeishuForm(payload: FeishuTestSubmitPayload): Promise<FeishuSubmitResult> {
  const formConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const endpoint = requireFeishuConfigValue(formConfig.endpoint, '飞书表单提交接口地址');
  const shareToken = requireFeishuConfigValue(formConfig.shareToken, '飞书表单 shareToken');
  const data = buildFeishuTestFormData(formConfig, payload.date);
  const requestId = `gitinsight-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { origin, referer } = getFeishuRequestContext(endpoint, shareToken);
  const cookie = await getFeishuCookieHeader(origin, formConfig.cookie);
  const csrfToken = getFeishuCsrfToken(cookie, formConfig.csrfToken);

  if (!cookie) {
    throw new Error('飞书测试提交失败：未找到飞书登录态，请先点击“登录飞书”完成登录，或填写完整有效的飞书 Cookie');
  }
  if (!csrfToken) {
    throw new Error('飞书测试提交失败：未在飞书登录态中找到 _csrf_token 或 swp_csrf_token，请重新登录飞书后再试');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      cookie,
      origin,
      referer,
      'request-id': requestId,
      'x-csrftoken': csrfToken,
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

async function syncFeishuDaily(payload: SyncFeishuDailyPayload) {
  const formConfig: FeishuFormConfig = {
    ...DEFAULT_FEISHU_FORM_CONFIG,
    ...payload.config,
  };
  const endpoint = requireFeishuConfigValue(formConfig.endpoint, '飞书表单接口地址');
  const shareToken = requireFeishuConfigValue(formConfig.shareToken, '飞书 shareToken');
  const csrfToken = requireFeishuConfigValue(formConfig.csrfToken, '飞书 x-csrftoken');
  const cookie = requireFeishuConfigValue(formConfig.cookie, '飞书 Cookie');
  const requestId = `gitinsight-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const { origin, referer } = getFeishuRequestContext(endpoint, shareToken);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      cookie,
      origin,
      referer,
      'request-id': requestId,
      'x-csrftoken': csrfToken,
      'x-request-id': requestId,
    },
    body: JSON.stringify({
      shareToken,
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

  return true;
}

function createWindow() {
  const preloadPath = existsSync(join(__dirname, '../preload/index.js'))
    ? join(__dirname, '../preload/index.js')
    : join(__dirname, '../preload/preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 780,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('app:load-config', async () => loadConfig());
  ipcMain.handle('app:save-config', async (_event, config: AppConfig) => saveConfig(config));
  ipcMain.handle('dialog:select-directory', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle('repo:scan', async (_event, workspaceDir: string) => scanRepositories(workspaceDir));
  ipcMain.handle('report:generate', async (_event, params: GenerateReportParams) => generateReport(params));
  ipcMain.handle('feishu:login', async (_event, payload: FeishuLoginPayload) => openFeishuLogin(payload));
  ipcMain.handle('feishu:list-projects', async (_event, payload: FeishuProjectOptionsPayload) => listFeishuProjectOptions(payload));
  ipcMain.handle('feishu:test-submit', async (_event, payload: FeishuTestSubmitPayload) => testSubmitFeishuForm(payload));
  ipcMain.handle('report:sync-feishu', async (_event, payload: SyncFeishuDailyPayload) => syncFeishuDaily(payload));

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
