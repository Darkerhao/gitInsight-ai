import assert from 'node:assert/strict';
import test from 'node:test';
import { testAiConnection } from '../electron/main/aiClient.js';

test('testAiConnection 使用当前配置调用模型并返回连接耗时', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;

  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const result = await testAiConnection({
      baseUrl: ' https://api.example.com/v1/ ',
      apiKey: ' sk-current-form ',
      model: ' demo-model ',
    });

    assert.equal(requestedUrl, 'https://api.example.com/v1/chat/completions');
    assert.equal(new Headers(requestedInit?.headers).get('Authorization'), 'Bearer sk-current-form');
    assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
      model: 'demo-model',
      messages: [{ role: 'user', content: 'ping' }],
      temperature: 0,
      max_tokens: 1,
      stream: false,
    });
    assert.equal(result.success, true);
    assert.match(result.message, /demo-model/);
    assert.ok(result.latencyMs >= 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testAiConnection 缺少必要配置时不发起请求', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response('{}');
  };

  try {
    const result = await testAiConnection({ baseUrl: '', apiKey: 'key', model: 'model' });
    assert.equal(result.success, false);
    assert.equal(result.latencyMs, 0);
    assert.match(result.message, /请先填写/);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testAiConnection 将服务端错误转换为可读失败结果', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'invalid api key' } }), {
    status: 401,
    statusText: 'Unauthorized',
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const result = await testAiConnection({ baseUrl: 'https://api.example.com/v1', apiKey: 'bad-key', model: 'demo-model' });
    assert.equal(result.success, false);
    assert.match(result.message, /invalid api key/);
    assert.ok(result.latencyMs >= 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testAiConnection 不将空 choices 响应判定为成功', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [] }), { status: 200 });

  try {
    const result = await testAiConnection({ baseUrl: 'https://api.example.com/v1', apiKey: 'key', model: 'demo-model' });
    assert.equal(result.success, false);
    assert.match(result.message, /返回格式/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testAiConnection 将包含 choice 但正文为空的响应判定为连接成功', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: '', reasoning_content: '' }, finish_reason: 'length' }],
  }), { status: 200 });

  try {
    const result = await testAiConnection({ baseUrl: 'https://api.deepseek.com', apiKey: 'key', model: 'deepseek-v4-pro' });
    assert.equal(result.success, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testAiConnection 将 HTML 页面响应识别为接口地址错误', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<!doctype html><html><body>Tokeness</body></html>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

  try {
    const result = await testAiConnection({ baseUrl: 'https://tokeness.io', apiKey: 'key', model: 'demo-model' });
    assert.equal(result.success, false);
    assert.match(result.message, /返回了 HTML 页面而不是 JSON/);
    assert.match(result.message, /https:\/\/tokeness\.io\/chat\/completions/);
    assert.match(result.message, /\/v1/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('testAiConnection 将服务端 524 转换为上游超时提示', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('error code: 524', { status: 524, statusText: 'A Timeout Occurred' });

  try {
    const result = await testAiConnection({ baseUrl: 'https://api.example.com', apiKey: 'key', model: 'demo-model' });
    assert.equal(result.success, false);
    assert.match(result.message, /上游响应超时/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

