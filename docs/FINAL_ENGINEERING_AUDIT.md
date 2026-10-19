# Final engineering audit

Release candidate: **0.3.0-beta.1**, 2026-10-19. This is a source beta, not an npm publication or a claim of universal website access.

## Architecture and review

The inspected baseline was reproduced before changing the release implementation. Discovery consults current public source interfaces, retains bounded candidates/cursors in RAM, and releases them on end, cancellation, TTL or shutdown. There is no SQL store, saved website JSON, background crawler, persistent candidate-vector index or bundled gallery. Explicit test reports contain metrics and independently authored implementations, not captured third-party media. Model files are optional integrity-checked software cache.

The retained 16-tool MCP surface provides live search, native categories, source diagnostics, selected reference details, operation disposal, owned browser sessions, actual images, progressive page regions, safe interactions, filmstrips, selected analysis/specification/verification and multi-reference comparison. Comparison can accept a project brief; observed facts and independently authored advice remain separate. It does not assign aesthetic quality scores.

Independent focused review found four concrete lifecycle defects: first-capture failure could orphan a session; semantic ranking could exceed the metadata deadline; cancellation during ranking could advance a continuation cursor without delivering its page; setup failure before session registration could bypass resource cleanup. All four have focused regressions, and the final complete suite passed 41/41 on Windows-default Brave and 41/41 on explicitly selected installed Edge. Native ONNX inference already executing cannot be preempted: the response falls back at its deadline, signals cancellation and discards late results, while the bounded native queue finishes during shutdown. Output explicitly reports this limitation.

Additional observed fixes include genuine Webflow query routing, progressive results showing newly retrieved candidates, preserving omitted continuation parameters over MCP, normalizing empty provider tags, separating ordinary artistic prose from real access challenges, classifying empty GPU readback as inconclusive, and permitting narrowly named non-form visual reset controls.

## Evidence and measured limits

- [Source integration matrix](SOURCE_INTEGRATION_MATRIX.md) and [15 production stdio source cases](../artifacts/final-release/source-acceptance.json): no adapter injection; six automatic sources plus explicit Awwwards restriction/manual-original handoff. All expected-path assertions passed. A restricted path passing its restriction test is not a catalog-access success.
- [Browser backend](DEFAULT_BROWSER_BACKEND.md): actual Windows HTTPS default Brave, independently launched headlessly with ephemeral profile, GPU rendering retained, process/profile cleanup and restart isolation checked. Other Chromium binaries require their own runtime validation.
- [Design workflow evaluation](VISUAL_WORKFLOW_EVALUATION.md): two new independently implemented tasks, coffee commerce and immersive WebGL2, with multiple actual references, desktop/mobile interaction QA and honest failed/blocked reference observations. This establishes workflow utility, not statistically proven design superiority.
- [Performance](../artifacts/final-release/performance.json): 14 heterogeneous accessible-source cases, empirical p50 1,576 ms and p95 12,138 ms. Three owned default-browser launch/navigation samples p50 1,950 ms and p95 2,343 ms; capture 51/60 ms; cleanup 195/345 ms. With three samples p95 is the maximum, not a production latency guarantee.
- [Semantic measurement](../artifacts/final-release/semantic-live.json): 58 actual Nuxt candidates, four queries in three modes; pinned model verified across four files. First hybrid call including initialization 1,055 ms, subsequent semantic/hybrid calls 75–84 ms in this run. Process RSS increased about 195 MiB; this includes model/runtime and is not aggregate browser peak memory.
- [Quality/security results](QUALITY_AND_SECURITY_TEST_RESULTS.md): baseline, adversarial/integration and real design-agent rounds; final local and hosted CI outcomes are distinguished.

## Release acceptance matrix

PASS means the scoped observed behavior passed. PARTIAL means a material external or scope limitation remains. BLOCKED means the requested capability cannot currently run. Awwwards catalog access remains blocked without the authorization the user explicitly says they do not hold.

