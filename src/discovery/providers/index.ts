import { load } from 'cheerio';
import type { Config } from '../../config.js';
import { guardedFetch, type HttpEvidence } from '../../security/fetch.js';
import { robotsAllowed } from '../../security/robots.js';
import { canonicalUrl, mapBounded } from '../../util.js';
import { type DiscoveryQuery, Provider, type SourcePage, type SourceRecord } from '../types.js';
import { awwwardsListing } from './awwwards-parser.js';
import {
  astroRecord,
  codropsHub,
  meshDetail,
  meshListing,
  normalize,
  nuxtRecords,
  threeResourcesRecords,
  webflowDetail,
  webflowListing,
} from './parsers.js';
import { toolData, withThreeResources } from './three-resources.js';

export type DiscoveryContext = {
  config: Config;
  query: DiscoveryQuery;
  signal?: AbortSignal;
  pageSize: number;
  cursors: Map<string, string>;
  get: (url: string, max?: number) => Promise<HttpEvidence>;
  publicPage: (url: string) => Promise<HttpEvidence>;
};
export interface SourceAdapter {
  id: Provider;
  search(context: DiscoveryContext): Promise<SourcePage[]>;
}
const good = (r: HttpEvidence) => {
  if (r.status !== 200) throw new Error(`Source HTTP ${r.status}: ${r.url}`);
  return r;
};
const page = (
  provider: Provider,
  stream: string,
  records: SourceRecord[],
  coverage: string,
  extra: Partial<SourcePage> = {},
): SourcePage => ({
  provider,
  stream,
  records,
  sourceRetrievedRecords: Math.max(0, records.length - (extra.manualReferenceCount ?? 0)),
  coverage,
  status: 'partial',
  diagnostics: [],
  retrievedAt: new Date().toISOString(),
  ...extra,
  hasMore: Boolean(extra.next && extra.next !== '$done'),
});
const fail = (provider: Provider, stream: string, e: unknown) =>
  page(provider, stream, [], 'No stale or substitute records returned', {
    status: /HTTP 40[13]|robots|authorization/i.test(String(e)) ? 'blocked' : 'unavailable',
    diagnostics: [String(e).slice(0, 500)],
  });
const safeCursor = (value: string | undefined, base: string) => {
  const u = new URL(value ?? base),
    b = new URL(base);
  if (u.origin !== b.origin || !u.pathname.startsWith(b.pathname))
    throw new Error('Source pagination outside expected stream');
  return u.href;
};

