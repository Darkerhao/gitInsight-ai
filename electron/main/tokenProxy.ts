import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { ProxyTarget, RepoInfo, TokenProxyConfig, TokenProxyStatus } from '../../src/shared/types.js';
import { DEFAULT_TOKEN_PROXY_CONFIG } from '../../src/shared/types.js';
import { loadConfig } from './config.js';
import { recordApiUsage } from './tokenUsageDb.js';

type ExtractedUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  model?: string;
};

let proxyServer: ReturnType<typeof createServer> | null = null;
let proxyRequestCount = 0;
let proxyPort = 0;

export function getTokenProxyStatus(): TokenProxyStatus {
  return {
    running: proxyServer !== null && proxyServer.listening,
    port: proxyPort,
    requestCount: proxyRequestCount,
  };
}

function matchTarget(pathname: string, targets: ProxyTarget[]): { target: ProxyTarget; remainingPath: string } | null {
  for (const target of targets) {
    const prefix = target.pathPrefix.replace(/\/+$/u, '');
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const remainingPath = pathname.slice(prefix.length) || '/';
      return { target, remainingPath };
    }
  }
  return null;
}

function matchProject(requestBody: string, knownRepos: RepoInfo[]): { name: string; path: string } | null {
  for (const repo of knownRepos) {
    const forwardSlashPath = repo.path.replace(/\\/gu, '/');
    if (requestBody.includes(forwardSlashPath) || requestBody.includes(repo.path)) {
      return repo;
    }
  }
  for (const repo of knownRepos) {
    if (requestBody.includes(`${repo.name}/`)) {
      return repo;
    }
  }
  return null;
}

function readTokenCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function emptyUsage(): ExtractedUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };
}

function usageHasTokens(usage: ExtractedUsage) {
  return (
    usage.inputTokens > 0 ||
    usage.outputTokens > 0 ||
    usage.cacheReadTokens > 0 ||
    usage.cacheCreationTokens > 0 ||
    usage.totalTokens > 0
  );
}

function normalizeUsage(input: {
  rawInputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  inputIncludesCacheRead?: boolean;
  model?: string;
}): ExtractedUsage {
  const cacheReadTokens = input.cacheReadTokens ?? 0;
  const cacheCreationTokens = input.cacheCreationTokens ?? 0;
  const freshInputTokens = input.inputIncludesCacheRead
    ? Math.max(input.rawInputTokens - cacheReadTokens, 0)
    : input.rawInputTokens;
  const promptTokens = input.inputIncludesCacheRead
    ? input.rawInputTokens
    : input.rawInputTokens + cacheReadTokens + cacheCreationTokens;
  const totalTokens = freshInputTokens + input.outputTokens + cacheReadTokens + cacheCreationTokens;

  return {
    promptTokens,
    completionTokens: input.outputTokens,
    totalTokens,
    cachedTokens: cacheReadTokens,
    inputTokens: freshInputTokens,
    outputTokens: input.outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    model: input.model,
  };
}

function isAnthropicMessage(data: any) {
  return (
    data?.type === 'message' ||
    data?.type === 'message_start' ||
    data?.type === 'message_delta' ||
    (typeof data?.id === 'string' && data.id.startsWith('msg_')) ||
    (data?.role === 'assistant' && Array.isArray(data?.content) && !data?.choices)
  );
}

