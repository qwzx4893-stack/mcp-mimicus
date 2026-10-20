// Explicit opt-in acceptance. Live adapters are untouched; the sustained browser
// exercise uses our own example. Export metrics and hashes, never site media/data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fixture } from '../test/helpers.mjs';

const minutes = Number(process.argv.find((x) => x.startsWith('--soak-minutes='))?.slice(15) ?? 0);
assert.ok(Number.isFinite(minutes) && minutes >= 0 && minutes <= 25);
const output = resolve(
  process.argv.find((x) => x.startsWith('--report='))?.slice(9) ??
    'artifacts/stability/live-sdk.json',
);
const report = {
  at: new Date().toISOString(),
  method: 'Official SDK to production CLI; seven live sources; sustained owned-example workflow',
  live: [],
  calls: {},
  images: 0,
  imageBytes: 0,
  soak: [],
  status: 'RUNNING',
};
const client = new Client({ name: 'mimicus-stability-acceptance', version: '1.0.0' });
const f = await fixture();
const operations = new Set(),
  sessions = new Set();
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args }, { timeout: 120000 });
  report.calls[name] = (report.calls[name] ?? 0) + 1;
  if (r.isError)
    throw Error(
      r.content
        .filter((x) => x.type === 'text')
        .map((x) => x.text)
        .join(' ')
        .slice(0, 500),
    );
  const images = r.content.filter((x) => x.type === 'image');
  for (const image of images) {
    assert.equal(image.mimeType, 'image/jpeg');
    const bytes = Buffer.from(image.data, 'base64');
    assert.ok(bytes.length > 1000);
    report.images++;
    report.imageBytes += bytes.length;
  }
  return r.structuredContent.data;
};
try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/cli.js'), 'serve'],
      env: {
        ...process.env,
        MIMICUS_SEMANTIC: '0',
        MIMICUS_TIMEOUT_MS: '60000',
        MIMICUS_MAX_BYTES: '40000000',
        MIMICUS_DEV_MODE: '1',
        MIMICUS_DEV_ORIGINS: f.origin,
      },
      stderr: 'pipe',
    }),
  );
  report.tools = (await client.listTools()).tools.length;
  report.server = client.getServerVersion();
  assert.equal(report.tools, 17);
  const opened = await call('mimicus_open_reference', { url: f.url, authorized: true });
  const sessionId = opened.sessionId;
  sessions.add(sessionId);
  const began = Date.now();
  report.browser = opened.browser;
  for (const [provider, input] of [
    ['awwwards', { awwwards: { details: false } }],
    ['webflow', { query: 'coffee' }],
    ['astro', { query: 'coffee' }],
    ['nuxt', { industry: 'Retail & Food' }],
    ['codrops', { stream: 'creative-hub' }],
    ['mesh3d', {}],
    ['threejs-resources', {}],
  ]) {
    const started = Date.now();
    const data = await call('mimicus_search', {
      providers: [provider],
      retrieval: 'lexical',
      limit: 3,
      ...input,
    });
    operations.add(data.operationId);
    const taxonomy = await call('mimicus_browse_categories', { operationId: data.operationId });
    report.live.push({
      provider,
      ms: Date.now() - started,
      returned: data.results.length,
      requests: data.metadataHttpRequests,
      sources: data.sources.map((s) => ({
        provider: s.provider,
        status: s.status,
        retrieved: s.sourceRetrievedRecords,
        diagnostics: s.diagnostics,
      })),
      taxonomyLabels: taxonomy.sources.reduce((n, s) => n + s.nativeLabels.length, 0),
    });
    if (data.results.length) {
      const ref = await call('mimicus_get_reference', {
        operationId: data.operationId,
        referenceId: data.results[0].id,
      });
      assert.ok(ref.relationships.some((r) => r.provider === provider));
      report.live.at(-1).identityHash = createHash('sha256')
        .update(
          data.results
            .map((r) => r.url)
            .sort()
            .join('\n'),
        )
        .digest('hex');
    }
    await call('mimicus_end_discovery', { operationId: data.operationId });
    operations.delete(data.operationId);
    await call('mimicus_interact', { sessionId, interaction: { action: 'renew' } });
  }
  await call('mimicus_preview_references', { references: [{ url: f.url, authorized: true }] });
  const second = await call('mimicus_open_reference', { url: f.url, authorized: true });
  sessions.add(second.sessionId);
  const analysis = await call('mimicus_analyze_element', {
    sessionId,
    selector: '#reveal',
    trigger: 'hover',
    viewports: [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ],
  });
  assert.ok(analysis.components.length);
  await call('mimicus_get_implementation_spec', { sessionId, analysisId: analysis.analysisId });
  await call('mimicus_get_design_insights', { sessionId });
  const compared = await call('mimicus_compare_references', {
    sessionIds: [sessionId, second.sessionId],
    brief: {
      project: 'Independent editorial concept',
      audience: 'Readers exploring design',
      primaryAction: 'Explore an article',
      sections: ['Introduction', 'Editorial'],
      motion: 'subtle',
    },
  });
  assert.ok(compared.designBrief);
  await call('mimicus_verify_implementation', {
    referenceSessionId: sessionId,
    analysisId: analysis.analysisId,
    targetSessionId: second.sessionId,
    selector: '#reveal',
  });
  await call('mimicus_close_session', { sessionId: second.sessionId });
  sessions.delete(second.sessionId);
  do {
    await call('mimicus_interact', { sessionId, interaction: { action: 'renew' } });
    const regions = await call('mimicus_explore_page', { sessionId });
    assert.ok(regions.regions.some((x) => x.selector === '#menu'));
    await call('mimicus_interact', {
      sessionId,
      interaction: { action: 'click', selector: '#menu' },
    });
    await call('mimicus_capture_view', { sessionId, selector: 'header' });
    const state = await call('mimicus_list_sources');
    assert.equal(state.browser.activeSessions, 1);
    assert.deepEqual(state.browser.maintenanceErrors, []);
    report.soak.push({
      elapsedMs: Date.now() - began,
      activeSessions: state.browser.activeSessions,
      closingSessions: state.browser.closingSessions,
      operations: state.federation.activeOperations,
    });
    console.log(
      JSON.stringify({
        phase: 'sustained-owned-session',
        elapsedMs: Date.now() - began,
        cycles: report.soak.length,
      }),
    );
    if (Date.now() - began >= minutes * 60000) break;
    await delay(Math.min(45000, minutes * 60000 - (Date.now() - began)));
  } while (true);
  await call('mimicus_capture_motion', { sessionId, selector: 'svg', frames: 3, intervalMs: 120 });
  await call('mimicus_close_session', { sessionId });
  sessions.delete(sessionId);
  const final = await call('mimicus_list_sources');
  report.final = {
    browser: final.browser,
    federation: final.federation,
    semantic: { ...final.semantic, modelCacheDir: 'operator-local-model-software-cache' },
  };
  for (const k of ['activeSessions', 'closingSessions', 'opening', 'temporaryAnalyses'])
    assert.equal(final.browser[k], 0, k);
  for (const k of [
    'activeOperations',
    'retainedReferences',
    'pendingRankedCandidates',
    'pendingSemanticCandidates',
  ])
    assert.equal(final.federation[k], 0, k);
  assert.equal(Object.keys(report.calls).length, 17);
  report.elapsedMs = Date.now() - began;
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  for (const sessionId of sessions)
    await call('mimicus_close_session', { sessionId }).catch(() => {});
  for (const operationId of operations)
    await call('mimicus_end_discovery', { operationId }).catch(() => {});
  await client.close();
  await f.close();
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: report.status,
      error: report.error,
    }),
  );
}
