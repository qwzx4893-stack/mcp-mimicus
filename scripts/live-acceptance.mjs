import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadConfig } from '../dist/config.js';
import { Provider } from '../dist/discovery/types.js';
import { Mimicus } from '../dist/server.js';

const app = new Mimicus({ ...loadConfig(), semanticEnabled: false, maxBytes: 40000000 }),
  report = {
    at: new Date().toISOString(),
    kind: 'Actual current live federation calls. This explicitly exported report contains counts, coverage and result hashes, not a catalog snapshot or media archive.',
    providers: [],
  };
try {
  for (const provider of Provider.options) {
    const started = performance.now();
    try {
      const result = await app.federation.search({
        providers: [provider],
        retrieval: 'lexical',
        limit: 3,
      });
      const evidence = {
        provider,
        elapsedMs: performance.now() - started,
        metadataHttpRequests: result.metadataHttpRequests,
        sources: result.sources.map((s) => ({
          stream: s.stream,
          status: s.status,
          returnedRecords: s.returnedRecords,
          coverage: s.coverage,
          retrievedAt: s.retrievedAt,
          diagnostics: s.diagnostics,
        })),
        returnedCandidates: result.results.length,
        originalUrlsValid:
          result.results.length > 0 && result.results.every((r) => /^https?:/.test(r.url)),
        nativeFieldsPreserved:
          result.results.length > 0 &&
          result.results.every((r) =>
            r.relationships.every((i) => i.native && i.provenance && i.listingUrl),
          ),
        resultIdentityHash: createHash('sha256')
          .update(JSON.stringify(result.results.map((r) => r.url)))
          .digest('hex'),
        previewLinks: result.results.reduce((n, r) => n + r.previews.length, 0),
        liveMeaning:
          'Actual interface call; blocked/partial results are not full integration completion',
      };
      report.providers.push(evidence);
      app.federation.end(result.operationId);
      console.log(JSON.stringify(evidence));
    } catch (e) {
      report.providers.push({ provider, error: String(e), elapsedMs: performance.now() - started });
      console.log(JSON.stringify({ provider, error: String(e) }));
    }
  }
  const repeated = [];
  for (let i = 0; i < 2; i++) {
    const r = await app.federation.search({ providers: ['nuxt'], retrieval: 'lexical', limit: 3 });
    repeated.push({
      operationId: r.operationId,
      requests: r.metadataHttpRequests,
      fresh: r.freshIndependentOperation,
    });
    app.federation.end(r.operationId);
  }
  report.repeatedFreshness = repeated;
  report.finalState = app.federation.status();
  mkdirSync('artifacts/product-correction', { recursive: true });
  writeFileSync(
    'artifacts/product-correction/live-acceptance.json',
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      report: 'artifacts/product-correction/live-acceptance.json',
      repeated,
      finalState: report.finalState,
    }),
  );
} finally {
  await app.close();
}
