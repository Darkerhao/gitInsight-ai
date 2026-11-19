import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileFunction } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/renderer/src/utils/clipboard.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });

function setup(clipboard) {
  const messages = [];
  const exports = {};
  compileFunction(outputText, ['require', 'exports', 'navigator'])(() => ({ ElMessage: {
    success: text => messages.push(['success', text]),
    warning: text => messages.push(['warning', text]),
    error: text => messages.push(['error', text]),
  } }), exports, { clipboard });
  return { copyText: exports.copyText, messages };
}

test('copy writes the original content and reports success', async () => {
  const copied = [];
  const { copyText, messages } = setup({ writeText: async value => copied.push(value) });
  await copyText(' 正文\n内容 ', '日报已复制');
  assert.deepEqual(copied, [' 正文\n内容 ']);
  assert.deepEqual(messages, [['success', '日报已复制']]);
});

test('empty content never calls the clipboard', async () => {
  const { copyText, messages } = setup({ writeText: () => assert.fail('empty content must not be copied') });
  await copyText(' \n ', '日报已复制');
  assert.deepEqual(messages, [['warning', '没有可复制的内容']]);
});

test('rejected or unavailable clipboard resolves with a useful failure message', async () => {
  for (const clipboard of [undefined, { writeText: async () => { throw new Error('permission denied'); } }]) {
    const { copyText, messages } = setup(clipboard);
    await copyText('保留正文', '日报已复制');
    assert.deepEqual(messages, [['error', '复制失败，请手动选择内容复制']]);
  }
});
