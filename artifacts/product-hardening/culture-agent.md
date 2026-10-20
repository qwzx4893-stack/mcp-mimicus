# Architecture and culture agent trial

Status: **PARTIAL** for unrestricted real-site fidelity; the original implementation and owned-page task path were verified. This is an actual agent workflow, not a generated transcript or a human preference study.

- Runtime: `0.4.0-beta.1`, final source build with delivery ledger and visible-reference sampling corrections; official SDK stdio through the development loopback bridge, isolated installed Windows-default Brave `155.0.8059.85`.
- Start: `2026-10-20T09:47:52.975Z`; reference comparison/spec before implementation: `09:52:37.066Z`; cleanup: `09:59:20.847Z`. Elapsed **11 min 28 s**, including real source retries, implementation and QA. This trial does not establish the separate twenty-minute requirement.
- Original deliverable: [hardening-culture.html](../../examples/workflow/hardening-culture.html).
- Manual call accounting: 30 Mimicus calls, including one repeated analysis after the development output cap truncated its response, unsuccessful/limited original-reference opens and previews, and three cleanup/status calls. The SDK client was then closed. The count is a manually reconstructed trace, not production telemetry.

## Brief and decisions made before coding

**Rooms for Tomorrow** is an imagined architecture exhibition at **Common Ground**. Visitors need to understand the exhibition, browse dated programs, plan a free visit and read an archive. The first decision is what to see and when. Success is a visible local visit reminder and a clear access/hours path; no real reservation or personal data is sent. Mobile keeps the visit action near the introduction, collapses navigation and preserves reading order.

The plan used chalk `#f8f9f5`, civic blue `#2349da`, ink `#182b32`, courtyard green `#e4ecbe`, and slate `#4a616b`; system Georgia display with Arial body. A two-part exhibition opening pairs readable type with an independently drawn perspective room, followed by a dated program list, practical visit section and expandable essays. Custom semantic HTML is sufficient for this standalone trial. The self-review rejected a generic museum photograph/card wall and ornamental numbered sections: the original room drawing supplies the memorable subject-specific element, while event dates and visit information carry the structure.

## Actual discovery and viewed images

Two fresh lexical searches were made before coding:

1. Astro + Nuxt: `architecture exhibition culture museum`. The current Astro title index exposed Archgyan, but its rendered page is a BIM training service. The software-architecture Netlify result was irrelevant to the exhibition brief. These are retrieval limitations, not suitable design references inferred from a keyword score. Nuxt returned its current collection without a useful museum match.
2. Webflow: `museum architecture`. Live results included Archtober, Memphis Brooks Museum and the Irbit architectural guide. Native labels and original URLs were kept distinct from computed similarity.

The first real batch returned three images in selection order: Archgyan (Astro), Archtober (Webflow), Brooks Museum (Webflow). All were viewed. All were correctly reported partial because essential cross-origin resources were initially unapproved. Subsequent explicit approval of observed static CSS/JS/font origins recovered styled content; tracking and ad origins were not approved. Source gallery thumbnails were never fetched. Approval of an asset origin is not a license to reuse the source artwork.

