/** Explicit opt-in live acceptance. Exports metrics/hashes only, never catalog,
 * source media, original screenshots, HTML, embeddings or credentials. */
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { loadConfig } from '../dist/config.js';
import { adapters, discoveryContext } from '../dist/discovery/providers/index.js';
import { DiscoveryQuery } from '../dist/discovery/types.js';

const outDir = resolve('artifacts/product-hardening');
const report = {
  at: new Date().toISOString(),
  method:
    'Live production adapter metrics and official MCP stdio SDK acceptance; no injected providers',
  samples: [],
  cases: [],
};
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];
const cfg = loadConfig({
  ...process.env,
  MIMICUS_SEMANTIC: '0',
  MIMICUS_TIMEOUT_MS: '60000',
  MIMICUS_MAX_BYTES: '40000000',
});
const trials = [
  ['webflow', { query: 'coffee' }],
  ['astro', { query: 'coffee' }],
  ['nuxt', { industry: 'Retail & Food' }],
  ['codrops', { stream: 'creative-hub' }],
  ['mesh3d', {}],
  ['threejs-resources', {}],
];
if (!process.argv.includes('--sdk-only')) {
  for (const [provider, input] of trials) {
    for (let sample = 1; sample <= 3; sample++) {
      const d = discoveryContext(
        cfg,
        DiscoveryQuery.parse({ ...input, providers: [provider], retrieval: 'lexical', limit: 3 }),
        new Map(),
      );
      const started = performance.now(),
        item = { provider, sample };
      try {
        const pages = await adapters()
          .find((a) => a.id === provider)
          .search(d.context);
        Object.assign(item, {
          ms: Math.round(performance.now() - started),
          requests: d.requestCount(),
          records: pages.reduce((n, p) => n + p.records.length, 0),
          status: pages.map((p) => p.status),
          identityHash: digest(pages.flatMap((p) => p.records.map((r) => r.url)).sort()),
        });
      } catch (error) {
        item.error = String(error).slice(0, 800);
        item.ms = Math.round(performance.now() - started);
      } finally {
        d.release();
      }
      report.samples.push(item);
      console.log(JSON.stringify({ phase: 'measure', ...item }));
    }
  }
  const baseline = JSON.parse(readFileSync(join(outDir, 'source-baseline.json'), 'utf8'));
  report.comparison = trials.map(([provider]) => {
    const before = baseline.samples.filter((s) => s.provider === provider),
      after = report.samples.filter((s) => s.provider === provider && !s.error);
    return {
      provider,
      nBefore: before.length,
      nAfter: after.length,
      before: {
        p50Ms: percentile(
          before.map((s) => s.ms),
          0.5,
        ),
        p95Ms: percentile(
          before.map((s) => s.ms),
          0.95,
        ),
        requests: before.map((s) => s.requests),
        records: before.map((s) => s.records),
      },
      after: {
        p50Ms: percentile(
          after.map((s) => s.ms),
          0.5,
        ),
        p95Ms: percentile(
          after.map((s) => s.ms),
          0.95,
        ),
        requests: after.map((s) => s.requests),
        records: after.map((s) => s.records),
      },
    };
  });
  report.latencyCaveat =
    'n=3 per provider per phase; nearest-rank p95 is the observed maximum, not a population tail estimate. Public network, upstream caches and connection reuse can dominate. No claimed causal speedup for providers without a reduced request path. Official MCP traffic is outside the metadata HTTP request counter.';
}

