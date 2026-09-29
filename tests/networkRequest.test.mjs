import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../electron/main/networkRequest.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { fetchWithTimeout } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);

async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('timeout includes a response body that stalls after headers', async t => {
  const url = await serve(t, (_req, res) => { res.writeHead(200); res.write('{'); });
  await assert.rejects(fetchWithTimeout(url, {}, 80), /超时/);
});

test('timeout bounds a server that never sends headers', async t => {
  const url = await serve(t, () => {});
  await assert.rejects(fetchWithTimeout(url, {}, 80), /超时/);
});

test('caller cancellation aborts active request and preserves reason', async t => {
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const url = await serve(t, () => started());
  const controller = new AbortController();
  const request = fetchWithTimeout(url, { signal: controller.signal });
  await ready;
  controller.abort(new Error('已取消生成'));
  await assert.rejects(request, /已取消生成/);
});

test('already canceled request never reaches the transport', async () => {
  const signal = AbortSignal.abort(new Error('已取消生成'));
  let calls = 0;
  await assert.rejects(fetchWithTimeout('http://unused', { signal }, 100, async () => { calls++; return new Response('{}'); }), /已取消生成/);
  assert.equal(calls, 0);
});

test('successful and failed HTTP responses preserve JSON and status', async t => {
  const url = await serve(t, (_req, res) => { res.writeHead(429, { 'Content-Type': 'application/json' }); res.end('{"error":"rate limit"}'); });
  const response = await fetchWithTimeout(url);
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { error: 'rate limit' });
});