| Actual original | Observed result / use |
|---|---|
| [Archgyan](https://archgyan.com/) | Readable large serif title, compact fixed navigation, action/reading hierarchy. Font recovery worked. Cumulative request budget and tracking blocks remained visible. A cookie notice appeared. The BIM subject is a weak fit; only type/navigation relationships were considered. |
| [Archtober](https://www.archtober.org/) | First frame unstyled; a later resource-approved batch item failed with `page.waitForTimeout: Target page, context or browser has been closed`. A later interactive open did not produce usable retained output. Not treated as a complete inspected design. |
| [Memphis Brooks Museum](https://www.brooksmuseum.org/) | First frame unstyled; resource-approved initial frame had incomplete hero media. A later comparison frame actually showed the exhibition art and readable split composition, navigation and notice. This is one observed frame, not full-site coverage. |
| [Irbit guide](https://www.oldirbit.ru/) | Initial unstyled frame recovered CSS after explicit static-origin approval, but the styled frame remained almost blank before its reveal and another image CDN was blocked. No hidden animation quality was inferred. |

Original JPEG response hashes (images remained in RAM; none exported):

| Frame | SHA-256 | Original bytes |
|---|---|---:|
| First Archgyan preview | `8364e103e3a7a46c14e4c202078de66af09a6c44a1257df84d35d98f37c71c40` | 36,230 |
| First Archtober preview | `855ba949c1b454fdd5b77036dd3cd768e88e508621b6db76cb3f967324a5ba98` | 33,744 |
| First Brooks preview | `53f278333316271ae976dd001d8fc4200557495864970bee4a872e52e8f6ea60` | 43,776 |
| Comparison Archgyan | `a232eee6c67b9067bf04b1d0dd966e38dcc384207da175d6f862fbfe876acd22` | 59,333 |
| Comparison Brooks, visible artwork | `686d29f328718b6747534c0ecc9b65d78048ed484cdf5fdf69d3311e3a06f6ff` | 108,185 |

Development display resizing is separate from the original MCP JPEG hashes above. Batch responses retained attribution/imageIndex ordering even when an item failed and the following item became image index 0.

## Comparison, selected evidence and implementation

The comparison brief explicitly used priorities **reading / exploration**, sections introduction → program → visit/access → archive, and subtle motion. Actual comparison images were viewed before coding. The tool offered competing per-reference directions, evidence-linked typography/composition/navigation proposals, and marked missing responsive/trigger evidence. It did not rank an aesthetic winner.

- Archgyan header was analyzed at 1280×800 and 390×844 with reduced motion. Analysis `ef11cf87-3f62-4f26-ba97-9ca9393624bd` measured fixed header heights 74/73 px and exposed role-linked responsive facts. Focusing the non-focusable header did not establish an interactive menu state; the report does not claim otherwise.
- Its implementation spec was requested while the analysis/session remained active. The initial development terminal output cap truncated a prior analysis response; repeating with sufficient output capacity recovered a parseable result. This was a test harness output limit, not evidence of server failure.
- A later selected Brooks navigation hover/reset probe, analysis `4f105819-caa2-4b92-a133-f4166c36fdf0`, produced a spec with declared 200 ms color/border transitions. Measured displacement was zero, opacity unchanged, and validation remained **declaration-only**. No unobserved menu animation was copied or claimed verified.
- Original output uses independent content, markup, system fonts, tokens and inline SVG artwork. It combines a readable exhibition introduction with explicit visitor information, not source copy, source art or source code. No remote asset is required.
- Original interactivity: program category filtering with `aria-pressed` and live count, mobile navigation with Escape/focus return, native archive disclosures, and an explicitly local visit-plan reminder.

## Actual QA and intended differences

The original page was opened through Mimicus at **1280×800**, then **390×844 with reduced motion**. Actual images were reviewed for the opening, program, visit form, archive and mobile navigation.

| Check | Observed result |
|---|---|
| Desktop hierarchy | Exhibition name, purpose, visit action and original architectural drawing visible; dates/hours strip follows without covering content. |
| Program filter | Mimicus click on Workshops visibly left one dated workshop and `1 event shown`. |
| Mobile opening | Title and primary action readable; room drawing reflows below; no horizontal overflow. Independent owned-page measurement: viewport width 390, document scrollWidth 390. |
| Menu / keyboard | Mimicus menu click opened links; Escape closed it and the screenshot showed focus returned to Menu. |
| Archive | Mimicus opened the first native disclosure; essay text and open minus indicator were visibly present. |
| Reduced motion | Actual narrow viewport set reduced motion; no autonomous animation is implemented and CSS switches smooth scrolling to immediate. This is not a vestibular user study. |
| Local visit action | Mimicus correctly refused a submit-button click under its non-form safety policy. Secondary QA used **agent-browser CLI**, a separate named isolated session with the installed Brave executable, on the owned loopback page only. Selecting Sunday 25 October and clicking Save produced `Your local plan: Sunday 25 October, 14:00. No booking is needed. This reminder lasts until you leave this page.` No backend, ticket or persistence claim. |
| Assets | Owned DOM measurement found zero external `img[src]`, stylesheet links or script sources. |
| Automated accessibility | An agent-browser axe invocation reported zero checks as well as zero violations. This is **inconclusive**, and is not presented as an accessibility pass. Semantic labels, native disclosures, visible focus and observed keyboard behavior supply narrower evidence only. |

`mimicus_verify_implementation` compared the original header against the selected Archgyan evidence at matching widths and returned **withinMeasuredTolerances: false**, with two reports. This is expected: the original is a 94/78 px **sticky** flex header, a distinct original palette and system fonts; the reference is a 74/73 px **fixed** header. The metric does not invalidate an intentionally different design or establish visual quality. It is useful evidence that original adaptation was not falsely certified as identity.

## Cleanup and limits

The three owned interactive sessions were closed together, each returning `closed: true`. Both discovery operations had already expired under their separate five-minute lifetime, so explicit end calls correctly returned `closed: false`. Final status nevertheless established **activeSessions 0, closingSessions 0, opening 0, temporaryAnalyses 0, activeOperations 0, retainedReferences 0, pendingRankedCandidates 0, pendingSemanticCandidates 0**. The SDK client and secondary agent-browser session were closed.

This trial supplies a fifth distinct cultural/architectural brief with original code and observed task paths. It also demonstrates real friction: source mismatch, bounded rendering delays, essential-origin recovery, failed/partial frames, source cookie notices, declaration-only motion, form safety boundaries and an inconclusive accessibility scanner response. It does not establish complete external-site rendering, human aesthetic superiority, long-duration session reliability, or conversion outcomes.
