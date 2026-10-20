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
const nativeLabel = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase('en');
export const matchesNativeFilters = (r: Reference, input: DiscoveryQuery) =>
  [input.category, input.technology, input.industry]
    .filter((x): x is string => Boolean(x))
    .every((filter) =>
      r.relationships.some((i) =>
        [...i.native.categories, ...i.native.tags, ...i.native.technologies].some(
          (label) => nativeLabel(label) === nativeLabel(filter),
        ),
      ),
    );

/** Union lexical matches with source-order exploration. Source diversity affects
 * admission to inference, never guarantees a reference a high final rank. */
export function candidatePool<T extends { reference: Reference; lexicalScore: number }>(
  lexical: T[],
  sourceOrder: Reference[],
  limit: number,
) {
  if (lexical.length <= limit)
    return lexical.map((row) => ({ ...row, selectionReason: 'within-bounded-current-candidates' }));
  const rows = new Map(lexical.map((r) => [r.reference.id, r])),
    chosen = new Map<string, T & { selectionReason: string }>(),
    add = (r: T, reason: string) => {
      if (chosen.size < limit && !chosen.has(r.reference.id))
        chosen.set(r.reference.id, { ...r, selectionReason: reason });
    };
  // Do not fill the lexical quota with zero-match ties. That silently consumes
  // exploration capacity for another arbitrary source prefix on sparse queries.
  for (const row of lexical.filter((r) => r.lexicalScore > 0).slice(0, Math.ceil(limit / 2)))
    add(row, 'lexical-metadata-match');
  const providers = [
      ...new Set(sourceOrder.flatMap((r) => r.relationships.map((i) => i.provider))),
    ],
    buckets = providers.map((provider) =>
      sourceOrder.filter(
        (r) => rows.has(r.id) && r.relationships.some((i) => i.provider === provider),
      ),
    );
  // A breadth-first subdivision visits the entire source window, rather than
  // reserving the exploration quota for another lexical/native prefix.
  const indices = (length: number) => {
    const result: number[] = [],
      pending: [number, number][] = [[0, length - 1]];
    while (pending.length) {
      const [lo, hi] = pending.shift()!;
      if (lo > hi) continue;
      result.push(lo);
      if (hi > lo) {
        const middle = Math.floor((lo + 1 + hi) / 2);
        pending.push([middle, hi], [lo + 1, middle - 1]);
      }
    }
    return result;
  };
  const orders = buckets.map((b) => indices(b.length));
  for (let i = 0; chosen.size < limit && i < sourceOrder.length; i++)
    for (let b = 0; b < buckets.length; b++) {
      const index = orders[b]![i],
        r = index === undefined ? undefined : buckets[b]![index];
      if (r) add(rows.get(r.id)!, 'source-order-exploration');
    }
  return [...chosen.values()];
}
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
  const started = performance.now();
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
    tokens = [...new Set(words(request))];
  const eligible = records.filter((r) => matchesNativeFilters(r, input));
  const lexical = eligible
    .map((r) => {
      const all = words(referenceText(r)),
        labels = r.relationships
          .flatMap((i) => [...i.native.categories, ...i.native.tags, ...i.native.technologies])
          .map((x) => x.toLowerCase());
      const matches = tokens.filter((t) => all.includes(t));
      const score = Math.min(
        1,
        matches.length / Math.max(1, tokens.length) +
          tokens.filter((t) => labels.some((l) => l === t)).length * 0.1,
      );
      return { reference: r, lexicalScore: score, matchedTerms: matches };
    })
    .sort((a, b) => b.lexicalScore - a.lexicalScore);
  const budget = input.candidateWindow ?? semantic.config.candidateLimit;
  const shortlist = candidatePool(lexical, eligible, Math.min(budget, 200));
  const lexicalMs = performance.now() - started,
    semanticStarted = performance.now();
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
  // A lexical/offline fallback can score all fetched eligible metadata cheaply;
  // an embedding window must not truncate the fallback as well.
  const scored = vectors.length
    ? shortlist
    : lexical.map((row) => ({
        ...row,
        selectionReason: 'lexical-fallback-over-all-current-metadata',
      }));
  const ranked = scored
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
              : Math.max(0, score) * 0.7 + row.lexicalScore * 0.3,
        relevance: {
          kind:
            score === undefined ? 'lexical-over-source-metadata' : 'computed-semantic-similarity',
          matchedTerms: row.matchedTerms,
          meaning:
            'Similarity is computed, not a source-provided style, mood or design-quality label.',
        },
      };
    })
    .sort((a, b) => b.score - a.score);
  const rankedCandidates = ranked.map(({ reference, ...ranking }) => ({
    ...reference,
    ...ranking,
  }));
  const semanticUsed = vectors.length > 0;
  vectors = [];
  return {
    results: rankedCandidates.slice(0, input.limit),
    rankedCandidates,
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
    // Internal lifecycle information; Federation removes these arrays from MCP
    // output and retains only a bounded queue of not-yet-scored RAM references.
    scoredReferenceIds: scored.map((r) => r.reference.id),
    unscoredReferenceIds: semanticUsed
      ? lexical
          .filter((r) => !shortlist.some((s) => s.reference.id === r.reference.id))
          .map((r) => r.reference.id)
      : [],
    pipeline: {
      fetchedReferences: records.length,
      eligibleAfterNativeFilters: eligible.length,
      nativeHardFilters: [input.category, input.technology, input.industry].filter(Boolean),
      lexicallyMatchedCandidates: lexical.filter((r) => r.lexicalScore > 0).length,
      lexicalScoredCandidates: lexical.length,
      semanticWindowBudget: Math.min(budget, 200),
      semanticPoolCandidates: shortlist.length,
      admittedWithoutLexicalMatch: shortlist.filter((r) => r.lexicalScore === 0).length,
      deferredSemanticCandidates: semanticUsed ? eligible.length - shortlist.length : 0,
      lexicalMs: Math.round(lexicalMs * 100) / 100,
      semanticMs: Math.round((performance.now() - semanticStarted) * 100) / 100,
      totalMs: Math.round((performance.now() - started) * 100) / 100,
      filterMeaning:
        'category, technology and industry require exact case-insensitive native labels; style, mood, purpose, interaction and navigation are soft search concepts, never invented labels.',
      selectionMeaning:
        'The semantic window unions lexical metadata relevance with provider/source-order exploration; unscored retained candidates can be considered on explicit continuation. Neither admission nor similarity proves visual quality.',
    },
    temporaryVectorsReleased: !semanticWorkMayContinue,
  };
}
