/** Explicit release evidence export: real production MCP over official stdio SDK.
 * Never writes website records, remote payloads, preview media or embeddings. */

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const cwd = mkdtempSync(join(tmpdir(), 'mimicus-source-release-'));
const env = { MIMICUS_SEMANTIC: '0', MIMICUS_TIMEOUT_MS: '45000', MIMICUS_MAX_BYTES: '40000000' };
for (const name of [
  'PATH',
  'Path',
  'SYSTEMROOT',
  'SystemRoot',
  'COMSPEC',
  'USERPROFILE',
  'LOCALAPPDATA',
  'APPDATA',
  'TEMP',
  'TMP',
])
  if (process.env[name]) env[name] = process.env[name];
const client = new Client({ name: 'mimicus-live-source-release-acceptance', version: '1.0.0' });
const report = {
  at: new Date().toISOString(),
  transport:
    'Official @modelcontextprotocol/client 2.3.1 stdio -> production dist/cli.js serve; no adapter injection',
  meaning:
    'Exported counts, source coverage, timestamps and result identity hashes only. Partial/restricted sources are not full catalog acceptance.',
  cases: [],
};
const digest = (results) =>
  createHash('sha256')
    .update(JSON.stringify(results.map((r) => r.url).sort()))
    .digest('hex');
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args }, { timeout: 90000 });
  if (r.isError)
    throw new Error(
      r.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join(' ')
        .slice(0, 1000),
    );
  if (!r.structuredContent || !('data' in r.structuredContent))
    throw new Error('MCP response lacks structured data');
  return r.structuredContent.data;
};
async function run(name, input, pages = 1) {
  let op;
  const at = performance.now(),
    evidence = { name, input, pages: [] };
  try {
    let prior = new Set();
    for (let n = 0; n < pages; n++) {
      const r = await call('mimicus_search', n ? { operationId: op } : input);
      op = r.operationId;
      const urls = r.results.map((x) => x.url),
        newIds = r.results.filter((x) => !prior.has(x.id)).length;
      for (const x of r.results) prior.add(x.id);
      const page = {
        at: new Date().toISOString(),
        page: n + 1,
        freshIndependentOperation: r.freshIndependentOperation,
        metadataHttpRequests: r.metadataHttpRequests,
        resultScope: r.resultScope,
        hasMore: r.hasMore,
        returnedCandidates: urls.length,
        newVisibleCandidates: newIds,
        retainedCandidates: r.retainedCandidates,
        evictedCandidates: r.evictedCandidates,
        identityHash: digest(r.results),
        validOriginalUrls:
          urls.length > 0 &&
          urls.every((u) => {
            try {
              const x = new URL(u);
              return ['https:', 'http:'].includes(x.protocol) && !x.username && !x.password;
            } catch {
              return false;
            }
          }),
        nativeRelationships:
          r.results.length > 0 &&
          r.results.every((x) =>
            x.relationships.every((i) => i.provider && i.listingUrl && i.provenance && i.native),
          ),
        previewLinks: r.results.reduce((s, x) => s + x.previews.length, 0),
        representedSources: [
          ...new Set(r.results.flatMap((x) => x.relationships.map((i) => i.provider))),
        ],
        sources: r.sources.map((s) => ({
          provider: s.provider,
          stream: s.stream,
          status: s.status,
          returnedRecords: s.returnedRecords,
          manualReferenceCount: s.manualReferenceCount ?? 0,
          hasMore: s.hasMore,
          next: s.next,
          coverage: s.coverage,
          revision: s.revision,
          retrievedAt: s.retrievedAt,
          diagnostics: s.diagnostics,
          capabilities: s.capabilities,
        })),
      };
      evidence.pages.push(page);
      console.log(
        JSON.stringify({
          name,
          page: n + 1,
          candidates: urls.length,
          newVisibleCandidates: newIds,
          sources: page.sources.map((s) => ({
            provider: s.provider,
            stream: s.stream,
            status: s.status,
            count: s.returnedRecords,
            hasMore: s.hasMore,
          })),
          elapsedMs: Math.round(performance.now() - at),
        }),
      );
      if (n && r.hasMore === false) break;
    }
    const native = await call('mimicus_browse_categories', { operationId: op });
    evidence.nativeTaxonomyCounts = native.sources.map((s) => ({
      provider: s.provider,
      stream: s.stream,
      taxonomy: s.taxonomy.length,
      nativeLabels: s.nativeLabels.length,
      directoryTaxonomySeparate: !!s.directoryTaxonomy,
    }));
  } catch (e) {
    evidence.error = String(e);
    console.log(JSON.stringify({ name, error: String(e) }));
  } finally {
    if (op) await call('mimicus_end_discovery', { operationId: op }).catch(() => {});
    evidence.expectedRestriction = name === 'awwwards-no-special-authorization';
    evidence.gatePassed =
      !evidence.error &&
      evidence.pages.length > 0 &&
      evidence.pages.every((p) =>
        evidence.expectedRestriction
          ? p.metadataHttpRequests === 0 &&
            p.returnedCandidates === 0 &&
            p.sources.every((s) => s.status === 'blocked')
          : p.returnedCandidates > 0 &&
            p.sources.every(
              (s) =>
                s.status === 'available' ||
                s.status === 'partial' ||
                (s.provider === 'awwwards' && s.status === 'blocked'),
            ),
      ) &&
      evidence.pages.slice(1).every((p) => p.newVisibleCandidates > 0);
    evidence.elapsedMs = performance.now() - at;
    report.cases.push(evidence);
  }
}

