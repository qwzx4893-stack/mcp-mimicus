/** Adapted from INSANE0777/Awwwards-mcp src/parsers.ts at
 * 9bc82857894007da4b27e806cecfde8befe68a81 (MIT). See THIRD_PARTY_NOTICES.
 * Re-reviewed against current upstream 1bc9c13557c8e8f6ea90e174d88eb1708696fca3.
 * The upstream card metadata model is retained with bounded DOM selectors and no media.
 * Parsing software does not grant permission to harvest the target catalog. */
import { load } from 'cheerio';
import { canonicalUrl } from '../../util.js';
import type { RawItem } from './parsers.js';

const entities: Record<string, string> = {
  '&quot;': '"',
  '&amp;': '&',
  '&#039;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};
export const decodeEntities = (s: string) =>
  s.replace(/&(?:quot|amp|#0?39|lt|gt|nbsp);/g, (e) => entities[e] ?? e);
const awards: Record<string, string> = {
  sotd: 'Site of the Day',
  dev: 'Developer Award',
  hm: 'Honorable Mention',
  sotm: 'Site of the Month',
  mobile: 'Mobile Excellence',
  ecom: 'E-Commerce Award',
};
export function awwwardsListing(html: string): RawItem[] {
  const result: RawItem[] = [];
  const $ = load(html);
  for (const element of $('[data-collectable-model-value]').slice(0, 100).toArray()) {
    const card = $(element),
      encoded = card.attr('data-collectable-model-value');
    if (!encoded || encoded.length > 20000) continue;
    let meta: any;
    try {
      meta = JSON.parse(encoded);
    } catch {
      continue;
    }
    if (!meta?.slug || !meta?.title || (meta.type && meta.type !== 'submission')) continue;
    const detail = card.find('a[href^="/sites/"]').first().attr('href'),
      live = card.find('a.figure-rollover__bt[href^="http"]').first().attr('href');
    if (!detail || !live) continue;
    try {
      const original = new URL(canonicalUrl(live));
      if (/(^|\.)awwwards\.com$/i.test(original.hostname)) continue;
      if (!/^\/sites\/[^/?#]+\/?$/.test(detail)) continue;
      if (typeof meta.title !== 'string' || meta.title.length > 300) continue;
      result.push({
        itemId: String(meta.id ?? meta.slug),
        title: decodeEntities(String(meta.title)),
        url: original.href,
        listingUrl: 'https://www.awwwards.com' + detail,
        native: {
          categories: [],
          tags: Array.isArray(meta.tags)
            ? meta.tags
                .filter((t: unknown) => typeof t === 'string' && t.length <= 160)
                .slice(0, 100)
            : [],
          technologies: [],
          awards: [
            ...new Set(
              card
                .find('[class*="budget-tag--"]')
                .toArray()
                .flatMap((el) =>
                  [...($(el).attr('class') ?? '').matchAll(/budget-tag--([a-z-]+)/g)].map(
                    (m) => awards[m[1]!] ?? m[1]!,
                  ),
                ),
            ),
          ],
        },
        makers: card
          .find('.avatar-name__title')
          .toArray()
          .map((el) => $(el).text().trim())
          .filter(Boolean)
          .slice(0, 20),
        publishedAt:
          typeof meta.createdAt === 'number' &&
          Number.isFinite(meta.createdAt) &&
          meta.createdAt > 0 &&
          meta.createdAt < 100000000000
            ? new Date(meta.createdAt * 1000).toISOString()
            : undefined,
        sourceMetadata: { relationshipVerified: true, operatorSupplied: false },
      });
    } catch {
      /* Isolate malformed cards; never lose all valid sibling originals. */
    }
  }
  if (!result.length && !/no (?:results|websites|sites)|nothing found/i.test($('main').text()))
    throw new Error('Awwwards listing drift or no original URLs; no records returned');
  return result;
}

const ORIGIN = 'https://www.awwwards.com';
/** Only current public listing/detail links, never search APIs or arbitrary origins. */
export function awwwardsUrl(raw: string, kind: 'listing' | 'detail', base = ORIGIN) {
  const u = new URL(raw, base);
  if (u.origin !== ORIGIN || u.username || u.password || u.hash || u.href.length > 2048)
    throw new Error('Invalid Awwwards source URL');
  if (kind === 'detail') {
    if (!/^\/sites\/[^/?#]+\/?$/.test(u.pathname) || u.search)
      throw new Error('Expected public Awwwards site detail');
  } else {
    if (!/^\/websites\/(?:[^/?#]+\/)*$/.test(u.pathname))
      throw new Error('Expected public Awwwards listing');
    if (
      [...u.searchParams].some(([k, v]) => k !== 'page' || !/^[1-9]\d{0,4}$/.test(v)) ||
      [...u.searchParams].length > 1
    )
      throw new Error('Unexpected Awwwards listing query');
  }
  return u.href;
}
export type AwwwardsFacet = { label: string; id: string; kind: string; url: string };
export function awwwardsTaxonomy(html: string): AwwwardsFacet[] {
  const $ = load(html),
    result = new Map<string, AwwwardsFacet>();
  const groups: Record<string, string> = {
    Awards: 'award',
    Category: 'category',
    Tag: 'tag',
    Technology: 'technology',
    Country: 'country',
    Font: 'font',
  };
  $('.nav-filters__item').each((_, el) => {
    const kind = groups[$(el).text().trim().replace(/\s+/g, ' ')];
    if (!kind) return;
    $(el)
      .parent()
      .find('a.nav-filters__subitem[href]')
      .slice(0, 1500)
      .each((_, a) => {
        try {
          const url = awwwardsUrl($(a).attr('href')!, 'listing'),
            u = new URL(url),
            label = $(a).text().trim().replace(/\s+/g, ' ');
          if (!label || label.length > 160 || u.pathname === '/websites/' || u.search) return;
          result.set(kind + ':' + label.toLowerCase(), {
            label,
            kind,
            id: decodeURIComponent(u.pathname.split('/').filter(Boolean).at(-1)!),
            url,
          });
        } catch {
          /* Ignore unrelated, reset and malformed links. */
        }
      });
  });
  return [...result.values()].slice(0, 2500);
}
export function awwwardsNext(html: string, current: string): string | null {
  const $ = load(html),
    href = $('a.pagination__next[href], a[rel="next"][href]').first().attr('href');
  if (!href) return null;
  const next = awwwardsUrl(href, 'listing', current),
    a = new URL(current),
    b = new URL(next);
  if (
    a.pathname !== b.pathname ||
    Number(b.searchParams.get('page')) !== Number(a.searchParams.get('page') ?? '1') + 1
  )
    throw new Error('Awwwards pagination changed collection or skipped a page');
  return next;
}
export function awwwardsDetail(html: string, record: RawItem, taxonomy: AwwwardsFacet[]): RawItem {
  const $ = load(html),
    href = $('a[data-visit-count-type-value="submission"][href]').first().attr('href');
  if (!href || canonicalUrl(href) !== canonicalUrl(record.url))
    throw new Error('Awwwards detail original does not match selected listing');
  const native = { ...record.native! },
    tags = new Set(native.tags);
  $('.list-tags a[href]')
    .slice(0, 100)
    .each((_, a) => {
      try {
        awwwardsUrl($(a).attr('href')!, 'listing');
        const text = $(a).text().trim();
        if (text && text.length <= 160) tags.add(text);
      } catch {}
    });
  native.tags = [...tags];
  native.categories = [
    ...new Set([
      ...native.categories,
      ...taxonomy.filter((f) => f.kind === 'category' && tags.has(f.label)).map((f) => f.label),
    ]),
  ];
  native.technologies = [
    ...new Set([
      ...native.technologies,
      ...taxonomy.filter((f) => f.kind === 'technology' && tags.has(f.label)).map((f) => f.label),
    ]),
  ];
  return { ...record, native, sourceMetadata: { ...record.sourceMetadata, detailVerified: true } };
}
