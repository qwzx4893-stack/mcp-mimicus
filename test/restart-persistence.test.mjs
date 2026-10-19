import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { cleanup, fixture, temporary } from './helpers.mjs';

test('Two real SDK process lifetimes with isolated HOME/CWD/TEMP leave no website store or restart cache', {
  timeout: 120000,
}, async () => {
  const f = await fixture(),
    dir = temporary();
  let previousOperation;
  try {
    for (let round = 0; round < 2; round++) {
      const client = new Client({ name: 'isolated-restart-acceptance', version: '0.3.0' });
      try {
        await client.connect(
          new StdioClientTransport({
            command: process.execPath,
            args: [resolve('test/sdk-server.mjs')],
            cwd: dir,
            env: {
              ...process.env,
              HOME: dir,
              USERPROFILE: dir,
              TEMP: dir,
              TMP: dir,
              TMPDIR: dir,
              MIMICUS_TEST_ORIGIN: f.origin,
            },
            stderr: 'pipe',
          }),
        );
        const call = async (name, args = {}) => {
          const result = await client.callTool({ name, arguments: args }, { timeout: 90000 });
          assert.notEqual(result.isError, true, JSON.stringify(result.content));
          return result.structuredContent.data;
        };
        if (previousOperation) {
          const stale = await client.callTool({
            name: 'mimicus_get_reference',
            arguments: { operationId: previousOperation, referenceId: 'expired-reference' },
          });
          assert.equal(stale.isError, true);
        }
        const found = await call('mimicus_search', {
          providers: ['nuxt'],
          query: 'editorial',
          retrieval: 'lexical',
          limit: 1,
        });
        assert.match(found.results[0].title, new RegExp('revision ' + (round + 1)));
        previousOperation = found.operationId;
        const opened = await call('mimicus_open_reference', {
          operationId: found.operationId,
          referenceId: found.results[0].id,
          authorized: true,
        });
        await call('mimicus_analyze_element', {
          sessionId: opened.sessionId,
          selector: '#reveal',
          trigger: 'hover',
        });
        await call('mimicus_close_session', { sessionId: opened.sessionId });
        await call('mimicus_end_discovery', { operationId: found.operationId });
      } finally {
        await client.close();
      }
      assert.deepEqual(
        readdirSync(dir),
        [],
        'No site catalog, screenshot, vector file or browser profile survives graceful shutdown; leftovers: ' +
          JSON.stringify(
            (function inspect(root, relative = '') {
              return readdirSync(join(root, relative), { withFileTypes: true }).flatMap((e) => {
                const name = join(relative, e.name);
                return e.isDirectory()
                  ? [{ directory: name }, ...inspect(root, name)]
                  : [{ file: name, bytes: statSync(join(root, name)).size }];
              });
            })(dir),
          ),
      );
      f.advance();
    }
    assert.equal(f.hits.filter((h) => h === '/source').length, 2);
  } finally {
    await f.close();
    cleanup(dir);
  }
});
