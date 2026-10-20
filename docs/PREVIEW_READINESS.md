# 1.1.0 preview readiness and intensive verification

Mimicus now lets an agent wait briefly for observed loading indicators before taking the final frame, and distinguishes deadlines, access refusals, origin approval and resource capacity in structured preview diagnostics. All 17 tools and seven source adapters remain available. Network/origin rules, consent controls and source access restrictions remain enforced.

## Agent workflow

`mimicus_preview_references` accepts the existing explicitly authorized selected references and these optional bounded controls:

| Field | Default | Allowed range |
| --- | --- | --- |
| `waitForReadyMs` | 1500 | 0–5000 milliseconds |
| `perReferenceTimeoutMs` | 10000 | 1000–20000 milliseconds |
| `budgetMs` | 45000 | 1000–60000 milliseconds for the batch |

`mimicus_capture_view` also accepts `waitForReadyMs`, default0, maximum5000. Zero disables additional visual polling; existing bounded font preparation, screenshot work and cleanup can still take time. The per-reference and batch deadlines are soft admission/abort budgets. Installed-browser startup and owned cleanup can add time; they are not hard real-time kill guarantees. Image counts, viewport bounds and the batch image-byte limit remain enforced.

For example, a client may select two known original references, allow up to3000ms of visual readiness observation, set a20000ms per-reference budget and a45000ms batch budget. This gives a transient loader time to disappear without accepting an unlimited wait.

The readiness observation checks visible loading indicators, pending visible images and fonts. It stops waiting on observed consent/password controls and does not dismiss them. It never uses network-idle as a rendering verdict. `readiness.readinessWait` reports requested/observed time, sample count and one of `ready-observed`, `budget-exhausted`, `gate-observed` or `not-requested`. This is bounded DOM evidence observed just before the screenshot, not proof of a complete WebGL scene, hidden content, image semantics or artistic quality. Dynamic page state can still change between observation and capture.

An access challenge appearing after open and during readiness waiting is checked again before capture. A refused preview returns no frame for that reference. Partial frames still retain actual images, attribution and ordered `imageIndex` values.

## Actionable failures and cleanup

Preview failures include `failureCode`, `stage`, `reason` and `nextAction`. Codes distinguish `origin-approval-required`, `robots-denied`, `access-denied`, `unsafe-url`, `deadline-exceeded`, `resource-limit`, `invalid-reference`, `cleanup-failed` and general navigation/capture failure. A refusal does not trigger an automatic retry or approval. An agent should inspect the selected original, explicitly choose another permitted reference or deliberately request a deeper open.

`executionStatus` reports `completed`, `completed-with-limits` or `cleanup-failed`. Every acquired session has its close awaited. If cleanup reports a failure, an already captured image is retained with an explicit per-reference cleanup failure, and further references in that batch are not admitted. This preserves diagnostic evidence without claiming successful resource release. Caller cancellation is observed even during the final close and propagates after owned cleanup is awaited.

## Verification method

New contracts cover transient and permanent preloaders, password controls, late access challenges, cancellation during real waits and final cleanup, required origin approval, actual per-reference deadline interruption, provenance/option forwarding, exact byte limits and stopped admission. The same initial contracts were run against the preserved1.0.0 runtime: seven failed and one passed, identifying both new capabilities and corrected cancellation/cleanup behavior.

The seeded fault campaign exercises500 generated batches, separately from real-browser tests. The controlled load campaign uses an owned HTTP source/page and the official SDK transport:120 fresh source searches,36 preview requests in six concurrent waves, observed capacity bounds and transport cancellation. It does not load-test or benchmark public upstream services. Live production source/tool acceptance is recorded separately.

Reproduce after building:

```sh
npm run lint
npm run check
npm test
node scripts/preview-load-acceptance.mjs
node scripts/stability-acceptance.mjs --soak-minutes=2 --report=.release/preview-live-sdk.json
node .release/quality-tools/stryker/node_modules/@stryker-mutator/core/bin/stryker.js run quality/preview-stryker.config.mjs
```

The last command uses the separately installed private tool described in the repository's [review-tool instructions](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v1.1.0/quality/README.md). Mutation scope is the compiled preview orchestration. Surviving mutations are disclosed; a score is not whole-project coverage or a security certificate. Final exact-commit CI, installation, archive checksums and compact validation reports are attached to the matching release. Earlier [1.0.0 stability evidence](STABILITY_AUDIT.md) remains historical and is not relabeled as a new run.

The complete local suite passed **107/107 on Brave and 107/107 on Edge**, without skipped tests. The controlled load campaign completed120 fresh searches and36 concurrent preview requests, returned18 actual images, observed at most3 active sessions, and ended with zero owned browser/discovery resources. All17 production tools and all seven actual sources also passed a separate live SDK exercise.

The focused preview mutation run killed154 of227 mutations (67.8%), with73 survivors and no timeout/runtime-error classifications. This exposes remaining gaps, including diagnostic/metadata alternatives and branches not covered by the isolated orchestration tests; it is not claimed to cover the readiness detector or the whole project. Real readiness behavior is checked separately in installed browsers. The local static scan retained four reviewed cleanup warnings with no scan errors, and OSV found no known vulnerabilities across140 locked packages at scan time. The [compact validation report](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v1.1.0/artifacts/preview-readiness/validation.json) records the measured counts and surviving mutations.
