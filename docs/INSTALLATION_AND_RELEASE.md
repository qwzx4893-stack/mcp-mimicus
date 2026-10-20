# Installation and release verification

Mimicus `0.4.0-beta.1` is a GitHub-distributed beta. The package deliberately retains `private: true`; it has **not been published to npm**. An actual `.tgz` has been installed and exercised from a fresh isolated consumer directory. Clean public-checkout and final release verification remain separate gates.

## Requirements

- Node.js 24 or newer and npm.
- A compatible Chromium browser already installed on the machine. Windows resolves the current HTTPS default browser when opening a session; this machine uses Brave. An unsupported default produces a diagnosis rather than downloading or silently choosing a different browser.
- On other hosts, explicitly configure `MIMICUS_BROWSER_EXECUTABLE` to an installed compatible executable. This does not imply Linux or macOS default-browser resolution has been verified.
- Public network access for the selected upstream sources and original websites. Individual sites may refuse robots access, need extra resource origins, present consent/password gates, or change markup.

The browser is launched as an owned headless process with a temporary isolated profile. No personal browser window or profile is attached. Playwright is a runtime library; installation does not require downloading a Playwright browser.

## Build from the public repository

```sh
git clone https://github.com/qwzx4893-stack/mcp-mimicus.git
cd mcp-mimicus
npm ci --ignore-scripts --no-fund --no-audit
npm run build
node dist/cli.js --version
node dist/cli.js doctor
node dist/cli.js self-test
```

Use `node /absolute/path/to/mcp-mimicus/dist/cli.js serve` as the stdio MCP server command. The host should provide arguments as an array, preserve stdout for the protocol and allow stderr for diagnostics. No GitHub token or other private credential is required for the public source checkout, ordinary permitted discovery, or local browser operation.

## Install a release archive

Download the `.tgz` attached to the corresponding verified GitHub prerelease, then install it into a directory you own. Substitute the real downloaded file and consumer directory below; the registry name `mcp-mimicus` is not an npm installation claim.

```sh
npm install --prefix ./mimicus-consumer --ignore-scripts --no-fund --no-audit ./mcp-mimicus-0.4.0-beta.1.tgz
node ./mimicus-consumer/node_modules/mcp-mimicus/dist/cli.js --version
node ./mimicus-consumer/node_modules/mcp-mimicus/dist/cli.js --help
node ./mimicus-consumer/node_modules/mcp-mimicus/dist/cli.js doctor
node ./mimicus-consumer/node_modules/mcp-mimicus/dist/cli.js self-test
```

The installed package also declares the `mimicus` executable shim. Passing its installed `dist/cli.js` to Node avoids shell-specific command lookup in MCP host configuration. Runtime dependencies come from the public npm registry; the package archive contains Mimicus build output and selected documentation rather than vendored dependencies.

## First run and model software

Semantic model download is opt-in. A fresh machine may show missing model software in `doctor`; permitted native/lexical source discovery remains useful and reports the fallback. `doctor` resolves the installed browser but does not launch it or contact sources. `self-test` performs real rendering and checks cleanup. Neither command proves external source availability.

If semantic retrieval is wanted, explicitly run `node dist/cli.js model-fetch` from a built checkout, or the corresponding installed entry path. Only pinned model software is stored; this is not a website catalog, screenshot, vector corpus, or background sync. A first-run model download requires network access and disk space. Do not enable it merely to hide a missing-model diagnosis.

For an explicit browser override, set `MIMICUS_BROWSER_EXECUTABLE` to the installed compatible executable path in the MCP host environment. A missing or unsupported explicit binary must fail without fallback. Configure additional original-site resource origins only when selected and authorized; do not disable origin checks globally.

## Acceptance evidence

`scripts/hardening-install.mjs` is a repository-only acceptance orchestrator. It creates a fresh consumer directory, empty home/model directory and empty user/global npm configuration, copies only required platform variables, uses the public registry, and excludes inherited credentials and Mimicus configuration. It runs installed application code and imports the official MCP client from installed production dependencies. The application does not import this test script, bridge helpers, source fixtures or development dependencies.

The actual packed-install result is recorded in [`install-acceptance.json`](https://github.com/qwzx4893-stack/mcp-mimicus/blob/main/artifacts/product-hardening/install-acceptance.json). Source screenshots stay in RAM; this report stores hashes and byte counts rather than image data or personal profile paths.

| Check | Actual observation on 20 October 2026 |
| --- | --- |
| Runtime and installation | Windows x64, Node `24.19.0`; real archive installed with `--ignore-scripts`, empty npm configuration and fresh consumer home |
| CLI | Installed `0.4.0-beta.1` version, help and doctor succeeded; `private: true` and the `mimicus` bin declaration were retained |
| Missing model software | Doctor explicitly reported missing model integrity; a fresh Nuxt hybrid request used `lexical-fallback`, made one metadata HTTP request and returned five results from the actual 58-record response |
| Actual installed browser | Windows default Brave `155.0.8059.85` rendered the self-test, navigation and 390×844 mobile capture, then closed its owned isolated process |
| Unsupported explicit binary | A nonexistent executable returned exit code 1; no fallback or browser download occurred |
| Official stdio protocol | The installed SDK client connected to the installed `serve` entry point and discovered all 17 tools, including selected-reference previews |
| Selected source original | The Nuxt query supplied the selected Tchibo original; its actual first viewport produced an MCP JPEG. Two preceding selected candidates refused with robots HTTP 403 and the metadata response byte bound; those failures remain in the report |
| Cleanup | `activeSessions`, `closingSessions`, `opening`, `activeOperations`, `retainedReferences` and both pending candidate queues were all zero |

The successful first install took approximately 72 seconds. This is one machine and one permitted source/original path, not a cross-platform or complete external-catalog guarantee. A captured Tchibo viewport does not imply fully loaded content, visual quality or permission to redistribute its content.

The first acceptance attempt passed the same seven application checks, then failed because the test harness used nonexistent resource-counter field names. The [preserved defect record](https://github.com/qwzx4893-stack/mcp-mimicus/blob/main/artifacts/product-hardening/install-round1-defect.json) identifies the assertion correction; the entire fresh installation was rerun successfully. This was a harness error rather than a browser cleanup failure.

Final archive contents after documentation changes, a clean public checkout and exact-release hosted CI are still pending. The eventual GitHub prerelease must name the verified commit and archive checksum. The final archive digest belongs outside the archive to avoid a self-referential checksum report. Runtime tests on an earlier build or hosted CI on an earlier commit do not verify the final release. No npm publication is part of this work.