function extractUsage(data: any): ExtractedUsage {
  if (!data || typeof data !== 'object') return emptyUsage();

  if (data.response && typeof data.response === 'object') {
    return extractUsage(data.response);
  }

  const usageMetadata = data.usageMetadata;
  if (usageMetadata && typeof usageMetadata === 'object') {
    const rawInputTokens = readTokenCount(usageMetadata.promptTokenCount);
    const totalTokenCount = readTokenCount(usageMetadata.totalTokenCount);
    const outputTokens = readTokenCount(usageMetadata.candidatesTokenCount) || Math.max(totalTokenCount - rawInputTokens, 0);
    return normalizeUsage({
      rawInputTokens,
      outputTokens,
      cacheReadTokens: readTokenCount(usageMetadata.cachedContentTokenCount),
      inputIncludesCacheRead: true,
      model: typeof data.modelVersion === 'string' ? data.modelVersion : undefined,
    });
  }

  const usage = data.usage;
  if (!usage || typeof usage !== 'object') return emptyUsage();

  if (usage.prompt_tokens != null || usage.completion_tokens != null) {
    return normalizeUsage({
      rawInputTokens: readTokenCount(usage.prompt_tokens),
      outputTokens: readTokenCount(usage.completion_tokens),
      cacheReadTokens: readTokenCount(
        usage.prompt_tokens_details?.cached_tokens ??
          usage.cache_read_input_tokens ??
          usage.prompt_cache_hit_tokens,
      ),
      cacheCreationTokens: readTokenCount(usage.cache_creation_input_tokens),
      inputIncludesCacheRead: true,
      model: typeof data.model === 'string' ? data.model : undefined,
    });
  }

  if (usage.input_tokens != null || usage.output_tokens != null) {
    const anthropic = isAnthropicMessage(data);
    return normalizeUsage({
      rawInputTokens: readTokenCount(usage.input_tokens),
      outputTokens: readTokenCount(usage.output_tokens),
      cacheReadTokens: readTokenCount(
        usage.cache_read_input_tokens ??
          usage.input_tokens_details?.cached_tokens ??
          usage.prompt_cache_hit_tokens,
      ),
      cacheCreationTokens: readTokenCount(usage.cache_creation_input_tokens),
      inputIncludesCacheRead: !anthropic,
      model: typeof data.model === 'string' ? data.model : undefined,
    });
  }

  return emptyUsage();
}

function mergeUsage(current: ExtractedUsage, next: ExtractedUsage) {
  if (!usageHasTokens(next)) return current;

  const merged: ExtractedUsage = { ...current };
  if (next.inputTokens > 0 && (merged.inputTokens === 0 || next.inputTokens <= merged.inputTokens)) {
    merged.inputTokens = next.inputTokens;
  }
  if (next.outputTokens > 0) merged.outputTokens = next.outputTokens;
  if (next.cacheReadTokens > 0) merged.cacheReadTokens = next.cacheReadTokens;
  if (next.cacheCreationTokens > 0) merged.cacheCreationTokens = next.cacheCreationTokens;
  if (next.promptTokens > 0) merged.promptTokens = next.promptTokens;
  if (next.completionTokens > 0) merged.completionTokens = next.completionTokens;
  if (next.model) merged.model = next.model;

  merged.cachedTokens = merged.cacheReadTokens;
  merged.completionTokens = merged.completionTokens || merged.outputTokens;
  merged.promptTokens = merged.promptTokens || merged.inputTokens + merged.cacheReadTokens + merged.cacheCreationTokens;
  merged.totalTokens = merged.inputTokens + merged.outputTokens + merged.cacheReadTokens + merged.cacheCreationTokens;
  return merged;
}

function extractStreamingUsage(chunks: string): ExtractedUsage {
  const state = emptyUsage();
  const lines = chunks.split(/\r?\n/u).filter((line) => line.startsWith('data: '));

  for (const line of lines) {
    const jsonStr = line.slice(6).trim();
    if (!jsonStr || jsonStr === '[DONE]') continue;
    try {
      const event = JSON.parse(jsonStr);

      if (event?.response) {
        const responseUsage = extractUsage(event.response);
        if (usageHasTokens(responseUsage)) return responseUsage;
      }

      if (event?.message?.usage) {
        Object.assign(state, mergeUsage(state, extractUsage({
          type: 'message',
          id: event.message.id,
          model: event.message.model,
          role: event.message.role,
          content: event.message.content,
          usage: event.message.usage,
        })));
      }

      if (event?.usage) {
        Object.assign(state, mergeUsage(state, extractUsage(event)));
      }
    } catch {
      continue;
    }
  }

  return usageHasTokens(state) ? state : emptyUsage();
}

function getProviderHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

