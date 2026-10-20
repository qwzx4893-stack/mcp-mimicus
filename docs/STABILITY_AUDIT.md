# 1.0.0 stability audit

The stable contract is a bounded stdio MCP design browser on Node.js 24+, with live RAM-only discovery, selected original-site images, measured interactions and original implementation guidance. Windows-default Brave and explicitly configured installed Edge receive full browser integration coverage. Linux CI covers browser-free behavior. Other compatible browser/host combinations require explicit configuration and remain outside this verified support set.

All seven source adapters and all 17 MCP tools remain available, including Awwwards public native collections, taxonomy and source-linked pagination. Source refusals, changed markup, missing resources, partial rendering and bounded recall remain visible outcomes. No npm publication, persisted website corpus or automatic browser download is introduced.

## Independently exercised review tooling

Opengrep 1.31.0 was downloaded from its official release and checksum-verified as the primary static review tool. OSV-Scanner 2.7.0 checked the exact dependency lock. StrykerJS 10.0.0 instrumented the actual compiled runtime in disposable copies. Pinned open-source Trail of Bits generic/JavaScript rules supplied a separate static pass. Tools and rule repositories remain private ignored installations, with no new runtime dependency. Versions, licenses, hashes and commands are in the repository's [review-tool instructions](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v1.0.0/quality/README.md).

These are complementary checks, not an independent human certification. Local project rules are review leads; each finding requires behavioral verification. The audit also inspected failure paths and used fault injection, real installed browsers, official SDK transport and actual public source responses.

## Confirmed defects and corrections

| Reproduced behavior | Correction and verification |
| --- | --- |
| Encoded destructive paths and some query actions passed navigation review | Decode bounded URI layers before review, reject malformed/over-deep encodings, cover signout/checkout query actions, retain benign lookalike parameters and content paths |
| Robots rules could borrow another product's group; raw and encoded paths differed | Select/merge exact product groups, retain empty-rule group boundaries, compare URI octets, preserve reserved escaped separators, and use bounded literal/wildcard matching with allow winning ties |
| Canonicalization merged `/work` and `/work/` | Preserve the meaningful terminal slash while removing tracking and sorting functional query parameters |
| Detached maintenance could reject without observation; concurrent teardown could return before the owner finished | Retain a bounded maintenance-error diagnostic, join the same owned session cleanup, wait for independent owners and attempt every cleanup step before reporting aggregate failure |
| Queued inference cancellation waited for active inference | Return the cancelled caller promptly; retain its bounded queue slot until its predecessor ends so later inference cannot overlap or cancellation storms grow the queue |
| Concurrent model/application close could dispose twice or leave one owner unobserved | Join one closing promise and wait for all owned cleanup outcomes |
| Bounded work treated `0`, `false`, `null` or `undefined` exceptions as success | Track failure independently from its value, propagate the original rejection and stop admitting new siblings |

The original focused tests failed before their corresponding corrections. The proxy stream shutdown check passed existing behavior and is retained as a safeguard; it is not claimed as a new defect fix. Failed launch/open, cancellation, expired session and independent cleanup paths remain covered.

## Tool results and finding disposition

The final local Opengrep pass scanned 36 TypeScript runtime files with seven project rules: no scan errors and four retained cleanup-review warnings. The pinned upstream rules scanned 37 targets with no findings or errors. OSV scanned all 140 lockfile package entries and reported no known vulnerabilities at the time of the check. These results do not establish absence of vulnerabilities or future advisories.

The four retained warnings are deliberate best-effort cleanup points: pointer release after drag; aborting an already-failed/intercepted route; closing a partially opened browser before independent proxy/home cleanup; and closing a session after its initial screenshot failed. The original operation still reports failure, and the owning session/open path performs teardown. Real-browser failure and cleanup tests exercise those owners. Warnings remain visible; no rule was disabled to produce a clean result.

The final focused mutation run generated 256 mutations across navigation review, robots matching and URL/label/bounded-work utilities: 212 killed by assertions, 12 timed out and 32 survived, with no runtime-error classifications. The conventional detected score is **87.5%**; assertion kills alone are **82.8%**. Timeouts are reported separately because they demonstrate bounded detection of mutated hangs, not an assertion verdict. This is selected-scope strength, not whole-project coverage.

Survivors include diagnostic wording, redundant anchors on fixed-width/single-character values, fast paths that change work without changing these outputs, equivalent array preallocation, and unexercised robots corner cases. They remain disclosed and are not all declared equivalent or harmless. An attempted TAP runner incorrectly classified test failures as runtime errors; it was replaced with an exit-code command runner before measurement. An earlier baseline's code and mutation scope differ, so its percentage is not used as a directly comparable product improvement claim.

## Verification and distribution evidence

The frozen 1.0.0 build passed lint, typecheck and the complete suite on both installed browsers: **94/94 on Brave and 94/94 on Edge**, with no skipped or cancelled tests. Hosted candidate verification separately passed **67/67 Linux core tests and 94/94 Windows Edge tests**. The final release's external CI asset identifies its exact source commit.

Actual cached pinned MiniLM software also passed integrity verification for four model artifacts and produced four finite, normalized 384-dimensional vectors. Queued cancellation returned promptly and concurrent close left zero pending work. The [native model report](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v1.0.0/artifacts/stability/native-model.json) records those facts without storing input texts or vectors.

An initial sustained-run harness completed its browser exercise and application cleanup, then asserted a nonexistent counter name. The [preserved harness defect](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v1.0.0/artifacts/stability/harness-defect.json) records the actual zero counters and the corrected assertion. That failed harness result is not counted as acceptance; the corrected versioned run is reported separately.

The corrected production 1.0.0 SDK run passed after **21 minutes and 1 second**, exercising all 17 tools and fresh queries to all seven sources. Its sustained owned-example session completed 29 cycles; the overall workflow returned 67 actual JPEG blocks. Final active/closing/opening sessions, temporary analyses, discovery operations, references and pending candidate queues were all zero, with no maintenance errors. Those owned-example images establish sustained execution, not artistic quality; installed-package original-site preview evidence is attached separately to the release.

The release assets identify the exact source commit, hosted Linux/Windows CI, fresh public-checkout build, actual packed installation, archive checksum and installed runtime digest. The source-level [stability metrics](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v1.0.0/artifacts/stability/static-and-mutation.json) record the reproducible tool results. The [live SDK report](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v1.0.0/artifacts/stability/live-sdk.json) separates live source metrics from the sustained owned-example browser exercise. Consult the matching release assets for final archive acceptance rather than treating an earlier report as verification of a later archive.

The bounded queue regression uses a controlled extractor to reproduce scheduling and cancellation, while fresh installation separately verifies actual missing-model lexical fallback. A currently executing native inference microbatch remains non-preemptible. Graceful shutdown waits for owned work; OS termination can still interrupt cleanup. The stable release does not establish human aesthetic superiority, every MCP host, assistive technology, real handheld behavior or uninterrupted external source access. See [limitations](FINAL_LIMITATIONS.md) and [installation](INSTALLATION_AND_RELEASE.md).
