import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { simpleGit } from 'simple-git';
import type { AppConfig, CommitEntry, GenerateReportParams, RepoInfo, ReportResult } from '../src/shared/types.js';

const DEFAULT_CONFIG: AppConfig = {
  workspaceDir: '',
  reporterName: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  feishuWebhook: '',
};

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'coverage', '.idea', '.vscode']);
const CONFIG_FILE = 'config.json';

let mainWindow: BrowserWindow | null = null;

function getConfigPath() {
  return join(app.getPath('userData'), CONFIG_FILE);
}

async function ensureConfigDir() {
  await mkdir(app.getPath('userData'), { recursive: true });
}

async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(getConfigPath(), 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(config: AppConfig) {
  await ensureConfigDir();
  await writeFile(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
  return config;
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

function nextDateString(date: string) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

async function collectGitData(repoPath: string, date: string) {
  const git = simpleGit(repoPath);
  const since = `${date} 00:00:00`;
  const until = `${nextDateString(date)} 00:00:00`;
  const marker = '__COMMIT__';

  const logOutput = await git.raw([
    'log',
    `--since=${since}`,
    `--until=${until}`,
    `--pretty=format:${marker}%H%x09%ad%x09%s`,
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
      const [, hash, commitDate, message] = line.slice(marker.length).split('\t');
      current = { hash, date: commitDate, message, files: [], show: '' };
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

  const gitLogs = commits
    .map((commit, index) => {
      const fileList = commit.files.length ? commit.files.join(', ') : '无';
      return `${index + 1}. ${commit.date} | ${commit.message} | 文件: ${fileList}`;
    })
    .join('\n');

  const files = [...new Set(commits.flatMap((commit) => commit.files))].join('\n');
  const diff = commits.map((commit) => `### ${commit.hash}\n${commit.show}`).join('\n\n').slice(0, 12000);

  return { commits, gitLogs, files, diff };
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

  const response = await fetch(`${config.aiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
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
    throw new Error(`AI接口调用失败：${response.status} ${response.statusText}`);
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
  const repoDataList = await Promise.all(params.repoPaths.map((repoPath) => collectGitData(repoPath, params.date)));
  const commits = repoDataList.flatMap((item) => item.commits);
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

async function pushFeishu(webhook: string, report: string) {
  if (!webhook) {
    throw new Error('请先配置飞书Webhook');
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'text',
      content: { text: report },
    }),
  });

  if (!response.ok) {
    throw new Error(`飞书推送失败：${response.status} ${response.statusText}`);
  }
  return true;
}

function createWindow() {
  const preloadPath = existsSync(join(__dirname, '../preload/index.js'))
    ? join(__dirname, '../preload/index.js')
    : join(__dirname, '../preload/preload.mjs');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 780,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
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
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle('repo:scan', async (_event, workspaceDir: string) => scanRepositories(workspaceDir));
  ipcMain.handle('report:generate', async (_event, params: GenerateReportParams) => generateReport(params));
  ipcMain.handle('report:push', async (_event, payload: { webhook: string; report: string }) => pushFeishu(payload.webhook, payload.report));

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
