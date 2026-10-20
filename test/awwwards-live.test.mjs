import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  awwwardsListing,
  awwwardsNext,
  awwwardsTaxonomy,
  awwwardsUrl,
} from '../dist/discovery/providers/awwwards-parser.js';
import { AwwwardsAdapter } from '../dist/discovery/providers/index.js';
import { DiscoveryQuery } from '../dist/discovery/types.js';
import { card, detail, listing, ROOT, taxonomyHtml } from './awwwards-fixtures.mjs';
import { config } from './helpers.mjs';

const response = (url, body, status = 200) => ({ url, body, status, headers: {} });
function context(query = {}, handler) {
  const seen = [];
  const c = {
    config: config('.'),
    query: DiscoveryQuery.parse({ providers: ['awwwards'], ...query }),
    pageSize: 3,
    cursors: new Map(),
    get: async (url) => {
      seen.push(url);
      return handler(url);
    },
    publicPage: async (url) => {
      seen.push(url);
      return handler(url);
    },
  };
  return { c, seen };
}

test('Awwwards parses isolated bounded source facts, date, makers and awards without importing media', () => {
  const raw = awwwardsListing(
    '<main><li data-collectable-model-value="broken"></li>' + card(1) + card(2) + '</main>',
  );
  assert.equal(raw.length, 2);
  assert.equal(raw[0].title, 'Original 1');
  assert.deepEqual(raw[0].makers, ['Maker 1']);
  assert.deepEqual(raw[0].native.awards, ['Site of the Day']);
  assert.match(raw[0].publishedAt, /^2026-/);
  assert.equal(raw[0].sourceMetadata.relationshipVerified, true);
  assert.ok(!JSON.stringify(raw).includes('must-not-be-imported'));
  assert.equal(raw[0].preview, undefined);
  assert.deepEqual(awwwardsListing('<main>No results found</main>'), []);
  assert.throws(() => awwwardsListing('<main>Unexpected loader only</main>'), /drift/);
});

test('Awwwards taxonomy preserves native groups and rejects navigation pollution/hostile routes', () => {
  const rows = awwwardsTaxonomy(
    taxonomyHtml +
      '<a href="/websites/fake/">Fake</a><li><span class="nav-filters__item">Technology</span><a class="nav-filters__subitem" href="https://evil.example/websites/bad/">Bad</a></li>',
  );
  assert.equal(rows.length, 10);
  assert.equal(rows.find((x) => x.label === 'WebGL').kind, 'technology');
  assert.equal(rows.find((x) => x.label === 'Culture & Education').kind, 'category');
  assert.equal(rows.find((x) => x.label === 'United States').url, ROOT + 'United%20States/');
  assert.ok(!rows.some((x) => ['Fake', 'Bad'].includes(x.label)));
  for (const url of [
    'https://evil.example/websites/',
    'https://www.awwwards.com/search-websites',
    'https://u:p@www.awwwards.com/websites/',
    '/websites/?text=secret',
    '/websites/?page=2&page=3',
  ])
    assert.throws(() => awwwardsUrl(url, 'listing'));
  assert.throws(() => awwwardsUrl('/sites/site-1/content', 'detail'));
});

test('Live adapter exposes source facts/taxonomy, classifies native technology and follows observed pages with isolated detail failure', async () => {
  const base = ROOT + 'webgl/',
    next = base + '?page=2';
  const { c, seen } = context({ technology: 'WebGL' }, (url) => {
    if (url.endsWith('robots.txt'))
      return response(url, 'User-agent: *\nDisallow: /websites/?\nDisallow: /search-websites');
    if (url === ROOT) return response(url, listing([0]));
    if (url === base) return response(url, listing([1, 2, 3, 4, 5], next));
    if (url === next) return response(url, listing([6, 7]));
    const id = url.match(/site-(\d+)/)?.[1];
    if (id) return response(url, detail(id), id === '2' ? 503 : 200);
    throw Error('Unexpected request ' + url);
  });
  c.config.sourceAuthorizations = {};
  const [a] = await new AwwwardsAdapter().search(c);
  assert.equal(a.records.length, 5);
  assert.equal(a.sourceRetrievedRecords, 5);
  assert.equal(a.status, 'partial');
  assert.equal(a.hasMore, true);
  assert.equal(JSON.parse(a.next).url, next);
  assert.ok(a.records.every((r) => r.native.technologies.includes('WebGL')));
  assert.equal(a.records.find((r) => r.itemId === '1').sourceMetadata.detailVerified, true);
  assert.equal(a.records.find((r) => r.itemId === '2').sourceMetadata.detailVerified, false);
  assert.ok(a.records.find((r) => r.itemId === '3').sourceMetadata.detailVerified);
  assert.equal(seen.filter((x) => x.includes('/sites/')).length, 3);
  c.cursors.set('awwwards:websites', a.next);
  const [b] = await new AwwwardsAdapter().search(c);
  assert.deepEqual(
    b.records.map((r) => r.itemId),
    ['6', '7'],
  );
  assert.equal(b.hasMore, false);
  assert.ok(seen.every((x) => new URL(x).origin === 'https://www.awwwards.com'));
  assert.ok(!seen.some((x) => /search-websites|assets\./.test(x)));
});