async function handleProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  targets: ProxyTarget[],
) {
  const pathname = req.url || '/';
  const matched = matchTarget(pathname, targets);
  if (!matched) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `没有匹配的转发规则：${pathname}` }));
    return;
  }

  const { target, remainingPath } = matched;
  const targetUrl = `${target.targetBaseUrl.replace(/\/+$/u, '')}${remainingPath}`;
  const bodyChunks: Buffer[] = [];
  for await (const chunk of req) {
    bodyChunks.push(chunk as Buffer);
  }
  const bodyBuffer = Buffer.concat(bodyChunks);
  const bodyStr = bodyBuffer.toString('utf-8');

  let requestModel = '';
  try {
    const parsed = JSON.parse(bodyStr);
    requestModel = String(parsed?.model || '');
  } catch {
    // Non-JSON requests can still be forwarded, but they will not have model attribution.
  }

  const currentConfig = await loadConfig();
  const knownRepos: RepoInfo[] = currentConfig.selectedRepoPaths.map((path) => ({
    name: path.replace(/\\/gu, '/').split('/').pop() || path,
    path,
  }));
  const project = matchProject(bodyStr, knownRepos);
  const startTime = Date.now();

  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key === 'host' || key === 'connection') continue;
    if (typeof value === 'string') forwardHeaders[key] = value;
    else if (Array.isArray(value)) forwardHeaders[key] = value.join(', ');
  }
  if (target.apiKey) {
    forwardHeaders.authorization = `Bearer ${target.apiKey}`;
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method || 'POST',
      headers: forwardHeaders,
      body: bodyBuffer,
    });

    const responseHeaders: Record<string, string> = {};
    upstreamResponse.headers.forEach((value, key) => {
      if (key !== 'transfer-encoding' && key !== 'content-encoding') {
        responseHeaders[key] = value;
      }
    });

    const isStreaming = upstreamResponse.headers.get('content-type')?.includes('text/event-stream');

    if (isStreaming && upstreamResponse.body) {
      res.writeHead(upstreamResponse.status, responseHeaders);

      const reader = upstreamResponse.body.getReader();
      const decoder = new TextDecoder();
      let allChunks = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          allChunks += text;
          res.write(value);
        }
      } finally {
        res.end();
      }

      const usage = extractStreamingUsage(allChunks);
      const durationMs = Date.now() - startTime;
      proxyRequestCount++;

      await recordApiUsage({
        source: 'proxy',
        projectName: project?.name,
        projectPath: project?.path,
        provider: getProviderHost(target.targetBaseUrl),
        ...usage,
        model: usage.model || requestModel,
        requestPath: remainingPath,
        durationMs,
      });
      return;
    }

    const responseBody = await upstreamResponse.arrayBuffer();
    const responseBuffer = Buffer.from(responseBody);
    responseHeaders['content-length'] = String(responseBuffer.length);

    res.writeHead(upstreamResponse.status, responseHeaders);
    res.end(responseBuffer);

    let usage = emptyUsage();
    try {
      usage = extractUsage(JSON.parse(responseBuffer.toString('utf-8')));
    } catch {
      // Non-JSON response body has no usage payload.
    }

    const durationMs = Date.now() - startTime;
    proxyRequestCount++;

    await recordApiUsage({
      source: 'proxy',
      projectName: project?.name,
      projectPath: project?.path,
      provider: getProviderHost(target.targetBaseUrl),
      ...usage,
      model: usage.model || requestModel,
      requestPath: remainingPath,
      durationMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `代理转发失败：${message}` }));
  }
}

export async function startTokenProxy(proxyConfig: TokenProxyConfig): Promise<{ port: number }> {
  if (proxyServer?.listening) {
    await stopTokenProxy();
  }

  const port = proxyConfig.port || DEFAULT_TOKEN_PROXY_CONFIG.port;

  return new Promise((resolve, reject) => {
    proxyServer = createServer((req, res) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        });
        res.end();
        return;
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      handleProxyRequest(req, res, proxyConfig.targets).catch((error) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
    });

    proxyServer.on('error', (error) => {
      reject(new Error(`代理启动失败（端口 ${port}）：${error.message}`));
    });

    proxyServer.listen(port, '127.0.0.1', () => {
      proxyPort = port;
      proxyRequestCount = 0;
      resolve({ port });
    });
  });
}

export async function stopTokenProxy() {
  return new Promise<void>((resolve) => {
    if (!proxyServer) {
      resolve();
      return;
    }
    proxyServer.close(() => {
      proxyServer = null;
      resolve();
    });
  });
}
