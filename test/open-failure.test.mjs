import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigSchema } from '../dist/config.js';
import { createMcpServer, Mimicus } from '../dist/server.js';

test('Failed first capture closes the session whose identifier cannot reach the caller', async () => {
  const app = new Mimicus(ConfigSchema.parse({ semanticEnabled: false }));
  const active = new Set();
  app.browser.open = async () => {
    active.add('owned-session');
    return { sessionId: 'owned-session' };
  };
  app.browser.capture = async () => {
    throw new Error('Owned screenshot failure');
  };
  app.browser.close = async (id) => {
    active.delete(id);
    return { closed: true };
  };
  const server = createMcpServer(app);
  try {
    const result = await server._registeredTools.mimicus_open_reference.handler(
      { authorized: true, url: 'https://owned.example/' },
      { mcpReq: { signal: new AbortController().signal } },
    );
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Owned screenshot failure/);
    assert.equal(active.size, 0);
  } finally {
    await server.close();
    await app.close();
  }
});
