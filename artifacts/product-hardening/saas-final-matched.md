# Relay assisted evaluation — fresh matched trial

- UTC start: **2026-10-20 14:57:15** (first tool).
- Hard deadline: **2026-10-20 15:12:15**. Maximum 15 minutes, no artificial wait.
- End UTC and actual elapsed time are recorded below after report writing.
- Condition: fresh assisted implementation using the actual Mimicus SDK bridge, unique client `saas-final-matched`.
- Scope: replaced `examples/workflow/hardening-saas.html` without reading its prior contents. No other SaaS HTML, control, failed-trial, or evaluation reports were read. Only this HTML and this report were written; no runtime, package, build, or git changes.

## Brief and original design

Relay is a fictional async decision log for small distributed product teams replacing decisions scattered through chat. The main action is a clearly labeled local 14-day trial preview, with no account, email collection, payment, subscription, or timer. Hero, working product decision log, three features, two pricing plans, and FAQ are present.

Original markup, system-ui typography, CSS and inline SVG use white #fff, slate #243348, and cobalt #365df5, with subordinate tints and a status green. The desktop composition uses a left-aligned promise beside one concrete decision; mobile preserves reading order and places the primary action before the example. A filterable sample log demonstrates context, ownership, next steps, and status rather than inventing testimonials or traction.

## Actual reference work before implementation

Fresh `mimicus_search` queried “saas collaboration product” across Webflow and Astro. The operation returned four candidates from eight bounded source records, used hybrid retrieval, reported partial coverage, and made 15 metadata HTTP requests. Similarity scores were not treated as aesthetic judgments.

The actual `mimicus_preview_references` response supplied **two ordered images, both viewed before any HTML was written**:

1. PulseAhead — https://www.pulseahead.com/ — source: current official Astro showcase. Styled but partial: external fonts, telemetry and some media were blocked. Its clear purpose, two-action hierarchy and restrained page rhythm informed reading/conversion choices.
2. Tasker — https://tasker-task-management.webflow.io/ — source: current Made in Webflow. Initial image was unstyled because the stylesheet CDN was blocked. After an explicit selected interactive open allowing its required Webflow/CDN resource origins, a second styled image was viewed. Its spacious primary action placement was considered; its gradients, badges, copy and artwork were not reproduced. Fonts/Cloudflare remained blocked, and the page was not claimed fully rendered.

Both selected sites were opened in isolated live sessions. `mimicus_compare_references` was called with the Relay brief, required five sections, and **conversion + reading** priorities. Its successful result recommended clear primary action, stable visual states, keyboard/menu verification, original content, and explicit measurement boundaries. The agent selected the final composition; the tool did not establish an aesthetic winner.

## Selected interaction and implementation specification

A navigation click analysis first failed because the desktop navigation control became hidden at the selected mobile width. This is recorded as a failed probe, not evidence.

The successful selected interaction was PulseAhead’s primary signup action `main a[href*='signup']`, measured with **focus** at 1440×900 and 390×844, with reduced motion. Analysis ID: `df52da11-3193-40eb-bd08-5d960c56b971`; component: `392a1dd99dc93bd2906329239356`. `mimicus_get_implementation_spec` was retrieved from that actual analysis.

Measured facts: source action 180×40, 14px label, 6px radius, centered flex contents, 8px gap, focusable and labeled, stable position and opacity across sampled focus states. A 150ms CSS transition declaration existed; the evidence did not prove hidden implementation, full hover behavior, or focus reset. Relay adopts stable focus geometry and a clear primary action, adds a visible focus ring, uses its required palette and original copy, and deliberately increases touch height to 48px.

## Actual QA and fixes

Mimicus opened the local target at **http://127.0.0.1:45812/hardening-saas.html**. Its actual desktop **1440×900** screenshot and mobile **390×844** reduced-motion screenshot were viewed. The static server root was initially misunderstood; three earlier target opens returned HTTP 404. No fallback was represented as successful SDK evidence.

Separately labeled isolated Playwright QA used a fresh private Brave browser/context, independent of Mimicus reference sessions. Three runs:
- First full run: **27/28** checks passed. It found a real dialog-close timing bug: focus returned to the trial opener after the sample-workspace action focused its category filter.
- Focus repair: moved the sample-workspace handoff into the dialog close handler. A targeted rerun confirmed the Product filter receives focus. Also added a visible mobile-menu fallback when a trial opener has become hidden.
- Final full run: **32/32** checks passed.

Final checks covered required sections and a single h1; desktop/mobile overflow; keyboard trial activation, modal Tab containment, Escape closure and focus return; sample-workspace focus handoff; Product/Design/Engineering filtering and keyboard activation; Annual/Monthly pressed state, prices and annual totals; native FAQ Enter/Space expansion; mobile menu initial/open/Tab/Escape/focus behavior; mobile trial hidden-trigger recovery; anchor navigation closing the menu; correct Team preview; reduced-motion scroll/transition styles; no overflow at 320, 390, 768 and 1440 widths; **zero runtime errors** and **zero external requests** from the implementation.

Own-page screenshots of mobile hero, pricing, product log and expanded FAQ, plus desktop hero and product log, were viewed. One early product capture occurred while prior scrolling had not settled and appeared largely blank; a fresh reduced-motion run with explicit instant scroll and animation-frame settling showed the full product normally. No visual completeness claim relies on that defective capture. Third-party screenshots were never exported; own-page QA images were also returned in memory and no screenshot files were retained.

## SDK verification result and honest limits

`mimicus_verify_implementation` compared Relay `#hero-trial` against the selected source analysis at both matching viewports. It reported **withinMeasuredTolerances: false**, with intended dimension differences:
- Desktop source 180×40 vs Relay approximately 158×48.
- Mobile source 180×40 vs Relay 168×48.

The focus sequence remained stable. The changed widths follow original copy/layout; increased height supports touch. Color, font, section composition and copy intentionally differ. This is an original design informed by selected relationships, **not a pixel match or an automatic aesthetic pass**. Verification covered a selected primary action, not every page component. The QA was an actual browser functional/visual pass, not a formal screen-reader or full accessibility audit.

## Costs, failures and cleanup

**22 local bridge requests** including schema listing, failed attempts, reference/target work, verification and cleanup. One fresh search operation; two preview frames before coding; two interactive reference sessions; one successful target session. Three comparison requests were needed: two native-output processing attempts truncated, and the final larger bounded response was parsed successfully. No running output chunks were discarded. Other tooling failures: unavailable `btoa` in the orchestration runtime (before a bridge request); one invalid initial bridge argument shape; the failed navigation probe; three target 404s; one non-escalated agent-browser snapshot denied socket-directory access. Agent-browser’s owned session was subsequently closed; the final functional evidence comes from the explicitly separate Playwright runs.

Both reference sessions and the target session were explicitly closed and released successfully. Discovery had already expired: `mimicus_end_discovery` returned closed:false, then `mimicus_list_sources` independently confirmed:
- active discovery operations **0**
- retained references **0**
- pending ranked/semantic candidates **0**
- active/opening/closing browser sessions **0**
- temporary analyses **0**
- persistent catalog/content **false**
- site vectors persisted **false**

All separate Playwright browsers and contexts closed in their runs. No third-party HTML/media/export, auth token, runtime build, dependency change, or QA script was retained.

Completed UTC: **2026-10-20 15:09:12**. Actual elapsed: **717.2 seconds (11.95 minutes)**; within the 15-minute budget.