test('Native country/font/award/tag collections are selected from source URLs rather than fabricated slugs', async () => {
  for (const [field, value, slug] of [
    ['country', 'United States', 'United%20States'],
    ['font', 'Aeonik', 'Aeonik'],
    ['award', 'Sites of the Day', 'sites_of_the_day'],
    ['tag', 'Animation', 'animation'],
  ]) {
    const { c, seen } = context({ awwwards: { [field]: value, details: false } }, (url) =>
      response(url, url === ROOT ? listing([0]) : listing([1])),
    );
    const [p] = await new AwwwardsAdapter().search(c);
    assert.ok(seen.includes(ROOT + slug + '/'));
    assert.equal(p.records[0].sourceMetadata.nativeCollection, value);
    assert.equal(p.status, 'available');
  }
  const { c } = context({ technology: 'Invented Tech' }, (url) => response(url, listing([1])));
  await assert.rejects(new AwwwardsAdapter().search(c), /native technology not found/);
});

test('Actual robots denial on a next link stops that route only without a source-wide ban', async () => {
  const { c, seen } = context({ awwwards: { listingUrl: ROOT, details: false } }, (url) =>
    response(
      url,
      url.endsWith('robots.txt')
        ? 'User-agent: *\nDisallow: /websites/?'
        : listing([1], '/websites/?page=2'),
    ),
  );
  const [p] = await new AwwwardsAdapter().search(c);
  assert.equal(p.records.length, 1);
  assert.equal(p.status, 'partial');
  assert.equal(p.hasMore, false);
  assert.ok(!seen.includes(ROOT + '?page=2'));
  assert.ok(p.diagnostics.some((x) => x.includes('disallowed')));
  assert.equal(p.records[0].sourceMetadata.nativeCollection, undefined);
});

test('Pagination refuses cross-origin, collection changes, duplicate/skipped pages and forged cursor cycles', async () => {
  for (const href of [
    'https://evil.example/websites/webgl/?page=2',
    '/websites/animation/?page=2',
    '/websites/webgl/?page=1',
    '/websites/webgl/?page=3',
  ])
    assert.throws(() => awwwardsNext(`<a rel="next" href="${href}">next</a>`, ROOT + 'webgl/'));
  const { c, seen } = context({}, (url) => response(url, listing([1])));
  c.cursors.set(
    'awwwards:websites',
    JSON.stringify({ url: 'https://evil.example/websites/', visited: [] }),
  );
  await assert.rejects(new AwwwardsAdapter().search(c), /Invalid Awwwards/);
  assert.equal(seen.length, 0);
});

test('Awwwards cancellation is not swallowed as a selected-detail warning', async () => {
  const controller = new AbortController();
  const { c } = context({ technology: 'WebGL' }, (url) => {
    if (url.includes('/sites/')) {
      controller.abort(new Error('explicit cancellation'));
      throw controller.signal.reason;
    }
    return response(url, listing([1]));
  });
  c.signal = controller.signal;
  await assert.rejects(new AwwwardsAdapter().search(c), /explicit cancellation/);
});

test('Awwwards HTTP429 honors cooldown and makes no new source request during Retry-After', async () => {
  let requests = 0;
  const { c } = context({}, (url) => {
    requests++;
    return { ...response(url, 'rate limited', 429), headers: { 'retry-after': '120' } };
  });
  const adapter = new AwwwardsAdapter();
  await assert.rejects(adapter.search(c), /HTTP 429/);
  const before = requests;
  await assert.rejects(adapter.search(c), /retry after/);
  assert.equal(requests, before);
});