export class AwwwardsAdapter implements SourceAdapter {
  readonly id = 'awwwards' as const;
  async search(c: DiscoveryContext) {
    if (!c.config.sourceAuthorizations.awwwards) {
      const manual = c.query.originalReferences ?? [],
        records = normalize(
          this.id,
          'operator-reference',
          manual.map((r, i) => ({
            itemId: 'operator-' + i,
            title: r.title,
            url: canonicalUrl(r.url),
            listingUrl: r.listingUrl,
            native: { categories: [], tags: [], technologies: [], awards: [] },
            sourceMetadata: { relationshipVerified: false, operatorSupplied: true },
          })),
          'Operator-supplied Awwwards reference link and original URL; gallery relationship/title unverified; no gallery page fetched and no source license inferred',
        );
      return [
        page(
          this.id,
          'websites',
          records,
          'Automated Awwwards catalog unavailable without authorization; operator-supplied original references are a separate usable handoff, never gallery search results',
          {
            status: 'blocked',
            manualReferenceCount: records.length,
            navigation: [
              {
                label: 'Browse public award references manually',
                url: 'https://www.awwwards.com/websites/',
                mode: 'manual-public-navigation',
              },
              {
                label: 'Read current source terms',
                url: 'https://www.awwwards.com/terms/',
                mode: 'manual-public-navigation',
              },
            ],
            capabilities: [
              {
                name: 'catalog-search/details/categories/awards/makers/technologies/elements',
                status: 'restricted',
                reason:
                  'No special content authorization. Robots prohibits automated search routes and elements; MIT software does not license the source catalog.',
              },
              {
                name: 'source-media-previews',
                status: 'restricted',
                reason:
                  'No permission to fetch or republish source-owned screenshots/videos is assumed.',
              },
              {
                name: 'operator-reference-handoff',
                status: 'operator-supplied',
                reason:
                  'Pass up to eight known original URLs and exact Awwwards /sites/ links using originalReferences. Relationships remain explicitly unverified.',
              },
              {
                name: 'original-site-visual-browsing',
                status: 'available',
                reason:
                  'Select the original URL, then authorized open_reference for separate robots-checked isolated browsing, screenshots, interactions and targeted analysis.',
              },
            ],
            diagnostics: [
              'No automated Awwwards catalog/search/detail/media requests were issued. Public navigation links are for the operator; they do not imply a live gallery connection.',
              'Current upstream software reviewed at ef6b5631206524942ff1cc3ecb17f5218e70c60d; retained MIT parser, independent visual evidence workflow and guarded original-site handoff.',
            ],
          },
        ),
      ];
    }
    const url = 'https://www.awwwards.com/websites/',
      r = good(await c.publicPage(url));
    return [
      page(
        this.id,
        'websites',
        normalize(
          this.id,
          'websites',
          awwwardsListing(r.body).slice(0, c.pageSize),
          c.config.sourceAuthorizations.awwwards,
        ),
        'Explicitly authorized first source page; no bulk catalog or permanent cache',
      ),
    ];
  }
}
export class NuxtAdapter implements SourceAdapter {
  readonly id = 'nuxt' as const;
  async search(c: DiscoveryContext) {
    const r = good(
      await c.get('https://raw.githubusercontent.com/nuxt/nuxt.com/main/content/showcase.yml'),
    );
    const records = normalize(
      this.id,
      'showcase',
      nuxtRecords(r.body),
      'Current official Nuxt MIT showcase YAML; industry labels preserved; screenshots and executable options excluded',
    );
    return [
      page(
        this.id,
        'showcase',
        records,
        'Complete current source-maintained YAML collection, read anew; count may change',
        {
          status: 'available',
          revision: r.headers.etag ?? undefined,
          taxonomy: [...new Set(records.flatMap((r) => r.native.categories))].map((label) => ({
            label,
            kind: 'industry',
          })),
        },
      ),
    ];
  }
}
export class AstroAdapter implements SourceAdapter {
  readonly id = 'astro' as const;
  async search(c: DiscoveryContext) {
    const r = good(await c.publicPage('https://astro.build/api/showcase.json')),
      index = JSON.parse(r.body);
    if (
      !Array.isArray(index) ||
      !index.length ||
      index.length > 20000 ||
      index.some(
        (i: any) =>
          typeof i.title !== 'string' || typeof i.url !== 'string' || typeof i.slug !== 'string',
      )
    )
      throw new Error('Official Astro title/URL index schema drift');
    const branch = JSON.parse(
        good(await c.get('https://api.github.com/repos/withastro/astro.build/branches/main')).body,
      ),
      revision = branch.commit?.sha;
    if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision))
      throw new Error('Astro repository revision unavailable');
    const tokens = [...c.query.query.toLowerCase().matchAll(/[\p{L}\p{N}]{2,}/gu)].map((m) => m[0]),
      score = (i: any) =>
        tokens.filter((t) => (i.title + ' ' + i.url + ' ' + i.slug).toLowerCase().includes(t))
          .length,
      ordered = [...index].sort((a, b) => score(b) - score(a));
    const offset = Number(c.cursors.get('astro:showcase') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid Astro offset');
    const batch = ordered.slice(offset, offset + c.pageSize),
      diagnostics = [
        'All current official index titles and original URLs participate in lexical selection, then only bounded selected YAML entries are enriched. The index has no style, industry or mood taxonomy; absent labels are not invented.',
        'Published index and repository revision are independently current; deployment lag may produce a reported metadata mismatch.',
      ];
    const records = await mapBounded(
      batch,
      2,
      async (i: any) => {
        if (i.slug.includes('/') || i.slug === '.' || i.slug === '..')
          throw new Error('Unexpected Astro slug');
        const path = `src/content/showcase/${i.slug}.yml`;
        try {
          const raw = astroRecord(
            good(
              await c.get(
                `https://raw.githubusercontent.com/withastro/astro.build/${revision}/src/content/showcase/${encodeURIComponent(i.slug)}.yml`,
              ),
            ).body,
            path,
            revision,
          );
          if (canonicalUrl(raw.url) !== canonicalUrl(i.url))
            throw new Error('Published index and pinned YAML URL differ');
          return raw;
        } catch (e) {
          c.signal?.throwIfAborted();
          diagnostics.push(
            `Selected YAML unavailable or changed: ${String(e).slice(0, 180)}; current published title/URL retained without added labels.`,
          );
          return {
            itemId: i.slug,
            title: i.title,
            url: i.url,
            listingUrl: 'https://astro.build/showcase/',
            native: { categories: [], tags: [], technologies: ['Astro'], awards: [] },
            sourceMetadata: { yamlEnrichment: false },
          };
        }
      },
      c.signal,
    );
    const next = offset + batch.length < ordered.length ? String(offset + batch.length) : null;
    return [
      page(
        this.id,
        'showcase',
        normalize(
          this.id,
          'showcase',
          records,
          'Current official Astro published title/URL API plus bounded revision-pinned repository YAML; images excluded; no blanket content license inferred',
        ),
        `Current complete title/URL index ${index.length}; enriched candidates ${offset}–${offset + batch.length}; not full-source semantic or style search`,
        { next, revision, taxonomy: [{ label: 'Astro', kind: 'technology' }], diagnostics },
      ),
    ];
  }
}
export class CodropsAdapter implements SourceAdapter {
  readonly id = 'codrops' as const;
  async search(c: DiscoveryContext) {
    const out: SourcePage[] = [];
    for (const [stream, base] of [
      ['creative-hub', 'https://tympanus.net/codrops/hub/all/'],
      ['webzibition', 'https://tympanus.net/codrops/webzibition/'],
    ] as const) {
      if (
        (c.query.stream && c.query.stream !== stream) ||
        c.cursors.get('codrops:' + stream) === '$done'
      )
        continue;
      try {
        const url = safeCursor(c.cursors.get('codrops:' + stream), base),
          r = good(await c.publicPage(url)),
          rejected: { identity: string; reason: string }[] = [],
          items = codropsHub(r.body, stream, url, rejected),
          $ = load(r.body),
          next = $('a.next.page-numbers,a[rel=next]').first().attr('href') ?? null;
        out.push(
          page(
            this.id,
            stream,
            normalize(
              this.id,
              stream,
              items,
              'Live public Codrops facts and native labels; no article/media archive',
            ),
            `Current source page ${new URL(url).pathname}; streams remain distinct`,
            {
              next: next ? safeCursor(next, base) : null,
              diagnostics: rejected.map((r) => r.reason),
            },
          ),
        );
      } catch (e) {
        out.push(fail(this.id, stream, e));
      }
    }
    if (
      (!c.query.stream || c.query.stream === 'repositories') &&
      c.cursors.get('codrops:repositories') !== '$done'
    ) {
      try {
        const n = Number(c.cursors.get('codrops:repositories') ?? 1);
        if (!Number.isSafeInteger(n) || n < 1 || n > 50) throw new Error('Invalid repository page');
        const repos = JSON.parse(
          good(
            await c.get(
              `https://api.github.com/orgs/codrops/repos?per_page=30&sort=updated&type=public&page=${n}`,
            ),
          ).body,
        );
        if (!Array.isArray(repos)) throw new Error('Codrops repository schema drift');
        const records = repos
          .filter((r: any) => r.homepage && /^https?:/.test(r.homepage))
          .map((r: any) => ({
            itemId: String(r.id),
            title: r.name,
            url: r.homepage,
            listingUrl: r.html_url,
            repository: r.html_url,
            license: r.license?.spdx_id ?? undefined,
            kind: 'demo' as const,
            native: {
              categories: ['Open-source demos'],
              tags: r.topics ?? [],
              technologies: r.language ? [r.language] : [],
              awards: [],
            },
            revision: r.pushed_at,
            description:
              typeof r.description === 'string' ? r.description.slice(0, 800) : undefined,
          }));
        out.push(
          page(
            this.id,
            'repositories',
            normalize(
              this.id,
              'repositories',
              records,
              'Live official Codrops organization repository metadata; individual license labels only',
            ),
            `Page ${n} of public organization repositories with published homepages; a homepage can be a tutorial rather than a demo`,
            { next: repos.length === 30 ? String(n + 1) : null },
          ),
        );
      } catch (e) {
        out.push(fail(this.id, 'repositories', e));
      }
    }
    return out;
  }
}
export class WebflowAdapter implements SourceAdapter {
  readonly id = 'webflow' as const;
  async search(c: DiscoveryContext) {
    const root = 'https://webflow.com/made-in-webflow',
      first = good(await c.publicPage(root)),
      listing = webflowListing(first.body),
      requested =
        c.query.category ??
        (c.query.technology?.toLowerCase() === 'webflow' ? undefined : c.query.technology) ??
        c.query.interaction;
    // Exact public GET feed used by the shipped Webflow browser client. Current robots
    // explicitly allows /api/v1/marketplace/made-in-webflow/; no private or mutation API.
    const textQuery = c.query.query.trim(),
      tag = requested
        ? listing.taxonomy.find(
            (t) =>
              t.label.toLowerCase() === requested.toLowerCase() ||
              t.id.toLowerCase() === requested.toLowerCase(),
          )
        : undefined,
      sort = c.query.sourceSort ?? 'popular',
      offset = Number(c.cursors.get('webflow:made-in-webflow') ?? (textQuery ? 1 : 0));
    if (!Number.isSafeInteger(offset) || offset < (textQuery ? 1 : 0) || offset > 10000)
      throw new Error('Invalid or exhausted Webflow bounded native offset/page');
    const diagnostics: string[] = [];
    let summaries: Record<string, any>[], next: string | null, coverage: string;
    if (textQuery) {
      // Public, read-only Engine Key intentionally published in Webflow's browser
      // bundle. This is not a private API/auth token. Official API documentation:
      // https://swiftype.com/documentation/site-search/overview#search-public-v-private
      const params = new URLSearchParams({
          engine_key: 'Y7a8MB19npLHEnFZb-sX',
          q: textQuery,
          page: String(offset),
          per_page: String(c.pageSize),
        }),
        search = JSON.parse(
          good(
            await c.publicPage(
              'https://search-api.swiftype.com/api/v1/public/engines/search.json?' +
                params.toString(),
            ),
          ).body,
        ),
        items = search.records?.page,
        total = search.info?.page?.num_pages;
      if (!Array.isArray(items) || !Number.isSafeInteger(total) || total < 0)
        throw new Error('Webflow public search schema drift');
      const ids = items
        .slice(0, c.pageSize)
        .map((i: any) => i.webflow_id)
        .filter((i: unknown): i is string => typeof i === 'string' && /^[a-f0-9]{24}$/.test(i));
      if (ids.length !== items.length)
        diagnostics.push(
          'Search hits without valid current Webflow site identifiers were excluded; no popular placeholder site was substituted.',
        );
      summaries = ids.length
        ? JSON.parse(
            good(
              await c.publicPage(
                'https://webflow.com/api/v1/marketplace/made-in-webflow/feed/by-ids?' +
                  new URLSearchParams({ ids: ids.join(','), keepOrder: 'true' }),
              ),
            ).body,
          )
        : [];
      if (Array.isArray(summaries))
        summaries = summaries.filter((i) => ids.includes(i.id)).slice(0, c.pageSize);
      next = offset < total && offset < 10000 ? String(offset + 1) : null;
      coverage = `Live source-provided full-text query, native search page ${offset} of ${total}; selected IDs resolved through current Webflow feed and detail pages`;
      if (requested || c.query.sourceSort)
        diagnostics.push(
          'Native public text search controls relevance order. Extra category/technology filters are strict local checks over returned native labels; a feed tag/sort was not falsely applied.',
        );
    } else {
      const params = new URLSearchParams({
          limit: String(c.pageSize),
          offset: String(offset),
          cloneable: 'false',
          excludeCloneable: 'false',
          tag: tag?.id ?? '',
          skipCache: '',
        }),
        feed =
          'https://webflow.com/api/v1/marketplace/made-in-webflow/feed/' +
          sort +
          '?' +
          params.toString();
      summaries = JSON.parse(good(await c.publicPage(feed)).body);
      next =
        Array.isArray(summaries) && summaries.length === c.pageSize && offset + c.pageSize <= 10000
          ? String(offset + c.pageSize)
          : null;
      coverage = `Live native ${sort} feed${tag ? ' filtered ' + tag.label : ''}, offsets ${offset}–${offset + (Array.isArray(summaries) ? summaries.length : 0)}; not platform-wide coverage`;
      if (requested && !tag)
        diagnostics.push(
          'Requested filter was not in the current source taxonomy. No native tag was invented; strict filtering applies to retrieved labels only.',
        );
      diagnostics.push(
        'A full native feed page suggests more results, not a known total; continuation stops on a short/empty page or bounded offset 10000.',
      );
    }
    if (
      !Array.isArray(summaries) ||
      summaries.some(
        (i) =>
          !i ||
          typeof i.id !== 'string' ||
          typeof i.slug !== 'string' ||
          typeof i.title !== 'string' ||
          i.slug.includes('/'),
      )
    )
      throw new Error('Webflow current public feed schema drift');
    if (summaries.length > c.pageSize) {
      summaries = summaries.slice(0, c.pageSize);
      diagnostics.push(
        'Provider exceeded requested page size; only the bounded candidate set was inspected.',
      );
    }
    const records = await mapBounded(
      summaries,
      2,
      async (item) => {
        try {
          const raw = webflowDetail(
            good(await c.publicPage(root + '/website/' + item.slug)).body,
            item,
          );
          if (tag && !textQuery) {
            raw.native = {
              categories: raw.native?.categories ?? [],
              tags: [...new Set([...(raw.native?.tags ?? []), tag.label])],
              technologies: raw.native?.technologies ?? [],
              awards: raw.native?.awards ?? [],
            };
            raw.sourceMetadata = {
              ...raw.sourceMetadata,
              nativeFilterId: tag.id,
              nativeFilterLabel: tag.label,
            };
          }
          const preview = item.thumbImg ?? item.screenshot;
          return {
            ...raw,
            description:
              typeof item.description === 'string'
                ? load(item.description).text().slice(0, 500)
                : undefined,
            ...(typeof preview === 'string' && /^https:\/\//.test(preview)
              ? {
                  preview: {
                    url: preview,
                    kind: 'source-remote-link' as const,
                    provenance: 'Actual public Webflow source thumbnail URL; not mirrored',
                  },
                }
              : {}),
          };
        } catch (e) {
          if (!String(e).includes('original website URL missing')) throw e;
          diagnostics.push(
            'Listing ' +
              String(item.id) +
              ' lacks an original live-site URL; excluded without invention',
          );
          return null;
        }
      },
      c.signal,
    );
    return [
      page(
        this.id,
        'made-in-webflow',
        normalize(
          this.id,
          'made-in-webflow',
          records.filter((r): r is NonNullable<typeof r> => r !== null),
          'Current public Webflow browser search/feed/detail facts; read-only public search method, current robots checks, no clone source or media mirror',
        ),
        coverage +
          '; original URLs checked on detail pages, not proof the original site remains reachable',
        {
          taxonomy: listing.taxonomy
            .filter((t) => t.id)
            .map((t) => ({ label: t.label, id: t.id, kind: 'tag' })),
          next,
          diagnostics,
        },
      ),
    ];
  }
}
export class Mesh3dAdapter implements SourceAdapter {
  readonly id = 'mesh3d' as const;
  async search(c: DiscoveryContext) {
    const root = 'https://mesh3d.gallery/websites',
      cursor = c.cursors.get('mesh3d:websites');
    let state: { url: string; offset: number } = cursor
      ? JSON.parse(cursor)
      : { url: root, offset: 0 };
    if (!Number.isSafeInteger(state.offset) || state.offset < 0)
      throw new Error('Invalid mesh3d detail offset');
    let url = safeCursor(state.url, root),
      listing = meshListing(good(await c.publicPage(url)).body);
    const diagnostics: string[] = [],
      taxonomy: { label: string; id: string; kind: string; url: string }[] = [];
    const detail = async (path: string) => {
      const r = good(await c.publicPage(new URL(path, root).href)),
        $ = load(r.body);
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href'),
          label = $(el).text().trim().slice(0, 160);
        if (!href || !label) return;
        const u = new URL(href, root);
        if (u.origin !== new URL(root).origin || u.pathname !== '/websites') return;
        for (const kind of ['tech', 'tags']) {
          const id = u.searchParams.get(kind);
          if (id && !taxonomy.some((t) => t.id === id && t.kind === kind))
            taxonomy.push({ label, id, kind, url: u.href });
        }
      });
      return meshDetail(r.body, path);
    };
    const requested = c.query.technology ?? c.query.category;
    if (!cursor && requested && listing.paths[0]) {
      await detail(listing.paths[0]);
      const native = taxonomy.find(
        (t) =>
          t.label.toLowerCase() === requested.toLowerCase() &&
          t.kind === (c.query.technology ? 'tech' : 'tags'),
      );
      if (native) {
        url = safeCursor(native.url, root);
        state = { url, offset: 0 };
        listing = meshListing(good(await c.publicPage(url)).body);
      } else
        diagnostics.push(
          'Requested native filter was not exposed by inspected source links; strict label filtering applies only to this bounded retrieval.',
        );
    }
    diagnostics.push(
      'The public client infinite-scroll endpoint /api/websites is disallowed by current robots /api/. It is not called; continuation covers exposed public listing/detail links only, not the full gallery.',
    );
    const paths = listing.paths.slice(state.offset, state.offset + c.pageSize),
      records = await mapBounded(paths, 2, detail, c.signal),
      nextOffset = state.offset + paths.length,
      next =
        nextOffset < listing.paths.length
          ? JSON.stringify({ url, offset: nextOffset })
          : listing.next
            ? JSON.stringify({ url: safeCursor(new URL(listing.next, root).href, root), offset: 0 })
            : null;
    return [
      page(
        this.id,
        'websites',
        normalize(
          this.id,
          'websites',
          records,
          'Live public mesh3d website facts; creators distinct; source-native technology and tag labels; no private API',
        ),
        `Current public listing, details ${state.offset}–${nextOffset} of ${listing.paths.length}; not the full gallery`,
        { taxonomy, next, diagnostics },
      ),
    ];
  }
}
export class ThreeResourcesAdapter implements SourceAdapter {
  readonly id = 'threejs-resources' as const;
  async search(c: DiscoveryContext) {
    return withThreeResources(
      c.config,
      async (client) => {
        const taxonomy = toolData(
            await client.callTool({ name: 'threejs_list_taxonomy', arguments: { kind: 'both' } }),
          ),
          offset = Number(c.cursors.get('threejs-resources:showcase') ?? 0);
        if (!Number.isSafeInteger(offset) || offset < 0)
          throw new Error('Invalid official MCP offset');
        const payload = toolData(
          await client.callTool({
            name: 'threejs_search_showcase',
            arguments: { query: c.query.query || undefined, limit: c.pageSize, offset },
          }),
        );
        let records: SourceRecord[] = [];
        if (
          typeof payload.text === 'string' &&
          !payload.text.includes('- **') &&
          /0 showcase|no (?:showcase|results|projects)/i.test(payload.text)
        )
          records = [];
        else
          records = normalize(
            this.id,
            'showcase',
            threeResourcesRecords(payload),
            'Live official read-only Three Resources MCP result; no website scraping or permanent mirror',
          );
        const next =
          typeof payload.text === 'string'
            ? payload.text.match(/next_offset:\s*(\d+)/)?.[1]
            : payload.next_offset;
        return [
          page(
            this.id,
            'showcase',
            records,
            'Official native text search and pagination; directory taxonomy is separate from showcase tag IDs',
            {
              next: next === undefined ? null : String(next),
              taxonomy: [],
              directoryTaxonomy: taxonomy,
              diagnostics: [
                'Tool-directory taxonomy returned separately; opaque showcase tag IDs are preserved without invented names.',
              ],
            },
          ),
        ];
      },
      undefined,
      c.signal,
    );
  }
}
export const adapters = (): SourceAdapter[] => [
  new AwwwardsAdapter(),
  new CodropsAdapter(),
  new AstroAdapter(),
  new WebflowAdapter(),
  new ThreeResourcesAdapter(),
  new NuxtAdapter(),
  new Mesh3dAdapter(),
];

