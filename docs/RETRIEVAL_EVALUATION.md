# Retrieval evaluation

Mimicus ranks live source metadata in temporary RAM. It does not infer the
appearance or artistic quality of a website from its embedding. The results
below test metadata relevance and candidate admission; visual selection still
requires actual previews and original-site inspection.

## Reproduced defect

The beta.2 federation selected at most 80 references before ranking. Selection
favored lexical matches, and ranking applied a second lexical shortlist before
MiniLM. A relevant record discarded at either boundary could never receive a
semantic score. Continuation also shared that small retained-address budget.

The new pipeline is:

1. Fetch one bounded, source-native page per selected adapter. No automatic
   multi-round crawl runs in the background.
2. Canonicalize and merge current records with retained operation references.
3. Apply exact, case-insensitive native-label filters for `category`,
   `technology` and `industry`. `style`, `mood`, `purpose`, `interaction` and
   `navigation` remain soft concepts. Missing native labels do not become
   invented classifications, and `art` no longer matches `Cartography`.
4. Score all current eligible metadata lexically. Build the bounded semantic
   window from positive lexical matches plus source-order exploration across
   providers. Breadth-first subdivision explores beyond another source prefix.
   Source diversity admits candidates to inference; it guarantees no final
   ranking position.
5. Rank before retention. Keep separate bounded queues for not-yet-embedded
   candidates and scored-but-undelivered results. Explicit `operationId`
   continuation considers unscored candidates first, merging compatible scores
   with retained ranked results. Remaining scored results reuse their scores
   with zero inference. Both queues drain before another source page is fetched.
   Already delivered results do not replay. Lexical/offline fallback considers
   all current eligible metadata. A ranking-mode change is explicit, and scores
   from different modes are grouped rather than compared as interchangeable.
6. Keep pending work and current results, then recently delivered addresses.
   Return exact evicted IDs when
   the declared RAM cap is reached; never promise an expired address works.

A separate ID-only ledger prevents a later native page from replaying a
delivered original URL even after its address payload was evicted. It is bounded
to 2,400 IDs per operation in RAM. Reaching the cap is explicit, and further
continuation closes the operation with a fresh-search instruction rather than
silently forgetting previous deliveries. It stores no vectors or site bodies.

The default semantic window is 160, adjustable with `candidateWindow` from 10
to 200. `retentionLimit` ranges from 10 to 600, defaults to at least 320, and
must cover the requested result limit. Returned results remain capped at 30.
The operation TTL and request/network budgets still apply. The model runs
sequential native microbatches of at most 16 texts. Cancellation can stop
between microbatches; an already running native batch remains non-preemptible.
Texts and vectors are never persisted or cached between searches.

`pipeline` reports eligible, lexical-match, semantic-pool and deferred counts
and timing. `retrievalStages` reports fetched records, canonical references,
retained/delivered addresses, pending candidates and retention budget. Results
state their admission reason separately from computed similarity. `hasMore`
includes retained ranked results, semantic work and source pagination. A RAM
result page is explicitly labeled `retained-ranked-candidates`; it must not be
misreported as an additional native source page.

## Frozen evaluation and label provenance

Run `npm run build`, then `node scripts/retrieval-evaluation.mjs`. `--describe`
prints every synthetic source record and judgment for independent inspection.
The final report is `artifacts/product-hardening/retrieval-evaluation.json`.
The script reconstructs the beta.2 selection/ranking algorithm on the same
records and uses the same pinned local MiniLM implementation for all variants.

The fixture has 180 independently inspectable synthetic records attributed to
six provider types, ten intents, 30 deliberately keyword-heavy infrastructure
monitoring negatives and 120 neutral records. Intents cover coffee, agency,
WebGL, product storytelling, editorial typography, SaaS, architecture,
navigation, pointer interaction and sparse Arabic/English metadata. These
provider identities test balancing; they do **not** prove live connectivity.

The implementation agent authored the records and initial labels. The root
agent independently reviewed the labels before the final run, accepted the
explicit monitoring negatives as grade 0, kept sparse broad labels at grade 1
and corrected overlapping coffee/Arabic records from false negatives to grades
1–2. Literal relevant records have grade 3; useful paraphrases generally grade
2. There are three positives per intent, or six for the overlapping coffee and
multilingual cases. These are **agent judgments about metadata**, not human
labels, blind aesthetic judgments or a statistical sample of the web.

Recall counts grade >0. MRR uses the first such result. nDCG uses
`(2^grade-1)/log2(rank+1)` and the ideal graded order. Diversity counts provider
identities in the first ten results. Empty rate counts zero-result responses.
Per-case relevant IDs admitted or discarded before inference are recorded, so
the cutoff can be distinguished from a low semantic rank.

## Measured outcomes

Measured on 2026-10-19, Node 24.19.0, CPU MiniLM q8 with two threads. The four
pinned model artifacts passed integrity verification. The frozen fixture SHA256
is `e4d0a2406fecc2b96610f825cd0f15e67bc46a20724b7af45f86028c29104cb5`.

| Variant | Recall@5 | Recall@10 | MRR@10 | nDCG@10 | Mean ms | p50 / p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| beta.2 selection, window 80 | 0.5667 | 0.7333 | 1.0000 | 0.7930 | 1,435.3 | 1,578 / 1,728 |
| Revised, matched window 80 | 0.5667 | 0.7333 | 1.0000 | 0.7917 | 1,469.3 | 1,574 / 1,726 |
| Revised default, window 160 | 0.5667 | 0.8333 | 1.0000 | 0.8259 | 2,956.3 | 2,984 / 3,639 |
| Revised lexical only | 0.5667 | 0.6667 | 0.3917 | 0.4435 | 2.1 | 2 / 3 |

