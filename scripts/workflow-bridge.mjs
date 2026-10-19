// Development-only authenticated loopback client for the requested real-agent workflow.
// Not imported by production or included in the package. All results remain in RAM.

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const token = randomUUID(),
  clients = new Map();
async function makeClient() {
  const client = new Client({ name: 'real-agent-visual-workflow', version: '0.2.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/cli.js'), 'serve'],
      env: { ...process.env, MIMICUS_DEV_MODE: '1', MIMICUS_DEV_ORIGINS: 'http://127.0.0.1:45812' },
      stderr: 'pipe',
    }),
  );
  return client;
}
const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.headers.authorization !== token || req.method !== 'POST') {
    res.writeHead(403);
    res.end('{}');
    return;
  }
  try {
    let body = '';
    for await (const part of req) {
      body += part;
      if (body.length > 100000) throw new Error('Input too large');
    }
    const input = JSON.parse(body),
      key = String(input.client ?? 'root').slice(0, 40);
    if (input.close) {
      await clients.get(key)?.close();
      clients.delete(key);
      res.end(JSON.stringify({ closed: true }));
      return;
    }
    let client = clients.get(key);
    if (!client) {
      client = await makeClient();
      clients.set(key, client);
    }
    const result = input.list
      ? await client.listTools()
      : await client.callTool(
          { name: input.name, arguments: input.arguments ?? {} },
          { timeout: 120000 },
        );
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: String(e) }));
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
console.log(JSON.stringify({ port: server.address().port, token }));
async function stop() {
  server.close();
  await Promise.allSettled([...clients.values()].map((c) => c.close()));
  clients.clear();
}
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
