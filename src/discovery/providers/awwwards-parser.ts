/** Adapted from INSANE0777/Awwwards-mcp src/parsers.ts at
 * 9bc82857894007da4b27e806cecfde8befe68a81 (MIT). See THIRD_PARTY_NOTICES.
 * Re-reviewed against current upstream 1bc9c13557c8e8f6ea90e174d88eb1708696fca3.
 * The upstream split/card parser is retained, bounded and stripped of media.
 * Parsing software does not grant permission to harvest the target catalog. */
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
  for (const part of html.split('data-collectable-model-value="').slice(1, 501)) {
    const end = part.indexOf('\">');
    if (end < 0 || end > 20000) continue;
    let meta: any;
    try {
      meta = JSON.parse(decodeEntities(part.slice(0, end)));
    } catch {
      continue;
    }
    if (!meta?.slug || !meta?.title || (meta.type && meta.type !== 'submission')) continue;
    const card = part.slice(end, end + 8000),
      detail = card.match(/href="(\/sites\/[^"#?]+)"/),
      live = card.match(/class="figure-rollover__bt"[^>]*href="(https?:\/\/[^\"]+)"/);
    if (!detail || !live) continue;
    result.push({
      itemId: String(meta.id ?? meta.slug),
      title: decodeEntities(String(meta.title)),
      url: decodeEntities(live[1]!),
      listingUrl: 'https://www.awwwards.com' + detail[1],
      native: {
        categories: [],
        tags: Array.isArray(meta.tags)
          ? meta.tags.filter((t: unknown) => typeof t === 'string').map(decodeEntities)
          : [],
        technologies: [],
        awards: [
          ...new Set(
            [...card.matchAll(/budget-tag--([a-z-]+)/g)].map((m) => awards[m[1]!] ?? m[1]!),
          ),
        ],
      },
      makers: card.match(/avatar-name__title">([^<]+)</)?.[1]
        ? [decodeEntities(card.match(/avatar-name__title">([^<]+)</)![1]!.trim())]
        : [],
      publishedAt: meta.createdAt ? String(meta.createdAt) : undefined,
    });
  }
  if (!result.length)
    throw new Error('Awwwards listing drift or no original URLs; no records returned');
  return result;
}