All variants returned nonempty results for all ten intents. Mean provider count
in the first ten was 5.8, 5.9, 5.8 and 5.8 respectively. This is synthetic
provider diversity, not actual endpoint coverage. The default window improved
mean Recall@10 by ten percentage points and nDCG on this fixture, at roughly
twice the measured warm ranking cost. Recall@5 and MRR did not improve. At the
matched 80-candidate budget, aggregate recall held steady and nDCG fell slightly;
the architecture case improved while the navigation case regressed. There is no
claim of universal relevance improvement or improvement without added cost.

Stage evidence is concrete: `webgl-positive-1` and
`architecture-positive-1` were discarded before baseline inference, admitted by
the revised 160 window and returned in its first ten. The 80 window still
excluded the WebGL paraphrase and also excluded `navigation-positive-1`, which
the baseline admitted. Deferred windows preserve an opportunity to score those
retained candidates; they cannot recover metadata the upstream never provides.

The model loaded in 1,121 ms. RSS was 212,164,608 bytes immediately after model
initialization and 347,025,408 bytes after all forty variant measurements. This
is a process observation, not a peak or per-variant allocation measurement.
The lexical variant considered all 180 eligible records but emitted ten; it
did not embed a global collection or produce an unbounded response.

Earlier exploratory output is preserved as
`retrieval-evaluation-round1.json`; it uses the initial, unadjudicated labels
and must not be compared numerically with the final graded set.

The first run exposed a second defect in the new selector: zero-match lexical
ties filled the lexical quota and unnecessarily consumed exploration capacity.
The fix reserves that quota for actual positive lexical matches. The final
fixture and queries were then frozen. No held-out relevance improvement is
claimed.

Independent review also found a delivery defect after the first implementation:
eight scored records with `limit:2` returned two and stranded the remaining six.
The fix adds the separate ranked delivery queue described above. A subsequent
100-item-cap regression exposed old delivered addresses crowding new ranked
results out before delivery. Pending work now precedes old deliveries, and old
address eviction is explicit. Both failures were repaired with new regressions;
the first-window comparative metrics above are unchanged by these lifecycle
fixes.

## Regression evidence

`test/hardening-retrieval.test.mjs` exercises:

- A 125-record adversarial page whose sparse late coffee reference has no
  query words. Explicit 20-candidate inference windows eventually admit it;
  finished upstream pages are fetched once, delivered sets do not repeat and
  every returned address resolves. The controlled vector function tests
  admission and lifecycle, not MiniLM quality.
- Eight complete source records with `limit:2`, separately in lexical and
  hybrid modes: all eight arrive exactly once, using one source fetch and at
  most one embedding call. Later result pages reuse ranked metadata.
- Four 40-record pages retained in bounded RAM, crossing the previous 80-item
  ceiling and delivering all 160 once while validating every address until its
  explicitly reported eviction under a 100-item cap.
- Exact native labels, Arabic lexical matching, free-form soft concepts and
  lexical consideration of a relevant record beyond the embedding-window cap.
- A deliberately tiny retention budget, explicit invalidated addresses and
  rejection of a budget too small to retain all returned results.
- A 100-text inference request cancelled during the second 16-text native
  microbatch: no further microbatch runs and the bounded queue is released.
- A restricted provider is labeled blocked while independently completed source
  results remain usable. Handling a restriction is not catalog connectivity.
- A repeated original URL after address eviction is not delivered again; the
  separate ID ledger stops before another source fetch once its 2,400-ID cap is
  reached. These last two deep-pagination tests require the final rebuilt
  runtime; the root's frozen short-workflow snapshot predates that ledger patch.

Existing deadline and cancellation regressions also pass: a discovery deadline
returns an explicit lexical fallback while native work completes asynchronously;
client cancellation closes an already advanced operation instead of silently
skipping a source page. Missing offline model software remains an explicit
lexical fallback and creates no model or website cache.

## Live production MCP verification

`node scripts/retrieval-evaluation.mjs --live` exercised three real source-query
cases through the official SDK and production stdio CLI, without injected
adapters or original-site browser visits. `retrieval-live.json` records counts,
source coverage and identity hashes, not catalog records or embeddings.

On the frozen 0.4 workstream snapshot, all three cases and five result windows
passed: Nuxt coffee used 20 then 20 local MiniLM candidate embeddings; six-source
WebGL used 20 then 20; native Retail & Food filtering used lexical ranking and
zero embeddings. Deferred windows used zero metadata HTTP requests, while the
initial Nuxt and cross-source windows used 1 and 25 guarded HTTP requests
respectively. The cross-source case explicitly reported partial coverage.
Thirty-one returned addresses resolved and no delivered IDs repeated. The
isolated working directory remained empty; final operations, references,
queues, sessions and inference pending counts were all zero. Search did not
launch a browser. This proves scoped transport/ranking integration, not judged
live-search relevance or universal source coverage. The final deep ID-ledger
patch requires a rebuilt-runtime recheck before release.

## Practical limits

An unobserved image cannot be recovered from sparse text. The English-oriented
MiniLM model is not a multilingual visual model; Arabic-only metadata remains
a difficult case. Keyword-heavy misleading titles still compete with real
content, and broad native labels are weak evidence. The same-budget selector
can exchange one relevant candidate for another; explicit continuation is
available rather than claiming every first window contains every useful site.

Higher candidate windows have measurable CPU and memory costs. The benchmark
uses one observation per intent/variant, warm shared model software, fixed
variant order and a shared workstation. Its p95 is a ten-sample order statistic,
not a provider SLA or a latency confidence interval. RSS includes ONNX software
and allocator high-water marks; it is not retained catalog size or isolated
per-variant peak memory. Synthetic fixture records saved for evaluation are
separate from production's RAM-only federation.
