# Live sources, scope and acceptance

Six adapters retrieve current candidates through permitted public source interfaces. **Awwwards automated catalog integration remains BLOCKED**: the owner has no special content grant. The useful original-site handoff is not successful Awwwards catalog discovery. RAM processing, robots allowance and an upstream MIT software license do not create content rights.

After building, run `node scripts/source-hardening-acceptance.mjs`. It measures fresh production adapters, then uses the official MCP stdio SDK against `dist/cli.js serve` in a temporary working directory. `--measure-only` and `--sdk-only` run the phases separately. Reports export counts, timestamps, coverage, diagnostics and identity hashes only; no website record dump, HTML, media, embedding or catalog. Current upstream counts can change.

## Capability matrix

| Source | Current interface / scope | Native metadata and honest limit |
| --- | --- | --- |
| Awwwards | Manual public navigation; operator original-URL handoff with optional exact `/sites/` attribution; independent original-site browser | **BLOCKED catalog/details/taxonomy/media** without a reviewed scoped grant. Supplied relationship/title stay unverified. No invented awards, makers or source previews. |
| Codrops Creative Hub | Live `/codrops/hub/all/`, actual next links, published demo/repository URLs | Source tags, authors and dates when present; page coverage only. Attributed source preview links are not automatic image downloads or redistribution rights. |
| Codrops Webzibition | Live `/codrops/webzibition/` and native pagination | Actual original and separate source article. Empty native taxonomy/makers remain empty; malformed originals are rejected. |
| Codrops repositories | Official GitHub organization API, updated order, 30 public repository entries/page | Actual topics, language, repository, pushed timestamp and SPDX label. Homepage may be a tutorial/project rather than an interactive demo; website/art rights are separate from code license. |
| Astro | Complete official `/api/showcase.json` index in request RAM plus selected current-SHA YAML | Actual title/URL/slug, YAML description/labels if present, source revision. No native style/industry/mood taxonomy in index; no full-index semantic claim. |
| Made in Webflow | Public native feeds/tag IDs/popular/recent/likes; public text search and `feed/by-ids`; selected detail verification | Actual tags, makers, cloneable/template distinction and optional remote thumbnail links. Text search controls relevance; extra filters check returned native labels locally. Unknown feed total, bounded offsets. |
| Three.js Resources | Official MCP showcase text search/native offset; separate tool-directory taxonomy | Actual original/showcase identity, makers and opaque showcase tag IDs. No published showcase-specific ID resolver or tag filter; tool-directory names cannot replace IDs. |
| Nuxt | Fresh official complete showcase YAML and declared industry vocabulary | Six actual industry labels, Nuxt technology, ETag/content revision. Complete maintained collection is not every Nuxt website; YAML assets/executable capture options excluded. |
| mesh3d.gallery | Public listing, native filter links, detail links and exposed next links | Actual tags, technologies, makers and dates. **Partial public HTML coverage**: robots-disallowed infinite-scroll `/api/` is never called. |

## Awwwards policy and useful operator flow

Reviewed on 2026-10-19:

