import { randomUUID } from 'node:crypto';
import type { Config } from '../config.js';
import { LocalSemantic } from '../semantic.js';
import { canonicalUrl, hash, mapBounded, safeLabel } from '../util.js';
import { adapters, discoveryContext, type SourceAdapter } from './providers/index.js';
import { candidatePool, conceptsFor, rankReferences } from './ranking.js';
import {
  DiscoveryQuery,
  Provider,
  type Reference,
  SOURCE_INFO,
  type SourcePage,
  type SourceRecord,
} from './types.js';

type Operation = {
  id: string;
  input: DiscoveryQuery;
  cursors: Map<string, string>;
  references: Map<string, Reference>;
  delivered: Set<string>;
  pendingRanking: Set<string>;
  pendingDelivery: Map<string, Awaited<ReturnType<typeof rankReferences>>['results'][number]>;
  rankingMode: string;
  pages: SourcePage[];
  created: number;
  expires: number;
  busy: boolean;
  controller: AbortController;
};
const DELIVERY_LEDGER_LIMIT = 2400;
export function mergeReferences(records: SourceRecord[]) {
  const merged = new Map<string, Reference>();
  for (const item of records) {
    const url = canonicalUrl(item.url),
      id = hash(url).slice(0, 24);
    let r = merged.get(id);
    if (!r) {
      r = {
        id,
        title: safeLabel(item.title),
        url,
        description: item.description,
        previews: [],
        relationships: [],
        concepts: [],
        inspection: 'requires-authorized-open',
      };
      merged.set(id, r);
    }
    if (
      !r.relationships.some(
        (i) => i.provider === item.provider && i.stream === item.stream && i.itemId === item.itemId,
      )
    )
      r.relationships.push({ ...item, url });
    if (item.preview && !r.previews.some((p) => p.url === item.preview!.url))
      r.previews.push(item.preview);
    r.concepts = conceptsFor(
      r.relationships.flatMap((i) => [
        ...i.native.categories,
        ...i.native.tags,
        ...i.native.technologies,
      ]),
    );
  }
  return [...merged.values()];
}
export class Federation {
  private operations = new Map<string, Operation>();
  private timer: ReturnType<typeof setInterval>;
  private controller = new AbortController();
  private searches = new Set<Promise<unknown>>();
  constructor(
    readonly config: Config,
    readonly semantic = new LocalSemantic(config),
    readonly sources: SourceAdapter[] = adapters(),
  ) {
    this.timer = setInterval(() => this.expire(), Math.min(30000, config.operationTtlMs));
    this.timer.unref();
  }
  private expire() {
    for (const [id, op] of this.operations) if (!op.busy && op.expires <= Date.now()) this.end(id);
  }
  private operation(id: string) {
    this.expire();
    const op = this.operations.get(id);
    if (!op) throw new Error('Discovery operation expired or closed; start a fresh search');
    return op;
  }
  listSources() {
    this.expire();
    return Provider.options.map((id) => ({
      id,
      ...SOURCE_INFO[id],
      status: [...this.operations.values()]
        .flatMap((op) => op.pages)
        .filter((p) => p.provider === id)
        .map(({ records, ...p }) => ({ ...p, returnedRecords: records.length })),
      connectionMeaning:
        'Only an actual current operation establishes access; an adapter descriptor alone is not a connection.',
    }));
  }
  async search(raw: unknown, signal?: AbortSignal) {
    this.controller.signal.throwIfAborted();
    const task = this.searchInternal(raw, signal);
    this.searches.add(task);
    try {
      return await task;
    } finally {
      this.searches.delete(task);
    }
  }
  private async searchInternal(raw: unknown, signal?: AbortSignal) {
    const input = DiscoveryQuery.parse(raw);
    if (
      !input.operationId &&
      input.retentionLimit !== undefined &&
      input.retentionLimit < input.limit
    )
      throw new Error(
        'retentionLimit must be at least the result limit so every returned reference remains addressable',
      );
    if (input.stream && !input.operationId) {
      const ids = input.providers ?? Provider.options;
      if (!ids.every((id) => SOURCE_INFO[id].streams.includes(input.stream!)))
        throw new Error(
          'Stream must be supported by every selected provider; select a single provider and a stream from mimicus_list_sources',
        );
    }
    this.expire();
    let op: Operation;
    if (input.operationId) {
      op = this.operation(input.operationId);
      if (op.busy) throw new Error('This discovery operation is already running');
      if (op.delivered.size >= DELIVERY_LEDGER_LIMIT) {
        this.end(op.id);
        throw new Error(
          'Discovery delivery history reached its 2400-ID RAM limit; operation closed. Start a fresh search to continue.',
        );
      }
      for (const key of Object.keys(raw as Record<string, unknown>))
        if (
          key !== 'operationId' &&
          JSON.stringify((input as any)[key]) !== JSON.stringify((op.input as any)[key])
        )
          throw new Error(
            'Continuation must retain query/filters; start an independent search to change them',
          );
    } else {
      if (this.operations.size >= this.config.maxOperations)
        throw new Error('Too many active discovery operations; close one or wait for expiry');
      op = {
        id: randomUUID(),
        input,
        cursors: new Map(),
        references: new Map(),
        delivered: new Set(),
        pendingRanking: new Set(),
        pendingDelivery: new Map(),
        rankingMode: 'lexical',
        pages: [],
        created: Date.now(),
        expires: Date.now() + this.config.operationTtlMs,
        busy: false,
        controller: new AbortController(),
      };
      this.operations.set(op.id, op);
    }
    op.busy = true;
    const cancel = AbortSignal.any([
        this.controller.signal,
        op.controller.signal,
        ...(signal ? [signal] : []),
      ]),
      combined = AbortSignal.any([cancel, AbortSignal.timeout(this.config.timeoutMs)]),
      transport = discoveryContext(this.config, op.input, op.cursors, combined),
      selected =
        op.pendingRanking.size || op.pendingDelivery.size
          ? []
          : this.sources.filter(
              (a) =>
                (!op.input.providers || op.input.providers.includes(a.id)) &&
                SOURCE_INFO[a.id].streams
                  .filter((s) => s !== 'operator-reference')
                  .filter((s) => !op.input.stream || s === op.input.stream)
                  .some((s) => op.cursors.get(a.id + ':' + s) !== '$done'),
            );
    let pages: SourcePage[] = [];
    try {
      const batches = await mapBounded(
        selected,
        3,
        async (adapter) => {
          try {
            return await adapter.search(transport.context);
          } catch (e) {
            cancel.throwIfAborted();
            const restricted =
              /\bHTTP\s*(?:401|403)\b|robots(?:\.txt)?[^\n]{0,100}(?:disallow|denied|blocked)/i.test(
                String(e),
              );
            return [
              {
                provider: adapter.id,
                stream: input.stream ?? 'source',
                records: [],
                status: restricted ? ('blocked' as const) : ('unavailable' as const),
                coverage: 'Source request failed; no disk or stale fallback',
                retrievedAt: new Date().toISOString(),
                diagnostics: [String(e).slice(0, 500)],
              },
            ];
          }
        },
        cancel,
      );
      pages = batches.flat();
      for (const p of pages) {
        if (p.status === 'available' || p.status === 'partial')
          op.cursors.set(p.provider + ':' + p.stream, p.next ?? '$done');
      }
      if (!this.operations.has(op.id))
        throw new Error('Discovery operation was closed while running');
      const all = mergeReferences(
        pages
          .flatMap((p) => p.records)
          .concat([...op.references.values()].flatMap((r) => r.relationships)),
      );
      const streamPages = new Map(op.pages.map((p) => [p.provider + ':' + p.stream, p]));
      for (const p of pages)
        streamPages.set(p.provider + ':' + p.stream, {
          ...p,
          records: p.records.slice(0, this.config.candidateLimit),
        });
      op.pages = [...streamPages.values()];
      op.expires = Math.min(op.created + 900000, Date.now() + this.config.operationTtlMs);
      cancel.throwIfAborted();
      const currentIds = new Set(mergeReferences(pages.flatMap((p) => p.records)).map((r) => r.id)),
        currentCandidates = all.filter(
          (r) => !op.delivered.has(r.id) && (currentIds.has(r.id) || op.pendingRanking.has(r.id)),
        ),
        reusedRanking = op.pendingDelivery.size > 0 && op.pendingRanking.size === 0,
        previousRankingMode = op.rankingMode,
        cachedRows = [...op.pendingDelivery.values()],
        scoredPass = reusedRanking
          ? {
              ...(await rankReferences(
                [],
                { ...op.input, retrieval: 'lexical' },
                this.semantic,
                cancel,
              )),
              results: cachedRows.slice(0, op.input.limit),
              rankedCandidates: cachedRows,
              unscoredReferenceIds: [...op.pendingRanking],
              retrieval: op.rankingMode + '-retained-ranking',
            }
          : await rankReferences(
              currentCandidates,
              combined.aborted ? { ...op.input, retrieval: 'lexical' } : op.input,
              this.semantic,
              combined,
            ),
        modeChanged =
          !reusedRanking && cachedRows.length > 0 && op.rankingMode !== scoredPass.retrieval,
        combinedRows = reusedRanking ? cachedRows : [...scoredPass.rankedCandidates, ...cachedRows],
        orderedRows = modeChanged ? combinedRows : combinedRows.sort((a, b) => b.score - a.score),
        pass = {
          ...scoredPass,
          rankedCandidates: orderedRows,
          results: orderedRows.slice(0, op.input.limit),
          retrieval: modeChanged
            ? op.rankingMode + '+' + scoredPass.retrieval
            : scoredPass.retrieval,
        },
        {
          scoredReferenceIds: _scoredIds,
          unscoredReferenceIds,
          rankedCandidates,
          ...ranked
        } = pass;
      cancel.throwIfAborted();
      if (
        op.delivered.size + ranked.results.filter((r) => !op.delivered.has(r.id)).length >
        DELIVERY_LEDGER_LIMIT
      ) {
        this.end(op.id);
        throw new Error(
          'This result window would exceed the 2400-ID RAM delivery history limit; operation closed. Start a fresh search.',
        );
      }
      // Rank fetched metadata before retention. Previously an irreversible
      // lexical cutoff discarded references before MiniLM could see them.
      const retentionLimit =
        op.input.retentionLimit ??
        Math.min(600, Math.max(320, (op.input.candidateWindow ?? this.config.candidateLimit) * 2));
      const chosen = new Map<string, Reference>(),
        byId = new Map(all.map((r) => [r.id, r]));
      const add = (id: string) => {
        const r = byId.get(id);
        if (r && chosen.size < retentionLimit) chosen.set(id, r);
      };
      // Keep current results and pending work, then recently delivered addresses.
      // Otherwise old deliveries can crowd new ranked rows out before delivery.
      // Any old address evicted by the declared cap is reported explicitly.
      for (const r of ranked.results) add(r.id);
      for (const r of rankedCandidates) add(r.id);
      for (const id of unscoredReferenceIds) add(id);
      for (const id of [...op.delivered].reverse()) add(id);
      for (const row of candidatePool(
        all.map((reference) => ({ reference, lexicalScore: 0 })),
        all,
        retentionLimit,
      ))
        add(row.reference.id);
      const evictedReferenceIds = all.filter((r) => !chosen.has(r.id)).map((r) => r.id);
      op.references = chosen;
      op.delivered = new Set([...op.delivered, ...ranked.results.map((r) => r.id)]);
      op.pendingRanking = new Set(unscoredReferenceIds.filter((id) => chosen.has(id)));
      op.pendingDelivery = new Map(
        rankedCandidates
          .filter((r) => chosen.has(r.id) && !op.delivered.has(r.id))
          .map((r) => [r.id, r]),
      );
      if (!reusedRanking) op.rankingMode = ranked.retrieval;
      if (combined.aborted && op.input.retrieval !== 'lexical') {
        ranked.retrieval = 'lexical-fallback';
        ranked.semanticDeadlineExceeded = true;
        ranked.semanticError =
          'Discovery deadline reached; completed source results retained with lexical ranking';
      }
      return {
        operationId: op.id,
        expiresAt: new Date(op.expires).toISOString(),
        freshIndependentOperation: !input.operationId,
        metadataHttpRequests: transport.requestCount(),
        requestCountScope: 'Guarded source HTTP; official MCP protocol/tool calls are separate',
        ...ranked,
        pipeline: {
          ...ranked.pipeline,
          reusedRankedCandidates: cachedRows.length,
        },
        rankingModeTransition: modeChanged
          ? {
              previous: previousRankingMode,
              current: scoredPass.retrieval,
              mergedByScore: false,
              meaning:
                'Different ranking modes are grouped, not compared as interchangeable numeric scores.',
            }
          : undefined,
        resultScope: !input.operationId
          ? 'initial-source-pages'
          : pages.length
            ? 'new-source-pages'
            : reusedRanking
              ? 'retained-ranked-candidates'
              : 'deferred-semantic-candidates',
        includesDeferredCandidates: op.pendingRanking.size > 0,
        currentPageCandidates: currentCandidates.length,
        retrievalStages: {
          fetchedSourceRecords: pages.reduce((sum, p) => sum + p.records.length, 0),
          currentPageDistinctReferences: currentIds.size,
          mergedDistinctReferences: all.length,
          candidatesBeforeRanking: currentCandidates.length,
          pendingSemanticCandidates: op.pendingRanking.size,
          pendingRankedCandidates: op.pendingDelivery.size,
          retentionLimit,
          retainedDeliveredReferences: [...op.delivered].filter((id) => chosen.has(id)).length,
          deliveredIdsTracked: op.delivered.size,
          deliveryLedgerLimit: DELIVERY_LEDGER_LIMIT,
        },
        sources: op.pages.map(({ records, ...p }) => ({ ...p, returnedRecords: records.length })),
        partialCoverage: op.pages.some((p) => p.status !== 'available'),
        retainedCandidates: chosen.size,
        evictedCandidates: evictedReferenceIds.length,
        evictedReferenceIds,
        continuationBlocked:
          op.delivered.size >= DELIVERY_LEDGER_LIMIT
            ? 'The 2400-ID RAM delivery ledger is full. Start a fresh search for further discovery.'
            : undefined,
        hasMore:
          op.pendingRanking.size > 0 ||
          op.pendingDelivery.size > 0 ||
          [...op.cursors.values()].some((v) => v !== '$done'),
        continuation: [...op.cursors.entries()]
          .filter(([, v]) => v !== '$done')
          .map(([stream]) => stream)
          .concat(op.pendingDelivery.size ? ['retained-ranked-candidates'] : [])
          .concat(op.pendingRanking.size ? ['retained-semantic-candidates'] : []),
        meaning:
          'Live source candidates or explicitly operator-supplied unverified references in bounded RAM. Continuation ranks new pages and retained not-yet-embedded candidates without repeating delivered references. Returned addresses remain valid until reported eviction or operation expiry. No catalog or site embeddings are written to disk.',
        untrustedEvidence: true,
      };
    } catch (e) {
      // A cancelled continuation may already have advanced source cursors. Drop
      // the operation rather than let a later continuation silently skip a page.
      if (!input.operationId || cancel.aborted) this.end(op.id);
      throw e;
    } finally {
      transport.release();
      op.busy = false;
    }
  }
  getReference(operationId: string, id: string) {
    const op = this.operation(operationId),
      r = op.references.get(id);
    if (!r) throw new Error('Reference not in active discovery operation');
    return {
      ...r,
      operationId,
      retrievedWithinOperation: true,
      expiresAt: new Date(op.expires).toISOString(),
      untrustedEvidence: true,
    };
  }
  categories(operationId: string) {
    const op = this.operation(operationId);
    return {
      operationId,
      sources: op.pages.map((p) => ({
        provider: p.provider,
        stream: p.stream,
        taxonomy: p.taxonomy ?? [],
        directoryTaxonomy: p.directoryTaxonomy,
        nativeLabels: [
          ...new Set(
            p.records.flatMap((i) => [
              ...i.native.categories,
              ...i.native.tags,
              ...i.native.technologies,
            ]),
          ),
        ],
        coverage: p.coverage,
      })),
      normalizedConcepts: [...new Set([...op.references.values()].flatMap((r) => r.concepts))],
      meaning:
        'Native source labels and computed cross-source concepts are separate; directory taxonomy is not relabeled as showcase taxonomy.',
    };
  }
  end(id: string) {
    const op = this.operations.get(id);
    if (op) {
      op.controller.abort();
      op.references.clear();
      op.delivered.clear();
      op.pendingRanking.clear();
      op.pendingDelivery.clear();
      op.cursors.clear();
      op.pages = [];
      this.operations.delete(id);
    }
    return { closed: !!op, operationId: id };
  }
  status() {
    this.expire();
    return {
      activeOperations: this.operations.size,
      retainedReferences: [...this.operations.values()].reduce(
        (sum, op) => sum + op.references.size,
        0,
      ),
      pendingRankedCandidates: [...this.operations.values()].reduce(
        (sum, op) => sum + op.pendingDelivery.size,
        0,
      ),
      pendingSemanticCandidates: [...this.operations.values()].reduce(
        (sum, op) => sum + op.pendingRanking.size,
        0,
      ),
      persistentCatalog: false,
    };
  }
  async close() {
    this.controller.abort();
    clearInterval(this.timer);
    for (const id of [...this.operations.keys()]) this.end(id);
    await Promise.allSettled([...this.searches]);
    await this.semantic.close();
  }
}
