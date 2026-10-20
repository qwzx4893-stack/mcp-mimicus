# Relay opaque A/B review — frozen before unmasking

Reviewed 2026-10-20 through the rendered local URLs only: `http://127.0.0.1:45812/review-a.local.html` and `http://127.0.0.1:45812/review-b.local.html`. The reviewer did not inspect implementation source, other reports, or condition mapping. Scores were sent to the coordinating agent before mapping was disclosed. This file records the blind result; no condition is inferred.

The supplied brief was identical: Relay, an async decision log for small distributed product teams; local 14-day trial; hero, log, features, two monthly/annual plans, FAQ; three category filters; mobile navigation with Escape/focus behavior; reduced motion; system UI typography and white/slate/cobalt styling with original CSS/SVG. Both were described as receiving the same 15-minute design budget. That production budget and source originality were not independently audited.

## Frozen scores

Scale: 0 absent/unusable, 1 major gaps, 2 partial, 3 solid with a noticeable limitation, 4 fully meets the inspected criterion. These are one reviewer's descriptive judgments, not statistical measurements.

| Criterion | A | B | Rendered evidence |
|---|---:|---:|---|
| Brief completion | 4 | 4 | Both show the requested sections, three categories, trial preview, two plans, annual control and FAQ. Source-only requirements remain outside this review. |
| Hierarchy | 3 | 4 | A introduces a static decision card, a bridging statement, then a second product introduction before the interactive log. B has a more direct headline → trial → working log progression. A's immediate example is useful, but its repeated introduction lengthens the path. |
| Coherence | 4 | 4 | Both consistently use slate text, cobalt actions, restrained borders and white/pale backgrounds. Typography, icons and section spacing feel internally consistent. |
| Mobile use | 3 | 4 | Both fit 390px and stack controls/cards readably. B brings the working category log into the initial mobile viewport; A first shows a separate static example. A's long FAQ labels nearly touch their disclosure symbols; B reserves clearer space. No horizontal clipping was observed in the inspected frames. |
| Observed behavior | 4 | 4 | Both pass the equal trial/Escape/focus, Design filter, monthly/annual price update, FAQ, and mobile menu/Escape/focus checks. |
| Clarity | 4 | 4 | Both explain retaining decisions and reasoning for asynchronous teams. Trial dialogs disclose the local demonstration. Prices identify billing units and annual charges. A supplies more prominent fictional-product disclosures. |
| **Total / 24** | **22** | **24** | **Slight visual/reading preference for B in this inspection.** |

The total summarizes the rubric only. It does not establish that any assistance caused a difference, nor predict conversion, accessibility conformance, or production quality.

## Matched observations

Actual screenshots were inspected at desktop **1440 × 900** and mobile **390 × 844**. Both received the same sequence of fourteen interactions: open the header trial dialog; Escape; select Design; select Monthly; select Annual; expand first FAQ; resize to mobile with reduced motion enabled; scroll to top; open Menu; Escape; scroll 650px; toggle first FAQ; select Design again; reopen first FAQ. Initial screenshots and semantic exploration were also performed equally.

| Check | A | B |
|---|---|---|
| Trial dialog | Opens with local sample-workspace explanation. Escape closes it and visible focus returns to the header trial button. | Opens with local demonstration explanation. Escape closes it and visible focus returns to the header trial button. |
| Design | Shows one Design decision with category, status, owner and explanation. | Shows two Design entries and the selected decision's reading pane. |
| Annual | Starter $15 → $12/workspace/month, billed $144 annually; Team $35 → $28, billed $336 annually. | Team $10 → $8/member/month, billed $96 annually; Studio $20 → $16, billed $192 annually. |
| First FAQ | Opens a readable explanation of the local trial. | Opens a readable explanation of how Relay complements chat. |
| Mobile Menu | Opens a legible link list and trial CTA. Escape closes it and visibly focuses Menu. | Opens a legible link list and trial CTA. Escape closes it and visibly focuses Menu. |
| Mobile product / pricing / FAQ | Readable stacked log and pricing; long FAQ labels crowd disclosure glyphs. | Readable stacked list/detail log and pricing; FAQ spacing remains clear. |

Reduced-motion mode was enabled for both mobile observations. Controls remained usable and content was visible. The inspection did not measure animation timelines or prove the absence of all motion. Keyboard evidence covers Escape and visible restored focus, not a complete keyboard or assistive-technology audit. Trial submission, purchase, account creation and backend behavior were outside scope.

## Resource accounting and limits

- Two owned temporary browser sessions; both explicitly closed, then the `final-blind-review` SDK client closed.
- Thirty actual screenshots inspected in RAM, fifteen per variant; no screenshot files persisted. No third-party imagery was requested.
- Twenty-eight interaction calls, fourteen per variant; two open calls and two semantic exploration calls. Thus 32 substantive review calls, followed by one batch session-close call and one client-close request.
- One initial schema-list request used the default root client before the helper's client field was inspected; it opened no browser. The coordinator was notified and retains responsibility for that existing shared client. All substantive review and owned cleanup calls used `final-blind-review`.
- No browser/session API errors or blocked resources were returned during the review. An initial JavaScript base64-helper attempt failed before any request; a helper-file search glob failed and was corrected. Neither affected page state or the matched sequence.
- Only rendered alias pages and permitted tool helper/skill instructions were read. No source edits, runtime/build execution, publishing or pushing were performed by this reviewer.

Scores remain frozen independently of any later condition mapping.
