import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { Config } from '../../config.js';
import { showcaseMcpFetch } from '../../security/fetch.js';
export async function withThreeResources<T>(
  config: Config,
  fn: (client: Client) => Promise<T>,
  endpoint = 'https://threejsresources.com/api/mcp',
  signal?: AbortSignal,
) {
  const client = new Client({ name: 'mcp-mimicus-live-federation', version: '0.2.0' });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL(endpoint), {
        fetch: showcaseMcpFetch(config, signal),
        requestInit: { redirect: 'error' },
      }),
    );
    return await fn(client);
  } finally {
    await client.close();
  }
}
export function toolData(result: any) {
  if (result.isError)
    throw new Error('Official MCP tool error: ' + JSON.stringify(result.content).slice(0, 400));
  if (result.structuredContent) return result.structuredContent;
  const text = result.content
    ?.filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n');
  if (!text) throw new Error('MCP result has no data');
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}
