# Visual discovery evaluation

`mimicus_preview_references` accepts one to eight individually authorized original references. Search remains metadata-only. The preview tool launches sequential owned browser processes, returns ordered real JPEG MCP image blocks, and closes each session in `finally`. It never fetches source-owned gallery thumbnails or saves a preview cache.

The response maps each selected input to `imageIndex`, provenance, requested URL, actual captured URL, viewport, capture time, measured readiness and a distinct captured/partial-render/blocked/unavailable/not-yet-previewed status. JPEG output is bounded to4MB. A45-second batch admission budget and ten-second per-item abort signal bound attempted work; installed-browser launch and cleanup can finish beyond those soft deadlines, up to their separate configured timeout. These are not strict wall-clock SLOs or proof that delayed scenes were inspected.

The actual official SDK regression received four distinct owned images and verified their source order by SHA-256. Robots refusal, substantial loading overlay, visible key/password input and missing visible image were separately exercised. Negative entries did not shift another image's source attribution. All owned sessions and pending closes were zero at the end. Evidence: `artifacts/product-hardening/preview-tests.log`.

On20 October2026, fresh Astro/Nuxt operations supplied four selected originals: I Brew My Own Coffee, Tchibo, Pulseahead and UserJot. One official-SDK stdio response returned four actual JPEG images in that order; all four were viewed. Original image sizes were30,317 /58,658 /47,859 /42,363 bytes, with distinct SHA-256 hashes. [Live metadata, provenance and diagnostics](https://github.com/qwzx4893-stack/mcp-mimicus/blob/v0.4.0-beta.1/artifacts/product-hardening/preview-live.json) record the exact observations without image files.

All four were correctly marked partial-render because incomplete visible media or rejected resources remained. Their composition was useful; this is not four fully loaded websites. Display-only resizing does not alter production images or recorded hashes. All preview sessions close immediately.

Other real trials viewed Codrops GPU scenes and Webflow/Astro cultural/agency references. Negative outcomes included robots403, deadline closure, persistent loaders, blocked CSS/fonts, analytics refusal and detail timeouts. Explicit essential-origin approval recovered some styled frames. Agents chose usable alternatives without claiming a hidden scene was inspected. See the [agent evaluation](AGENT_QUALITY_EVALUATION.md).

Final Brave/Edge suites include the controlled positive and negative cases. Fixtures remain distinct from external connectivity. The tool is a visual selection step, not a screenshot embedding model or content license; no saved frame is used as a runtime fallback.