try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve('dist/cli.js'), 'serve'],
      cwd,
      env,
      stderr: 'pipe',
    }),
  );
  report.tools = (await client.listTools()).tools.map((t) => t.name);
  await run('awwwards-no-special-authorization', {
    providers: ['awwwards'],
    limit: 3,
    retrieval: 'lexical',
  });
  for (const stream of ['creative-hub', 'webzibition', 'repositories'])
    await run(
      'codrops-' + stream,
      { providers: ['codrops'], stream, limit: 3, retrieval: 'lexical' },
      2,
    );
  await run(
    'astro-title-query-progressive',
    { providers: ['astro'], query: 'coffee', limit: 3, retrieval: 'lexical' },
    2,
  );
  await run(
    'webflow-native-animation-recent-offsets',
    {
      providers: ['webflow'],
      category: 'Animation',
      sourceSort: 'recent',
      limit: 3,
      retrieval: 'lexical',
    },
    3,
  );
  await run(
    'webflow-native-coffee-fulltext-pages',
    { providers: ['webflow'], query: 'coffee', limit: 3, retrieval: 'lexical' },
    2,
  );
  await run(
    'three-official-mcp-native-offsets',
    { providers: ['threejs-resources'], limit: 3, retrieval: 'lexical' },
    2,
  );
  await run('nuxt-complete-current-yaml', { providers: ['nuxt'], limit: 3, retrieval: 'lexical' });
  await run('nuxt-native-industry', {
    providers: ['nuxt'],
    industry: 'Retail & Food',
    limit: 5,
    retrieval: 'lexical',
  });
  await run(
    'mesh-public-progressive-details',
    { providers: ['mesh3d'], limit: 3, retrieval: 'lexical' },
    2,
  );
  await run('mesh-native-technology', {
    providers: ['mesh3d'],
    technology: 'Three.js',
    limit: 3,
    retrieval: 'lexical',
  });
  for (let i = 1; i <= 2; i++)
    await run('independent-fresh-nuxt-' + i, {
      providers: ['nuxt'],
      limit: 3,
      retrieval: 'lexical',
    });
  await run('cross-source-coffee-discovery', {
    query: 'coffee editorial product',
    limit: 12,
    retrieval: 'lexical',
  });
  report.finalStatus = await call('mimicus_list_sources');
} finally {
  await client.close();
  report.finishedAt = new Date().toISOString();
  report.cwdFilesAfterExit = readdirSync(cwd);
  report.noWebsiteFilesInIsolatedCwd = report.cwdFilesAfterExit.length === 0;
  report.gates = {
    toolErrors: report.cases.filter((c) => c.error).length,
    failedCases: report.cases.filter((c) => !c.gatePassed).map((c) => c.name),
    allExpectedSourcePathsPassed:
      report.cases.length >= 15 && report.cases.every((c) => c.gatePassed),
    noWebsiteFilesInIsolatedCwd: report.noWebsiteFilesInIsolatedCwd,
  };
  mkdirSync('artifacts/final-release', { recursive: true });
  writeFileSync('artifacts/final-release/source-acceptance.json', JSON.stringify(report, null, 2));
  if (!report.cwdFilesAfterExit.length) rmdirSync(cwd);
  console.log(
    JSON.stringify({
      report: 'artifacts/final-release/source-acceptance.json',
      cases: report.cases.length,
      gates: report.gates,
    }),
  );
  if (report.gates.failedCases.length) process.exitCode = 1;
}
