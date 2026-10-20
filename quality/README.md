# Private review tooling

These configurations are for maintainers reviewing Mimicus. They are not MCP tools, runtime dependencies or part of the release archive. Install binaries under ignored `.release/quality-tools/`; do not vendor them or scanner rule repositories into the product.

The stability review used:

| Tool | Pinned version / revision | License | Verified download SHA256 |
| --- | --- | --- | --- |
| [Opengrep](https://github.com/opengrep/opengrep/releases/tag/v1.31.0) | 1.31.0, `opengrep_windows_x86.exe` | LGPL-2.1 | `fdd2e22549e7000ceb66976a01366db6910760b2aa4e457b6bda62545070d26a` |
| [OSV-Scanner](https://github.com/google/osv-scanner/releases/tag/v2.7.0) | 2.7.0, Windows amd64 | Apache-2.0 | `9964ed64ec9a387391eb4cc006ad5c531154821aef29b793e02c448de4686438` |
| [StrykerJS](https://github.com/stryker-mutator/stryker-js/releases/tag/v10.0.0) | `@stryker-mutator/core@10.0.0` | Apache-2.0 | npm integrity-locked private installation |
| [Trail of Bits rules](https://github.com/trailofbits/semgrep-rules/tree/31390b3a99c04c81522d1b37c8d1900aa2dd4094) | `31390b3a99c04c81522d1b37c8d1900aa2dd4094`, generic + JavaScript | AGPL-3.0 | Git revision pin |

Download the official release binaries, verify their hashes, and extract the pinned rule repository into `.release/quality-tools/rules/`. Opengrep's local-only configurations require no registry login or uploaded source. OSV sends dependency identifiers to its advisory service. Mutation testing runs instrumented compiled JavaScript in disposable copies. Review findings manually.

```powershell
npm ci --ignore-scripts
npm run build
.release/quality-tools/opengrep/opengrep.exe scan --config quality/opengrep.yml --disable-version-check --json --output .release/opengrep-final.json src
.release/quality-tools/osv/osv-scanner.exe scan source --lockfile=package-lock.json --all-packages --format=json --output-file=.release/osv-final.json
npm install --prefix .release/quality-tools/stryker --ignore-scripts --no-fund --no-audit --save-exact @stryker-mutator/core@10.0.0
node .release/quality-tools/stryker/node_modules/@stryker-mutator/core/bin/stryker.js run quality/stryker.config.mjs
```

For the independent upstream rules, pass Opengrep two additional `--config` arguments pointing at the pinned repository's `generic` and `javascript` directories. Keep the repository's license intact in that private installation. The seven rules in `opengrep.yml` are independently written project review patterns; neither these patterns nor an empty scan replace security review.

Stryker uses the command runner because the attempted TAP integration misclassified native `node:test` failures as runtime errors. Those failed-harness classifications are excluded from the score. The configuration deliberately reports remaining survivors and timeouts; it has no score-based release override. It covers robots matching, URL/label/bounded-work utilities and the navigation guard, not the complete product.

Run the sustained production-SDK acceptance explicitly; it contacts the actual sources and launches isolated installed-browser sessions:

```powershell
node scripts/stability-acceptance.mjs --soak-minutes=21
```

The owned visual example is the sustained test target. Live source metrics are separate and do not imply continuous availability or full-catalog recall. Reports export counts, diagnostics and identity hashes rather than source records or screenshots.
