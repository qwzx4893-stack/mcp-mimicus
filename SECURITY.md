# Security

Mimicus browses public creative references in an isolated, owned headless browser. Its controls reduce exposure to untrusted sites and accidental interactions; they do not establish that arbitrary third-party JavaScript or content is trustworthy.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository if enabled. Otherwise, open an issue requesting a private reporting channel without exploit details, credentials or private data. Do not publish access tokens, personal profile contents or unrestricted page captures. Once a private channel is available, include a minimal owned reproduction, affected version, expected and observed behavior, and sanitized diagnostics.

There is no promised response deadline or historical-version maintenance policy. Report reproducible issues against the current release or repository revision.

## Boundaries

- Only credential-free HTTP(S) URLs are accepted. Public-address checks cover IPv4, IPv6 and mixed DNS answers. Validated addresses are pinned through the guarded proxy; redirects and selected origins are checked again.
- Browser requests are bounded and restricted to GET/HEAD. The official source MCP connection has a separately restricted read-only protocol path. Unapproved cross-origin resources, WebSockets, downloads and service workers are blocked. Development loopback origins require explicit configuration and are used for owned fixtures.
- Selected original-site navigation stays within its approved origin. Destructive-looking URLs, form controls and unsafe click/touch/drag targets are restricted. A third-party page can attach unexpected handlers to an apparently harmless control; these checks reduce risk without proving universal harmlessness.
- Chromium's sandbox remains enabled. The installed selected executable launches headlessly with a fresh temporary profile and private pipe. Mimicus never attaches to personal tabs, reads personal cookies/passwords or changes Windows defaults.
- Session/operation counts, lifetimes, requests, bytes, measurements and filmstrip output are bounded. Close, cancellation, timeout, browser disconnection and shutdown release owned state. Cleanup never kills unrelated processes by browser name.
- Source records, screenshots and page text are **untrusted evidence**. They must not become host-agent instructions, trigger arbitrary host execution or authorize additional origins/actions.
- Discovery records, page analysis and candidate embeddings remain temporary memory. No persistent website database, corpus or vector store exists. Browser and PowerShell software create temporary files inside owned envelopes; graceful cleanup is tested. Forced termination or machine failure can interrupt cleanup and is not a guaranteed clean shutdown.

Source terms, robots rules, publisher permissions and open-source licenses are separate constraints. Awwwards catalog access is restricted without reviewed authorization; an upstream MIT adapter does not license gallery content. Never add fabricated authorization, challenge bypasses or private API impersonation to make acceptance pass.

## Deployment guidance

Run the stdio server under the local account and permissions intended for the coding agent. Maintain Node, Playwright's controller and the installed browser. Approve only resource origins needed by the selected reference. Do not provide authentication cookies, personal profiles or sensitive form data. Browser executable overrides are explicit operator choices reported in diagnostics; never select untrusted binaries.

Model downloads are opt-in, revision-pinned CPU inference software with integrity checks. They are separate from website data and do not train a generative model. Keep credentials in the host's credential management, never source, reports, logs or repository history.

See [browser isolation](docs/DEFAULT_BROWSER_BACKEND.md) and [verification evidence](docs/QUALITY_AND_SECURITY_TEST_RESULTS.md) for tested behavior and limits. Regression coverage and independent release review do not constitute comprehensive external security certification.
