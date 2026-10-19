# Quality and security verification

This report separates deterministic regressions, real browser/MCP execution, live source acceptance and coding-agent design trials. A parser fixture is not a live connection; a screenshot or GPU capability flag alone does not prove complete rendering or artistic quality.

## Verification rounds

| Round | Purpose | Evidence and status |
| --- | --- | --- |
| 1 — baseline | Reproduce the existing product before release changes | Previous 17-test suite passed; recovery history preserved. |
| 2 — integration and adversarial fixes | Reproduce defects and add focused regressions | Real Brave backend, lifecycle, source continuation/native interfaces, access-layer detection, canvas uncertainty and strict restart persistence were exercised. |
| 3 — frozen release | Run complete suite after implementation and review | Final rebuilt-runtime complete suite passed **41/41** on Windows-default Brave and **41/41** on explicitly selected installed Edge, with no skips. Lint and typecheck passed. Hosted CI is a separate post-publication check. |

The frozen-run evidence is [default Brave TAP](../artifacts/final-release/final-tests.tap), [installed Edge TAP](../artifacts/final-release/edge-tests.tap), [build](../artifacts/final-release/final-build.log), [lint](../artifacts/final-release/final-lint.log) and [typecheck](../artifacts/final-release/final-typecheck.log). The suites run the same complete test set as `npm test`, with the TAP reporter explicitly placed before test file arguments. They completed in approximately **91.1 seconds** and **70.8 seconds** respectively; these are suite durations from concurrent independent local runs, not browser latency benchmarks. This is local integration evidence, not a claimed hosted workflow run.

## Focused verification

- **Six browser/backend regressions** cover literal association commands, unsupported engines/paths, bounded errors, actual executable identity, parallel profile/cookie isolation, GPU diagnostics, progressive sections, safe touch/drag, owned crash, timeout, process/profile cleanup and an injected real-browser page-setup failure before session registration.
- **Strict restart persistence passed.** Two real official-SDK stdio lifetimes use isolated HOME, USERPROFILE, CWD and TEMP. Search, reference lookup, browsing and selected analysis run before graceful close. The directory must be completely empty after each lifetime; an old operation ID is unusable and the source is fetched afresh.
- The earlier focused combined backend/restart run passed **6/6** before the additional setup-failure regression. That new regression then passed independently with a real default Brave process. The complete final runs include all six backend cases and the restart gate. Seven existing visual/lifecycle regressions also passed on actual default Brave during implementation.
- The installed-browser CLI self-test passed JPEG capture, menu activation, mobile resizing and owned process/profile deletion. Windows selected Brave through its HTTPS association, without a browser download or fallback.

## Reproduced defects and corrections

| Defect | Evidence | Correction |
| --- | --- | --- |
| Implicit bundled Chromium | Previous launch omitted executable selection | Resolve current default and verify actual launched executable/profile/pipe. |
| Brave command-line identity unavailable | CDP rejected identity lookup without automation flag | Explicit `--enable-automation`; no stealth identity change. |
| Optional PowerShell module blocked browsing | Real coding-agent child could not load Security module | Optional signature diagnostic; bounded errors omit encoded commands/CLIXML. |
| Empty isolated-HOME residue | Plain `powershell.exe -NoProfile` created empty `AppData/Roaming` | Owned helper HOME/AppData/TEMP envelope, removed in `finally`; strict test retained. |
| Edge failed isolated-HOME restart | Installed Edge passed 39/40 but its native AppData lookup failed, so DevTools rejected even the correct non-default profile | Initialize owned browser HOME/AppData/TEMP before launch, remove it on teardown, retain strict persistence checks; no safety-check bypass. The [failed run](../artifacts/final-release/edge-round2-defect.tap) is retained with personal paths redacted. |
| Expiry test assumed 100 ms browser shutdown | Edge closed asynchronously after the fixed assertion delay while session removal was already correct | Observe native disconnection and zero closing sessions within a bounded five-second deadline, without forcing close first. The [failed run](../artifacts/final-release/edge-round3-expiry-defect.tap) is retained with paths redacted. |
| Page setup failed before session registration | Independent review found an allocated session could be absent from the active map when `newPage` throws | Registered sessions use normal close; unregistered setup failures explicitly release browser/proxy/home. A real-browser injected page-setup failure verifies disconnection, profile/home deletion and refused proxy connections. |
| Legitimate prose treated as challenge | “Just a moment” appeared in ordinary page copy | Access-layer evidence distinguishes ordinary prose; real challenge remains blocked. |
| Empty canvas readback overstated static rendering | Readable transient buffer had no nonempty pixels | Inconclusive/null change with compositing limit; inspect temporal screenshots. |