- [Official terms](https://www.awwwards.com/terms/) reserve content rights and require express authorization for commercial content use. Featured originals remain their creators' intellectual property. Technically observing an original is a separate operation with its own access constraints.
- [Current robots](https://www.awwwards.com/robots.txt) blocks `/feed`, `/search-websites`, `/websites/?`, `/elements/*` and other restricted paths. Robots is an access signal, not a content license. No restricted catalog route is probed.
- [Official FAQ](https://www.awwwards.com/faqs/) and the reviewed terms supplied no verified public catalog/API license or scoped Mimicus grant. This describes the reviewed avenues, not proof that a private commercial arrangement cannot exist.
- The robots-advertised [sitemap](https://www.awwwards.com/sitemap.xml) returned HTTP 404. No source records were extracted. Feeds/search/elements are not alternate loopholes.
- [INSANE0777/Awwwards-mcp at `1bc9c13557c8e8f6ea90e174d88eb1708696fca3`](https://github.com/INSANE0777/Awwwards-mcp/tree/1bc9c13557c8e8f6ea90e174d88eb1708696fca3) was reviewed: current client, parsers and visual/inspiration workflow. Its MIT license covers software. Its SQLite catalog, media cache, preferences and watches are excluded. The retained parser adaptation remains attributed to `9bc82857894007da4b27e806cecfde8befe68a81`; no new upstream code was copied this pass.

| Capability | Status and behavior |
| --- | --- |
| Catalog search/details/categories/awards/makers/elements | **BLOCKED.** Zero automated gallery/media requests. Even a truthy `sourceAuthorizations.awwwards` string cannot enable access: the release has no reviewed-grant verification mechanism. |
| Gallery screenshots/videos/inline remote previews | **BLOCKED.** No special media grant; no automatic source-owned image download or mirror. |
| Manual public navigation | Available as attributed public gallery and terms links; no connected gallery-search claim. |
| Known original handoff | Available as `originalReferences: [{"url":"https://original.example/"}]`, maximum eight. Optional `title` and exact HTTPS `www.awwwards.com/sites/...` `listingUrl`; default title is hostname. Missing source link is explicit `noAwwwardsListing:true`; original URL supplies the reference identity field. Always `relationshipVerified:false`. |
| Independent original-site visual workflow | Available after `authorized:true`, subject to public-IP/robots/resource/browser guards. Actual screenshot, targeted observations, motion and comparison do not establish Awwwards awards or gallery membership. |

Workflow: manually choose an original → supply just its original URL and optional known attribution → receive a clearly operator-supplied reference → open it in an isolated browser → inspect actual images/interactions → compare observations → implement independently → close session and operation. No title or gallery metadata must be fabricated. No source owner was contacted on the user's behalf.

## Concrete source hardening

- **Astro:** query plus brief facets participate in lexical priority. Each bounded page reserves half the candidates for source-order exploration. The deterministic full ordering includes every index item once, so sparse titles cannot exclude an original from every future page. Only selected revision-pinned YAML is fetched; an actual description is retained when present. Missing native labels stay missing; index/repository deployment mismatch remains explicit.
- **Webflow:** plain text/feed queries omit redundant landing HTML. The landing page is fetched when a requested filter needs its current real tag vocabulary. Every original still comes from the selected detail's “Open live site” link; opaque summary IDs are not guessed into domains. Detail concurrency is bounded at three. No cross-operation cache or extra background retrieval was introduced.
- A real first SDK round found that one Webflow detail deadline discarded successful sibling details. Detail failures now remain isolated and diagnostic; good current records survive. Explicit operation cancellation still propagates. If every selected detail fails, source status is unavailable. The observed failed round is preserved in `source-hardening-round1-defect.json` rather than counted as a pass.
- **Codrops:** relative demo links resolve against the real source page; malformed/credential-bearing cards are excluded independently. Demo/original/article roles remain distinct. Actual dated Codrops tutorial homepages are identified as tutorials instead of interactive demos. Synthetic `Open-source demos` was removed from native categories; source topics and individual license labels remain separate facts.
- **Three.js Resources:** separate directory taxonomy and showcase search run concurrently through the official client. Actual `tools/list` exposed 15 tools; showcase search accepts query, `built_with_ai`, limit and offset. No showcase-specific taxonomy resolver/tag filter was present. IDs stay opaque with a diagnostic.
- **Nuxt:** the declared industry vocabulary survives even if a category currently has no website; complete current YAML is read for each independent operation. Missing ETag falls back to content-hash revision.
- **mesh3d:** actual listing filter links are used directly when exposed, avoiding an unnecessary first detail lookup. Detail inspection discovers a requested filter only when needed. Pagination path boundaries reject lookalike `/websites-evil` routes. No private API or invented continuation is introduced.

## Interface provenance and freshness

[Webflow robots](https://webflow.com/robots.txt) permits `/api/v1/marketplace/made-in-webflow/` within broader API restrictions. The shipped public client supplies feeds, `feed/by-ids`, the Swiftype endpoint and public Engine Key. [Swiftype overview](https://swiftype.com/documentation/site-search/overview) and [search reference](https://swiftype.com/documentation/site-search/searching) document client search identifiers; this is not a private account credential. Actual robots are checked before transport requests; no clone, like, account or admin API is used. A documentation-fetch tool hit a transient header-size limit on Webflow robots; production guarded live acceptance establishes the executable path independently.

[Three's official MCP page](https://threejsresources.com/mcp) supplies the read-only interface. MCP handshake/tool requests are outside the guarded metadata HTTP counter: zero metadata requests for this adapter does not mean zero network traffic. [mesh robots](https://mesh3d.gallery/robots.txt) disallows `/api/`, `/admin/`, `/auth/`, `/profile/`; only exposed public HTML/filter/detail links are followed.

Independent operations issue fresh requests. Coalescing is RAM-only within the current scope. Continuation retains query/native sort and reports per-source `next`, `hasMore`, current coverage and bounded retention. Source order can change between calls; this is not upstream snapshot isolation. A repeated identity hash means unchanged observed results, not an invented update.

Canonical originals merge relationships while retaining source listing provenance, labels and makers. `available` for Nuxt means the current maintained YAML collection; `partial` marks paged/incomplete sources. Actual original availability is established only when opened. Native metadata, semantic similarity and independent guidance remain separate.

## Evidence interpretation

`artifacts/product-hardening/source-baseline.json` contains three observed pre-edit calls per permitted provider. The hardening report records matching post-edit calls plus actual SDK multi-page/native-filter acceptance, independent Nuxt freshness, all three separate Codrops streams, Awwwards bare-note rejection and URL-only actual original image handoff. Only counts, coverage and hashes are exported.

A passing restriction test proves a guard, **not** successful gallery integration. SDK working directory cleanliness and image hashes do not create a media mirror. Unit fixtures separately verify unverified authorization rejection, URL-only attribution, sparse-label progressive coverage, actual YAML descriptions, bounded detail concurrency, malformed links, tutorial roles, declared empty industry classes and strict native filter paths.

### Observed 2026-10-19 timings and repair result

Three fresh calls per phase/provider; milliseconds. Nearest-rank p95 with n=3 is only the observed maximum, not a population tail estimate. Network conditions, upstream caches and first-connection setup can dominate. The comparable direct-adapter queries are in `source-baseline.json`; complete observed post-edit metrics are retained in `source-hardening-acceptance.json` even though its first SDK round found the repaired defect.

| Provider | Before p50 / p95 | After p50 / p95 | Guarded metadata requests, before → after |
| --- | --- | --- | --- |
| Webflow coffee, three originals | 5442 / 7064 | 3767 / 6244 | 8 → 7 |
| Astro coffee, three selected YAMLs | 408 / 1872 | 786 / 1958 | 6 → 6 |
| Nuxt whole current 58-entry collection | 124 / 384 | 174 / 411 | 1 → 1 |
| Codrops Creative Hub current 44 cards | 471 / 1273 | 561 / 1608 | 2 → 2 |
| mesh public listing, three details | 983 / 2033 | 1275 / 2112 | 5 → 5 |
| Three official MCP, three originals | 3187 / 3728 | 1464 / 4482 | Separate MCP traffic, excluded from counter |

This pass removes one concrete redundant Webflow roundtrip; it does not claim a uniform source speedup. Three's concurrent calls reduced observed median but its maximum increased; the sample is too small for stronger claims. Astro/Codrops/Nuxt/mesh observations are slower in this sample and are reported unchanged.

Final fresh SDK repair round: **12/12 scripted cases passed their declared assertions** in `source-sdk-acceptance.json`. Ten permitted-source cases cover real progressive pages, native Webflow Animation/recent and mesh Three.js filters, all three Codrops streams and independent Nuxt reads. The two Awwwards cases prove only restriction correctness and operator handoff: bare notes still issue zero gallery requests; URL-only `https://threejs.org/` independently opened into an actual isolated session and returned one real MCP image block, then closed. It is explicitly not claimed to be Awwwards-discovered or an award winner. The isolated SDK working directory contained zero files after shutdown. Automated Awwwards catalog status remains **BLOCKED**, regardless of these passing guard assertions.
