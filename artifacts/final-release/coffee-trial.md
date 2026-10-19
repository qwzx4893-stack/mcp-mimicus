# Fieldwork Coffee: real agent workflow trial

Performed on 2026-10-19, approximately 11:01–11:12 UTC, using the real official MCP SDK stdio client behind the development loopback bridge. The bridge called the current production tools; source results and original-site images were not fixtures. Third-party screenshots and observations remained in temporary memory. Only this report and the original concept HTML were authored by this trial agent.

## Brief and design gate

**Project:** a premium independent coffee roaster concept for home brewers choosing a seasonal whole-bean coffee. **Surface:** new storefront landing page. **Primary task:** choose a brewing style and read a coffee’s origin, tasting notes and brewing guidance. **First decision:** comforting espresso or a brighter filter coffee. **Success:** a person can reach relevant product details, close them, and keep their place. **Mobile action:** “Choose your coffee” in the first viewport. **Recovery:** reset the brewing filter, close the detail dialog, close the menu with Escape. There is no payment or purchase flow.

Applied the frontend-design, ui-ux and motion skills. Chose custom semantic HTML/CSS/native dialog because the concept needs a small local interaction model, not an application framework. Risks reviewed before coding: an oversized hero hiding the primary action; decoration overwhelming actual coffee choice; inaccessible mobile navigation; focus loss after product details; borrowed source imagery; and motion with no useful purpose.

The original direction uses pale blue `#e5edf1`, deep botanical ink `#25352e`, roast-label orange `#ed7d39`, faded pink `#eac9c3` and uncoated-paper cream `#f9f5e8`. Georgia carries the large, soft editorial headline; Trebuchet MS/Arial carry legible task text. A two-column desktop hero pairs a direct coffee decision with an independently drawn SVG coffee bag. The collection is quieter and organised around brewing style. On mobile the same reading order becomes one column. The bag label, copy, brand, illustration and product information are original illustrative work. Motion is confined to direct navigation feedback and respectful scrolling; there are no automatic decorative loops.

## Live discovery and reference selection

| Actual request | Observed result and decision |
| --- | --- |
| Nuxt, query `coffee`, lexical | “Buy Me a Coffee” was the only direct title match among returned results; a creator platform is a weak match for this retail brief. Did not treat lexical score as aesthetic suitability. |
| Made in Webflow, query `coffee`, hybrid | At that moment the running adapter returned the popular native feed, including navigation/animation demos, with partial coverage. This did not establish coffee search coverage. Reported the limitation to the parent; its source worker subsequently implemented and tested a native coffee query. This trial does not claim to have exercised that later fix. |
| Original `https://osmo-fixed-underlay-nav.webflow.io/` | Automation was blocked by robots. Did not bypass it or claim to have inspected its visual design. |
| Nuxt, native industry `Retail & Food`, lexical | Current official YAML returned Tchibo, Aldi, McDonalds France and Harrods. Native industry filtering supplied a more defensible retail reference than the broad title query. |
| Astro, query `coffee`, lexical | The current official 3,221-title/URL index returned I Brew My Own Coffee, Jura Espresso Machines, Main Coffee Lab and caffeineletter among the selected enriched candidates. Inspected Main Coffee Lab as the closer specialist retail reference. Source enrichment remained bounded, not a claim of full-source semantic/style coverage. |

Viewed actual MCP image blocks from **two different original sites**:

- **Tchibo**, `https://www.tchibo.de/`, 1280×800, captured 11:04:58 UTC. Nuxt provenance retained native `Retail & Food` and `Nuxt`. Actual first viewport showed a dense retail navigation, promotion strip and large horizontally arranged lifestyle tiles. Useful comparison: clear merchandising hierarchy and visible category access. Rejected its broad department-store density and promotional emphasis for this small roaster. Readiness reported 14/75 images loaded, 61 incomplete, and request-budget/analytics diagnostics. The visible viewport was meaningful, but this was not complete site rendering.
- **Main Coffee Lab**, `https://maincoffeelab.com/`, 1280×800, opened after fresh Astro discovery around 11:05 UTC. Actual image showed a characterful pixel headline, straightforward coffee proposition, shop navigation and nearby product collection. Useful comparison: explain the coffee before offering products, and keep product choice close to the proposition. Chose it as the more relevant conceptual reference. Deliberately avoided its pixel typography, brand language, badges, sprites, art and automatic marquee. Readiness reported 33/36 images loaded; Cloudflare analytics was blocked. No asset origin was added merely to load analytics.

Compared both open sessions with `mimicus_compare_references` and a concrete brief: seasonal hero, coffee choice, origin/brewing details, roaster story, subtle motion. The tool returned measured typography, spacing, navigation and independently written guidance. Its default first-reference anchor was Tchibo; the agent deliberately chose a different original composition and the specialist coffee reference for the task. The comparison did not choose an aesthetic winner or generate the page. Author judgment remained necessary.

## Selected analysis, specification and implementation

Used `mimicus_explore_page` to obtain the actual Main Coffee Lab Shop disclosure selector. `mimicus_analyze_element` then sampled hover at 1280×800. The selected navigation link had a **200ms ease-in-out transition**, no measured horizontal/document displacement, opacity 1, and `aria-expanded` changing **false → true → false** over activation and reset. The source declared transition-property `all`; that declaration alone was not mistaken for movement. Retrieved `mimicus_get_implementation_spec` from temporary analysis `9d46910b-8e78-4df6-8f33-31c427f3801f`, component `c1afdf091b7ec0453dc116392560`.

