import { load } from 'cheerio';
import { parse } from 'yaml';
import { canonicalUrl, hash } from '../../util.js';
import { type Provider, type SourceRecord, SourceRecordSchema } from '../types.js';
export type RawItem = Partial<SourceRecord> &
  Pick<SourceRecord, 'itemId' | 'title' | 'url' | 'listingUrl'>;
export const yamlData = (text: string) => parse(text, { maxAliasCount: 0 }) as Record<string, any>;
export function normalize(
  provider: Provider,
  stream: string,
  records: RawItem[],
  provenance: string,
) {
  const labels = (v: unknown) =>
    Array.isArray(v)
      ? [
          ...new Set(
            v
              .filter((x): x is string => typeof x === 'string')
              .map((x) => x.trim())
              .filter((x) => x.length > 0 && x.length <= 160),
          ),
        ].slice(0, 100)
      : [];
  return records.map((r) => {
    canonicalUrl(r.url);
    canonicalUrl(r.listingUrl);
    return SourceRecordSchema.parse({
      provider,
      stream,
      retrievedAt: new Date().toISOString(),
      provenance,
      ...r,
      makers: labels(r.makers),
      native: {
        categories: labels(r.native?.categories),
        tags: labels(r.native?.tags),
        technologies: labels(r.native?.technologies),
        awards: labels(r.native?.awards),
      },
    });
  });
}
export function astroRecord(text: string, path: string, blob: string): RawItem {
  const d = yamlData(text);
  if (typeof d.url !== 'string' || typeof d.title !== 'string')
    throw new Error('Astro showcase schema drift');
  return {
    itemId: path,
    title: d.title,
    url: d.url,
    listingUrl: 'https://astro.build/showcase/',
    native: {
      categories: d.categories ?? [],
      tags: d.tags ?? [],
      technologies: ['Astro'],
      awards: [],
    },
    publishedAt: d.dateAdded ? String(d.dateAdded) : undefined,
    revision: blob,
    description: typeof d.description === 'string' ? d.description.slice(0, 800) : undefined,
    sourceMetadata: {
      highlight: d.highlight === true,
      featured: typeof d.featured === 'number' ? d.featured : 0,
    },
  };
}
export function nuxtTaxonomy(text: string): string[] {
  const d = yamlData(text);
  if (!Array.isArray(d.wall?.filters)) throw new Error('Nuxt industry taxonomy schema drift');
  const filters: unknown[] = d.wall.filters;
  return [
    ...new Set(
      filters.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 160),
    ),
  ];
}
export function nuxtRecords(text: string): RawItem[] {
  const d = yamlData(text);
  if (!Array.isArray(d.websites) || !Array.isArray(d.wall?.filters))
    throw new Error('Nuxt showcase schema drift');
  return d.websites.map((w: any) => {
    if (typeof w.name !== 'string' || typeof w.url !== 'string')
      throw new Error('Invalid Nuxt website');
    return {
      itemId: hash(w.url).slice(0, 24),
      title: w.name,
      url: w.url,
      listingUrl: 'https://nuxt.com/showcase',
      native: {
        categories: w.industry ? [w.industry] : [],
        tags: [],
        technologies: ['Nuxt'],
        awards: [],
      },
      license: 'MIT',
      revision: hash([w.name, w.url, w.industry]),
      sourceMetadata: { industry: w.industry ?? '' },
    };
  });
}
export function webflowListing(html: string): {
  items: Record<string, any>[];
  taxonomy: { id: string; label: string }[];
} {
  const $ = load(html),
    text = $('#__NEXT_DATA__').text();
  if (!text) throw new Error('Webflow NEXT_DATA missing');
  const p = JSON.parse(text).props?.pageProps;
  if (!Array.isArray(p?.fallbackData) || !Array.isArray(p.tags))
    throw new Error('Webflow catalog schema drift');
  return {
    items: p.fallbackData as Record<string, any>[],
    taxonomy: p.tags.map((t: any) => ({ id: String(t.id), label: String(t.label) })),
  };
}
export function webflowDetail(html: string, summary: Record<string, any>): RawItem {
  const $ = load(html),
    p = JSON.parse($('#__NEXT_DATA__').text()).props?.pageProps,
    item = p?.showcaseItem?.siteProfile ?? p?.showcaseItem;
  if (!item || String(item.id) !== String(summary.id))
    throw new Error('Webflow detail identity mismatch');
  const url = $('a')
    .filter((_, e) => $(e).text().trim() === 'Open live site')
    .first()
    .attr('href');
  if (!url) throw new Error('Webflow original website URL missing');
  return {
    itemId: String(item.id),
    title: String(item.title),
    url,
    listingUrl: 'https://webflow.com/made-in-webflow/website/' + item.slug,
    native: {
      categories: [],
      tags: [...(item.tags ?? []), ...(item.additionalTags ?? [])],
      technologies: ['Webflow'],
      awards: [],
    },
    makers: [item.authorWorkspace?.name ?? item.authorProfile?.name].filter(Boolean),
    kind: item.fromPaidTemplate ? 'template' : item.cloneable ? 'cloneable' : 'website',
    publishedAt: item.createdOn,
    sourceMetadata: {
      cloneable: item.cloneable === true,
      template: Boolean(item.fromPaidTemplate),
      modifiedAt: item.lastModified ?? '',
    },
  };
}
export function meshListing(html: string) {
  const $ = load(html);
  const paths = [
    ...new Set(
      $('a[href^="/website/"]')
        .map((_, e) => $(e).attr('href')!)
        .get(),
    ),
  ];
  if (!paths.length) throw new Error('mesh3d listing schema drift');
  return {
    paths,
    next:
      $('a[rel=next]').attr('href') ??
      $('a')
        .filter((_, e) => /^(Next|Load more)$/i.test($(e).text().trim()))
        .first()
        .attr('href'),
    advertisedCount: html.match(/All websites.{0,100}?(\d{2,5})/s)?.[1] ?? null,
  };
}
export function meshNativeFilters(html: string, root = 'https://mesh3d.gallery/websites') {
  const $ = load(html),
    base = new URL(root);
  const filters: { label: string; id: string; kind: string; url: string }[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href'),
      label = $(el).text().trim().slice(0, 160);
    if (!href || !label) return;
    try {
      const u = new URL(href, root);
      if (u.origin !== base.origin || u.pathname !== '/websites' || u.username || u.password)
        return;
      for (const kind of ['tech', 'tags']) {
        const id = u.searchParams.get(kind);
        if (id && !filters.some((t) => t.id === id && t.kind === kind))
          filters.push({ label, id, kind, url: u.href });
      }
    } catch {
      /* One malformed link does not erase the source's valid filters. */
    }
  });
  return filters;
}
export function meshDetail(html: string, path: string): RawItem {
  const $ = load(html);
  const outbound = $('a[href^="http"]')
    .map((_, e) => $(e).attr('href')!)
    .get()
    .find((h) => h.includes('utm_source=mesh3d.gallery'));
  if (!outbound) throw new Error('mesh3d original URL missing');
  const title = $('h1').first().text().trim();
  if (!title) throw new Error('mesh3d title missing');
  const tags = $('a[href*="/websites?tags="]')
    .map((_, e) => $(e).text().trim())
    .get();
  const tech = $('a[href*="/websites?tech="]')
    .map((_, e) => $(e).text().trim())
    .get();
  return {
    itemId: path.split('/').at(-1)!,
    title,
    url: outbound,
    listingUrl: 'https://mesh3d.gallery' + path,
    native: {
      categories: ['Websites'],
      tags: [...new Set(tags)],
      technologies: [...new Set(tech)],
      awards: [],
    },
    makers: [
      ...new Set(
        $('a[href^="/makers/"]')
          .map((_, e) => $(e).children('span').first().text().trim())
          .get()
          .filter(Boolean),
      ),
    ],
    publishedAt: $('time[datetime]').first().attr('datetime'),
  };
}
export function codropsHub(
  html: string,
  stream: 'creative-hub' | 'webzibition',
  pageUrl = 'https://tympanus.net/codrops/webzibition/',
  rejected: { identity: string; reason: string }[] = [],
): RawItem[] {
  const $ = load(html),
    records: RawItem[] = [];
  if (stream === 'creative-hub') {
    $('article.demo-card,article').each((_, el) => {
      const e = $(el),
        title = e.find('h2,h3').first().text().trim(),
        href = e.find('a.demo-card__thumb-img').first().attr('href');
      if (!title || !href) return;
      let url: string;
      try {
        url = canonicalUrl(new URL(href, pageUrl).href);
      } catch {
        rejected.push({
          identity: e.attr('id') ?? title.slice(0, 160),
          reason:
            'Malformed or credential-bearing Creative Hub demo URL excluded without guessing a replacement',
        });
        return;
      }
      const repo = e.find('a.icon--code').attr('href'),
        image = e.find('img').first().attr('src') ?? e.find('img').first().attr('data-src');
      const preview =
        image && !image.startsWith('data:') ? new URL(image, pageUrl).href : undefined;
      records.push({
        itemId: e.attr('id') ?? url,
        title,
        url,
        listingUrl: pageUrl.includes('/hub/') ? pageUrl : 'https://tympanus.net/codrops/hub/all/',
        repository: repo?.startsWith('https://github.com/') ? repo : undefined,
        ...(preview && /^https?:/.test(preview)
          ? {
              preview: {
                url: preview,
                kind: 'source-remote-link' as const,
                provenance:
                  'Actual Codrops source card image URL; returned as a link without fetching or mirroring media',
              },
            }
          : {}),
        native: {
          categories: [],
          tags: e
            .find('.demo-card__tags a')
            .map((_, a) => $(a).text().trim())
            .get(),
          technologies: [],
          awards: [],
        },
        makers: e
          .find('.demo-card__author')
          .map((_, a) => $(a).text().trim())
          .get(),
        publishedAt: e.find('time').first().text().trim() || undefined,
        kind: 'demo',
        sourceMetadata: {
          linkRole: 'published-interactive-demo',
          repositoryRelationship: Boolean(repo?.startsWith('https://github.com/')),
        },
      });
    });
    if (!records.length) throw new Error('Codrops Creative Hub card schema drift');
    return records;
  }
  $('article').each((_, el) => {
    const e = $(el),
      title = e.find('h2,h3').first().text().trim(),
      listing = e.find('h2 a,h3 a').first().attr('href'),
      url = e
        .find('a[rel~=external],a[href][target=_blank]')
        .map((_, a) => $(a).attr('href')!)
        .get()
        .find(
          (h) => /^https?:/.test(h) && !h.includes('tympanus.net') && !h.includes('twitter.com'),
        );
    if (title && listing && url) {
      let original: URL, listingUrl: URL;
      try {
        original = new URL(url);
        listingUrl = new URL(listing, 'https://tympanus.net');
        if (
          !['https:', 'http:'].includes(original.protocol) ||
          !['https:', 'http:'].includes(listingUrl.protocol)
        )
          throw new Error('Unsupported URL scheme');
        canonicalUrl(original.href);
        canonicalUrl(listingUrl.href);
      } catch {
        rejected.push({
          identity: e.attr('id') ?? title.slice(0, 160),
          reason:
            'Provider article contains a malformed original or listing URL; excluded without inventing a replacement',
        });
        return;
      }
      records.push({
        itemId: e.attr('id') ?? listing,
        title,
        url: original.href,
        listingUrl: listingUrl.origin === 'https://tympanus.net' ? listingUrl.href : pageUrl,
        native: {
          categories: e
            .find('a[rel~=category]')
            .map((_, a) => $(a).text().trim())
            .get(),
          tags: e
            .find('a[rel~=tag]')
            .map((_, a) => $(a).text().trim())
            .get(),
          technologies: [],
          awards: [],
        },
        makers: e
          .find('[rel=author]')
          .map((_, a) => $(a).text().trim())
          .get(),
        publishedAt: e.find('time[datetime]').first().attr('datetime'),
        kind: 'website',
        sourceMetadata: { linkRole: 'original-website', sourceArticleDistinct: true },
      });
    }
  });
  if (!records.length)
    throw new Error(
      'Codrops ' + stream + ' parser has no original-site records; no acceptance claim',
    );
  return records;
}
export function threeResourcesRecords(payload: any): RawItem[] {
  if (typeof payload?.text === 'string') {
    const blocks = payload.text.split(/(?=^- \*\*)/m).slice(1);
    const records: RawItem[] = [];
    for (const block of blocks) {
      const head = block.match(
          /^- \*\*(.+?)\*\*\s*—\s*(https:\/\/threejsresources\.com\/showcase\/[^\s]+)/,
        ),
        live = block.match(/^\s*live:\s*(https?:\/\/[^\s]+)/m);
      if (!head || !live)
        throw new Error('Official MCP showcase block lacks identity/original URL');
      const maker = block.match(/^\s*by (.+?)(?: \((https?:\/\/[^\s]+)\))?\s*$/m),
        tags =
          block
            .match(/^\s*tags:\s*(.+)$/m)?.[1]
            ?.split(',')
            .map((s: string) => s.trim()) ?? [];
      records.push({
        itemId: new URL(head[2]!).pathname.split('/').at(-1)!,
        title: head[1]!.trim(),
        url: live[1]!,
        listingUrl: head[2]!,
        native: { categories: [], tags, technologies: ['Three.js'], awards: [] },
        makers: maker ? [maker[1]!.trim()] : [],
        sourceMetadata: {
          taxonomyEncoding: tags.length ? 'provider tag identifiers' : 'no entry tags provided',
          ...(maker?.[2] ? { makerUrl: maker[2] } : {}),
        },
      });
    }
    if (!records.length)
      throw new Error('Official MCP text format drift: no original showcase URLs');
    return records;
  }
  const root = payload?.data ?? payload,
    items = Array.isArray(root)
      ? root
      : (root?.results ?? root?.items ?? root?.showcase ?? root?.entries);
  if (!Array.isArray(items) || !items.length)
    throw new Error('Official Three Resources MCP response schema drift');
  return items.map((i: any) => {
    const url = i.url ?? i.websiteUrl ?? i.website_url ?? i.link;
    const title = i.title ?? i.name;
    if (typeof url !== 'string' || typeof title !== 'string')
      throw new Error('Official MCP record lacks title/original URL');
    const arr = (v: any) =>
      Array.isArray(v)
        ? v.map((x) => (typeof x === 'string' ? x : (x.name ?? x.label ?? x.slug))).filter(Boolean)
        : typeof v === 'string'
          ? [v]
          : [];
    return {
      itemId: String(i.id ?? i.slug ?? hash(url).slice(0, 24)),
      title,
      url,
      listingUrl: i.sourceUrl ?? i.listingUrl ?? 'https://threejsresources.com/showcase',
      native: {
        categories: arr(i.categories ?? i.category),
        tags: arr(i.tags),
        technologies: arr(i.technologies ?? i.tech),
        awards: [],
      },
      makers: arr(i.author ?? i.creator ?? i.maker),
      publishedAt: i.publishedAt ?? i.createdAt,
    };
  });
}
