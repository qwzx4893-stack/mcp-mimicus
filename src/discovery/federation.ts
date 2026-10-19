import { randomUUID } from 'node:crypto';
import type { Config } from '../config.js';
import { LocalSemantic } from '../semantic.js';
import { canonicalUrl, hash, mapBounded, safeLabel } from '../util.js';
import { adapters, discoveryContext, type SourceAdapter } from './providers/index.js';
import { conceptsFor, rankReferences, referenceText } from './ranking.js';
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
  pages: SourcePage[];
  created: number;
  expires: number;
  busy: boolean;
  controller: AbortController;
};
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
function selectCandidates(all: Reference[], input: DiscoveryQuery, limit: number) {
  const tokens =
      [
        input.query,
        input.category,
        input.industry,
        input.technology,
        input.purpose,
        input.style,
        input.interaction,
        input.mood,
        input.navigation,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? [],
    score = (r: Reference) =>
      tokens.filter((t) => referenceText(r).toLowerCase().includes(t)).length,
    ordered = [...all].sort((a, b) => score(b) - score(a)),
    buckets = Provider.options
      .map((p) => ordered.filter((r) => r.relationships.some((i) => i.provider === p)))
      .filter((b) => b.length),
    chosen = new Map<string, Reference>();
  for (const b of buckets) if (chosen.size < limit) chosen.set(b[0]!.id, b[0]!);
  for (const r of ordered.filter((r) => score(r) > 0)) {
    if (chosen.size >= limit) break;
    chosen.set(r.id, r);
  }
  for (let i = 0; chosen.size < limit && i < ordered.length; i++)
    for (const b of buckets) {
      const r = b[i];
      if (r && chosen.size < limit) chosen.set(r.id, r);
    }
  return [...chosen.values()];
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
      selected = this.sources.filter(
        (a) =>
          (!op.input.providers || op.input.providers.includes(a.id)) &&
          SOURCE_INFO[a.id].streams
            .filter((s) => s !== 'operator-reference')
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
            return [
              {
                provider: adapter.id,
                stream: input.stream ?? 'source',
                records: [],
                status: 'unavailable' as const,
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
        ),
        chosen = selectCandidates(all, op.input, this.config.candidateLimit);
      op.references = new Map(chosen.map((r) => [r.id, r]));
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
        currentCandidates = [...op.references.values()].filter(
          (r) => !input.operationId || currentIds.has(r.id),
        ),
        ranked = await rankReferences(
          currentCandidates,
          combined.aborted ? { ...op.input, retrieval: 'lexical' } : op.input,
          this.semantic,
          combined,
        );
      cancel.throwIfAborted();
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
        resultScope: input.operationId ? 'new-source-pages' : 'initial-source-pages',
        currentPageCandidates: currentCandidates.length,
        sources: op.pages.map(({ records, ...p }) => ({ ...p, returnedRecords: records.length })),
        partialCoverage: op.pages.some((p) => p.status !== 'available'),
        retainedCandidates: chosen.length,
        evictedCandidates: Math.max(0, all.length - chosen.length),
        hasMore: [...op.cursors.values()].some((v) => v !== '$done'),
        continuation: [...op.cursors.entries()]
          .filter(([, v]) => v !== '$done')
          .map(([stream]) => stream),
        meaning:
          'Only live source candidates or explicitly operator-supplied unverified references from this bounded operation. Continuation ranks current pages; previous retained references remain addressable by ID. No catalog, response payloads or site embeddings are written to disk.',
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
