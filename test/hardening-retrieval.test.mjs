import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigSchema } from '../dist/config.js';
import { Federation, mergeReferences } from '../dist/discovery/federation.js';
import { rankReferences } from '../dist/discovery/ranking.js';
import { DiscoveryInput, DiscoveryQuery, SourceRecordSchema } from '../dist/discovery/types.js';
import { LocalSemantic } from '../dist/semantic.js';

const record = (n, extra = {}) =>
  SourceRecordSchema.parse({
    provider: 'astro',
    stream: 'showcase',
    itemId: String(n),
    title: 'Owned sample ' + n,
    url: `https://owned-${n}.example/`,
    listingUrl: 'https://gallery.example/',
    provenance: 'Independent owned retrieval fixture, not source connectivity evidence',
    retrievedAt: '2026-10-19T00:00:00Z',
    ...extra,
  });
const page = (records, next = null) => ({
  provider: 'astro',
  stream: 'showcase',
  status: 'available',
  records,
  next,
  coverage: 'Owned finite fixture only',
  diagnostics: [],
  retrievedAt: '2026-10-19T00:00:00Z',
});
const semanticFixture = (config, observed = []) => ({
  config,
  embed: async (texts) => {
    observed.push(...texts.slice(1));
    return texts.map((text, i) => {
      const vector = new Float32Array(384);
      vector[i === 0 || text.includes('arabica beans') ? 0 : 1] = 1;
      return vector;
    });
  },
  close: async () => {},
});

for (const retrieval of ['lexical', 'hybrid'])
  test(`Scored ${retrieval} leftovers paginate without re-fetching or re-embedding and every address is delivered once`, async () => {
    const config = ConfigSchema.parse({ semanticEnabled: true, candidateLimit: 20 });
    let fetches = 0,
      embeddings = 0;
    const semantic = semanticFixture(config);
    const embed = semantic.embed;
    semantic.embed = async (...args) => {
      embeddings++;
      return embed(...args);
    };
    const fed = new Federation(config, semantic, [
      {
        id: 'astro',
        search: async () => {
          fetches++;
          return [page(Array.from({ length: 8 }, (_, n) => record(n)))];
        },
      },
    ]);
    try {
      let result = await fed.search({ providers: ['astro'], query: 'owned', retrieval, limit: 2 });
      const ids = new Set();
      for (let n = 0; n < 4; n++) {
        assert.equal(result.results.length, 2);
        for (const r of result.results) {
          assert.ok(!ids.has(r.id));
          ids.add(r.id);
        }
        assert.equal(result.hasMore, n < 3);
        if (n) {
          assert.equal(result.embeddedCandidates, 0);
          assert.equal(result.resultScope, 'retained-ranked-candidates');
        }
        if (result.hasMore) result = await fed.search({ operationId: result.operationId });
      }
      assert.equal(ids.size, 8);
      assert.equal(fetches, 1);
      assert.equal(embeddings, retrieval === 'lexical' ? 0 : 1);
      for (const id of ids) assert.equal(fed.getReference(result.operationId, id).id, id);
    } finally {
      await fed.close();
    }
  });

test('Large semantic windows use bounded native microbatches and cancellation prevents later batches', async () => {
  const config = ConfigSchema.parse({ semanticEnabled: true }),
    model = new LocalSemantic(config);
  const controller = new AbortController(),
    sizes = [];
  model.extractor = async (texts) => {
    sizes.push(texts.length);
    if (sizes.length === 2) controller.abort(new Error('Owned inference cancellation'));
    return {
      tolist: () => texts.map(() => Array.from({ length: 384 }, (_, i) => Number(i === 0))),
    };
  };
  try {
    await assert.rejects(
      model.embed(
        Array.from({ length: 100 }, (_, n) => 'Owned text ' + n),
        controller.signal,
      ),
      /Owned inference cancellation/,
    );
    assert.deepEqual(sizes, [16, 16]);
    assert.equal(model.status().pending, 0);
    assert.equal(model.status().siteVectorsPersisted, false);
  } finally {
    await model.close();
  }
});

