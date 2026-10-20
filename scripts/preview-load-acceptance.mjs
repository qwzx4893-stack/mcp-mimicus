// Controlled load, not a live-provider benchmark. SDK transport and owned browsers are real.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fixture } from '../test/helpers.mjs';

const f = await fixture();
const client = new Client({ name: 'preview-concurrency-campaign', version: '1.1.0' });
const report = {
  at: new Date().toISOString(),
  method:
    'Owned HTTP source and page, real SDK stdio and installed browsers; no public services load-tested',
  sourceSearches: 0,
  sourceHttpHits: 0,
  waves: [],
  samples: [],
  status: 'RUNNING',
};
let sampling = false,
  sampler;
const call = async (name, args = {}, options = {}) => {
  const r = await client.callTool({ name, arguments: args }, { timeout: 90000, ...options });
  if (r.isError)
    throw Error(
      r.content
        .filter((x) => x.type === 'text')
        .map((x) => x.text)
        .join(' ')
        .slice(0, 500),
    );
  return { data: r.structuredContent.data, images: r.content.filter((x) => x.type === 'image') };
};
try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('test/sdk-server.mjs')],
      env: { ...process.env, MIMICUS_TEST_ORIGIN: f.origin },
      stderr: 'pipe',
    }),
  );
  report.server = client.getServerVersion();
  for (let wave = 0; wave < 15; wave++) {
    const items = await Promise.all(
      Array.from({ length: 8 }, () =>
        call('mimicus_search', { providers: ['nuxt'], retrieval: 'lexical', limit: 1 }),
      ),
    );
    assert.ok(items.every((x) => x.data.results.length === 1));
    report.sourceSearches += items.length;
    await call('mimicus_end_discovery', { operationIds: items.map((x) => x.data.operationId) });
    assert.equal((await call('mimicus_list_sources')).data.federation.activeOperations, 0);
  }
  report.sourceHttpHits = f.hits.filter((x) => x === '/source').length;
  assert.equal(report.sourceHttpHits, 120);
  sampling = true;
  sampler = (async () => {
    while (sampling) {
      const { browser } = (await call('mimicus_list_sources')).data;
      report.samples.push({
        active: browser.activeSessions,
        opening: browser.opening,
        closing: browser.closingSessions,
      });
      assert.ok(
        browser.activeSessions <= browser.sessionLimit && browser.opening <= browser.sessionLimit,
      );
      await delay(100);
    }
  })();
  // Observe any sampler failure immediately; awaiting it below still preserves the verdict.
  void sampler.catch(() => {
    sampling = false;
  });
  for (let wave = 0; wave < 6; wave++) {
    const batches = await Promise.all(
      Array.from({ length: 6 }, () =>
        call('mimicus_preview_references', {
          references: [{ url: f.url, authorized: true }],
          waitForReadyMs: 0,
          perReferenceTimeoutMs: 20000,
          budgetMs: 30000,
        }),
      ),
    );
    const items = batches.flatMap((x) => x.data.references);
    report.waves.push({
      requests: 6,
      images: batches.reduce((n, x) => n + x.images.length, 0),
      outcomes: items.map((x) => ({ status: x.status, failureCode: x.failureCode ?? null })),
    });
    const { browser } = (await call('mimicus_list_sources')).data;
    assert.equal(browser.activeSessions, 0);
    assert.equal(browser.opening, 0);
    assert.equal(browser.closingSessions, 0);
  }
  assert.ok(report.waves.reduce((n, w) => n + w.images, 0) >= 6);
  f.setHtml(
    '<!doctype html><title>Owned cancellation</title><h1>Waiting example</h1><div id="loader" style="position:fixed;inset:0;background:#111;color:white">Loading</div>',
  );
  const controller = new AbortController();
  const interrupted = call(
    'mimicus_preview_references',
    {
      references: [{ url: f.url, authorized: true }],
      waitForReadyMs: 5000,
      perReferenceTimeoutMs: 20000,
    },
    { signal: controller.signal },
  );
  const cancelled = interrupted.then(
    () => false,
    () => true,
  );
  for (let n = 0; n < 80; n++) {
    if ((await call('mimicus_list_sources')).data.browser.activeSessions) break;
    await delay(50);
  }
  controller.abort(new Error('SDK caller cancelled readiness'));
  report.transportCancellationObserved = await cancelled;
  assert.equal(report.transportCancellationObserved, true);
  for (let n = 0; n < 100; n++) {
    const { browser } = (await call('mimicus_list_sources')).data;
    if (!browser.activeSessions && !browser.opening && !browser.closingSessions) break;
    await delay(50);
  }
  sampling = false;
  await sampler;
  const final = (await call('mimicus_list_sources')).data;
  report.final = { browser: final.browser, federation: final.federation };
  for (const k of ['activeSessions', 'opening', 'closingSessions', 'temporaryAnalyses'])
    assert.equal(final.browser[k], 0);
  for (const k of [
    'activeOperations',
    'retainedReferences',
    'pendingRankedCandidates',
    'pendingSemanticCandidates',
  ])
    assert.equal(final.federation[k], 0);
  assert.deepEqual(final.browser.maintenanceErrors, []);
  report.status = 'PASS';
} catch (e) {
  report.status = 'FAIL';
  report.error = e instanceof Error ? e.message : String(e);
  process.exitCode = 1;
} finally {
  sampling = false;
  await sampler?.catch(() => {});
  await client.close();
  await f.close();
  report.finishedAt = new Date().toISOString();
  mkdirSync('artifacts/preview-readiness', { recursive: true });
  writeFileSync('artifacts/preview-readiness/load.json', JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: report.status,
      searches: report.sourceSearches,
      waves: report.waves.length,
      error: report.error,
    }),
  );
}
