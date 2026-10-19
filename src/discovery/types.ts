import { z } from 'zod';
export const Provider = z.enum([
  'awwwards',
  'codrops',
  'astro',
  'webflow',
  'threejs-resources',
  'nuxt',
  'mesh3d',
]);
export type Provider = z.infer<typeof Provider>;
const labels = z.array(z.string().min(1).max(160)).max(100).default([]);
export const SourceRecordSchema = z.object({
  provider: Provider,
  stream: z.string().min(1).max(80),
  itemId: z.string().min(1).max(300),
  title: z.string().min(1).max(300),
  url: z.string().url(),
  listingUrl: z.string().url(),
  native: z
    .object({ categories: labels, tags: labels, technologies: labels, awards: labels })
    .default({ categories: [], tags: [], technologies: [], awards: [] }),
  makers: labels,
  description: z.string().max(800).optional(),
  preview: z
    .object({
      url: z.string().url(),
      kind: z.literal('source-remote-link'),
      provenance: z.string(),
    })
    .optional(),
  publishedAt: z.string().max(100).optional(),
  kind: z.enum(['website', 'demo', 'experiment', 'cloneable', 'template']).default('website'),
  repository: z.string().url().optional(),
  revision: z.string().max(100).optional(),
  license: z.string().max(100).optional(),
  provenance: z.string().min(8).max(2000),
  retrievedAt: z.string(),
  sourceMetadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
});
export type SourceRecord = z.infer<typeof SourceRecordSchema>;
const operatorReference = z.object({
  title: z.string().min(1).max(300),
  url: z
    .string()
    .url()
    .refine((value) => {
      try {
        const u = new URL(value);
        return (
          ['http:', 'https:'].includes(u.protocol) &&
          !u.username &&
          !u.password &&
          u.hostname !== 'www.awwwards.com' &&
          u.hostname !== 'awwwards.com'
        );
      } catch {
        return false;
      }
    }, 'Provide the credential-free original website URL'),
  listingUrl: z
    .string()
    .url()
    .refine((value) => {
      try {
        const u = new URL(value);
        return (
          u.protocol === 'https:' &&
          u.hostname === 'www.awwwards.com' &&
          !u.username &&
          !u.password &&
          /^\/sites\/[^/]+\/?$/.test(u.pathname) &&
          !u.search &&
          !u.hash
        );
      } catch {
        return false;
      }
    }, 'Provide an exact public Awwwards /sites/ reference link'),
});
export const DiscoveryQuery = z.object({
  query: z.string().max(500).default(''),
  providers: z.array(Provider).min(1).max(7).optional(),
  stream: z.string().max(80).optional(),
  category: z.string().max(120).optional(),
  technology: z.string().max(120).optional(),
  industry: z.string().max(120).optional(),
  purpose: z.string().max(120).optional(),
  style: z.string().max(120).optional(),
  interaction: z.string().max(120).optional(),
  mood: z.string().max(120).optional(),
  navigation: z.string().max(120).optional(),
  sourceSort: z.enum(['popular', 'recent', 'likes']).optional(),
  originalReferences: z.array(operatorReference).max(8).optional(),
  retrieval: z.enum(['lexical', 'hybrid', 'semantic']).default('hybrid'),
  limit: z.number().int().min(1).max(30).default(10),
  operationId: z.string().max(100).optional(),
});
export type DiscoveryQuery = z.infer<typeof DiscoveryQuery>;
// MCP validation must preserve omissions. Defaults inserted at the wire boundary
// would turn {operationId} into an unintended change of query/limit/retrieval.
export const DiscoveryInput = DiscoveryQuery.extend({
  query: z.string().max(500).optional(),
  retrieval: z.enum(['lexical', 'hybrid', 'semantic']).optional(),
  limit: z.number().int().min(1).max(30).optional(),
});
export type SourcePage = {
  provider: Provider;
  stream: string;
  status: 'available' | 'partial' | 'blocked' | 'unavailable';
  records: SourceRecord[];
  sourceRetrievedRecords?: number;
  taxonomy?: { label: string; id?: string; kind: string; url?: string }[];
  directoryTaxonomy?: unknown;
  next?: string | null;
  hasMore?: boolean;
  coverage: string;
  diagnostics: string[];
  retrievedAt: string;
  revision?: string;
  requests?: number;
  navigation?: { label: string; url: string; mode: 'manual-public-navigation' }[];
  capabilities?: {
    name: string;
    status: 'available' | 'restricted' | 'operator-supplied';
    reason: string;
  }[];
  manualReferenceCount?: number;
};
export type Reference = {
  id: string;
  title: string;
  url: string;
  description?: string;
  previews: NonNullable<SourceRecord['preview']>[];
  relationships: SourceRecord[];
  concepts: string[];
  inspection: 'requires-authorized-open';
};
export const SOURCE_INFO: Record<
  Provider,
  { name: string; url: string; streams: string[]; interface: string }
> = {
  awwwards: {
    name: 'Awwwards',
    url: 'https://www.awwwards.com/websites/',
    streams: ['websites', 'operator-reference'],
    interface:
      'Reviewed MIT parser; public manual reference navigation and operator-supplied original-site handoff, restricted automated catalog without authorization',
  },
  codrops: {
    name: 'Codrops',
    url: 'https://tympanus.net/codrops/',
    streams: ['creative-hub', 'webzibition', 'repositories'],
    interface: 'Public independent streams and official organization API',
  },
  astro: {
    name: 'Astro Showcase',
    url: 'https://astro.build/showcase/',
    streams: ['showcase'],
    interface:
      'Complete current official title/URL API in request RAM and selected revision-pinned showcase YAML',
  },
  webflow: {
    name: 'Made in Webflow',
    url: 'https://webflow.com/made-in-webflow',
    streams: ['made-in-webflow'],
    interface:
      'Robots-allowed public native offset feed, source tags/sorts and verified original-site detail links',
  },
  'threejs-resources': {
    name: 'Three.js Resources',
    url: 'https://threejsresources.com/mcp',
    streams: ['showcase'],
    interface: 'Official read-only MCP search and taxonomy',
  },
  nuxt: {
    name: 'Nuxt Showcase',
    url: 'https://nuxt.com/showcase',
    streams: ['showcase'],
    interface: 'Current official showcase YAML',
  },
  mesh3d: {
    name: 'mesh3d.gallery',
    url: 'https://mesh3d.gallery/websites',
    streams: ['websites'],
    interface:
      'Public native-filter listing/detail links; robots-blocked infinite-scroll API is excluded',
  },
};