## Actual browser environment

Locally tested: Windows, Node.js 24, Playwright controller 1.64.1, installed **Brave file version 155.1.97.59 / Chromium 155.0.8059.85**, selected by HTTPS default association, and **Edge file version 155.0.4283.62** selected through an explicit override. CDP binaries matched the selected executables. Sessions used headless private pipes, separate owned temporary profiles and owned HOME/AppData envelopes.

NVIDIA GeForce RTX 4060 Laptop GPU exposed WebGL 2 through ANGLE/D3D11. GPU compositing, canvas and WebGL were enabled; GPU was not disabled. This records this environment's capabilities, not universal Three.js/video/shader support. Optional signature metadata can be unavailable in restricted PowerShell environments and is reported honestly.

## Performance evidence

[Performance measurements](../artifacts/final-release/performance.json) describe actual live-source and three owned Brave browsing trials. Fourteen nonrestricted source cases had p50 **1,576 ms** and p95 **12,138 ms**; three browser launch/navigation cases had p50 **1,950 ms** and p95 **2,343 ms**. Captures measured p50/p95 **51/60 ms**; cleanup **195/345 ms**. These are descriptive measurements from small, heterogeneous samples, not throughput guarantees.

That performance run was captured at **2026-10-19 14:48 UTC**, before the final browser-HOME envelope fix. Source behavior and browser features were the same, but these numbers are not a fresh latency measurement of the final environment-containment patch.

[Local semantic measurements](../artifacts/final-release/semantic-live.json) used 58 actual current candidates and 12 query/retrieval cases. Reported RSS change was **204,578,816 bytes** for that run, which includes runtime/model allocation rather than a website-vector disk cache. No aesthetic or statistical relevance superiority is inferred.

## Coverage and limits

The suite covers database-free runtime structure; fresh RAM federation, canonical deduplication and native provenance; missing-model lexical fallback; continuation/default fields and progressive pages; Awwwards operator handoff without catalog authorization; guarded DNS/proxy/redirect/robots behavior; SDK images/reference/analysis/spec and shutdown; selected motion/viewport behavior; expiry, cancellation and cleanup; and evidence-grounded design briefs.

Live source status belongs in the [source integration matrix](SOURCE_INTEGRATION_MATRIX.md) and [current source evidence](../artifacts/final-release/source-acceptance.json). Awwwards restrictions remain visible. Interfaces and site rendering can change after a run. See [coffee](../artifacts/final-release/coffee-trial.md) and [immersive](../artifacts/final-release/immersive-trial.md) coding-agent trials; small trials do not establish statistical aesthetic superiority.

CI runs Linux static/core checks and Windows full integration with explicitly selected **preinstalled Edge**. Action SHAs were verified against official tags through GitHub's API. An authored workflow is not a claimed completed hosted run. Other recognized browsers do not inherit Brave/Edge acceptance; see [browser support](DEFAULT_BROWSER_BACKEND.md).

Verified official action pins on 2026-10-19: `actions/checkout` v7.0.1 → `3d3c42e5aac5ba805825da76410c181273ba90b1`; `actions/setup-node` v7.1.0 → `949feb2413d6458794dcd2491c4babbbce0c15c1`; `actions/upload-artifact` v7.0.2 → `cf430e030ddbb5b0abf93d22962f4752f3646cd9`. The workflow uses read-only repository permissions, disables checkout credential persistence, installs dependencies with `--ignore-scripts`, and sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.

Residual limits include partial/rate-limited upstream indexes, explicit resource-origin approval, finite budgets/sampling, site-specific rendering, untrusted third-party handlers and cleanup interrupted by forced termination. No external security certification or unrestricted source permission is asserted.
