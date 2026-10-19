import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigSchema } from '../dist/config.js';
import { Federation } from '../dist/discovery/federation.js';
import { SourceRecordSchema } from '../dist/discovery/types.js';

const record = (n) =>
  SourceRecordSchema.parse({
    provider: 'astro',
    stream: 'showcase',
    itemId: String(n),
    title: 'Owned reference ' + n,
    url: 'https://site' + n + '.example/',
    listingUrl: 'https://astro.build/showcase/',
    provenance: 'Owned lifecycle fixture, not actual source connectivity',
    retrievedAt: new Date().toISOString(),
  });
const page = (n) => ({
  provider: 'astro',
  stream: 'showcase',
  status: 'partial',
  records: [record(n)],
  next: String(n + 1),
  coverage: 'Owned lifecycle source fixture',
  diagnostics: [],
  retrievedAt: new Date().toISOString(),
});
const vectors = (texts) => texts.map(() => new Float32Array(384).fill(0.01));

test('Discovery deadline bounds semantic waiting and reports late non-preemptible work honestly', {
  timeout: 5000,
}, async () => {
  const config = ConfigSchema.parse({ semanticEnabled: true, timeoutMs: 1000 });
  let release,
    embeddingSignal,
    finished = false,
    embedStarted;
  const started = new Promise((ok) => (embedStarted = ok)),
    nativeWork = new Promise((ok) => (release = ok)),
    semantic = {
      config,
      embed: async (texts, signal) => {
        embeddingSignal = signal;
        embedStarted();
        await nativeWork;
        finished = true;
        return vectors(texts);
      },
      close: async () => nativeWork,
    };
  const fed = new Federation(config, semantic, [{ id: 'astro', search: async () => [page(0)] }]);
  let guard;
  try {
    const begin = performance.now(),
      request = fed.search({ providers: ['astro'], query: 'Owned reference', retrieval: 'hybrid' });
    await started;
    const result = await Promise.race([
      request,
      new Promise((_, reject) => {
        guard = setTimeout(
          () => reject(new Error('Discovery wait exceeded its bounded deadline')),
          1800,
        );
      }),
    ]);
    clearTimeout(guard);
    assert.ok(performance.now() - begin < 1800);
    assert.equal(
      finished,
      false,
      'Request must return before the non-preemptible runtime finishes',
    );
    assert.equal(embeddingSignal.aborted, true, 'Semantic work receives the full request deadline');
    assert.equal(result.retrieval, 'lexical-fallback');
    assert.equal(result.results.length, 1);
    assert.equal(result.semanticDeadlineExceeded, true);
    assert.equal(result.semanticWorkMayContinue, true);
    assert.equal(result.temporaryVectorsReleased, false);
    assert.match(result.semanticWorkLimitation, /cannot be preempted/);
    assert.equal(result.embeddedCandidates, 0);
    assert.ok(
      !('semanticScore' in result.results[0]) || result.results[0].semanticScore === undefined,
    );
  } finally {
    clearTimeout(guard);
    release();
    await fed.close();
  }
});

test('Cancelling semantic work during continuation closes the advanced operation instead of silently skipping a source page', {
  timeout: 3000,
}, async () => {
  const config = ConfigSchema.parse({ semanticEnabled: true });
  let calls = 0,
    release,
    embedStarted;
  const started = new Promise((ok) => (embedStarted = ok)),
    nativeWork = new Promise((ok) => (release = ok)),
    semantic = {
      config,
      embed: async (texts) => {
        if (++calls === 2) {
          embedStarted();
          await nativeWork;
        }
        return vectors(texts);
      },
      close: async () => nativeWork,
    },
    fed = new Federation(config, semantic, [
      { id: 'astro', search: async (c) => [page(Number(c.cursors.get('astro:showcase') ?? 0))] },
    ]);
  try {
    const first = await fed.search({
        providers: ['astro'],
        query: 'Owned reference',
        retrieval: 'hybrid',
        limit: 1,
      }),
      controller = new AbortController(),
      request = fed.search({ operationId: first.operationId }, controller.signal);
    await started;
    controller.abort(new Error('Owned client cancellation'));
    await assert.rejects(request, /Owned client cancellation/);
    assert.equal(fed.status().activeOperations, 0);
    assert.equal(fed.status().retainedReferences, 0);
    assert.throws(
      () => fed.getReference(first.operationId, first.results[0].id),
      /expired or closed/,
    );
    await assert.rejects(fed.search({ operationId: first.operationId }), /expired or closed/);
    release();
    const restarted = await fed.search({
      providers: ['astro'],
      query: 'Owned reference',
      retrieval: 'hybrid',
      limit: 1,
    });
    assert.equal(
      restarted.results[0].title,
      'Owned reference 0',
      'Explicit restart does not pretend the cancelled page was delivered',
    );
  } finally {
    release();
    await fed.close();
  }
});
