// Real official-SDK acceptance. Export facts/counts/hashes, never source HTML/media.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const client = new Client({ name: 'awwwards-live-acceptance', version: '1.0.0' }),
  cwd = mkdtempSync(join(tmpdir(), 'mimicus-awwwards-'));
const report = {
    at: new Date().toISOString(),
    method:
      'Actual production stdio SDK, fresh public metadata, original-site images, selected analysis and cleanup',
    cases: [],
    previews: [],
    status: 'RUNNING',
  },
  images = [],
  ops = [];
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args }, { timeout: 120000 });
  if (r.isError) throw Error(JSON.stringify(r.content));
  return { data: r.structuredContent.data, images: r.content.filter((c) => c.type === 'image') };
};
const digest = (s) => createHash('sha256').update(s).digest('hex');
let selected, session;
try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/cli.js'), 'serve'],
      cwd,
      env: { ...process.env, MIMICUS_SEMANTIC: '0', MIMICUS_TIMEOUT_MS: '60000' },
      stderr: 'pipe',
    }),
  );
  report.tools = (await client.listTools()).tools.length;
  for (const [name, input, rounds] of [
    ['webgl-two-native-pages', { technology: 'WebGL', query: 'interactive' }, 2],
    ['architecture-native-category', { category: 'Architecture' }, 1],
    ['site-of-the-month-native-award', { awwwards: { award: 'Sites of the Month' } }, 1],
    ['country-native-collection', { awwwards: { country: 'United States' } }, 1],
    ['font-native-collection', { awwwards: { font: 'Aeonik' } }, 1],
    [
      'root-public-listing-with-restricted-next',
      { awwwards: { listingUrl: 'https://www.awwwards.com/websites/', details: false } },
      1,
    ],
  ]) {
    const item = { name, input, nativePages: [], drains: 0, returned: 0, duplicateIds: 0 },
      seen = new Set();
    let op;
    try {
      for (let n = 0; n < 14 && item.nativePages.length < rounds; n++) {
        const started = performance.now(),
          { data } = await call(
            'mimicus_search',
            n
              ? { operationId: op }
              : { providers: ['awwwards'], retrieval: 'lexical', limit: 10, ...input },
          );
        op = data.operationId;
        if (!ops.includes(op)) ops.push(op);
        item.returned += data.results.length;
        for (const r of data.results) {
          if (seen.has(r.id)) item.duplicateIds++;
          seen.add(r.id);
          assert.equal(r.relationships[0].provider, 'awwwards');
          assert.equal(r.relationships[0].sourceMetadata.relationshipVerified, true);
        }
        if (data.metadataHttpRequests) {
          item.nativePages.push({
            scope: data.resultScope,
            elapsedMs: Math.round(performance.now() - started),
            requests: data.metadataHttpRequests,
            records: data.sources[0]?.sourceRetrievedRecords,
            status: data.sources[0]?.status,
            taxonomyLabels: data.sources[0]?.taxonomy?.length,
            hasMore: data.sources[0]?.hasMore,
            diagnostics: data.sources[0]?.diagnostics,
            referenceIdentitySha256: digest(JSON.stringify(data.results.map((r) => r.id).sort())),
          });
        } else item.drains++;
        if (!selected && name === 'webgl-two-native-pages')
          selected = { operationId: op, results: data.results };
        if (!data.hasMore) break;
      }
      assert.equal(item.nativePages.length, rounds);
      assert.ok(item.returned > 0);
      assert.equal(item.duplicateIds, 0);
      assert.ok(
        item.nativePages.every(
          (p) => ['available', 'partial'].includes(p.status) && p.taxonomyLabels > 0,
        ),
      );
      item.passed = true;
    } catch (e) {
      item.passed = false;
      item.error = String(e).slice(0, 1200);
    }
    report.cases.push(item);
  }
  assert.ok(
    report.cases.every((c) => c.passed),
    'One or more live discovery cases failed',
  );
  const categories = (
    await call('mimicus_browse_categories', { operationId: selected.operationId })
  ).data;
  report.taxonomyAvailable = categories.sources.map((s) => ({
    provider: s.provider,
    labels: s.taxonomy.length,
  }));
  for (let n = 0; n < Math.min(6, selected.results.length) && images.length < 2; n += 2) {
    const refs = selected.results.slice(n, n + 2),
      preview = await call('mimicus_preview_references', {
        references: refs.map((r) => ({
          operationId: selected.operationId,
          referenceId: r.id,
          authorized: true,
        })),
        viewport: { width: 1280, height: 800 },
      });
    report.previews.push(...preview.data.references);
    for (const img of preview.images) images.push(img);
  }
  report.imageEvidence = images.map((img, index) => ({
    index,
    bytes: Buffer.from(img.data, 'base64').length,
    sha256: digest(Buffer.from(img.data, 'base64')),
  }));
  assert.ok(images.length > 0, 'No original-site image available');
  const candidate = report.previews.find((r) => r.imageIndex !== undefined);
  const opened = await call('mimicus_open_reference', {
    url: candidate.actualUrl,
    authorized: true,
    viewport: { width: 1280, height: 800 },
  });
  session = opened.data.sessionId;
  const analysis = (
    await call('mimicus_analyze_element', {
      sessionId: session,
      selector: 'body',
      trigger: 'time',
      viewports: [
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
      ],
    })
  ).data;
  const spec = (
    await call('mimicus_get_implementation_spec', {
      sessionId: session,
      analysisId: analysis.analysisId,
    })
  ).data;
  const mobile = await call('mimicus_interact', {
    sessionId: session,
    interaction: { action: 'resize', viewport: { width: 390, height: 844 }, reducedMotion: true },
  });
  report.originalUnderstanding = {
    url: candidate.actualUrl,
    analysisId: analysis.analysisId,
    specReturned: Boolean(spec),
    mobileImages: mobile.images.length,
    meaning:
      'Selected original-site responsive/temporal measurements and implementation guidance; not recovered author source or aesthetic validation',
  };
  assert.equal(mobile.images.length, 1);
  report.status = 'VERIFIED';
} catch (e) {
  report.status = 'FAILED';
  report.error = String(e).slice(0, 2000);
  process.exitCode = 1;
} finally {
  if (session) await call('mimicus_close_session', { sessionId: session }).catch(() => {});
  if (ops.length) await call('mimicus_end_discovery', { operationIds: ops }).catch(() => {});
  try {
    const status = (await call('mimicus_list_sources')).data;
    report.finalResources = { browser: status.browser, federation: status.federation };
    assert.equal(status.browser.activeSessions, 0);
    assert.equal(status.browser.closingSessions, 0);
    assert.equal(status.browser.temporaryAnalyses, 0);
    assert.equal(status.federation.activeOperations, 0);
  } catch (e) {
    report.status = 'FAILED';
    report.cleanupError = String(e);
    process.exitCode = 1;
  }
  await client.close();
  report.cwdFiles = readdirSync(cwd);
  if (!report.cwdFiles.length) rmdirSync(cwd);
  report.finishedAt = new Date().toISOString();
  mkdirSync('artifacts/awwwards-integration', { recursive: true });
  writeFileSync(
    'artifacts/awwwards-integration/live-sdk.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  if (process.argv.includes('--emit-images'))
    console.log(JSON.stringify({ report, images: images.slice(0, 2) }));
  else
    console.log(
      JSON.stringify({
        status: report.status,
        cases: report.cases.length,
        images: images.length,
        error: report.error,
      }),
    );
}
