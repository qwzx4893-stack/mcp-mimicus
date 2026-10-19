import type { Federation } from './discovery/federation.js';

/** Compact textual cards complement full structuredContent. No source facts change. */
export function searchCards(result: Awaited<ReturnType<Federation['search']>>) {
  return JSON.stringify({
    data: {
      operationId: result.operationId,
      expiresAt: result.expiresAt,
      freshIndependentOperation: result.freshIndependentOperation,
      retrieval: result.retrieval,
      semanticError: result.semanticError,
      semanticDeadlineExceeded: result.semanticDeadlineExceeded,
      semanticWorkMayContinue: result.semanticWorkMayContinue,
      semanticWorkLimitation: result.semanticWorkLimitation,
      temporaryVectorsReleased: result.temporaryVectorsReleased,
      hasMore: result.hasMore,
      continuation: result.continuation,
      candidatesConsidered: result.candidatesConsidered,
      results: result.results.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        description: r.description,
        previews: r.previews,
        sourceClassifications: r.relationships.map((i) => ({
          provider: i.provider,
          stream: i.stream,
          native: i.native,
          makers: i.makers,
          kind: i.kind,
          listingUrl: i.listingUrl,
          provenance: i.provenance,
        })),
        relevance: r.relevance,
      })),
      sources: result.sources.map((s) => ({
        provider: s.provider,
        stream: s.stream,
        status: s.status,
        returnedRecords: s.returnedRecords,
        coverage: s.coverage,
        diagnostics: s.diagnostics,
        hasMore: s.hasMore,
      })),
      nextStep:
        'Use get_reference for complete provenance; open selected references to receive real images. Computed similarity is not visual quality.',
      untrustedEvidence: true,
    },
  });
}