/** Fresh transport scope per independent discovery operation; no disk writes. */
export function discoveryContext(
  config: Config,
  query: DiscoveryQuery,
  cursors: Map<string, string>,
  signal?: AbortSignal,
) {
  let requests = 0,
    bytes = 0;
  const coalesced = new Map<string, Promise<HttpEvidence>>(),
    robots = new Map<string, Promise<string | null>>();
  const get: DiscoveryContext['get'] = (url, max = 3000000) => {
    const key = canonicalUrl(url);
    let promise = coalesced.get(key);
    if (!promise) {
      if (++requests > config.discoveryRequests || bytes >= config.maxBytes)
        return Promise.reject(
          new Error('Discovery request/byte budget reached; narrow the provider/page'),
        );
      promise = guardedFetch(config, url, {}, 0, 'GET', max, signal).then((r) => {
        bytes += Buffer.byteLength(r.body);
        if (bytes > config.maxBytes) throw new Error('Discovery byte budget reached');
        return r;
      });
      coalesced.set(key, promise);
    }
    return promise;
  };
  const publicPage: DiscoveryContext['publicPage'] = async (url) => {
    const u = new URL(url);
    let rules = robots.get(u.origin);
    if (!rules) {
      rules = get(u.origin + '/robots.txt', 100000).then((r) => {
        if (r.status === 404) return null;
        if (r.status !== 200) throw new Error('robots access HTTP ' + r.status);
        return r.body;
      });
      robots.set(u.origin, rules);
    }
    const text = await rules;
    if (text !== null && !robotsAllowed(text, u.pathname + u.search))
      throw new Error('robots disallows source path ' + u.pathname);
    return get(url);
  };
  return {
    context: {
      config,
      query,
      cursors,
      signal,
      pageSize: query.providers?.length === 1 ? Math.min(8, Math.max(3, query.limit)) : 4,
      get,
      publicPage,
    },
    requestCount: () => requests,
    release: () => {
      coalesced.clear();
      robots.clear();
    },
  };
}
