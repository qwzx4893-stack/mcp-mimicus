# Browser reliability and long workflows

Windows re-resolves the current HTTPS default installed browser at each new session. Explicit executable overrides remain available. Each launch owns its headless process, private control pipe, fresh home and temporary browser profile. Personal tabs, profiles and cookies are not attached. Unsupported defaults fail without a bundled-browser download or fallback.

The default is now three concurrent sessions, matching three-reference comparison. Idle expiry defaults to ten minutes; an absolute thirty-minute lifetime is separate. `mimicus_interact` with `interaction.action: "renew"` renews only an unexpired idle lease, produces no image, cannot extend the absolute deadline and cannot reset cumulative budgets. Relevant selected-session reads count as activity; listing all sources does not keep abandoned sessions alive.

Default per-session limits are 80 successful JPEGs and 200 browser operations, in addition to cumulative network request/byte bounds. Status and diagnostics expose limits, counters and both deadlines. Absolute expiry aborts an in-flight operation. Expired sessions must deliberately reopen the authorized original URL; analysis identifiers cannot be revived. This is temporary browsing, not durable state recovery.

Four focused browser cases cover renewal across original idle expiry, image/operation budget enforcement, in-flight absolute expiry and refusal of an arbitrary Awwwards authorization string. Existing crash/cancel/process/profile tests remain. A new real-browser regression replaces context.close with a never-resolving RPC and verifies owned browser/process/profile teardown completes; all11 focused backend/session tests pass.

## Extended workflow and observed cleanup failure

The actual SDK coffee workflow began20 October2026 at09:48:08UTC. Both references stayed usable through repeated selected analysis/spec/comparison, original implementation desktop/mobile QA and explicit renewal. The agent captured both again after20 minutes, with the same absolute deadlines and increasing cumulative counters. This was actual wall time with work interleaved, not an accelerated expiry timer or an account-outage interval. Discovery expired independently; selected browser analyses remained usable.

One reference close then remained pending while other sessions were still active. No corresponding owned browser process remained, but a closing counter and proxy listener persisted. It eventually completed after the other owned sessions closed. This is retained as a failure in [round-one timestamps](https://github.com/qwzx4893-stack/mcp-mimicus/blob/main/artifacts/product-hardening/long-workflow-round1.json), not silently counted as reliable cleanup. The exact underlying browser protocol cause was not established.

Because each reference owns an entire browser, teardown now closes that owner directly rather than serially awaiting context.close first. This removes a context-RPC stall from the path to proxy/home cleanup. The unresponsive-RPC regression and normal crash/timeout cases pass. A subsequent extended final-code run is being checked separately; the first run alone cannot verify that correction.

Playwright documents [Browser.close](https://playwright.dev/docs/api/class-browser#browser-close) as closing a launched browser and its pages, similar to force-quitting. Graceful context close is useful for flushing HAR/video artifacts; Mimicus does not record or retain those artifacts. This teardown deliberately prioritizes disposal of the wholly owned browser. It never sends a close command to a personal browser.

Brave is observed as the installed Windows HTTPS default, not inferred from a Chrome protocol string. Explicit installed Edge is separately exercised. After both corrections, local full suites passed71/71 with zero skips: default Brave181.6s and explicit Edge138.9s. These are one run per browser on this machine, not latency SLOs. Exact-release hosted CI is recorded separately. No claim is made for untested Chrome/Vivaldi/Opera, Linux/macOS defaults, assistive technology or real handheld devices.
