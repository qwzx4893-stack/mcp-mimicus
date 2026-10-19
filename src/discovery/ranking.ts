import { cosine, LocalSemantic } from '../semantic.js';
import type { DiscoveryQuery, Reference } from './types.js';
export const conceptsFor = (labels: string[]) => {
  const map: Record<string, string[]> = {
    'three.js': ['3d', 'webgl'],
    webgl: ['3d', 'interactive'],
    gsap: ['motion', 'animation'],
    portfolio: ['portfolio'],
    'e-commerce': ['product', 'commerce'],
    ecommerce: ['product', 'commerce'],
    typography: ['editorial', 'typography'],
    scroll: ['scroll', 'motion'],
    webflow: ['webflow'],
    nuxt: ['nuxt'],
    astro: ['astro'],
  };
  return [...new Set(labels.flatMap((l) => map[l.toLowerCase()] ?? []))];
};
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKC')
    .match(/[\p{L}\p{N}]+/gu)
    ?.slice(0, 60) ?? [];
export function referenceText(r: Reference) {
  return [
    r.title,
    r.description ?? '',
    ...r.relationships.flatMap((i) => [
      ...i.native.categories,
      ...i.native.tags,
      ...i.native.technologies,
      ...i.native.awards,
      i.description ?? '',
    ]),
    ...r.concepts,
  ]
    .join(' ')
    .slice(0, 1800);
}
/** Bound the caller's wait without pretending native ONNX inference is preemptible.
 * Both work outcomes stay observed after abort; late vectors are never retained. */
function withAbort<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  if (!signal) return work();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    try {
      work().then(
        (value) => {
          signal.removeEventListener('abort', abort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener('abort', abort);
          reject(error);
        },
      );
    } catch (error) {
      signal.removeEventListener('abort', abort);
      reject(error);
    }
  });
}
export async function rankReferences(
  records: Reference[],
  input: DiscoveryQuery,
  semantic: LocalSemantic,
  signal?: AbortSignal,
) {
  const request = [
      input.query,
      input.category,
      input.technology,
      input.industry,
      input.purpose,
      input.style,
      input.interaction,
      input.mood,
      input.navigation,
    ]
      .filter(Boolean)
      .join(' '),
    tokens = words(request);
  const labelFilters = [input.category, input.technology, input.industry].filter((x): x is string =>
    Boolean(x),
  );
  const eligible = records.filter((r) =>
    labelFilters.every((filter) =>
      r.relationships.some((i) =>
        [...i.native.categories, ...i.native.tags, ...i.native.technologies].some((l) =>
          l.toLowerCase().includes(filter.toLowerCase()),
        ),
      ),
    ),
  );
  const lexical = eligible
    .map((r) => {
      const all = words(referenceText(r)),
        labels = r.relationships
          .flatMap((i) => [...i.native.categories, ...i.native.tags, ...i.native.technologies])
          .map((x) => x.toLowerCase());
      const matches = tokens.filter((t) => all.includes(t));
      const score =
        matches.length / Math.max(1, tokens.length) +
        tokens.filter((t) => labels.some((l) => l === t)).length * 0.2;
      return { reference: r, lexicalScore: score, matchedTerms: matches };
    })
    .sort((a, b) => b.lexicalScore - a.lexicalScore);
  // Only the current bounded candidates are embedded, never a global collection.
  const shortlist = lexical.slice(0, Math.min(semantic.config.candidateLimit, 200));
  let mode = 'lexical',
    semanticError: string | undefined,
    semanticDeadlineExceeded = false,
    semanticWorkMayContinue = false,
    vectors: Float32Array[] = [];
  if (
    request &&
    input.retrieval !== 'lexical' &&
    semantic.config.semanticEnabled &&
    shortlist.length
  ) {
    try {
      vectors = await withAbort(
        () =>
          semantic.embed([request, ...shortlist.map((x) => referenceText(x.reference))], signal),
        signal,
      );
      mode = input.retrieval;
    } catch (e) {
      if (signal?.aborted) {
        if (!(signal.reason instanceof Error) || signal.reason.name !== 'TimeoutError')
          throw signal.reason;
        semanticDeadlineExceeded = true;
        semanticWorkMayContinue = true;
        semanticError = 'Discovery deadline reached; completed candidates ranked lexically';
      } else semanticError = e instanceof Error ? e.message : 'MiniLM unavailable';
      mode = 'lexical-fallback';
    }
  }
  const ranked = shortlist
    .map((row, i) => {
      const score = vectors.length ? cosine(vectors[0]!, vectors[i + 1]!) : undefined;
      return {
        ...row,
        semanticScore: score,
        score:
          score === undefined
            ? row.lexicalScore
            : input.retrieval === 'semantic'
              ? score
              : score * 0.65 + row.lexicalScore * 0.35,
        relevance: {
          kind:
            score === undefined ? 'lexical-over-source-metadata' : 'computed-semantic-similarity',
          matchedTerms: row.matchedTerms,
          meaning:
            'Similarity is computed, not a source-provided style, mood or design-quality label.',
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit);
  vectors = [];
  return {
    results: ranked.map(({ reference, ...ranking }) => ({ ...reference, ...ranking })),
    retrieval: mode,
    semanticError,
    semanticDeadlineExceeded,
    semanticWorkMayContinue,
    ...(semanticWorkMayContinue
      ? {
          semanticWorkLimitation:
            'The request wait ended at its deadline. Already-running native CPU inference cannot be preempted and may finish asynchronously within the bounded runtime queue. Shutdown waits for that work; no site vectors are persisted.',
        }
      : {}),
    candidatesConsidered: eligible.length,
    embeddedCandidates: mode.startsWith('lexical') ? 0 : shortlist.length,
    temporaryVectorsReleased: !semanticWorkMayContinue,
  };
}
