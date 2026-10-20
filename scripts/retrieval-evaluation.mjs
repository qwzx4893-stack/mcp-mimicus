import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { ConfigSchema } from '../dist/config.js';
import { mergeReferences } from '../dist/discovery/federation.js';
import { rankReferences, referenceText } from '../dist/discovery/ranking.js';
import { DiscoveryQuery, Provider, SourceRecordSchema } from '../dist/discovery/types.js';
import { cosine, LocalSemantic } from '../dist/semantic.js';

// Synthetic, authored retrieval judgments, not human labels or downloaded
// source catalogs. IDs/providers permit independent inspection of every item.
export const intents = [
  [
    'coffee',
    'premium coffee subscriptions',
    [
      ['Ember Roast', 'Premium coffee, single-origin beans and monthly roast subscriptions.'],
      [
        'Kona Collective',
        'Arabica roasts delivered monthly from independent growers; a bean shop.',
      ],
      ['Morrow', '', ['Coffee']],
    ],
  ],
  [
    'agency',
    'creative agency portfolio',
    [
      [
        'Studio Field',
        'Creative agency portfolio of brand identity, art direction and digital projects.',
      ],
      [
        'North Practice',
        'An independent design studio showcasing selected client work and visual identities.',
      ],
      ['Atelier', '', ['Portfolio']],
    ],
  ],
  [
    'webgl',
    'immersive WebGL 3D',
    [
      [
        'Luminous Space',
        'An immersive WebGL 3D scene with interactive particles and spatial navigation.',
      ],
      [
        'Tidal Instrument',
        'Explore a real-time rendered sculpture in the browser using a moving camera.',
      ],
      ['Orbital', '', ['Three.js']],
    ],
  ],
  [
    'product',
    'product storytelling scroll',
    [
      [
        'Object Sequence',
        'A product storytelling page with scroll-linked assembly and feature chapters.',
      ],
      [
        'The New Camera',
        'A cinematic introduction that reveals a camera through sequential sections as visitors move down.',
      ],
      ['Form One', '', ['Product']],
    ],
  ],
  [
    'editorial',
    'typography magazine editorial',
    [
      [
        'Type Journal',
        'An editorial magazine with expressive typography, long-form stories and issue archives.',
      ],
      [
        'Margins',
        'Independent essays and interviews arranged in a publication with large serif headlines.',
      ],
      ['Issue Zero', '', ['Editorial']],
    ],
  ],
  [
    'saas',
    'SaaS product landing pricing',
    [
      [
        'Clear Desk',
        'SaaS product landing page with pricing, feature comparison and a free-trial call to action.',
      ],
      ['Relay', 'Subscription software for teams: plans, customer proof and a signup path.'],
      ['Pact', '', ['SaaS']],
    ],
  ],
  [
    'architecture',
    'architecture studio projects',
    [
      [
        'Stone Practice',
        'Architecture studio projects, building photography and a catalogue of residential work.',
      ],
      ['Courtyard', 'Architects presenting houses, cultural buildings and a practice profile.'],
      ['Volume', '', ['Architecture']],
    ],
  ],
  [
    'navigation',
    'fullscreen menu navigation',
    [
      ['Open Index', 'Fullscreen menu navigation reveals project links in an accessible overlay.'],
      [
        'Wayfinder',
        'A site-wide panel of large links opens over the entire viewport from the header.',
      ],
      ['Directory', '', ['Menu']],
    ],
  ],
  [
    'interaction',
    'hover cards cursor animation',
    [
      [
        'Motion Index',
        'Hover cards animate under the cursor with image reveals and pointer-following motion.',
      ],
      [
        'Reveal Study',
        'Moving the pointer over project tiles reveals an image with a smooth transition.',
      ],
      ['Trace', '', ['Animation']],
    ],
  ],
  [
    'multilingual',
    'مقهى coffee roastery',
    [
      ['بيت البن', 'مقهى ومحمصة: coffee roastery, beans and a local café.'],
      ['بيت التحميص', 'حبوب البن العربية وتحميص طازج واشتراك شهري.'],
      ['قهوة', '', ['Coffee']],
    ],
  ],
].map(([id, query, positives]) => ({ id, query, positives }));
const providers = Provider.options.filter((p) => p !== 'awwwards');
export function evaluationFixture() {
  const records = [],
    judgments = {};
  const add = (id, title, description, provider, tags = []) =>
    records.push(
      SourceRecordSchema.parse({
        provider,
        stream: provider === 'codrops' ? 'creative-hub' : 'showcase',
        itemId: id,
        title,
        description,
        url: `https://${id}.evaluation.example/`,
        listingUrl: `https://source-${provider}.evaluation.example/${id}`,
        native: { tags },
        retrievedAt: '2026-10-19T00:00:00Z',
        provenance:
          'Synthetic independently inspectable retrieval evaluation, not live source data',
      }),
    );
  for (let n = 0; n < 120; n++)
    add(
      `neutral-${n}`,
      `Sample ${n}`,
      [
        'A weather dashboard displaying local forecasts.',
        'A documentation page for compiler errors.',
        'A public transport timetable with route information.',
        'A server monitoring console with incident logs.',
      ][n % 4],
      providers[n % providers.length],
    );
  for (const [index, intent] of intents.entries()) {
    judgments[intent.id] = {};
    for (const [n, [title, description, tags]] of intent.positives.entries()) {
      const id = `${intent.id}-positive-${n}`;
      add(id, title, description, providers[(index + n) % providers.length], tags);
      judgments[intent.id][id] = 3 - n;
    }
    for (let n = 0; n < 3; n++)
      add(
        `${intent.id}-negative-${n}`,
        `${intent.query} monitor ${n}`,
        'This is an infrastructure monitoring console. The title names a tracked customer query; the page has no shop, project portfolio, interactive scene or marketing design.',
        providers[(index + n + 3) % providers.length],
      );
  }
  // Independent root-agent adjudication, frozen before the final benchmark:
  // overlapping coffee/Arabic references are not false negatives. These are
  // content-metadata relevance judgments, never visual-quality judgments.
  Object.assign(judgments.coffee, {
    'multilingual-positive-0': 1,
    'multilingual-positive-1': 2,
    'multilingual-positive-2': 1,
  });
  Object.assign(judgments.multilingual, {
    'coffee-positive-0': 2,
    'coffee-positive-1': 2,
    'coffee-positive-2': 1,
  });
  // Fixed source-order permutation, shared by all variants, independent of labels.
  let seed = 0x4d494d49;
  for (let n = records.length - 1; n > 0; n--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (n + 1);
    [records[n], records[j]] = [records[j], records[n]];
  }
  return { records, judgments };
}
const words = (s) =>
  s
    .toLowerCase()
    .normalize('NFKC')
    .match(/[\p{L}\p{N}]+/gu)
    ?.slice(0, 60) ?? [];
