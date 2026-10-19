import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Config } from '../config.js';
import { NetworkPolicy } from './network.js';
export type HttpEvidence = {
  status: number;
  headers: Record<string, string>;
  body: string;
  url: string;
};
/** Node HTTP client pins the validated IP and preserves TLS hostname validation.
 * Each redirect is independently checked; no credentials/cookies are forwarded. */
export async function guardedFetch(
  config: Config,
  url: string,
  headers: Record<string, string> = {},
  redirects = 0,
  method: 'GET' | 'HEAD' = 'GET',
  maxBytes = 1000000,
  signal?: AbortSignal,
): Promise<HttpEvidence> {
  return requestPinned(
    config,
    url,
    headers,
    redirects,
    method,
    undefined,
    Math.min(5000000, maxBytes),
    signal,
  );
}
async function requestPinned(
  config: Config,
  url: string,
  headers: Record<string, string>,
  redirects: number,
  method: string,
  body: string | undefined,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<HttpEvidence> {
  signal?.throwIfAborted();
  const target = await new NetworkPolicy(config).target(url);
  signal?.throwIfAborted();
  const result = await new Promise<HttpEvidence>((resolve, reject) => {
    const transport = target.url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = transport(
      {
        hostname: target.address,
        family: target.family,
        servername: target.url.hostname,
        port: target.url.port || (target.url.protocol === 'https:' ? 443 : 80),
        path: target.url.pathname + target.url.search,
        method,
        maxHeaderSize: 65536,
        headers: {
          ...headers,
          host: target.url.host,
          'user-agent': 'mcp-mimicus/0.2 (permitted metadata discovery)',
          'accept-encoding': 'identity',
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (b: Buffer) => {
          bytes += b.length;
          if (bytes > maxBytes) request.destroy(new Error('Metadata response exceeds byte bound'));
          else chunks.push(b);
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: Object.fromEntries(
              Object.entries(response.headers).map(([k, v]) => [
                k,
                Array.isArray(v) ? v.join(',') : (v ?? ''),
              ]),
            ),
            body: Buffer.concat(chunks).toString('utf8'),
            url: target.url.href,
          }),
        );
        response.on('error', reject);
      },
    );
    const abort = () => request.destroy(new Error('Metadata fetch aborted'));
    const deadline = setTimeout(
      () => request.destroy(new Error('Metadata fetch absolute deadline exceeded')),
      Math.min(config.timeoutMs, 15000),
    );
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    request.once('close', () => {
      clearTimeout(deadline);
      signal?.removeEventListener('abort', abort);
    });
    request.setTimeout(Math.min(config.timeoutMs, 15000), () =>
      request.destroy(new Error('Metadata fetch timed out')),
    );
    request.on('error', reject);
    request.end(body);
  });
  if (
    result.status >= 300 &&
    result.status < 400 &&
    result.status !== 304 &&
    result.headers.location
  ) {
    if (method === 'POST' || redirects >= 3) throw new Error('Metadata redirect refused');
    return requestPinned(
      config,
      new URL(result.headers.location, url).href,
      headers,
      redirects + 1,
      method,
      body,
      maxBytes,
      signal,
    );
  }
  return result;
}

/** Only the official read-only showcase MCP endpoint may receive protocol POSTs.
 * This does not expand the browser or generic fetch write-method policy. */
export function showcaseMcpFetch(config: Config, signal?: AbortSignal): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input),
      u = new URL(url);
    if (
      url !== 'https://threejsresources.com/api/mcp' &&
      !(config.developmentOrigins.includes(u.origin) && u.pathname === '/mcp')
    )
      throw new Error('MCP endpoint outside reviewed scope');
    const method = init?.method ?? 'GET';
    if (method === 'DELETE') return new Response(null, { status: 405 });
    const body = typeof init?.body === 'string' ? init.body : undefined;
    if (method === 'POST') {
      if (!body || body.length > 64000) throw new Error('Invalid bounded MCP request');
      const rpc = JSON.parse(body);
      if (
        !['initialize', 'notifications/initialized', 'tools/list', 'tools/call', 'ping'].includes(
          rpc.method,
        )
      )
        throw new Error('MCP method outside read-only scope');
      if (
        rpc.method === 'tools/call' &&
        !['threejs_list_taxonomy', 'threejs_search_showcase'].includes(rpc.params?.name)
      )
        throw new Error('MCP tool outside reviewed read-only scope');
    } else if (method !== 'GET') throw new Error('MCP method refused');
    init?.signal?.throwIfAborted();
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    for (const key of Object.keys(headers))
      if (
        ![
          'accept',
          'content-type',
          'mcp-session-id',
          'mcp-protocol-version',
          'last-event-id',
        ].includes(key.toLowerCase())
      )
        delete headers[key];
    const requestSignal =
      signal && init?.signal
        ? AbortSignal.any([signal, init.signal])
        : (signal ?? init?.signal ?? undefined);
    const r = await requestPinned(config, url, headers, 0, method, body, 3000000, requestSignal);
    return new Response([202, 204, 304].includes(r.status) ? null : r.body, {
      status: r.status,
      headers: r.headers,
    });
  }) as typeof fetch;
}
