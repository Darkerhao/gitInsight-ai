import assert from 'node:assert/strict';
import test from 'node:test';
import type { CommitEntry } from '../src/shared/types.js';
import { filterCommitsByReporter } from '../electron/main/gitCollect.js';

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
