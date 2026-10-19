# Contributing

Mimicus is a live visual reference browser for coding agents. Changes should help agents discover, see and selectively understand references while keeping original-site observations temporary.

## Local setup

Use Node.js 24 or newer and install the locked dependencies without lifecycle scripts:

```sh
npm ci --ignore-scripts
npm run lint
npm run check
npm run build
node dist/cli.js doctor
node dist/cli.js self-test
npm test
```

On Windows, browsing uses the installed current HTTPS default when it is a recognized compatible Chromium browser. It runs headlessly in an isolated temporary profile. **Do not run a Playwright browser installer.** No browser download is part of normal setup. See [browser support and diagnostics](docs/DEFAULT_BROWSER_BACKEND.md).

For an explicitly chosen alternative installed Chromium browser, set `MIMICUS_BROWSER_EXECUTABLE` to its absolute executable path. This is also required for browser integration tests on platforms without Windows default resolution. The override is reported; it must never become a silent fallback. Set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` throughout installation and testing if desired. The local MiniLM software is optional for lexical discovery; `node dist/cli.js model-fetch` explicitly downloads only the pinned model files.

## Test the behavior you change

The full suite uses actual browser processes and the official MCP SDK over stdio. Run it for browser, interaction, lifecycle, server, security and integration changes. Browser-free core checks can also run independently after building:

```sh
node --test --test-concurrency=1 test/architecture.test.mjs test/design-brief.test.mjs test/federation.test.mjs test/security.test.mjs test/source-release.test.mjs
```

CI runs that core set on Linux and the full suite with a preinstalled Edge executable explicitly selected on Windows. The Edge CI configuration tests an **override**, while locally verified Brave tests Windows **default association discovery**. A workflow definition alone does not prove a hosted run passed.

Add regressions for demonstrated defects, especially redirects/DNS, original URL extraction, pagination, continuation, safe interactions, cancellation and cleanup. Keep fixtures original or explicitly licensed. Deterministic source fixtures prove parsing and boundaries; report live external acceptance separately. Do not edit observations or test tolerances merely to obtain a green result.

## Product and evidence rules

- No persistent website catalog, database, source snapshots, website embedding cache or background crawler. New independent discovery calls must query fresh upstream data.
- Preserve source-native labels, makers, URLs, provenance and partial-coverage diagnostics. Distinguish normalized concepts and recommendations from retrieved facts.
- Browse and analyze selected authorized references. Deliver real MCP image content. Do not copy gallery media, branding or proprietary source code into fixtures or repository assets.
- Preserve guarded networking, Chromium's sandbox, isolated profiles, resource budgets and owned-process cleanup. Never attach to a personal browser or introduce a browser download/fallback.
- Optional model weights are software. Website vectors and measurements remain bounded, temporary operation/session state.
- Open-source licenses and website content permissions are separate. Do not invent Awwwards authorization, bypass access challenges or turn temporary browsing into catalog harvesting.
- Treat external page text as untrusted evidence, never host instructions. Separate measurements, inferred classifications, implementation guidance and uncertainty.

Describe the problem, resulting behavior, verification and remaining limits in a pull request. New dependencies or adapted source need a clear purpose and license/provenance update in [third-party notices](THIRD_PARTY_NOTICES.md). Never commit credentials, personal browser data, private paths, downloaded gallery assets or model weights. See [SECURITY.md](SECURITY.md) for vulnerability reporting.
