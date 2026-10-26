import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommitEntry } from '../src/shared/types.js';
import { collectGitData, filterCommitsByReporter } from '../electron/main/gitCollect.js';

const commits: CommitEntry[] = [
  { hash: 'name-match', date: '', author: '张三', authorEmail: 'other@example.com', message: '', files: [], show: '' },
  { hash: 'email-match', date: '', author: 'Developer', authorEmail: 'ZhangSan@Example.com', message: '', files: [], show: '' },
  { hash: 'other', date: '', author: '李四', authorEmail: 'li@example.com', message: '', files: [], show: '' },
];

test('filterCommitsByReporter 按 Git 作者名称或邮箱匹配提交', () => {
  assert.deepEqual(
    filterCommitsByReporter(commits, '张三', 'zhangsan@example.com').map((commit) => commit.hash),
    ['name-match', 'email-match'],
  );
});

test('filterCommitsByReporter 未配置名称和邮箱时保留全部提交', () => {
  assert.deepEqual(
    filterCommitsByReporter(commits, '', '').map((commit) => commit.hash),
    ['name-match', 'email-match', 'other'],
  );
});

test('collectGitData 先按汇报人过滤，再只为匹配提交读取 show', async (t) => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const repoPath = mkdtempSync(join(tmpdir(), 'gitinsight-collect-'));
  t.after(() => rmSync(repoPath, { recursive: true, force: true }));
  const env = { ...process.env, GIT_AUTHOR_DATE: '2026-10-26T10:00:00+08:00', GIT_COMMITTER_DATE: '2026-10-26T10:00:00+08:00' };
  execFileSync('git', ['init'], { cwd: repoPath, env, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=Other', '-c', 'user.email=other@example.com', 'commit', '--allow-empty', '-m', 'other work'], {
    cwd: repoPath, env, stdio: 'ignore',
  });
  execFileSync('git', ['-c', 'user.name=Target', '-c', 'user.email=target@example.com', 'commit', '--allow-empty', '-m', 'target work'], {
    cwd: repoPath, env, stdio: 'ignore',
  });

  const result = await collectGitData(repoPath, {
    startDateTime: '2026-10-26T00:00:00',
    endDateTime: '2026-10-27T00:00:00',
    startMs: new Date('2026-10-26T00:00:00+08:00').getTime(),
    endMs: new Date('2026-10-27T00:00:00+08:00').getTime(),
    label: '测试范围',
  }, 'Target');

  assert.equal(result.totalCommits, 2);
  assert.deepEqual(result.commits.map((commit) => commit.message), ['target work']);
});
