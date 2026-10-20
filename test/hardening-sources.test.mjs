import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AstroAdapter,
  AwwwardsAdapter,
  astroCandidateOrder,
  CodropsAdapter,
  Mesh3dAdapter,
  NuxtAdapter,
  WebflowAdapter,
} from '../dist/discovery/providers/index.js';
import { codropsHub, meshNativeFilters } from '../dist/discovery/providers/parsers.js';
import { DiscoveryQuery } from '../dist/discovery/types.js';
import { config } from './helpers.mjs';

const response = (url, body) => ({
  url,
  status: 200,
  headers: {},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const context = (query, handler) => ({
  config: config('.'),
  query: DiscoveryQuery.parse(query),
  pageSize: 3,
  cursors: new Map(),
  get: async (u) => handler(u),
  publicPage: async (u) => handler(u),
});
const nextData = (p) =>
  `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: p } })}</script>`;

test('Awwwards explicit URL-only handoff stays unverified and does not fetch the gallery', async () => {
  const c = context(
    {
      providers: ['awwwards'],
      originalReferences: [{ url: 'https://original.example/?utm_source=awwwards' }],
    },
    () => {
      throw new Error('No source network is allowed');
    },
  );
  c.config.sourceAuthorizations = {
    awwwards: 'I have permission but this is not a verified grant',
  };
  const [p] = await new AwwwardsAdapter().search(c);
  assert.equal(p.status, 'available');
  assert.equal(p.sourceRetrievedRecords, 0);
  assert.equal(p.manualReferenceCount, 1);
  assert.equal(p.records[0].title, 'original.example');
  assert.equal(p.records[0].listingUrl, 'https://original.example/');
  assert.equal(p.records[0].sourceMetadata.noAwwwardsListing, true);
  assert.equal(p.records[0].sourceMetadata.relationshipVerified, false);
  assert.equal(p.hasMore, false);
});

test('Astro niche brief facets influence candidates while progressive exploration eventually includes every unlabeled original', () => {
  const index = Array.from({ length: 30 }, (_, i) => ({
    title: i > 10 ? 'Coffee project ' + i : 'Unlabeled ' + i,
    url: `https://site${i}.example`,
    slug: 'site' + i,
  }));
  const ordered = astroCandidateOrder(
    index,
    DiscoveryQuery.parse({ style: 'coffee', query: '' }),
    4,
  );
  assert.match(ordered[0].title, /Coffee/);
  assert.equal(ordered[2], index[0]);
  assert.equal(new Set(ordered).size, index.length);
  assert.ok(index.every((item) => ordered.includes(item)));
});

test('Astro actual YAML description enriches only selected records, without assigning invented style metadata', async () => {
  const sha = 'a'.repeat(40),
    seen = [];
  const c = context({ providers: ['astro'], style: 'cinematic' }, (u) => {
    seen.push(u);
    if (u.endsWith('showcase.json'))
      return response(u, [
        { title: 'Selected', url: 'https://original.example', slug: 'selected' },
      ]);
    if (u.endsWith('branches/main')) return response(u, { commit: { sha } });
    return response(
      u,
      'title: Selected\nurl: https://original.example\ndescription: Authored showcase description\n',
    );
  });
  const [p] = await new AstroAdapter().search(c);
  assert.equal(p.records[0].description, 'Authored showcase description');
  assert.deepEqual(p.records[0].native.tags, []);
  assert.deepEqual(p.records[0].native.categories, []);
  assert.equal(seen.filter((u) => u.endsWith('.yml')).length, 1);
});

test('plain Webflow text search omits landing HTML but validates every actual original detail link with bounded parallel work', async () => {
  let active = 0,
    maximum = 0;
  const seen = [];
  const c = context({ query: 'coffee', providers: ['webflow'] }, async (u) => {
    seen.push(u);
    if (u.includes('search-api.swiftype.com'))
      return response(u, {
        records: { page: [0, 1, 2].map((n) => ({ webflow_id: String(n).repeat(24) })) },
        info: { page: { num_pages: 1 } },
      });
    if (u.includes('/feed/by-ids'))
      return response(
        u,
        [0, 1, 2].map((n) => ({
          id: String(n).repeat(24),
          slug: 'coffee' + n,
          title: 'Coffee ' + n,
        })),
      );
    assert.ok(u.includes('/website/coffee'));
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    const n = Number(u.at(-1));
    return response(
      u,
      nextData({
        showcaseItem: {
          siteProfile: { id: String(n).repeat(24), slug: 'coffee' + n, title: 'Coffee ' + n },
        },
      }) + `<a href="https://coffee${n}.example">Open live site</a>`,
    );
  });
  const [p] = await new WebflowAdapter().search(c);
  assert.equal(p.records.length, 3);
  assert.equal(seen.length, 5);
  assert.equal(maximum, 3);
  assert.ok(!seen.includes('https://webflow.com/made-in-webflow'));
  assert.ok(p.records.every((r) => r.url.startsWith('https://coffee')));
  assert.deepEqual(p.taxonomy, []);
});

test('Webflow retains successful siblings when one detail times out and propagates explicit cancellation', async () => {
  const c = context({ providers: ['webflow'] }, (u) => {
    if (u.includes('/feed/'))
      return response(
        u,
        [0, 1, 2].map((n) => ({ id: String(n), slug: 'site' + n, title: 'Site ' + n })),
      );
    if (u.endsWith('site1')) throw new Error('Metadata fetch absolute deadline exceeded');
    const n = u.at(-1);
    return response(
      u,
      nextData({ showcaseItem: { id: n, slug: 'site' + n, title: 'Site ' + n } }) +
        `<a href="https://original${n}.example">Open live site</a>`,
    );
  });
  const [p] = await new WebflowAdapter().search(c);
  assert.equal(p.status, 'partial');
  assert.equal(p.records.length, 2);
  assert.ok(p.diagnostics.some((d) => d.includes('deadline exceeded')));
  const controller = new AbortController();
  controller.abort(new Error('Operator cancelled'));
  c.signal = controller.signal;
  await assert.rejects(new WebflowAdapter().search(c), /Operator cancelled/);
});

test('Codrops resolves actual relative demo links, rejects credential links, and keeps tutorial repository homes distinct from demos', async () => {
  const rejected = [];
  const records = codropsHub(
    '<article><h2>Good</h2><a class="demo-card__thumb-img" href="/demo/actual"></a></article><article><h2>Bad</h2><a class="demo-card__thumb-img" href="https://user:password@evil.example"></a></article>',
    'creative-hub',
    'https://tympanus.net/codrops/hub/all/',
    rejected,
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].url, 'https://tympanus.net/demo/actual');
  assert.equal(rejected.length, 1);
  const c = context({ providers: ['codrops'], stream: 'repositories' }, (u) =>
    response(u, [
      {
        id: 1,
        name: 'Tutorial',
        homepage: 'https://tympanus.net/codrops/2026/10/19/tutorial/',
        html_url: 'https://github.com/codrops/example',
        topics: ['webgl'],
        language: 'JavaScript',
        license: { spdx_id: 'MIT' },
      },
    ]),
  );
  const [p] = await new CodropsAdapter().search(c);
  assert.equal(p.records[0].kind, 'website');
  assert.equal(p.records[0].sourceMetadata.homepageRole, 'tutorial');
  assert.deepEqual(p.records[0].native.categories, []);
  assert.deepEqual(p.records[0].native.tags, ['webgl']);
});

test('Nuxt preserves the source-declared complete industry vocabulary even if one category currently has no site', async () => {
  let calls = 0;
  const c = context({ providers: ['nuxt'] }, (u) => {
    calls++;
    return response(
      u,
      'wall:\n  filters: [Finance, Retail]\nwebsites:\n  - name: Example\n    url: https://original.example\n    industry: Finance\n',
    );
  });
  const adapter = new NuxtAdapter(),
    [a] = await adapter.search(c),
    [b] = await adapter.search(c);
  assert.deepEqual(
    a.taxonomy.map((t) => t.label),
    ['Finance', 'Retail'],
  );
  assert.equal(calls, 2);
  assert.match(a.revision, /^[a-f0-9]{64}$/);
  assert.equal(a.revision, b.revision);
});

test('mesh native listing filters avoid a redundant first detail lookup and never allow API/substitute origins', async () => {
  const html = '<a href="/website/a">A</a><a href="/websites?tech=real-three">Three.js</a>';
  assert.equal(meshNativeFilters(html).length, 1);
  const seen = [],
    c = context({ providers: ['mesh3d'], technology: 'Three.js' }, (u) => {
      seen.push(u);
      if (u === 'https://mesh3d.gallery/websites') return response(u, html);
      if (u.includes('/websites?tech=')) return response(u, '<a href="/website/b">B</a>');
      return response(
        u,
        '<h1>B</h1><a href="https://b.example/?utm_source=mesh3d.gallery">Visit</a><a href="/websites?tech=real-three">Three.js</a>',
      );
    });
  const [p] = await new Mesh3dAdapter().search(c);
  assert.equal(seen.length, 3);
  assert.ok(!seen.includes('https://mesh3d.gallery/website/a'));
  assert.ok(seen.every((u) => !new URL(u).pathname.startsWith('/api/')));
  assert.deepEqual(p.records[0].native.technologies, ['Three.js']);
  c.cursors.set(
    'mesh3d:websites',
    JSON.stringify({ url: 'https://mesh3d.gallery/websites-evil', offset: 0 }),
  );
  await assert.rejects(new Mesh3dAdapter().search(c), /outside expected stream/);
});

test('mesh follows the current public technology parameter and preserves its exact native URL', async () => {
  // Observed public markup on 2026-10-20: the technology facet replaced tech.
  const nativeUrl = 'https://mesh3d.gallery/websites?technology=three-js';
  const detail =
    '<h1>Fixture</h1><a href="https://fixture.example/?utm_source=mesh3d.gallery">Visit</a>' +
    '<h2>How it\'s built</h2><div><a href="/websites?technology=three-js"><span>Three.js</span></a>' +
    '<a href="/websites?technology=webgl2">WebGL2</a></div>' +
    '<a href="https://other.example/websites?technology=untrusted">Untrusted</a>' +
    '<a href="/api/websites?technology=private">Private</a>';
  assert.deepEqual(meshNativeFilters(detail), [
    { label: 'Three.js', id: 'three-js', kind: 'tech', url: nativeUrl },
    {
      label: 'WebGL2',
      id: 'webgl2',
      kind: 'tech',
      url: 'https://mesh3d.gallery/websites?technology=webgl2',
    },
  ]);
  const seen = [],
    c = context({ providers: ['mesh3d'], technology: 'Three.js' }, (u) => {
      seen.push(u);
      if (u === 'https://mesh3d.gallery/websites')
        return response(u, '<a href="/website/first">First</a>');
      if (u === nativeUrl) return response(u, '<a href="/website/matching">Matching</a>');
      return response(u, detail);
    });
  const [p] = await new Mesh3dAdapter().search(c);
  assert.ok(seen.includes(nativeUrl));
  assert.ok(
    seen.every(
      (u) =>
        new URL(u).origin === 'https://mesh3d.gallery' && !new URL(u).pathname.startsWith('/api/'),
    ),
  );
  assert.deepEqual(p.records[0].native.technologies, ['Three.js', 'WebGL2']);
  assert.ok(!p.diagnostics.some((message) => message.includes('not exposed')));
});