if (!process.argv.includes('--measure-only')) {
  const cwd = mkdtempSync(join(tmpdir(), 'mimicus-hardening-source-'));
  const env = {
    MIMICUS_SEMANTIC: '0',
    MIMICUS_TIMEOUT_MS: '60000',
    MIMICUS_MAX_BYTES: '40000000',
    MIMICUS_SOURCE_AUTHORIZATIONS: JSON.stringify({
      awwwards: 'unverified authorization note must not grant access',
    }),
  };
  for (const k of [
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
    'MIMICUS_BROWSER_EXECUTABLE',
  ])
    if (process.env[k]) env[k] = process.env[k];
  const client = new Client({ name: 'mimicus-product-hardening-sources', version: '1.0.0' });
  const call = async (name, arguments_ = {}) => {
    const r = await client.callTool({ name, arguments: arguments_ }, { timeout: 120000 });
    if (r.isError)
      throw new Error(
        r.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join(' ')
          .slice(0, 900),
      );
    return { data: r.structuredContent.data, images: r.content.filter((c) => c.type === 'image') };
  };
  async function run(name, input, count = 2, expectedRestriction = false) {
    const evidence = {
      name,
      input,
      pages: [],
      cachedDrainCalls: 0,
      cachedDrainReturned: 0,
      cachedDrainAllNew: true,
      expectedRestriction,
      automatedCatalogStatus: expectedRestriction ? 'BLOCKED' : undefined,
    };
    let op;
    try {
      const prior = new Set();
      for (let n = 0; n < 100 && evidence.pages.length < count; n++) {
        const at = performance.now();
        const { data: r } = await call(
          'mimicus_search',
          n ? { operationId: op } : { retrieval: 'lexical', limit: 3, ...input },
        );
        op = r.operationId;
        const nativeRound = ['initial-source-pages', 'new-source-pages'].includes(r.resultScope);
        const current = r.results.map((x) => x.id),
          item = {
            page: evidence.pages.length + 1,
            call: n + 1,
            resultScope: r.resultScope,
            elapsedMs: Math.round(performance.now() - at),
            returned: current.length,
            newlyVisible: current.filter((id) => !prior.has(id)).length,
            identityHash: digest(r.results.map((x) => x.url).sort()),
            freshIndependentOperation: r.freshIndependentOperation,
            metadataHttpRequests: r.metadataHttpRequests,
            hasMore: r.hasMore,
            nativeAndProvenanceValid: r.results.every((x) =>
              x.relationships.every((s) => s.provider && s.listingUrl && s.provenance && s.native),
            ),
            sources: r.sources.map((s) => ({
              provider: s.provider,
              stream: s.stream,
              status: s.status,
              sourceRetrievedRecords: s.sourceRetrievedRecords,
              manualReferenceCount: s.manualReferenceCount,
              returnedRecords: s.returnedRecords,
              next: s.next,
              hasMore: s.hasMore,
              coverage: s.coverage,
              revision: s.revision,
              diagnostics: s.diagnostics,
            })),
          };
        current.forEach((id) => prior.add(id));
        if (nativeRound) evidence.pages.push(item);
        else {
          evidence.cachedDrainCalls++;
          evidence.cachedDrainReturned += current.length;
          evidence.cachedDrainAllNew &&= item.newlyVisible === current.length;
        }
        if (n === 0) {
          const taxonomy = (await call('mimicus_browse_categories', { operationId: op })).data;
          evidence.taxonomy = taxonomy.sources.map((s) => ({
            provider: s.provider,
            stream: s.stream,
            labels: s.taxonomy.length,
            nativeLabels: s.nativeLabels.length,
            separateDirectoryTaxonomy: Boolean(s.directoryTaxonomy),
          }));
        }
        if (name === 'awwwards-url-only-actual-original') {
          const ref = r.results[0];
          evidence.handoff = {
            originalUrlOnlyAccepted: Boolean(ref),
            discoveredGalleryRelationship:
              ref?.relationships[0]?.sourceMetadata.relationshipVerified,
            noSourceListingSupplied: ref?.relationships[0]?.sourceMetadata.noAwwwardsListing,
          };
          let session;
          try {
            const opened = await call('mimicus_open_reference', {
              operationId: op,
              referenceId: ref.id,
              authorized: true,
            });
            session = opened.data.sessionId;
            evidence.handoff.imageBlocks = opened.images.length;
            evidence.handoff.imageHashes = opened.images.map((im) => digest(im.data));
            evidence.handoff.actualSession = Boolean(session);
            evidence.handoff.authorizedOriginal = opened.data.url
              ? new URL(opened.data.url).hostname
              : 'original independently observed';
          } finally {
            if (session) await call('mimicus_close_session', { sessionId: session });
          }
        }
        if (nativeRound)
          console.log(
            JSON.stringify({
              phase: 'SDK',
              name,
              page: item.page,
              call: item.call,
              returned: item.returned,
              newlyVisible: item.newlyVisible,
              elapsedMs: item.elapsedMs,
              sources: item.sources.map((s) => ({
                provider: s.provider,
                stream: s.stream,
                status: s.status,
                records: s.returnedRecords,
              })),
            }),
          );
        if (!r.hasMore) break;
      }
      evidence.passed =
        evidence.pages.length === count &&
        evidence.cachedDrainAllNew &&
        evidence.pages.every((p) =>
          expectedRestriction
            ? p.metadataHttpRequests === 0 && p.sources.every((s) => s.status === 'blocked')
            : p.returned > 0 &&
              p.nativeAndProvenanceValid &&
              p.sources.every((s) => ['available', 'partial'].includes(s.status)),
        ) &&
        evidence.pages.slice(1).every((p) => p.newlyVisible > 0);
      if (evidence.handoff)
        evidence.passed &&=
          evidence.handoff.imageBlocks > 0 &&
          evidence.handoff.actualSession &&
          evidence.handoff.discoveredGalleryRelationship === false;
    } catch (e) {
      evidence.error = String(e).slice(0, 1000);
      evidence.passed = false;
      console.log(JSON.stringify({ phase: 'SDK', name, error: evidence.error }));
    } finally {
      if (op) await call('mimicus_end_discovery', { operationId: op }).catch(() => {});
    }
    report.cases.push(evidence);
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
    await run('awwwards-bare-note-remains-blocked', { providers: ['awwwards'] }, 1, true);
    await run(
      'awwwards-url-only-actual-original',
      { providers: ['awwwards'], originalReferences: [{ url: 'https://threejs.org/' }] },
      1,
      true,
    );
    for (const stream of ['creative-hub', 'webzibition', 'repositories'])
      await run('codrops-' + stream, { providers: ['codrops'], stream });
    await run('astro-coffee-progressive', { providers: ['astro'], query: 'coffee' });
    await run('webflow-coffee-native-search', { providers: ['webflow'], query: 'coffee' });
    await run('webflow-native-animation-recent', {
      providers: ['webflow'],
      category: 'Animation',
      sourceSort: 'recent',
    });
    await run('threejs-official-mcp', { providers: ['threejs-resources'] });
    await run(
      'nuxt-complete-native-industry-first',
      { providers: ['nuxt'], industry: 'Retail & Food' },
      1,
    );
    await run(
      'nuxt-independent-fresh-second',
      { providers: ['nuxt'], industry: 'Retail & Food' },
      1,
    );
    await run('mesh3d-public-native-threejs', { providers: ['mesh3d'], technology: 'Three.js' });
  } finally {
    await client.close();
    report.isolatedCwdFilesAfterExit = readdirSync(cwd);
    if (!report.isolatedCwdFilesAfterExit.length) rmdirSync(cwd);
  }
}
report.acceptance = {
  permittedCasesPassed: report.cases.filter((x) => !x.expectedRestriction).every((x) => x.passed),
  restrictionTestsPassed: report.cases.filter((x) => x.expectedRestriction).every((x) => x.passed),
  awwwardsCatalog:
    'BLOCKED: no verified scoped grant; passing restriction test is not gallery integration success',
  failedCases: report.cases.filter((x) => !x.passed).map((x) => x.name),
  noWebsiteCatalogFiles: report.isolatedCwdFilesAfterExit?.length === 0,
};
mkdirSync(outDir, { recursive: true });
const output = join(
  outDir,
  process.argv.includes('--measure-only')
    ? 'source-after-metrics.json'
    : process.argv.includes('--sdk-only')
      ? 'source-sdk-acceptance.json'
      : 'source-hardening-acceptance.json',
);
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    output,
    acceptance: report.acceptance,
    samples: report.samples.length,
    cases: report.cases.length,
  }),
);
if (report.acceptance.failedCases.length) process.exitCode = 1;
