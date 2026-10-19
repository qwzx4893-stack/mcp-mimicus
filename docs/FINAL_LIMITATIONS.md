# Final release limitations

Mimicus `0.3.0-beta.1` is a source beta for live reference discovery and selected visual analysis. The following boundaries are part of the product's actual behavior, not deferred claims of completion.

## Source coverage and permissions

- Seven adapters do not mean seven unrestricted catalog connections. Awwwards automated search, gallery details and source-owned media remain restricted without reviewed authorization. Operator-provided original URLs are a separately labeled handoff, not verified Awwwards search results. No special license is assumed.
- Six other sources returned actual live candidates in release acceptance. Public interfaces and upstream availability can change. Partial coverage and per-source failures are reported; no disk corpus silently replaces an unavailable source.
- Astro uses the complete current official title/URL index for lexical selection, then enriches bounded selected YAML records. It does not provide complete semantic/style recall across every entry, and the published index can lag repository metadata.
- Webflow uses source-provided full-text search and native feed/tag/sort interfaces, then resolves selected details. A listing's original URL is not proof that its destination is reachable. A full feed page indicates possible continuation, not a known platform total.
- mesh3d's public listing/detail traversal is bounded. Its robots-disallowed infinite-scroll API is not called, so this is not full-gallery pagination.
- Three.js Resources tool-directory categories and tags do not resolve opaque showcase tag IDs. Native labels can be sparse; absent classifications are not invented. Codrops repository homepages may lead to articles rather than runnable demos.
- Robots permission, public visibility, MIT adapter code and content reuse rights are distinct. Visiting a selected original site does not authorize copying its artwork, media, source code or gallery database.

## Browser fidelity and interaction

- Windows resolves the installed HTTPS default browser. A compatible installed Chromium executable is required; unsupported defaults fail explicitly. Other operating systems require `MIMICUS_BROWSER_EXECUTABLE`. Custom Chromium variants are subject to actual launch compatibility; stock installed Firefox is not supported by this controller. There is no browser download or silent fallback.
- Browser sessions are headless and isolated. They do not use personal cookies or login state. Sites can render differently, require authentication, show loaders, or refuse automation. Challenges and access restrictions are not bypassed.
- Browser readiness is a bounded observation. Fonts, lazy images, remote assets, scroll-triggered scenes and site-specific initialization may still be incomplete. Additional public resource origins require explicit approval; analytics are not automatically approved merely to remove a diagnostic.
- Safe interactions intentionally exclude forms, destructive controls, arbitrary script evaluation, downloads and unreviewed cross-origin navigation. Conservative heuristics can reject benign controls. The “Reset view” trial rejection led to a narrow final fix for exact non-form visual reset labels; account/form resets remain blocked by regression tests. Public page JavaScript is still untrusted and may have effects beyond its visible semantic label.
- Default sessions and discovery operations expire after five minutes, with a fifteen-minute hard ceiling. Long workflows must close/reopen or create fresh operations as appropriate; expired reference analyses cannot be fetched as persistent patterns.

## Measurement and verification

- CSS declarations, measured DOM behavior and inferred concepts remain separate evidence. A transition declaration does not prove movement. Zero DOM animation effects do not mean a WebGL scene is static.
- A motion filmstrip contains actual timestamped screenshots, including capture overhead. It is not exact author timing, recovered physics or a complete hidden interaction state machine. Selected scroll traversal is bounded, including a 20,000-CSS-pixel traversal budget.
- CSSOM can be inaccessible. Tiny scalar canvas probes cannot reconstruct scene geometry, shaders or artwork. Tainted or near-empty/compositor-dependent WebGL readback is unavailable or inconclusive; a constant readback is not proof that a visibly rendered scene is static. Actual images still need inspection.
- Verification compares selected measured properties at matching viewports. Intended original content, accessibility semantics, transition scope or positioning can produce a false tolerance verdict. Such differences must be reviewed against the brief, not hidden or relabeled as an aesthetic failure.
- Project-aware comparison produces independently written deterministic guidance grounded in bounded observations. It does not generate the implementation, infer author intent, select a universally best design, or score beauty.

## Model, persistence and evaluation scope

- Optional MiniLM reranks text from the current bounded candidate set, not screenshots. It cannot supply aesthetic judgment or recall a reference excluded before reranking. Missing model software produces explicit lexical fallback; installation/download is opt-in.
- The pinned q8 CPU model has a software cache and a reusable runtime. Site texts and vectors are not persisted. Releasing application references is not cryptographic erasure of process memory; the runtime can retain allocated memory until shutdown. Model loading had a material memory cost in the measured environment, not a portable memory guarantee.
- No website database, persistent catalog, disk fallback corpus or background indexing worker exists. Browser software may create isolated OS temporary files during a session. Graceful cleanup is exercised, but abrupt process/OS termination can leave temporary files; they are not reused as a site catalog.
- Release evidence includes actual SDK stdio transport, owned-page browser checks, live-source requests and two agent design workflows. It does not establish every named MCP client's compatibility, all operating systems, all browsers, real handheld behavior, assistive-technology acceptance or continuous upstream availability.
- Synthetic fixtures and benchmark queries are labeled as such. Two qualitative workflow trials and a small query sample do not establish statistical relevance, lower task cost or aesthetic superiority. The immersive trial did not obtain two fully accessible 3D scenes; it documented the gated alternative honestly.

See [workflow evaluation](VISUAL_WORKFLOW_EVALUATION.md), [browser diagnostics](DEFAULT_BROWSER_BACKEND.md), [source integration matrix](SOURCE_INTEGRATION_MATRIX.md), [configuration](CONFIGURATION.md), and [security](SECURITY.md) for evidence and operational detail. Historical evidence describes earlier runs; it is excluded from runtime retrieval and must not be mistaken for current acceptance.
