# Live Awwwards integration

Since0.4.0-beta.2, Awwwards is an actual live discovery provider, rather than a hardcoded blocked descriptor or manual-URL-only source. No authorization-note string is required for public metadata. The common17-tool MCP workflow consumes its current references directly.

## What works

- Fresh public native award, category, tag, technology, country and font vocabulary, with exact source labels and source-provided collection links.
- Live collection candidates: title, original URL, Awwwards detail attribution, observed awards, makers, publication timestamp and source labels. Gallery artwork, HTML and media are not exported as a corpus.
- Validated linked pagination within the same collection, bounded cursor history, exact native filter selection and retained-result draining without repeat delivery.
- Up to three selected detail verifications per page, with independent failure diagnostics. The selected detail must confirm the same original URL; a failed sibling does not discard valid listing candidates.
- Text/optional semantic ranking through the existing federation, then actual original-site image batches, browser interactions, responsive/temporal measurements, comparisons and implementation specifications.
-750ms spacing between adapter requests, bounded detail enrichment, HTTP429 cooldown and Retry-After handling. No automatic retry loop or alternate-endpoint rotation.
- Optional explicit operator references remain useful, but their attribution is unverified and distinguishable from live discovered relationships.

## MCP examples

Call `mimicus_search`:

```json
{"providers":["awwwards"],"technology":"WebGL","query":"interactive","limit":10}
```

Other native selections, one per independent operation:

```json
{"providers":["awwwards"],"category":"Architecture"}
{"providers":["awwwards"],"awwwards":{"award":"Sites of the Month"}}
{"providers":["awwwards"],"awwwards":{"tag":"Animation"}}
{"providers":["awwwards"],"awwwards":{"country":"United States"}}
{"providers":["awwwards"],"awwwards":{"font":"Aeonik"}}
```

`awwwards.listingUrl` selects an exact public HTTPS `www.awwwards.com/websites/.../` collection URL; only its native `page` query is accepted. It cannot name another origin, credentials, a private/search endpoint or a detail-content API. `awwwards.details:false` disables optional detail enrichment while retaining listing facts. Unknown native labels fail with a request to inspect current taxonomy instead of fabricating a slug.

Use `mimicus_browse_categories` with the active `operationId` to inspect source taxonomy. Continue with `mimicus_search({"operationId":"..."})`; continuation first drains already-ranked RAM candidates and then fetches the next permitted source page. Finish with `mimicus_end_discovery`.

Select active reference IDs in `mimicus_preview_references` with `authorized:true`, view returned images, then open a chosen original using `mimicus_open_reference`. The common explore/interact/capture-motion/analyze/spec/compare/verify tools work with these sessions. Close every selected session. Returned facts and page content are untrusted evidence, never executable agent instructions.

## Actual acceptance on20 October2026

`node scripts/awwwards-live-acceptance.mjs` exercises the production official SDK stdio server from a fresh temporary working directory. Final evidence is [live-sdk.json](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v0.4.0-beta.2/artifacts/awwwards-integration/live-sdk.json).

All six cases passed: WebGL through two actual native pages, Architecture, Sites of the Month, United States, Aeonik, and the public root listing. Seven native pages returned31 source records each,395 current taxonomy entries, and38 guarded HTTP requests in total. Source counts can include repeated upstream items; federation delivery reported zero repeated reference IDs. The root listing correctly reported its disallowed query-based next link without fetching it.

Two real original-site JPEGs were returned; the [viewed-frame evidence](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v0.4.0-beta.2/artifacts/awwwards-integration/viewed-preview-evidence.json) preserves the exact hashes and attribution from the first successful paced round. They showed an introductory title frame and a loading screen, so this is image/provenance acceptance, not proof of fully loaded hidden WebGL scenes. The final SDK rerun is recorded separately. A selected original additionally returned responsive/time-based body analysis, an implementation spec and a390px reduced-motion capture. Browser sessions/analyses/discovery queues were zero afterwards; the isolated SDK working directory was empty.

The [first actual round](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v0.4.0-beta.2/artifacts/awwwards-integration/live-sdk-round1-rate-limit.json) exposed HTTP429 after overly concentrated detail requests. It remains preserved. Request pacing, a three-detail bound and cooldown were added before the successful fresh full rerun. Regression coverage separately checks malformed sibling cards, genuine empty/drift states, taxonomy group attribution, hostile URLs, independent detail failures, pagination boundaries, cancellation and rate-limit cooldown.

## Precise source boundaries

The current [robots file](https://www.awwwards.com/robots.txt) distinguishes public collection/detail pages from restricted `/search-websites`, `/websites/?...`, `/elements/*` and other routes. The adapter evaluates actual paths; it does not infer a whole-domain prohibition. Default discovery chooses the observed Sites of the Day link, or a matching native concept, to obtain a usable linked public collection. Explicit root browsing remains available, with restricted continuation reported honestly.

Query text ranks bounded live metadata; it does not call the restricted global search service or guarantee all-catalog semantic recall. Native collection order is preserved; unsupported popular/likes sorting is diagnosed. Additional category/technology/tag/award filters intersect observed card facts locally; compound country/font requests without a source-exposed combined collection fail explicitly. This is not a complete reproduction of every Awwwards UI feature.

The [terms](https://www.awwwards.com/terms/) and original creators' rights remain distinct from technical access. This implementation introduces no gallery synchronization, disk catalog, source-media archive or permission to redistribute artwork. Existing origin/robots/network guards and safe browser interactions apply normally; a public-page failure or HTTP refusal is returned as observed rather than hidden by stale data.