test('Progressive semantic windows eventually consider a sparse late reference without a lexical-only permanent cutoff', async () => {
  const config = ConfigSchema.parse({ candidateLimit: 20, semanticEnabled: true });
  const observed = [],
    records = Array.from({ length: 125 }, (_, n) =>
      record(n, {
        title: n === 124 ? 'Atelier Ember' : 'Coffee retail status ' + n,
        description:
          n === 124
            ? 'Single-origin arabica beans, roast subscriptions and a shop.'
            : 'Incident response software.',
      }),
    );
  let fetches = 0;
  const fed = new Federation(config, semanticFixture(config, observed), [
    {
      id: 'astro',
      search: async () => {
        fetches++;
        return [page(records)];
      },
    },
  ]);
  try {
    let result = await fed.search({
      query: 'coffee retail',
      providers: ['astro'],
      candidateWindow: 20,
      retentionLimit: 200,
      limit: 5,
    });
    const id = result.operationId,
      delivered = new Set();
    let found = false,
      rounds = 0;
    do {
      assert.ok(result.embeddedCandidates <= 20);
      assert.ok(result.retainedCandidates <= 200);
      for (const r of result.results) {
        assert.ok(!delivered.has(r.id), 'Continuation must not replay delivered reference sets');
        delivered.add(r.id);
        if (r.title === 'Atelier Ember') found = true;
        assert.equal(fed.getReference(id, r.id).url, r.url);
      }
      if (!result.hasMore) break;
      result = await fed.search({ operationId: id });
    } while (++rounds < 30);
    assert.equal(found, true);
    assert.ok(observed.some((text) => text.includes('arabica beans')));
    assert.equal(
      observed.length,
      125,
      'Each fetched candidate is embedded once across the progressive windows',
    );
    assert.equal(delivered.size, 125, 'All bounded ranked leftovers remain deliverable');
    assert.equal(result.hasMore, false);
    assert.equal(fetches, 1, 'Deferred inference must not refetch finished source pages');
    assert.ok(rounds > 0, 'Fixture exercises explicit bounded continuation');
  } finally {
    await fed.close();
  }
});

test('RAM retention grows progressively beyond eighty while preserving delivered addresses and declaring evictions', async () => {
  const config = ConfigSchema.parse({ candidateLimit: 80, semanticEnabled: false });
  const fed = new Federation(config, undefined, [
    {
      id: 'astro',
      search: async (c) => {
        const offset = Number(c.cursors.get('astro:showcase') ?? 0);
        return [
          page(
            Array.from({ length: 40 }, (_, n) => record(offset + n)),
            offset < 120 ? String(offset + 40) : null,
          ),
        ];
      },
    },
  ]);
  try {
    let result = await fed.search({
      providers: ['astro'],
      retrieval: 'lexical',
      retentionLimit: 100,
      limit: 10,
    });
    const delivered = new Set(),
      activeAddresses = new Map();
    let evicted = 0,
      round = 0;
    do {
      evicted += result.evictedCandidates;
      assert.equal(result.evictedReferenceIds.length, result.evictedCandidates);
      for (const id of result.evictedReferenceIds) activeAddresses.delete(id);
      for (const r of result.results) {
        assert.ok(!delivered.has(r.id));
        delivered.add(r.id);
        activeAddresses.set(r.id, r.url);
      }
      for (const [id, url] of activeAddresses)
        assert.equal(fed.getReference(result.operationId, id).url, url);
      assert.ok(result.retainedCandidates <= 100);
      if (!result.hasMore) break;
      result = await fed.search({ operationId: result.operationId });
    } while (++round < 30);
    assert.equal(result.retainedCandidates, 100);
    assert.ok(evicted > 0);
    assert.equal(delivered.size, 160);
    assert.equal(result.hasMore, false);
  } finally {
    await fed.close();
  }
});

test('Native filters require real exact labels; free-form concepts are soft and offline lexical ranking considers the whole fetched set', async () => {
  const config = ConfigSchema.parse({ candidateLimit: 10, semanticEnabled: false });
  const records = mergeReferences([
    record(0, { title: 'Map', native: { categories: ['Cartography'] } }),
    record(1, { title: 'Quiet archive', native: { categories: ['Art'] } }),
    ...Array.from({ length: 40 }, (_, n) => record(n + 2)),
    record(100, { title: 'مقهى coffee', native: { categories: ['Art'] } }),
  ]);
  const native = await rankReferences(
    records,
    DiscoveryQuery.parse({ category: 'art', mood: 'quiet', retrieval: 'lexical' }),
    { config },
  );
  assert.equal(native.candidatesConsidered, 2);
  assert.ok(native.results.every((r) => r.relationships[0].native.categories.includes('Art')));
  const fallback = await rankReferences(
    records,
    DiscoveryQuery.parse({ query: 'مقهى', style: 'minimal', retrieval: 'lexical' }),
    { config },
  );
  assert.equal(fallback.results[0].title, 'مقهى coffee');
  assert.equal(fallback.pipeline.lexicalScoredCandidates, records.length);
  assert.equal(fallback.embeddedCandidates, 0);
  assert.deepEqual(DiscoveryInput.parse({ operationId: 'owned' }), { operationId: 'owned' });
});