Implemented an original disclosure using a semantic button, explicit `aria-controls`, a visible controlled region, hover activation/reset at desktop, and click activation for keyboard/touch. Kept the observed 200ms ease-in-out timing for **color only**. The rest of the page is authored for the project: brewing-style filters with pressed state and live feedback; original coffee bags; product descriptions and native modal detail dialogs; menu Escape recovery; and reduced-motion overrides.

`mimicus_verify_implementation` compared the reference analysis with `#coffee-nav` in the real owned page at 1280×800. It returned **withinMeasuredTolerances: false**. The two reported differences were intentional and retained:

1. Reference transition-property `all`; implementation `color`. Timing and easing were retained while limiting transition scope.
2. Reference state evidence had no exposed controlled-region list; implementation reports the explicit controlled region as hidden/visible alongside expanded state.

The implementation’s sampled sequence showed false → true → false, zero displacement, opacity 1, and visible controlled content only while expanded. Verification did not establish pixel identity, visual quality or aesthetic superiority. The narrower selected region used for one filmstrip clipped out the absolute-positioned dropdown; a second full-viewport filmstrip showed the complete result. This is a useful caller lesson: choose a visual capture region that includes the controlled content.

## Actual visual and independent task QA

Viewed the owned page via actual MCP images at **1280×800** and **390×844**, including mobile menu open, coffee filtering, product dialog, final desktop hierarchy and a three-frame disclosure filmstrip. Full-viewport frames were timestamped at approximately **29.9, 203.4 and 355.1ms**. The later filmstrip was captured with reduced motion enabled, so it demonstrates visible state change rather than a normal-mode animation duration. Normal-mode timing was independently measured in the earlier verification.

Independent Playwright QA launched the same already verified installed Brave executable against the owned page; it did not replace the MCP discovery/analysis workflow. Results:

| Check | Actual result |
| --- | --- |
| Desktop and 390px mobile overflow | None at either width. |
| Primary action and content | “Choose your coffee” visible in the first mobile viewport; three named coffees and required origin/brewing details available. One H1. |
| Desktop disclosure | Expanded true on hover; false after pointer exit. |
| Mobile menu | Opens; Escape closes and returns focus to `menu-toggle`. Target height 45.5px. |
| Coffee filtering | Filter leaves 2 products visible; live status “Showing 2 filter coffees.” |
| Product details | Greenhouse opens in a native modal dialog; close control receives focus. Escape closes and restores focus to the Greenhouse trigger. |
| Reduced motion | Media query matched; navigation transition duration `0s`; document scroll behavior `auto`. |
| Runtime errors / external implementation assets | No page errors; zero external resource loads. |

Actual defect found and fixed during image review: an over-specific paragraph rule made the desktop secondary hero note as prominent as the body text and wrapped it unnecessarily. Corrected the selector specificity, then remeasured **12px** desktop note text and viewed the corrected real screenshot. Mobile retained 11px secondary text. Brief judgment after this fix: the page prioritises the coffee decision, provides a coherent original visual direction and makes its limited concept scope clear. This is a single agent’s qualitative assessment, not a statistically established quality improvement.

## Browser and workflow friction

Actual browser: **Windows HTTPS default Brave**, installed executable `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe`, actual protocol version **155.0.8059.85**, file version 155.1.97.59. Sessions reported isolated temporary profiles, private-pipe control, personalProfileAccess false, bundledBrowserFallback false, globalGpuDisabled false and enabled WebGL. The real GPU report included the NVIDIA RTX 4060 Laptop GPU; this does not prove every site used it for rendering.

Encountered a real startup defect after restarting the SDK client: optional Authenticode inspection could not load the PowerShell security module, and the error exposed a very long encoded command/CLIXML. Reported it to the browser worker. That worker repaired optional-signature handling and bounded error text; restarted the actual client and subsequently opened both references successfully with signatureStatus `unavailable`. This trial exercised the repaired behavior, without claiming a verified signature.

The native command’s transcript output limit initially truncated a screenshot’s base64 before the orchestration code could parse it. Raising that limit and forwarding only the parsed image resolved this bridge-display issue. Large comparison data was filtered in the native process to avoid dumping raw image/observation payloads into the transcript. These retries were not counted as evidence of source quality, and this is not a low-call-efficiency benchmark.

## Cleanup and practical usefulness

Closed the unused Tchibo session before opening the owned implementation, preserving the two-session limit. By final cleanup the Main Coffee Lab reference and its discovery operation had naturally expired; their explicit cleanup calls returned false. The owned implementation close returned true. A subsequent actual `mimicus_list_sources` reported:

```json
{"browser":{"activeSessions":0,"closingSessions":0,"opening":0,"temporaryAnalyses":0,"persistentContent":false},"federation":{"activeOperations":0,"retainedReferences":0,"persistentCatalog":false},"semantic":{"pending":0,"siteVectorsPersisted":false}}
```

Then closed the real SDK bridge client. Original site screenshots were not exported to files; no catalog or site vectors were created by the workflow. Reference URLs in this report are explicit provenance for the requested trial, not an imported website collection.

Mimicus was useful for finding a current specialist reference, viewing actual rendering, identifying a real disclosure selector, distinguishing declaration from sampled behavior, and verifying selected constraints. Broad source discovery, first-reference anchoring, incomplete assets and strict state comparisons still require agent judgment. The concept’s typography, illustration, content order and overall suitability were authored and assessed by the agent; the product did not establish those choices automatically.

Deliverable: `examples/workflow/coffee.html`. No purchase, form submission, copied third-party media, GitHub mutation or release action was performed by this trial agent.
