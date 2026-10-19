import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, platform } from 'node:os';
import { loadConfig } from '../dist/config.js';
import { Federation } from '../dist/discovery/federation.js';
import { rankReferences } from '../dist/discovery/ranking.js';
import { DiscoveryQuery } from '../dist/discovery/types.js';
import { LocalSemantic } from '../dist/semantic.js';

const live = process.argv.includes('--live'),
  config = loadConfig(),
  semantic = new LocalSemantic({ ...config, semanticEnabled: live }),
  fed = new Federation({ ...config, semanticEnabled: false }),
  before = process.memoryUsage().rss;
const queries = [
  'commerce retail brand',
  'software developer documentation',
  'creative agency portfolio',
  'nonprofit education',
];
let references = [];
const report = {
  at: new Date().toISOString(),
  kind: live
    ? 'Actual current Nuxt metadata; temporary MiniLM reranking; no relevance or aesthetic superiority asserted'
    : 'Owned synthetic software benchmark, not live-provider acceptance',
  node: process.version,
  platform: platform(),
  cpu: cpus()[0]?.model,
  cpuThreads: config.semanticThreads,
  queries: [],
  persistedWebsiteVectors: false,
};
try {
  if (live) {
    const r = await fed.search({ providers: ['nuxt'], retrieval: 'lexical', limit: 3 });
    references = [...fed.operations.get(r.operationId).references.values()];
    report.liveRequests = r.metadataHttpRequests;
    report.sourceCoverage = r.sources.map((s) => ({
      provider: s.provider,
      status: s.status,
      count: s.returnedRecords,
      at: s.retrievedAt,
    }));
    fed.end(r.operationId);
  } else
    references = queries.map((q, i) => ({
      id: String(i),
      title: q,
      url: 'https://owned.example/' + i,
      relationships: [],
      previews: [],
      concepts: [],
      inspection: 'requires-authorized-open',
    }));
  report.candidates = references.length;
  for (const query of queries)
    for (const retrieval of live ? ['lexical', 'hybrid', 'semantic'] : ['lexical']) {
      const started = performance.now(),
        r = await rankReferences(
          references,
          DiscoveryQuery.parse({ query, retrieval, limit: 3 }),
          semantic,
        );
      report.queries.push({
        query,
        requested: retrieval,
        actual: r.retrieval,
        elapsedMs: performance.now() - started,
        candidates: r.candidatesConsidered,
        embedded: r.embeddedCandidates,
        semanticError: r.semanticError,
        topScores: r.results.map((v) => ({
          lexical: v.lexicalScore,
          semantic: v.semanticScore,
          combined: v.score,
        })),
        temporaryVectorsReleased: r.temporaryVectorsReleased,
      });
    }
  report.integrity = live ? await semantic.verifyModel() : undefined;
  report.rssDeltaBytes = process.memoryUsage().rss - before;
  report.rssPeakSampleBytes = process.memoryUsage().rss;
  report.limitations = [
    'RSS includes a retained model/runtime and does not measure site-vector retention.',
    'Four queries on a bounded current pool do not establish production-scale latency percentiles or retrieval relevance.',
    'Semantic similarity is not a visual-quality score.',
  ];
  mkdirSync('artifacts/final-release', { recursive: true });
  const path = 'artifacts/final-release/' + (live ? 'semantic-live' : 'benchmark') + '.json';
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      report: path,
      candidates: references.length,
      cases: report.queries.length,
      model: semantic.status().state,
      rssDeltaBytes: report.rssDeltaBytes,
    }),
  );
} finally {
  references = [];
  await fed.close();
  await semantic.close();
}
