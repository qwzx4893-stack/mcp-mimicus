import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { Federation, mergeReferences } from '../dist/discovery/federation.js';
import { AwwwardsAdapter } from '../dist/discovery/providers/index.js';
import { rankReferences } from '../dist/discovery/ranking.js';
import { DiscoveryQuery, SourceRecordSchema } from '../dist/discovery/types.js';
import { LocalSemantic } from '../dist/semantic.js';
import { cleanup, config, fixture, temporary } from './helpers.mjs';

const record = (provider, url = 'https://owned.example/') =>
  SourceRecordSchema.parse({
    provider,
    stream: 'showcase',
    itemId: provider,
    title: 'Owned editorial reference',
    url,
    listingUrl: 'https://gallery.example/item',
    native: {
      categories: ['Editorial'],
      tags: ['GSAP'],
      technologies: [provider === 'astro' ? 'Astro' : 'Nuxt'],
    },
    makers: ['Owned studio'],
    retrievedAt: new Date().toISOString(),
    provenance: 'Owned controlled test data, not a live curated provider',
  });
test('A genuinely missing offline model reports lexical fallback without creating a cache', {
  timeout: 30000,
}, async () => {
  const dir = temporary(),
    model = new LocalSemantic({
      ...config('.'),
      semanticEnabled: true,
      semanticDownload: false,
      modelCacheDir: dir,
    });
  try {
    const result = await rankReferences(
      mergeReferences([record('nuxt')]),
      DiscoveryQuery.parse({ query: 'editorial', retrieval: 'hybrid' }),
      model,
    );
    assert.equal(result.retrieval, 'lexical-fallback');
    assert.ok(result.semanticError);
    assert.equal(result.embeddedCandidates, 0);
    assert.equal(result.results.length, 1);
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    await model.close();
    cleanup(dir);
  }
});
test('Fresh requests normalize/dedup native provenance in RAM, isolate a failed source, and never create a local catalog', async () => {
  const f = await fixture(),
    dir = temporary();
  let reads = 0;
  const make = (id) => ({
      id,
      search: async (c) => {
        reads++;
        const r = await c.get(f.origin + '/source'),
          d = JSON.parse(r.body);
        return [
          {
            provider: id,
            stream: 'showcase',
            status: 'available',
            records: [
              { ...record(id, d.items[0].url + '?utm_source=' + id), title: d.items[0].title },
            ],
            coverage: 'Owned HTTP fixture only',
            diagnostics: [],
            retrievedAt: new Date().toISOString(),
          },
        ];
      },
    }),
    fed = new Federation(config(dir, f.origin), undefined, [
      make('astro'),
      make('nuxt'),
      {
        id: 'webflow',
        search: async () => {
          throw new Error('Controlled unavailable source');
        },
      },
    ]);
  try {
    const before = readdirSync(dir),
      first = await fed.search({ query: 'editorial', retrieval: 'lexical' });
    assert.equal(first.results.length, 1);
    assert.equal(first.results[0].relationships.length, 2);
    assert.ok(first.results[0].relationships.every((r) => r.native.tags.includes('GSAP')));
    assert.equal(first.partialCoverage, true);
    assert.ok(first.sources.some((s) => s.status === 'unavailable'));
    f.advance();
    const second = await fed.search({ query: 'editorial', retrieval: 'lexical' });
    assert.notEqual(second.operationId, first.operationId);
    assert.match(second.results[0].title, /revision 2/);
    assert.equal(reads, 4);
    assert.equal(
      f.hits.filter((h) => h === '/source').length,
      2,
      'One coalesced HTTP fetch per operation; a later independent operation fetches again',
    );
    const continued = await fed.search({ operationId: second.operationId });
    assert.equal(continued.freshIndependentOperation, false);
    assert.equal(reads, 4);
    assert.equal(
      fed.categories(second.operationId).sources.some((s) => s.nativeLabels.includes('GSAP')),
      true,
    );
    assert.deepEqual(readdirSync(dir), before);
    fed.end(first.operationId);
    fed.end(second.operationId);
    assert.equal(fed.status().retainedReferences, 0);
  } finally {
    await fed.close();
    await f.close();
    cleanup(dir);
  }
});
test('Canonical dedup keeps independent native categories and makers without inventing labels', () => {
  const merged = mergeReferences([
    record('nuxt', 'https://owned.example/?utm_source=one'),
    {
      ...record('astro', 'https://owned.example/'),
      native: { categories: ['Portfolio'], tags: ['WebGL'], technologies: ['Astro'], awards: [] },
      makers: ['Another studio'],
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].relationships.length, 2);
  assert.ok(merged[0].relationships[0].native.categories.includes('Editorial'));
  assert.ok(merged[0].relationships[1].native.categories.includes('Portfolio'));
  assert.equal(merged[0].inspection, 'requires-authorized-open');
});
test('No-license Awwwards mode retains source integration but performs zero catalog fetches', async () => {
  let fetched = 0;
  const result = await new AwwwardsAdapter().search({
    config: config('.'),
    query: { query: '', limit: 5 },
    publicPage: async () => {
      fetched++;
      throw new Error('Should not fetch');
    },
  });
  assert.equal(result[0].provider, 'awwwards');
  assert.equal(result[0].status, 'blocked');
  assert.equal(fetched, 0);
  assert.deepEqual(result[0].records, []);
});
test('Temporary semantic batches use the same model interface without retaining a text/vector cache', async () => {
  const model = new LocalSemantic({ ...config('.'), semanticEnabled: true });
  let batches = 0,
    active = 0,
    peak = 0;
  model.extractor = async (texts) => {
    batches++;
    active++;
    peak = Math.max(peak, active);
    await new Promise((ok) => setTimeout(ok, 5));
    active--;
    return {
      tolist: () => texts.map(() => Array.from({ length: 384 }, (_, i) => Number(i === 0))),
    };
  };
  try {
    const first = await model.embed(['same', 'same']);
    assert.equal(first.length, 2);
    await model.embed(['same']);
    assert.equal(batches, 2, 'No embeddings survive a request as a local text cache');
    const pending = await Promise.allSettled(
      Array.from({ length: 12 }, () => model.embed(['owned'])),
    );
    assert.equal(pending.filter((r) => r.status === 'fulfilled').length, 8);
    assert.equal(peak, 1);
    assert.equal(model.status().siteVectorsPersisted, false);
  } finally {
    await model.close();
  }
});
