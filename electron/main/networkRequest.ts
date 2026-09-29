type RequestTransport = (url: string, init?: RequestInit) => Promise<Response>;

/** Current integrations return small, non-streaming JSON; include body reads in the deadline. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 60_000,
  transport: RequestTransport = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const cancel = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) cancel();
  init.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('请求超时，请检查网络状态', 'TimeoutError')), timeoutMs);
  try {
    controller.signal.throwIfAborted();
    const response = await transport(url, { ...init, signal: controller.signal });
    const body = await response.arrayBuffer();
    controller.signal.throwIfAborted();
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  } catch (error) {
    controller.signal.throwIfAborted();
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancel);
  }
}
