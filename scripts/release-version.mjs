import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const git = (args, input) => execFileSync('git', args, {
  input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
});

const stableTags = args => git(['tag', '--list', 'v*', '--sort=-version:refname', ...args])
  .trim().split('\n').filter(tag => /^v\d+\.\d+\.\d+$/.test(tag));
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
// dev receives cherry-picked version commits, so its matching tag need not be an ancestor.
const currentTag = `v${version}`;
const baseTag = stableTags([]).includes(currentTag) ? currentTag : stableTags(['--merged', 'HEAD'])[0] ?? null;
const base = baseTag ?? git(['hash-object', '-t', 'tree', '--stdin'], '').trim();
const revision = baseTag ? `${baseTag}..HEAD` : 'HEAD';
const records = git(['log', '--format=%H%x00%B%x00', revision]).split('\0');
let commits = [];
for (let i = 0; i < records.length - 1; i += 2) {
  commits.push({ sha: records[i].trim(), message: records[i + 1].trim() });
}
const breaking = /^[a-z][\w-]*(?:\([^\r\n)]+\))?!:|^BREAKING[ -]CHANGE:\s*\S/im;
const feature = /^feat(?:\([^\r\n)]+\))?:\s*\S/im;

if (baseTag && commits.some(({ message }) => breaking.test(message) || feature.test(message))) {
  const patchIds = (ref, reverse = false) => git(['patch-id', '--stable'],
    git(['log', '--topo-order', '--no-merges', '--format=%H', '--patch', '--no-prefix', '--no-ext-diff', '--no-textconv',
      ...(reverse ? ['-R'] : []), ref]))
    .trim().split('\n').filter(Boolean).map(line => line.split(' '));
  // Compare published history too: after a dev merge, the release tag is already an ancestor.
  const reversed = new Map(patchIds(baseTag, true).map(([patch, sha]) => [sha, patch]));
  const published = new Map();
  for (const [patch, sha] of patchIds(baseTag)) {
    // Newest occurrence wins; an inverse change cancels a previously published patch.
    if (!published.has(patch)) published.set(patch, true);
    const inverse = reversed.get(sha);
    if (inverse && !published.has(inverse)) published.set(inverse, false);
  }
  const candidates = new Map(patchIds(revision).map(([patch, sha]) => [sha, patch]));
  commits = commits.filter(({ sha }) => published.get(candidates.get(sha)) !== true);
}
const messages = commits.map(({ message }) => message);

function isCode(path) {
  if (/(^|\/)(?:tests|__tests__)\/|\.(?:test|spec)\.[^.]+$/.test(path)) return false;
  return /^(?:electron\.vite\.config\.ts|electron-builder\.config\.cjs|tsconfig\.json)$/.test(path)
    || /^(?:src|electron|scripts|build)\/.*\.(?:[cm]?[jt]sx?|vue|css|scss|sass|less|html|json|nsh|py|ya?ml)$/.test(path);
}

let files = 0;
let additions = 0;
let deletions = 0;
const stats = git(['diff', '--numstat', '-z', '--find-renames', '--ignore-space-at-eol', base, 'HEAD']).split('\0');
for (let i = 0; i < stats.length - 1; i++) {
  const [added, deleted, path] = stats[i].split('\t');
  const paths = path ? [path] : [stats[++i], stats[++i]];
  const changed = Number(added) + Number(deleted);
  // Binary assets and pure renames contribute no code changes.
  if (!changed || !paths.some(isCode)) continue;
  files++;
  additions += Number(added);
  deletions += Number(deleted);
}

let bump = 'patch';
let reason = '小规模修复或维护';
if (messages.some(message => breaking.test(message))) {
  bump = 'major';
  reason = '提交明确标记不兼容变更';
} else if (messages.some(message => feature.test(message))) {
  bump = 'minor';
  reason = '提交包含新增功能';
} else if (additions + deletions >= 500 || files >= 20) {
  bump = 'minor';
  reason = '有效代码增删达到 500 行或涉及 20 个代码文件';
}

const plan = { baseTag, commits: messages.length, files, additions, deletions, bump, reason };
console.log(JSON.stringify(plan, null, 2));
if (process.argv.includes('--github-output')) {
  appendFileSync(process.env.GITHUB_OUTPUT, `bump=${bump}\n`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### 自动版本判定\n\n| 项目 | 结果 |\n| --- | --- |\n`
    + `| 分析基线 | ${baseTag ?? '首次发布（全部历史）'} |\n| 提交数 | ${messages.length} |\n`
    + `| 有效代码文件 | ${files} |\n| 新增 / 删除行 | +${additions} / -${deletions} |\n`
    + `| 升级级别 | ${bump} |\n| 判定原因 | ${reason} |\n`);
}
