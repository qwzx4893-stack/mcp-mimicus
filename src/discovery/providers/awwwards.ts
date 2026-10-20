import { setTimeout as delay } from 'node:timers/promises';
import { robotsAllowed } from '../../security/robots.js';
import { canonicalUrl, hash, mapBounded } from '../../util.js';
import type { DiscoveryQuery, SourcePage, SourceRecord } from '../types.js';
import {
  type AwwwardsFacet,
  awwwardsDetail,
  awwwardsListing,
  awwwardsNext,
  awwwardsTaxonomy,
  awwwardsUrl,
} from './awwwards-parser.js';
import type { DiscoveryContext, SourceAdapter } from './index.js';
import { normalize, type RawItem } from './parsers.js';

const ROOT = 'https://www.awwwards.com/websites/';
const key = (s: string) => s.normalize('NFKC').trim().toLowerCase();
const native = (r: RawItem, taxonomy: AwwwardsFacet[], selected?: AwwwardsFacet): RawItem => {
  const tags = r.native?.tags ?? [],
    labels = new Set(tags.map(key));
  return {
    ...r,
    native: {
      tags: [...new Set([...tags, ...(selected?.kind === 'tag' ? [selected.label] : [])])],
      categories: [
        ...new Set([
          ...taxonomy
            .filter((t) => t.kind === 'category' && labels.has(key(t.label)))
            .map((t) => t.label),
          ...(selected?.kind === 'category' ? [selected.label] : []),
        ]),
      ],
      technologies: [
        ...new Set([
          ...taxonomy
            .filter((t) => t.kind === 'technology' && labels.has(key(t.label)))
            .map((t) => t.label),
          ...(selected?.kind === 'technology' ? [selected.label] : []),
        ]),
      ],
      awards: r.native?.awards ?? [],
    },
    sourceMetadata: {
      ...r.sourceMetadata,
      ...(selected
        ? { nativeCollection: selected.label, nativeCollectionKind: selected.kind }
        : {}),
    },
  };
};
const good = (r: { status: number; body: string; url: string }) => {
  if (r.status !== 200) throw new Error(`Awwwards source HTTP ${r.status}: ${r.url}`);
  return r.body;
};
function requestedFacets(q: DiscoveryQuery) {
  return [
    ['technology', q.technology],
    ['category', q.category ?? q.industry],
    ['award', q.awwwards?.award],
    ['tag', q.awwwards?.tag],
    ['country', q.awwwards?.country],
    ['font', q.awwwards?.font],
  ].filter((pair): pair is [string, string] => Boolean(pair[1]));
}
function selectFacet(q: DiscoveryQuery, taxonomy: AwwwardsFacet[]) {
  const requested = requestedFacets(q);
  const exact = requested.map(([kind, label]) => {
    const f = taxonomy.find(
      (t) => t.kind === kind && (key(t.label) === key(label) || key(t.id) === key(label)),
    );
    if (!f)
      throw new Error(
        `Awwwards native ${kind} not found: ${label}. Browse current source taxonomy instead of guessing a route.`,
      );
    return f;
  });
  if (exact.length) return { selected: exact[0], requested: exact };
  const hints = [q.query, q.style, q.interaction, q.navigation, q.mood]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hinted = taxonomy
    .filter(
      (t) =>
        ['tag', 'category', 'technology'].includes(t.kind) &&
        key(t.label).length >= 3 &&
        hints.includes(key(t.label)),
    )
    .sort((a, b) => b.label.length - a.label.length)[0];
  return {
    selected: hinted ?? taxonomy.find((t) => t.kind === 'award' && t.id === 'sites_of_the_day'),
    requested: [],
  };
}
type Cursor = { url: string; visited: string[] };
function cursor(raw: string): Cursor {
  const v = JSON.parse(raw);
  if (
    !v ||
    typeof v.url !== 'string' ||
    !Array.isArray(v.visited) ||
    v.visited.length > 100 ||
    v.visited.some((x: unknown) => typeof x !== 'string' || !/^[a-f0-9]{24}$/.test(x))
  )
    throw new Error('Invalid Awwwards pagination cursor');
  return { url: awwwardsUrl(v.url, 'listing'), visited: v.visited };
}
/** Live public discovery. Text ranking, cursors and source facts remain operation RAM. */
export class AwwwardsAdapter implements SourceAdapter {
  readonly id = 'awwwards' as const;
  private nextRequestAt = 0;
  private cooldownUntil = 0;
  private async read(c: DiscoveryContext, url: string, robots = false) {
    const paused = () => this.cooldownUntil > Date.now();
    const limited = () =>
      new Error(
        'Awwwards HTTP 429 rate limited; retry after ' +
          Math.ceil((this.cooldownUntil - Date.now()) / 1000) +
          ' seconds. No alternate endpoint was attempted.',
      );
    if (paused()) throw limited();
    const start = Math.max(Date.now(), this.nextRequestAt);
    this.nextRequestAt = start + 750;
    if (start > Date.now()) await delay(start - Date.now(), undefined, { signal: c.signal });
    if (paused()) throw limited();
    try {
      const response = robots ? await c.get(url, 100000) : await c.publicPage(url);
      if (response.status === 429) {
        const value = response.headers['retry-after'],
          seconds = Number(value),
          until = value && !Number.isFinite(seconds) ? Date.parse(value) : NaN;
        const wait =
          Number.isFinite(seconds) && value
            ? seconds * 1000
            : Number.isFinite(until)
              ? until - Date.now()
              : 60000;
        this.cooldownUntil = Date.now() + Math.max(1000, Number.isFinite(wait) ? wait : 60000);
        throw limited();
      }
      return response;
    } catch (e) {
      if (/HTTP 429/.test(String(e)) && !paused()) this.cooldownUntil = Date.now() + 60000;
      throw e;
    }
  }
  async search(c: DiscoveryContext): Promise<SourcePage[]> {
    const manual = c.query.originalReferences ?? [];
    if (manual.length || c.query.stream === 'operator-reference') {
      const records = normalize(
        this.id,
        'operator-reference',
        manual.map((r, i) => ({
          itemId: 'operator-' + i,
          title: r.title ?? new URL(r.url).hostname,
          url: canonicalUrl(r.url),
          listingUrl: r.listingUrl ?? canonicalUrl(r.url),
          sourceMetadata: {
            relationshipVerified: false,
            operatorSupplied: true,
            noAwwwardsListing: !r.listingUrl,
          },
        })),
        'Operator-supplied original URL; optional Awwwards relationship remains unverified',
      );
      return [
        this.page(records, {
          stream: c.query.stream === 'operator-reference' ? 'operator-reference' : 'websites',
          manualReferenceCount: records.length,
          sourceRetrievedRecords: 0,
          coverage:
            'Explicit operator-reference handoff; select a fresh search without originalReferences for live Awwwards discovery',
        }),
      ];
    }
    const saved = c.cursors.get('awwwards:websites');
    if (saved === '$done') return [];
    const diagnostics: string[] = [],
      errors: string[] = [],
      initial = saved ? cursor(saved) : undefined;
    // publicPage consults the current robots file and checks each actual route.
    // Read through the paced transport first so a robots HTTP429 retains its
    // Retry-After header. publicPage reuses this request in the transport scope.
    const rules = await this.read(c, 'https://www.awwwards.com/robots.txt', true);
    if (rules.status !== 200 && rules.status !== 404) good(rules);
    const root = good(await this.read(c, ROOT)),
      taxonomy = awwwardsTaxonomy(root);
    if (!taxonomy.length) throw new Error('Awwwards native taxonomy schema drift');
    const selection = selectFacet(c.query, taxonomy);
    let url =
      initial?.url ??
      (c.query.awwwards?.listingUrl
        ? awwwardsUrl(c.query.awwwards.listingUrl, 'listing')
        : (selection.selected?.url ?? ROOT));
    if (
      c.query.awwwards?.listingUrl &&
      selection.requested.length &&
      url !== selection.selected?.url
    )
      throw new Error('Choose either an exact Awwwards listingUrl or native facet filters');
    const selected = taxonomy.find((t) => new URL(t.url).pathname === new URL(url).pathname);
    const html = url === ROOT ? root : good(await this.read(c, url));
    const identity = hash(url).slice(0, 24),
      visited = initial?.visited ?? [];
    if (visited.includes(identity))
      throw new Error('Repeated Awwwards collection page; cursor stopped');
    visited.push(identity);
    let raw = awwwardsListing(html).map((r) => native(r, taxonomy, selected));
    const sourceRetrievedRecords = raw.length;
    if (c.query.sourceSort && c.query.sourceSort !== 'recent')
      diagnostics.push(
        'Source does not expose a reviewed public ' +
          c.query.sourceSort +
          ' sort link; native collection order is preserved.',
      );
    // The generic ranker applies category/technology/industry intersections. Extra
    // native facets can intersect observed labels, never fabricated classifications.
    for (const f of selection.requested.slice(1)) {
      if (f.kind === 'country' || f.kind === 'font')
        throw new Error(
          'Country/font combinations require a source-exposed collection URL; use one native collection per operation.',
        );
      raw = raw.filter((r) =>
        [
          ...(r.native?.tags ?? []),
          ...(r.native?.categories ?? []),
          ...(r.native?.technologies ?? []),
          ...(r.native?.awards ?? []),
        ].some((v) => key(v) === key(f.label)),
      );
      diagnostics.push(
        'Additional ' +
          f.kind +
          ' matched exact observed card labels within this collection page; not a remote compound query.',
      );
    }
    const words = [...new Set(c.query.query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])];
    const score = (r: RawItem) =>
      words.reduce(
        (n, w) =>
          n + Number((r.title + ' ' + (r.native?.tags ?? []).join(' ')).toLowerCase().includes(w)),
        0,
      );
    raw.sort((a, b) => score(b) - score(a));
    const selectedIds = new Set(raw.slice(0, Math.min(3, c.pageSize)).map((r) => r.itemId));
    if (c.query.awwwards?.details !== false) {
      raw = await mapBounded(
        raw,
        3,
        async (r) => {
          if (!selectedIds.has(r.itemId)) return r;
          try {
            const detail = awwwardsUrl(r.listingUrl, 'detail');
            return awwwardsDetail(good(await this.read(c, detail)), r, taxonomy);
          } catch (e) {
            c.signal?.throwIfAborted();
            errors.push('Selected detail ' + r.itemId + ': ' + String(e).slice(0, 200));
            return { ...r, sourceMetadata: { ...r.sourceMetadata, detailVerified: false } };
          }
        },
        c.signal,
      );
    }
    let next: string | null = null;
    try {
      const candidate = awwwardsNext(html, url);
      if (candidate) {
        const rules = good(await this.read(c, 'https://www.awwwards.com/robots.txt', true)),
          n = new URL(candidate);
        if (!robotsAllowed(rules, n.pathname + n.search))
          diagnostics.push(
            'Native next link is disallowed by current robots rules and was not fetched: ' +
              candidate,
          );
        else if (visited.length >= 100 || visited.includes(hash(candidate).slice(0, 24)))
          diagnostics.push(
            'Pagination reached the bounded cycle/history limit; start a new selected collection.',
          );
        else next = JSON.stringify({ url: candidate, visited });
      }
    } catch (e) {
      diagnostics.push('Pagination unavailable: ' + String(e).slice(0, 220));
    }
    diagnostics.push(
      'Text/semantic search ranks current live title/tag/fact candidates in RAM; no /search-websites endpoint is called.',
      'Native collection: ' +
        url +
        '. Source artwork/media are not fetched by this adapter; visual previews visit selected original websites.',
      'No catalog synchronization, disk cache, voting, login, private endpoints or permission-note gate.',
    );
    return [
      this.page(
        normalize(
          this.id,
          'websites',
          raw,
          'Live Awwwards public listing facts and selected detail/original-link verification; original artwork is not imported',
        ),
        {
          sourceRetrievedRecords,
          taxonomy,
          next,
          hasMore: Boolean(next),
          diagnostics: [...diagnostics, ...errors],
          status:
            errors.length ||
            (!next && diagnostics.some((d) => /disallowed|Pagination unavailable/.test(d)))
              ? 'partial'
              : 'available',
          coverage:
            'Current native public collection page; linked continuation only where robots permits. Selected details enriched independently. Text search is bounded local ranking, not the restricted global search endpoint.',
        },
      ),
    ];
  }
  private page(records: SourceRecord[], extra: Partial<SourcePage> = {}): SourcePage {
    return {
      provider: this.id,
      stream: 'websites',
      status: 'available',
      records,
      sourceRetrievedRecords: records.length,
      retrievedAt: new Date().toISOString(),
      diagnostics: [],
      coverage: 'Live public source facts',
      next: null,
      hasMore: false,
      capabilities: [
        {
          name: 'live-public-awards/categories/tags/technologies/countries/fonts',
          status: 'available',
          reason: 'Current source-provided labels and URLs; no guessed taxonomy',
        },
        {
          name: 'linked-public-pagination',
          status: 'available',
          reason: 'Per-route robots checks and bounded validated cursor',
        },
        {
          name: 'bounded-text-and-semantic-reference-search',
          status: 'available',
          reason: 'Current public metadata ranked within operation RAM',
        },
        {
          name: 'selected-details/makers/original-links',
          status: 'available',
          reason: 'Bounded independent public detail verification; sibling failures isolated',
        },
        {
          name: 'original-site-visual-browsing',
          status: 'available',
          reason:
            'Existing real MCP images, interaction, motion, comparison and implementation guidance',
        },
        {
          name: 'restricted-global-search-and-elements-routes',
          status: 'restricted',
          reason:
            'Only routes disallowed by actual current robots rules are refused; this is not a source-wide ban',
        },
      ],
      ...extra,
    };
  }
}
