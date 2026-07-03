import { simpleGit } from 'simple-git';
import type { CommitEntry } from '../../src/shared/types.js';
import { formatDateTimeForGit, type NormalizedReportTimeRange } from './dateUtils.js';

export async function collectGitData(repoPath: string, timeRange: NormalizedReportTimeRange) {
  const git = simpleGit(repoPath);
  const marker = '__COMMIT__';
  // git log 的 --since/--until 过滤的是 committer date，但日报关心的是 author date：
  // 提交被 rebase / merge 后 committer date 会被刷新到处理那一刻，author date 仍是当初写代码的时间。
  // 因此这里只用宽松的 committer-date 下界做粗筛（committer date 一般 ≥ author date），不设 --until，
  // 再在 JS 里按 author date(%ad) 精确筛到目标时间段，避免漏掉「前一时间段写、之后才合并」的提交。
  const coarseSince = formatDateTimeForGit(new Date(timeRange.startMs - 2 * 24 * 60 * 60 * 1000));

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
      if (Number.isNaN(authoredMs) || authoredMs < timeRange.startMs || authoredMs >= timeRange.endMs) {
        current = null; // 非目标时间段创作，跳过该提交（其 --name-only 文件行也随之忽略）
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


export function normalizeAuthorName(name: string) {
  return name.trim().toLocaleLowerCase();
}


export function filterCommitsByReporter(commits: CommitEntry[], reporterName: string) {
  const normalizedReporterName = normalizeAuthorName(reporterName);
  if (!normalizedReporterName) return commits;
  return commits.filter((commit) => normalizeAuthorName(commit.author) === normalizedReporterName);
}


export function formatCollectedGitData(commits: CommitEntry[]) {
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

