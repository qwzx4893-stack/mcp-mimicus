import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Federation } from '../dist/discovery/federation.js';
import {
  AstroAdapter,
  AwwwardsAdapter,
  Mesh3dAdapter,
  WebflowAdapter,
} from '../dist/discovery/providers/index.js';
import { normalize } from '../dist/discovery/providers/parsers.js';
import { DiscoveryInput, DiscoveryQuery, SourceRecordSchema } from '../dist/discovery/types.js';
import { config } from './helpers.mjs';

const response = (url, body) => ({
  url,
  status: 200,
  headers: {},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const context = (query, handler, cursors = new Map()) => ({
  config: config('.'),
  query: DiscoveryQuery.parse(query),
  pageSize: 3,
  cursors,
  get: async (url) => handler(url),
  publicPage: async (url) => handler(url),
});
const nextData = (p) =>
  `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: p } })}</script>`;

test('MCP discovery input preserves omitted continuation fields while internal query applies first-search defaults', () => {
  assert.deepEqual(DiscoveryInput.parse({ operationId: 'active-operation' }), {
    operationId: 'active-operation',
  });
  const parsed = DiscoveryQuery.parse(DiscoveryInput.parse({}));
  assert.equal(parsed.query, '');
  assert.equal(parsed.limit, 10);
  assert.equal(parsed.retrieval, 'hybrid');
});

test('Awwwards operator handoff is usable, unverified and isolated from restricted catalog extraction', async () => {
  let calls = 0;
  const input = {
      providers: ['awwwards'],
      originalReferences: [
        {
          title: 'Operator-selected original',
          url: 'https://original.example/?utm_source=awwwards',
          listingUrl: 'https://www.awwwards.com/sites/operator-reference',
        },
      ],
    },
    pages = await new AwwwardsAdapter().search(
      context(input, () => {
        calls++;
        throw new Error('Must not fetch gallery');
      }),
    );
  assert.equal(calls, 0);
  assert.equal(pages[0].status, 'blocked');
  assert.equal(pages[0].manualReferenceCount, 1);
  assert.equal(pages[0].records[0].stream, 'operator-reference');
  assert.equal(pages[0].records[0].url, 'https://original.example/');
  assert.equal(pages[0].records[0].sourceMetadata.relationshipVerified, false);
  assert.deepEqual(pages[0].records[0].native, {
    categories: [],
    tags: [],
    technologies: [],
    awards: [],
  });
  assert.equal(pages[0].hasMore, false);
  assert.ok(
    pages[0].capabilities.some(
      (c) => c.name === 'original-site-visual-browsing' && c.status === 'available',
    ),
  );
  for (const listingUrl of [
    'https://evil.example/sites/ref',
    'https://www.awwwards.com/search-websites',
    'https://www.awwwards.com/sites/a?x=1',
  ])
    assert.throws(() =>
      DiscoveryQuery.parse({
        ...input,
        originalReferences: [{ ...input.originalReferences[0], listingUrl }],
      }),
    );
  assert.throws(() =>
    DiscoveryQuery.parse({
      ...input,
      originalReferences: [
        { ...input.originalReferences[0], url: 'https://user:password@original.example' },
      ],
    }),
  );
});

test('Astro searches current actual titles across the full official index, preserves progressive continuation and pins selected YAML', async () => {
  const sha = 'a'.repeat(40),
    hits = [],
    index = Array.from({ length: 9 }, (_, i) => ({
      title: i === 7 ? 'Independent Coffee Roaster' : 'Title ' + i,
      url: `https://site${i}.example`,
      slug: `site${i}.example`,
    })),
    handler = (url) => {
      hits.push(url);
      if (url === 'https://astro.build/api/showcase.json') return response(url, index);
      if (url.endsWith('/branches/main')) return response(url, { commit: { sha } });
      const i = Number(url.match(/site(\d+)\.example\.yml$/)?.[1]);
      assert.ok(url.includes('/' + sha + '/'));
      return response(url, `title: ${index[i].title}\nurl: ${index[i].url}\nhighlight: true\n`);
    },
    c = context({ query: 'coffee', providers: ['astro'] }, handler),
    adapter = new AstroAdapter(),
    first = (await adapter.search(c))[0];
  assert.equal(first.records[0].title, 'Independent Coffee Roaster');
  assert.equal(first.records.length, 3);
  assert.equal(first.revision, sha);
  assert.equal(first.next, '3');
  assert.equal(first.hasMore, true);
  assert.ok(first.coverage.includes('index 9'));
  assert.equal(hits.filter((h) => h.includes('api/showcase')).length, 1);
  c.cursors.set('astro:showcase', first.next);
  const second = (await adapter.search(c))[0];
  assert.equal(second.next, '6');
  assert.ok(second.records.every((r) => !first.records.some((a) => a.itemId === r.itemId)));
  assert.equal(
    hits.filter((h) => h.includes('api/showcase')).length,
    2,
    'An adapter call reads the current official index; coalescing belongs only to an active operation',
  );
});

test('Webflow uses exact public native feed offsets and current tag IDs, verifies original live links, and retains classification', async () => {
  const seen = [];
  const handler = (url) => {
    seen.push(url);
    if (url === 'https://webflow.com/made-in-webflow')
      return response(
        url,
        nextData({ fallbackData: [], tags: [{ id: 'animation', label: 'Animation' }] }),
      );
    if (url.includes('/feed/')) {
      const u = new URL(url),
        offset = Number(u.searchParams.get('offset'));
      assert.equal(u.searchParams.get('tag'), 'animation');
      assert.equal(u.pathname, '/api/v1/marketplace/made-in-webflow/feed/recent');
      return response(
        url,
        Array.from({ length: 3 }, (_, i) => ({
          id: String(offset + i),
          slug: 'site' + (offset + i),
          title: 'Reference ' + (offset + i),
          tags: ['layout'],
        })),
      );
    }
    const id = url.match(/site(\d+)$/)?.[1];
    return response(
      url,
      nextData({
        showcaseItem: {
          siteProfile: {
            id,
            slug: 'site' + id,
            title: 'Reference ' + id,
            tags: ['layout'],
            authorProfile: { name: 'Studio' },
            cloneable: true,
          },
        },
      }) + `<a href="https://original${id}.example/">Open live site</a>`,
    );
  };
  const c = context(
      { providers: ['webflow'], category: 'Animation', sourceSort: 'recent' },
      handler,
    ),
    adapter = new WebflowAdapter(),
    first = (await adapter.search(c))[0];
  assert.equal(first.next, '3');
  assert.equal(first.hasMore, true);
  assert.equal(first.records.length, 3);
  assert.equal(first.records[0].url, 'https://original0.example/');
  assert.ok(first.records[0].native.tags.includes('Animation'));
  assert.equal(first.records[0].sourceMetadata.nativeFilterId, 'animation');
  assert.equal(first.records[0].kind, 'cloneable');
  c.cursors.set('webflow:made-in-webflow', first.next);
  const second = (await adapter.search(c))[0];
  assert.equal(second.records[0].url, 'https://original3.example/');
  assert.ok(seen.some((u) => u.includes('offset=3')));
  assert.ok(seen.every((u) => !u.includes('/private') && !u.includes('token=')));
});

test('Webflow native public full-text search preserves real IDs and page counts without substituting popular sites or inventing tag membership', async () => {
  const seen = [],
    handler = (url) => {
      seen.push(url);
      if (url === 'https://webflow.com/made-in-webflow')
        return response(
          url,
          nextData({ fallbackData: [], tags: [{ id: 'animation', label: 'Animation' }] }),
        );
      if (url.startsWith('https://search-api.swiftype.com/')) {
        const p = new URL(url).searchParams;
        assert.equal(p.get('q'), 'coffee');
        assert.equal(p.get('per_page'), '3');
        assert.ok(!p.has('auth_token'));
        return response(url, {
          records: {
            page: [
              { webflow_id: 'a'.repeat(24), title: 'Current coffee result' },
              { title: 'Stale hit missing identity' },
            ],
          },
          info: { page: { num_pages: 2 } },
        });
      }
      if (url.includes('/feed/by-ids?')) {
        assert.equal(new URL(url).searchParams.get('ids'), 'a'.repeat(24));
        return response(url, [{ id: 'a'.repeat(24), slug: 'coffee', title: 'Coffee' }]);
      }
      return response(
        url,
        nextData({
          showcaseItem: {
            siteProfile: {
              id: 'a'.repeat(24),
              slug: 'coffee',
              title: 'Coffee',
              tags: ['Coffee'],
              authorProfile: { name: 'Maker' },
            },
          },
        }) + '<a href="https://coffee.example/">Open live site</a>',
      );
    };
  const c = context({ providers: ['webflow'], query: 'coffee', category: 'Animation' }, handler),
    adapter = new WebflowAdapter(),
    first = (await adapter.search(c))[0];
  assert.equal(first.records.length, 1);
  assert.equal(first.next, '2');
  assert.equal(first.records[0].url, 'https://coffee.example/');
  assert.ok(!first.records[0].native.tags.includes('Animation'));
  assert.ok(first.diagnostics.some((s) => s.includes('excluded')));
  c.cursors.set('webflow:made-in-webflow', '2');
  const second = (await adapter.search(c))[0];
  assert.equal(second.next, null);
  assert.ok(seen.some((u) => u.includes('page=2')));
});

test('Unsupported source URLs fail inside adapter normalization before merging can poison other providers', () => {
  const item = {
    itemId: 'bad',
    title: 'Untrusted metadata',
    url: 'javascript:alert(1)',
    listingUrl: 'https://astro.build/showcase/',
  };
  assert.throws(
    () => normalize('astro', 'showcase', [item], 'Owned malformed source test'),
    /HTTP/,
  );
  assert.throws(
    () =>
      normalize(
        'astro',
        'showcase',
        [{ ...item, url: 'https://user:password@private.example/' }],
        'Owned malformed source test',
      ),
    /credential/,
  );
});

test('Empty legacy native metadata is omitted without losing valid source records or inventing labels', () => {
  const r = normalize(
    'webflow',
    'made-in-webflow',
    [
      {
        itemId: 'old',
        title: 'Older valid record',
        url: 'https://old.example/',
        listingUrl: 'https://webflow.com/made-in-webflow/website/old',
        makers: ['', ' Independent Maker '],
        native: {
          tags: ['', 'coffee', 'coffee'],
          categories: [],
          technologies: ['Webflow'],
          awards: [],
        },
      },
    ],
    'Owned missing-metadata fixture',
  )[0];
  assert.deepEqual(r.native.tags, ['coffee']);
  assert.deepEqual(r.makers, ['Independent Maker']);
  assert.equal(r.title, 'Older valid record');
});

test('mesh3d native filter links are followed, maker identity remains distinct, and disallowed API is never called', async () => {
  const hits = [],
    handler = (url) => {
      hits.push(url);
      if (url.includes('/api/')) throw new Error('Disallowed API must not be used');
      if (url.includes('/website/'))
        return response(
          url,
          '<h1>Original Brand</h1><a href="https://brand.example/?utm_source=mesh3d.gallery">Visit</a><a href="/websites?tech=three">Three.js</a><a href="/makers/studio"><span>Independent Maker</span></a>',
        );
      return response(url, '<a href="/website/original-brand">Reference</a>');
    };
  const out = (
    await new Mesh3dAdapter().search(
      context({ providers: ['mesh3d'], technology: 'Three.js' }, handler),
    )
  )[0];
  assert.ok(hits.includes('https://mesh3d.gallery/websites?tech=three'));
  assert.ok(hits.every((u) => !u.includes('/api/')));
  assert.equal(out.records[0].title, 'Original Brand');
  assert.deepEqual(out.records[0].makers, ['Independent Maker']);
  assert.ok(out.diagnostics.some((d) => d.includes('disallowed')));
  assert.equal(out.hasMore, false);
});

test('Progressive search exposes new references instead of repeating the old top results, and finished continuation is empty', async () => {
  let fetched = 0;
  const source = {
      id: 'astro',
      search: async (c) => {
        const n = Number(c.cursors.get('astro:showcase') ?? 0);
        fetched++;
        return [
          {
            provider: 'astro',
            stream: 'showcase',
            status: 'partial',
            records: [
              SourceRecordSchema.parse({
                provider: 'astro',
                stream: 'showcase',
                itemId: String(n),
                title: 'Reference ' + n,
                url: 'https://site' + n + '.example/',
                listingUrl: 'https://astro.build/showcase/',
                provenance: 'Owned pagination fixture only',
                retrievedAt: new Date().toISOString(),
              }),
            ],
            coverage: 'Owned source page ' + n,
            next: n === 0 ? '1' : null,
            diagnostics: [],
            retrievedAt: new Date().toISOString(),
          },
        ];
      },
    },
    fed = new Federation(config('.'), undefined, [source]);
  try {
    const a = await fed.search({ providers: ['astro'], limit: 1, retrieval: 'lexical' }),
      b = await fed.search({ operationId: a.operationId }),
      c = await fed.search({ operationId: a.operationId });
    assert.notEqual(a.results[0].id, b.results[0].id);
    assert.equal(b.results[0].title, 'Reference 1');
    assert.equal(b.resultScope, 'new-source-pages');
    assert.equal(b.hasMore, false);
    assert.equal(fed.getReference(a.operationId, a.results[0].id).title, 'Reference 0');
    assert.deepEqual(c.results, []);
    assert.equal(fetched, 2);
  } finally {
    await fed.close();
  }
});
