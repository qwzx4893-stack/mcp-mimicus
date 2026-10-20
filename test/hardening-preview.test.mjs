import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('Actual stdio multi-preview preserves distinct image/source order, diagnoses gates and closes every owned browser', {
  timeout: 120000,
}, async () => {
  const server = createServer((req, res) => {
    if (req.url === '/robots.txt') {
      res.end('User-agent: *\nDisallow: /blocked\nAllow: /');
      return;
    }
    if (req.url === '/missing.png') {
      res.writeHead(404);
      res.end();
      return;
    }
    const n = Number(req.url?.match(/\d/)?.[0] ?? 0),
      color = ['#294fc7', '#a43d29', '#197455', '#7637a2'][n % 4];
    res.setHeader('content-type', 'text/html');
    res.end(
      `<!doctype html><title>Owned preview ${n}</title><body style="background:${color};color:white;font:48px system-ui"><h1>Reference ${n}</h1><nav>Distinct owned layout ${n}</nav>${req.url === '/loader' ? '<div aria-busy="true" style="position:fixed;inset:0;background:#111">Loading</div>' : ''}${req.url === '/key' ? '<input type="password" aria-label="Key">' : ''}${req.url === '/asset' ? '<img src="/missing.png" width="300" height="200" alt="Unavailable test asset">' : ''}</body>`,
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const client = new Client({ name: 'actual-multi-preview-regression', version: '1.0.0' });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [resolve('test/sdk-server.mjs')],
        env: { ...process.env, MIMICUS_TEST_ORIGIN: origin },
        stderr: 'pipe',
      }),
    );
    const call = async (name, args = {}) => {
      const r = await client.callTool({ name, arguments: args }, { timeout: 110000 });
      assert.notEqual(r.isError, true, JSON.stringify(r.content));
      return r;
    };
    const first = await call('mimicus_preview_references', {
      references: [0, 1, 2, 3].map((n) => ({
        url: origin + '/p' + n,
        referenceUrl: 'https://owned-test.example/source/' + n,
        authorized: true,
      })),
    });
    const data = first.structuredContent.data,
      images = first.content.filter((x) => x.type === 'image');
    assert.equal(images.length, 4);
    assert.equal(data.capturedImages, 4);
    assert.equal(
      new Set(images.map((i) => createHash('sha256').update(i.data).digest('hex'))).size,
      4,
    );
    data.references.forEach((r, i) => {
      assert.equal(r.imageIndex, i);
      assert.equal(r.url, origin + '/p' + i);
      assert.equal(r.attribution.referenceUrl, 'https://owned-test.example/source/' + i);
      assert.equal(r.status, 'captured');
    });
    const negative = await call('mimicus_preview_references', {
      references: ['blocked', 'loader', 'key', 'asset'].map((path) => ({
        url: origin + '/' + path,
        authorized: true,
      })),
    });
    const refs = negative.structuredContent.data.references;
    assert.equal(refs[0].status, 'blocked');
    assert.equal(refs[0].imageIndex, null);
    assert.equal(refs[1].status, 'partial-render');
    assert.match(refs[1].reasons.join(' '), /loading/);
    assert.equal(refs[2].status, 'partial-render');
    assert.match(refs[2].reasons.join(' '), /password|key/);
    assert.equal(refs[3].status, 'partial-render');
    assert.match(refs[3].reasons.join(' '), /images/);
    assert.deepEqual(
      refs.slice(1).map((r) => r.imageIndex),
      [0, 1, 2],
    );
    const status = (await call('mimicus_list_sources')).structuredContent.data.browser;
    assert.equal(status.activeSessions, 0);
    assert.equal(status.closingSessions, 0);
    assert.equal(status.opening, 0);
  } finally {
    await client.close();
    await new Promise((r) => server.close(r));
  }
});
