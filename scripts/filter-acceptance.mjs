import { mkdirSync, writeFileSync } from 'node:fs';
import { loadConfig } from '../dist/config.js';
import { Federation } from '../dist/discovery/federation.js';

const federation = new Federation({ ...loadConfig(), semanticEnabled: false }),
  report = {
    at: new Date().toISOString(),
    kind: 'Actual native-filter and progressive discovery requests; counts only, no catalog payloads',
    cases: [],
  };
try {
  for (const input of [
    { providers: ['webflow'], category: 'Animation', limit: 3 },
    { providers: ['mesh3d'], technology: 'Three.js', limit: 3 },
  ]) {
    const first = await federation.search({ ...input, retrieval: 'lexical' }),
      next = first.continuation.length
        ? await federation.search({ operationId: first.operationId })
        : null;
    report.cases.push({
      input,
      first: {
        requests: first.metadataHttpRequests,
        results: first.results.length,
        sources: first.sources.map((s) => ({
          provider: s.provider,
          coverage: s.coverage,
          count: s.returnedRecords,
          status: s.status,
          diagnostics: s.diagnostics,
        })),
        taxonomyCount: federation
          .categories(first.operationId)
          .sources.reduce((n, s) => n + s.taxonomy.length, 0),
      },
      continuation: next
        ? {
            requests: next.metadataHttpRequests,
            results: next.results.length,
            retained: next.retainedCandidates,
            evictions: next.evictedCandidates,
            sources: next.sources.map((s) => ({
              coverage: s.coverage,
              status: s.status,
              count: s.returnedRecords,
            })),
          }
        : null,
    });
    federation.end(first.operationId);
  }
  const broad = await federation.search({
    query: 'editorial portfolio motion',
    retrieval: 'lexical',
    limit: 14,
  });
  report.broad = {
    requests: broad.metadataHttpRequests,
    results: broad.results.length,
    candidates: broad.retainedCandidates,
    evictions: broad.evictedCandidates,
    representedProviders: [
      ...new Set(broad.results.flatMap((r) => r.relationships.map((i) => i.provider))),
    ],
    sources: broad.sources.map((s) => ({
      provider: s.provider,
      stream: s.stream,
      status: s.status,
      records: s.returnedRecords,
      diagnostics: s.diagnostics,
    })),
  };
  federation.end(broad.operationId);
  report.finalState = federation.status();
  mkdirSync('artifacts/product-correction', { recursive: true });
  writeFileSync('artifacts/product-correction/filters-live.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await federation.close();
}