| # | Gate | Status | Evidence / scope |
|---|---|---|---|
| 1 | Inspected code and reproduced baseline | PASS | Baseline and final regression records; focused independent review |
| 2 | Preserved working capabilities, removed obsolete code | PASS | 16 tools retained; old database architecture absent; duplicated unused helper removed |
| 3 | No permanent website database/snapshots/vector index | PASS | Architecture and two-process restart/isolated-home regressions |
| 4 | Fresh federation, RAM dedup and native taxonomy | PASS | Production SDK acceptance; independent fresh searches and continuation tests |
| 5 | Seven adapters and all three Codrops streams tested | PASS | 15 source cases; Awwwards restriction is explicitly tested |
| 6 | Best permitted Awwwards capabilities and restrictions | PARTIAL | Original-site handoff works; automatic catalog unavailable without permission |
| 7 | Broader source discovery and pagination | PASS | Source matrix and progressive/native query cases; bounded scope, no completeness claim |
| 8 | Windows default resolution including installed Brave | PASS | Actual HTTPS association and executable verified |
| 9 | Actual default binary in owned headless isolation | PASS | Brave process identity, GPU, isolated profiles and cleanup |
| 10 | Normal setup requires no bundled browser download | PASS | Installed executable backend; setup/CI contain no browser-install step |
| 11 | Actual interactive/animated references and real images | PASS | Coffee and immersive trial reports including GPU WebGL2 |
| 12 | MCP images, filmstrips, sections, navigation, responsive states | PASS | Actual SDK integration and trial QA |
| 13 | Selected analysis only, no mass-analysis side effects | PASS | Discovery/target-scoping regressions |
| 14 | Transient MiniLM semantic ranking | PASS | Four verified model files, 58 live candidates; no website vectors on disk |
| 15 | Coherent evidence-backed comparison and project brief | PASS | Structured comparison regression and both trials |
| 16 | Multiple real implementation/design QA tasks | PASS | Two new independent agent workflows; no superiority claim |
| 17 | Security, cleanup and failure isolation | PASS | Four independently found defects fixed; complete 41/41 suites on Brave and Edge |
| 18 | Representative measured performance | PASS | Live metadata + actual default browser metrics, sample limits stated |
| 19 | Reproducible CI and documentation | PASS | Linux core and Windows installed-Edge jobs passed in hosted run 39275362601 |
| 20 | Original banner and truthful README badges | PASS | Editable original SVG, rendered review; no fake publication badge |
| 21 | Correct public repository, scoped commits and staged pushes | PASS | Correct public owner; parentless sanitized history, substantive scoped commits and ordered pushes verified |
| 22 | Link, SHA, evidence, limitations and release status | PASS | Public repository and source-beta tag identify the exact release commit; runtime CI, tests and limitations linked below |

## Public verification

[Repository](https://github.com/qwzx4893-stack/mcp-mimicus), [source-beta release](https://github.com/qwzx4893-stack/mcp-mimicus/releases/tag/v0.3.0-beta.1), and [successful hosted runtime verification](https://github.com/qwzx4893-stack/mcp-mimicus/actions/runs/39275362601). Both Linux and Windows jobs passed on runtime commit `6faa327f461340908534f4329ef40082ebd753f2`. The subsequent release evidence commit changes documentation and audit metadata; the release tag resolves its exact SHA. This is **21 PASS, 1 PARTIAL** across the scoped gates. Gate 6 retains the actual Awwwards restriction; automated catalog access itself is BLOCKED without authorization.

## Publication hygiene

The public history is constructed from an explicit source-file allowlist, preserving private development history locally. Raw attached directives, historical website exports, model weights, source screenshots, credentials and personal browser profiles are excluded. This is a transparent initial source import followed by actual scoped feature and release commits; it does not reconstruct fictional earlier dates or authors. Public package files use an explicit documentation allowlist. Runtime dependency notices and selective MIT adaptations are recorded in [third-party notices](../THIRD_PARTY_NOTICES.md).
