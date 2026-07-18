import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getRepoDisplayName,
  matchesRepoKeyword,
  normalizeRepoDisplayNames,
  setRepoDisplayName,
} from '../src/shared/repositoryName.js';

const repo = {
  name: 'integrated-platform-web',
  path: 'D:/MyWork/project/SHUZHI/integrated-platform-web',
};

test('用户设置显示名称后保留真实仓库名，并优先展示自定义名称', () => {
  const displayNames = setRepoDisplayName({}, repo.path, '业财融合一体化平台');

  assert.equal(getRepoDisplayName(repo, displayNames), '业财融合一体化平台');
  assert.equal(repo.name, 'integrated-platform-web');
});

test('仓库搜索同时匹配显示名称、真实仓库名和路径', () => {
  const displayNames = setRepoDisplayName({}, repo.path, '业财融合一体化平台');

  assert.equal(matchesRepoKeyword(repo, displayNames, '业财融合'), true);
  assert.equal(matchesRepoKeyword(repo, displayNames, 'integrated-platform'), true);
  assert.equal(matchesRepoKeyword(repo, displayNames, 'SHUZHI'), true);
  assert.equal(matchesRepoKeyword(repo, displayNames, '不存在'), false);
});

test('清空显示名称后恢复展示真实仓库名', () => {
  const renamed = setRepoDisplayName({}, repo.path, '业财融合一体化平台');
  const restored = setRepoDisplayName(renamed, repo.path, '   ');

  assert.equal(getRepoDisplayName(repo, restored), repo.name);
  assert.deepEqual(restored, {});
});

test('从配置恢复显示名称时忽略无效值并统一路径大小写', () => {
  assert.deepEqual(
    normalizeRepoDisplayNames({
      ' D:/PROJECT/ONE ': ' 项目一 ',
      'D:/project/two': '',
      'D:/project/three': 123,
    }),
    { 'd:/project/one': '项目一' },
  );
});
