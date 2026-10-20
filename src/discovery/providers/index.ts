import { load } from 'cheerio';
import type { Config } from '../../config.js';
import { guardedFetch, type HttpEvidence } from '../../security/fetch.js';
import { robotsAllowed } from '../../security/robots.js';
import { canonicalUrl, hash, mapBounded } from '../../util.js';
import { type DiscoveryQuery, Provider, type SourcePage, type SourceRecord } from '../types.js';
import {
  astroRecord,
  codropsHub,
  meshDetail,
  meshListing,
  meshNativeFilters,
  normalize,
  nuxtRecords,
  nuxtTaxonomy,
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
  const path = b.pathname.replace(/\/+$/, '');
  if (
    u.origin !== b.origin ||
    (u.pathname !== path && !u.pathname.startsWith(path + '/')) ||
    u.username ||
    u.password
  )
    throw new Error('Source pagination outside expected stream');
  return u.href;
};
/** Lexical priority plus progressive exploration; sparse labels cannot erase an
 * original from every future page. No synthetic native taxonomy is introduced. */
export function astroCandidateOrder<T extends { title: string; url: string; slug: string }>(
  index: T[],
  query: DiscoveryQuery,
  pageSize: number,
): T[] {
  const terms = [
    ...new Set(
      [
        query.query,
        query.industry,
        query.purpose,
        query.style,
        query.mood,
        query.interaction,
        query.navigation,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .match(/[\p{L}\p{N}]{2,}/gu) ?? [],
    ),
  ];
  const score = (i: T) =>
    terms.reduce(
      (n, t) => n + Number((i.title + ' ' + i.url + ' ' + i.slug).toLowerCase().includes(t)),
      0,
    );
  const lexical = [...index].sort((a, b) => score(b) - score(a));
  const result: T[] = [],
    seen = new Set<T>();
  let a = 0,
    b = 0;
  const take = (items: T[], position: 'lexical' | 'native') => {
    let p = position === 'lexical' ? a : b;
    while (p < items.length && seen.has(items[p]!)) p++;
    const item = items[p++];
    if (position === 'lexical') a = p;
    else b = p;
    if (item) {
      seen.add(item);
      result.push(item);
    }
  };
  while (result.length < index.length) {
    for (let i = 0; i < Math.ceil(pageSize / 2) && result.length < index.length; i++)
      take(lexical, 'lexical');
    for (let i = Math.ceil(pageSize / 2); i < pageSize && result.length < index.length; i++)
      take(index, 'native');
  }
  return result;
}

export class AwwwardsAdapter implements SourceAdapter {
  readonly id = 'awwwards' as const;
  async search(c: DiscoveryContext) {
    // A configuration note is not a reviewed, scoped rights grant. There is no
    // grant-verification mechanism in this release, so catalog access stays off.
    {
      const manual = c.query.originalReferences ?? [],
        records = normalize(
          this.id,
          'operator-reference',
          manual.map((r, i) => ({
            itemId: 'operator-' + i,
            title: r.title ?? new URL(r.url).hostname,
            url: canonicalUrl(r.url),
            listingUrl: r.listingUrl ?? canonicalUrl(r.url),
            native: { categories: [], tags: [], technologies: [], awards: [] },
            sourceMetadata: {
              relationshipVerified: false,
              operatorSupplied: true,
              noAwwwardsListing: !r.listingUrl,
            },
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
                  'Pass up to eight original URLs using originalReferences; titles and exact Awwwards /sites/ links are optional. Relationships remain explicitly unverified.',
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
              'Current upstream software reviewed at 1bc9c13557c8e8f6ea90e174d88eb1708696fca3; retained MIT parser and adapted the candidate-to-original-site visual study workflow without its catalog/media/preferences persistence.',
              ...(c.config.sourceAuthorizations.awwwards
                ? [
                    'The configured authorization note is not verified proof of a scoped rights grant and does not enable gallery requests.',
                  ]
                : []),
            ],
          },
        ),
      ];
    }
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
          revision: r.headers.etag ?? hash(r.body),
          taxonomy: nuxtTaxonomy(r.body).map((label) => ({
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
    const ordered = astroCandidateOrder(index, c.query, c.pageSize);
    const offset = Number(c.cursors.get('astro:showcase') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid Astro offset');
    const batch = ordered.slice(offset, offset + c.pageSize),
      diagnostics = [
        'All current official index titles and original URLs participate in lexical selection using query and brief facets. Each page reserves half its bounded candidates for source-order exploration; only selected revision-pinned YAML is enriched. Sparse native labels cannot permanently exclude a site, but this is not full-index semantic search.',
        'The official index has no style, industry or mood taxonomy; absent labels are not invented. Independent explicit continuation progressively covers the index.',
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
          .filter((r: any) => {
            try {
              return Boolean(r.homepage && canonicalUrl(r.homepage));
            } catch {
              return false;
            }
          })
          .map((r: any) => {
            const homepage = canonicalUrl(r.homepage);
            const tutorial =
              new URL(homepage).hostname === 'tympanus.net' &&
              /^\/codrops\/\d{4}\//.test(new URL(homepage).pathname);
            return {
              itemId: String(r.id),
              title: r.name,
              url: homepage,
              listingUrl: r.html_url,
              repository: r.html_url,
              license: r.license?.spdx_id ?? undefined,
              kind: tutorial ? ('website' as const) : ('demo' as const),
              native: {
                categories: [],
                tags: r.topics ?? [],
                technologies: r.language ? [r.language] : [],
                awards: [],
              },
              revision: r.pushed_at,
              sourceMetadata: {
                homepageRole: tutorial ? 'tutorial' : 'published-demo-or-project',
                relationshipVerified: true,
              },
              description:
                typeof r.description === 'string' ? r.description.slice(0, 800) : undefined,
            };
          });
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
            `Page ${n} of public organization repositories with published homepages; tutorial/article homepages are explicitly identified and not mislabeled as interactive demos; source topics and licenses remain independent`,
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
      requested =
        c.query.category ??
        (c.query.technology?.toLowerCase() === 'webflow' ? undefined : c.query.technology) ??
        c.query.interaction,
      // The listing is needed for real native tag resolution only. Its bundled
      // fallback cards cannot replace a query result and its HTML is otherwise
      // a redundant network roundtrip on every independent text/feed search.
      listing = requested
        ? webflowListing(good(await c.publicPage(root)).body)
        : { items: [], taxonomy: [] };
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
    if (!requested)
      diagnostics.push(
        'Native tag taxonomy was not requested; the redundant landing-page fetch was omitted. Detail pages still validate every original URL.',
      );
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
      3,
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
          c.signal?.throwIfAborted();
          diagnostics.push(
            'Listing ' +
              String(item.id) +
              ' detail unavailable or original URL missing; excluded without inventing a substitute: ' +
              String(e).slice(0, 180),
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
          status:
            summaries.length > 0 && records.every((r) => r === null) ? 'unavailable' : 'partial',
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
    let url = safeCursor(state.url, root);
    const initial = good(await c.publicPage(url));
    let listing = meshListing(initial.body);
    const diagnostics: string[] = [],
      taxonomy = meshNativeFilters(initial.body, root);
    const detail = async (path: string) => {
      const r = good(await c.publicPage(new URL(path, root).href));
      for (const t of meshNativeFilters(r.body, root))
        if (!taxonomy.some((prior) => prior.id === t.id && prior.kind === t.kind)) taxonomy.push(t);
      return meshDetail(r.body, path);
    };
    const requested = c.query.technology ?? c.query.category;
    if (!cursor && requested && listing.paths[0]) {
      if (
        !taxonomy.some(
          (t) =>
            t.label.toLowerCase() === requested.toLowerCase() &&
            t.kind === (c.query.technology ? 'tech' : 'tags'),
        )
      )
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
        const offset = Number(c.cursors.get('threejs-resources:showcase') ?? 0);
        if (!Number.isSafeInteger(offset) || offset < 0)
          throw new Error('Invalid official MCP offset');
        const [taxonomyResult, payloadResult] = await Promise.all([
          client.callTool({ name: 'threejs_list_taxonomy', arguments: { kind: 'both' } }),
          client.callTool({
            name: 'threejs_search_showcase',
            arguments: { query: c.query.query || undefined, limit: c.pageSize, offset },
          }),
        ]);
        const taxonomy = toolData(taxonomyResult),
          payload = toolData(payloadResult);
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
                'Official MCP tools/list reviewed 2026-10-19: no showcase-specific taxonomy resolver or tag filter exists in the published interface. Native showcase text search/offsets remain usable; no unrelated tool tag is substituted.',
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