test('A deliberately small retention cap reports invalidated prior addresses rather than silently promising them', async () => {
  const config = ConfigSchema.parse({ semanticEnabled: false });
  let round = 0;
  const fed = new Federation(config, undefined, [
    {
      id: 'astro',
      search: async () => [
        page(
          Array.from({ length: 10 }, (_, n) => record(n + round * 10)),
          ++round < 2 ? 'next' : null,
        ),
      ],
    },
  ]);
  try {
    await assert.rejects(
      fed.search({ providers: ['astro'], retrieval: 'lexical', limit: 20, retentionLimit: 10 }),
      /retentionLimit must be at least/,
    );
    const first = await fed.search({
      providers: ['astro'],
      retrieval: 'lexical',
      limit: 10,
      retentionLimit: 10,
    });
    const second = await fed.search({ operationId: first.operationId });
    assert.ok(second.evictedReferenceIds.includes(first.results[0].id));
    assert.throws(() => fed.getReference(first.operationId, first.results[0].id), /not in active/);
    assert.equal(second.retainedCandidates, 10);
  } finally {
    await fed.close();
  }
});

test('An access-restricted provider is reported blocked while independent completed sources remain usable', async () => {
  const config = ConfigSchema.parse({ semanticEnabled: false });
  const fed = new Federation(config, undefined, [
    { id: 'astro', search: async () => [page([record(1)])] },
    {
      id: 'webflow',
      search: async () => {
        throw new Error('Source HTTP 403: robots.txt disallows catalog access');
      },
    },
  ]);
  try {
    const result = await fed.search({ retrieval: 'lexical' });
    assert.equal(result.results.length, 1);
    assert.equal(result.sources.find((s) => s.provider === 'webflow').status, 'blocked');
    assert.equal(result.partialCoverage, true);
  } finally {
    await fed.close();
  }
});

test('Eviction does not forget delivered IDs when a later native page repeats an old original URL', async () => {
  const config = ConfigSchema.parse({ semanticEnabled: false });
  let round = 0;
  const fed = new Federation(config, undefined, [
    {
      id: 'astro',
      search: async () => {
        const n = round++;
        return [
          page(
            n < 2
              ? Array.from({ length: 10 }, (_, i) => record(n * 10 + i))
              : [record(0), record(20)],
            n < 2 ? String(n + 1) : null,
          ),
        ];
      },
    },
  ]);
  try {
    const first = await fed.search({
      providers: ['astro'],
      retrieval: 'lexical',
      limit: 10,
      retentionLimit: 10,
    });
    const second = await fed.search({ operationId: first.operationId });
    assert.ok(second.evictedReferenceIds.includes(first.results[0].id));
    const third = await fed.search({ operationId: first.operationId });
    assert.equal(third.results.length, 1);
    assert.equal(third.results[0].title, 'Owned sample 20');
    assert.equal(third.retrievalStages.deliveredIdsTracked, 21);
    assert.equal(third.hasMore, false);
  } finally {
    await fed.close();
  }
});

test('The ID-only delivery ledger has an explicit finite RAM cap and closes rather than forgetting old deliveries', async () => {
  const config = ConfigSchema.parse({ semanticEnabled: false });
  let round = 0;
  const fed = new Federation(config, undefined, [
    {
      id: 'astro',
      search: async () => {
        const offset = round++ * 30;
        return [
          page(
            Array.from({ length: 30 }, (_, n) => record(offset + n)),
            String(round),
          ),
        ];
      },
    },
  ]);
  try {
    let result = await fed.search({
      providers: ['astro'],
      retrieval: 'lexical',
      limit: 30,
      retentionLimit: 30,
    });
    for (let n = 1; n < 80; n++) result = await fed.search({ operationId: result.operationId });
    assert.equal(result.retrievalStages.deliveredIdsTracked, 2400);
    assert.equal(result.retainedCandidates, 30);
    assert.match(result.continuationBlocked, /ledger is full/);
    await assert.rejects(fed.search({ operationId: result.operationId }), /2400-ID RAM limit/);
    assert.equal(round, 80, 'A capped continuation must stop before fetching another source page');
    assert.equal(fed.status().activeOperations, 0);
  } finally {
    await fed.close();
  }
});