// Frozen production algorithm at release 2e64dd5, copied for matched-fixture
// comparison. Baseline lexical scores and source-first retention are preserved.
async function baseline(records, query, semantic, window) {
  const tokens = words(query),
    score = (r) => tokens.filter((t) => referenceText(r).toLowerCase().includes(t)).length;
  const ordered = [...records].sort((a, b) => score(b) - score(a));
  const buckets = Provider.options
    .map((p) => ordered.filter((r) => r.relationships.some((i) => i.provider === p)))
    .filter((b) => b.length);
  const chosen = new Map();
  for (const b of buckets) if (chosen.size < window) chosen.set(b[0].id, b[0]);
  for (const r of ordered.filter((r) => score(r) > 0)) {
    if (chosen.size >= window) break;
    chosen.set(r.id, r);
  }
  for (let i = 0; chosen.size < window && i < ordered.length; i++)
    for (const b of buckets) {
      if (b[i] && chosen.size < window) chosen.set(b[i].id, b[i]);
    }
  const lexical = [...chosen.values()]
    .map((reference) => {
      const all = words(referenceText(reference)),
        labels = reference.relationships
          .flatMap((i) => [...i.native.categories, ...i.native.tags, ...i.native.technologies])
          .map((x) => x.toLowerCase());
      return {
        reference,
        lexicalScore:
          tokens.filter((t) => all.includes(t)).length / Math.max(1, tokens.length) +
          tokens.filter((t) => labels.some((l) => l === t)).length * 0.2,
      };
    })
    .sort((a, b) => b.lexicalScore - a.lexicalScore)
    .slice(0, window);
  const vectors = await semantic.embed([query, ...lexical.map((r) => referenceText(r.reference))]);
  const results = lexical
    .map((row, i) => ({
      ...row.reference,
      score: cosine(vectors[0], vectors[i + 1]) * 0.65 + row.lexicalScore * 0.35,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  return {
    results,
    scoredReferenceIds: lexical.map((r) => r.reference.id),
    pipeline: {
      mergedReferences: records.length,
      retainedBeforeRanking: chosen.size,
      eligibleAfterNativeFilters: chosen.size,
      semanticPoolCandidates: lexical.length,
      discardedBeforeInference: records.length - lexical.length,
    },
  };
}
function metrics(results, grades) {
  const grade = (r) => grades[r.relationships[0].itemId] ?? 0;
  const hit = (k) =>
    results.slice(0, k).filter((r) => grade(r) > 0).length / Object.keys(grades).length;
  const dcg = (values) => values.reduce((sum, g, i) => sum + (2 ** g - 1) / Math.log2(i + 2), 0);
  const rank = results.findIndex((r) => grade(r) > 0);
  return {
    recall5: hit(5),
    recall10: hit(10),
    mrr10: rank < 0 ? 0 : 1 / (rank + 1),
    ndcg10: dcg(results.map(grade)) / dcg(Object.values(grades).sort((a, b) => b - a)),
    sourceDiversity10: new Set(results.flatMap((r) => r.relationships.map((i) => i.provider))).size,
    empty: Number(results.length === 0),
  };
}
export async function runEvaluation() {
  const fixture = evaluationFixture(),
    refs = mergeReferences(fixture.records);
  const semantic = new LocalSemantic(
    ConfigSchema.parse({ semanticEnabled: true, semanticDownload: false }),
  );
  const report = {
    schema: 1,
    measuredAt: new Date().toISOString(),
    node: process.version,
    fixtureSha256: createHash('sha256').update(JSON.stringify(fixture)).digest('hex'),
    provenance:
      'Agent-authored synthetic relevance labels independently adjudicated by the root agent before final measurement, including cross-intent coffee/Arabic grades. Not human judgments, visual-quality labels, or live-source connectivity.',
    scope: {
      intents: intents.length,
      references: refs.length,
      providers: providers.length,
      gradedPositivesPerIntent: '3, or 6 in the overlapping coffee/multilingual cases',
    },
    model: semantic.name,
    cases: [],
    aggregates: {},
    memory: {},
    failures: [],
  };
  try {
    const cold = performance.now();
    if (!(await semantic.init())) throw new Error(JSON.stringify(semantic.status()));
    report.modelLoadMs = Math.round(performance.now() - cold);
    report.modelIntegrity = await semantic.verifyModel();
    const before = process.memoryUsage();
    for (const intent of intents) {
      const row = {
        id: intent.id,
        query: intent.query,
        grades: fixture.judgments[intent.id],
        variants: {},
      };
      for (const [name, window] of [
        ['baseline80', 80],
        ['revised80', 80],
        ['revised160', 160],
        ['revisedLexical', 160],
      ]) {
        const start = performance.now();
        const result =
          name === 'baseline80'
            ? await baseline(refs, intent.query, semantic, window)
            : await rankReferences(
                refs,
                DiscoveryQuery.parse({
                  query: intent.query,
                  candidateWindow: window,
                  limit: 10,
                  retrieval: name === 'revisedLexical' ? 'lexical' : 'hybrid',
                }),
                semantic,
              );
        row.variants[name] = {
          ...metrics(result.results, row.grades),
          durationMs: Math.round(performance.now() - start),
          resultItemIds: result.results.map((r) => r.relationships[0].itemId),
          pipeline: result.pipeline,
          relevantAdmittedToScoring: refs
            .filter(
              (r) =>
                row.grades[r.relationships[0].itemId] && result.scoredReferenceIds.includes(r.id),
            )
            .map((r) => r.relationships[0].itemId),
          relevantDiscardedBeforeScoring: refs
            .filter(
              (r) =>
                row.grades[r.relationships[0].itemId] && !result.scoredReferenceIds.includes(r.id),
            )
            .map((r) => r.relationships[0].itemId),
          returned: result.results.length,
        };
      }
      report.cases.push(row);
    }
    for (const name of ['baseline80', 'revised80', 'revised160', 'revisedLexical']) {
      const rows = report.cases.map((c) => c.variants[name]),
        aggregate = {};
      for (const metric of [
        'recall5',
        'recall10',
        'mrr10',
        'ndcg10',
        'sourceDiversity10',
        'empty',
        'durationMs',
      ])
        aggregate[metric] = rows.reduce((sum, r) => sum + r[metric], 0) / rows.length;
      const times = rows.map((r) => r.durationMs).sort((a, b) => a - b);
      aggregate.p50Ms = times[Math.ceil(times.length * 0.5) - 1];
      aggregate.p95Ms = times[Math.ceil(times.length * 0.95) - 1];
      report.aggregates[name] = aggregate;
    }
    report.memory = {
      before,
      after: process.memoryUsage(),
      meaning:
        'Process RSS includes loaded ONNX model/runtime and allocator high-water marks; no per-variant peak attribution.',
    };
    return report;
  } finally {
    await semantic.close();
  }
}
export async function liveEvaluation() {
  const { Client } = await import('@modelcontextprotocol/client');
  const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');
  const cwd = mkdtempSync(join(tmpdir(), 'mimicus-retrieval-live-'));
  const env = { MIMICUS_SEMANTIC: '1', MIMICUS_TIMEOUT_MS: '45000', MIMICUS_MAX_BYTES: '40000000' };
  for (const key of [
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
    'MIMICUS_MODEL_CACHE_DIR',
  ])
    if (process.env[key]) env[key] = process.env[key];
  const client = new Client({ name: 'mimicus-hardening-live-retrieval', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('dist/cli.js'), 'serve'],
    cwd,
    env,
    stderr: 'pipe',
  });
  const report = {
    measuredAt: new Date().toISOString(),
    transport: 'Official SDK stdio, production CLI, no adapter injection',
    scope:
      'Live metadata retrieval and local MiniLM only. No original website/browser visit, screenshot export, catalog or vector export.',
    cases: [],
  };
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args }, { timeout: 90000 });
    if (result.isError || !result.structuredContent?.data)
      throw new Error('MCP tool failed: ' + name);
    return result.structuredContent.data;
  };
  try {
    await client.connect(transport);
    let stderrBytes = 0;
    transport.stderr?.on('data', (chunk) => {
      stderrBytes += chunk.length;
    });
    const tools = await client.listTools();
    const properties = tools.tools.find((t) => t.name === 'mimicus_search')?.inputSchema
      ?.properties;
    report.budgetControlsOnWire = Boolean(
      properties?.candidateWindow && properties?.retentionLimit,
    );
    for (const [name, input, count] of [
      [
        'nuxt-coffee-semantic-progressive',
        {
          providers: ['nuxt'],
          query: 'premium coffee retail',
          retrieval: 'hybrid',
          candidateWindow: 20,
          retentionLimit: 120,
          limit: 5,
        },
        2,
      ],
      [
        'six-source-webgl-semantic-progressive',
        {
          providers: providers,
          query: 'immersive WebGL',
          retrieval: 'hybrid',
          candidateWindow: 20,
          retentionLimit: 200,
          limit: 8,
        },
        2,
      ],
      [
        'native-industry-lexical-fallback',
        {
          providers: ['nuxt'],
          industry: 'Retail & Food',
          retrieval: 'lexical',
          candidateWindow: 20,
          retentionLimit: 120,
          limit: 5,
        },
        1,
      ],
    ]) {
      const entry = { name, input, pages: [], errors: [] },
        seen = new Set(),
        addresses = [];
      let operationId;
      try {
        for (let n = 0; n < count; n++) {
          const start = performance.now(),
            result = await call('mimicus_search', n ? { operationId } : input);
          operationId = result.operationId;
          const repeats = result.results.filter((r) => seen.has(r.id)).length;
          for (const r of result.results) {
            seen.add(r.id);
            addresses.push({ id: r.id, url: r.url });
          }
          entry.pages.push({
            durationMs: Math.round(performance.now() - start),
            returned: result.results.length,
            retrieval: result.retrieval,
            embeddedCandidates: result.embeddedCandidates,
            metadataHttpRequests: result.metadataHttpRequests,
            resultScope: result.resultScope,
            hasMore: result.hasMore,
            pipeline: result.pipeline,
            stages: result.retrievalStages,
            repeatedDeliveredIds: repeats,
            partialCoverage: result.partialCoverage,
            sources: result.sources.map((s) => ({
              provider: s.provider,
              stream: s.stream,
              status: s.status,
              returnedRecords: s.returnedRecords,
              coverage: s.coverage,
            })),
            resultIdentityHash: createHash('sha256')
              .update(result.results.map((r) => r.id).join('\n'))
              .digest('hex'),
          });
          if (!result.hasMore) break;
        }
        for (const address of addresses) {
          const detail = await call('mimicus_get_reference', {
            operationId,
            referenceId: address.id,
          });
          if (detail.url !== address.url) throw new Error('Returned address changed unexpectedly');
        }
        entry.addressesVerified = addresses.length;
        entry.passed =
          addresses.length > 0 &&
          entry.pages.every((p) => p.repeatedDeliveredIds === 0 && p.embeddedCandidates <= 20);
      } catch (error) {
        entry.errors.push(String(error).slice(0, 500));
        entry.passed = false;
      } finally {
        if (operationId) await call('mimicus_end_discovery', { operationId });
      }
      report.cases.push(entry);
    }
    report.stderrBytes = stderrBytes;
    const finalStatus = await call('mimicus_list_sources');
    report.finalStatus = {
      federation: finalStatus.federation,
      browser: finalStatus.browser,
      semantic: finalStatus.semantic
        ? {
            model: finalStatus.semantic.model,
            state: finalStatus.semantic.state,
            pending: finalStatus.semantic.pending,
            siteVectorsPersisted: finalStatus.semantic.siteVectorsPersisted,
          }
        : undefined,
    };
  } finally {
    await client.close();
    report.cwdFileCountAfterExit = readdirSync(cwd).length;
    if (!report.cwdFileCountAfterExit) rmdirSync(cwd);
  }
  report.passed =
    report.budgetControlsOnWire &&
    report.cwdFileCountAfterExit === 0 &&
    report.cases.every((c) => c.passed) &&
    report.cases.some((c) => c.pages.some((p) => p.embeddedCandidates > 0));
  if (!report.passed) process.exitCode = 1;
  return report;
}
if (process.argv.includes('--live')) console.log(JSON.stringify(await liveEvaluation(), null, 2));
else if (process.argv.includes('--describe'))
  console.log(JSON.stringify({ intents, ...evaluationFixture() }, null, 2));
else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await runEvaluation(), null, 2));
