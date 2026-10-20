# Offset Practice: editorial agency trial

Status: **VERIFIED integration and responsive interaction checks; limited design-quality evidence.**

This is an actual coding-agent workflow continuation through the official MCP SDK stdio interface, using candidate `0.4.0-beta.1`, installed default Brave, and isolated temporary profiles. The original HTML and original SVG project illustrations had already been prepared during interrupted work. This recovery agent inspected that implementation, selected fresh live references, and completed the checks below. It does **not** claim the existing implementation was newly generated after these preview timestamps, or reconstruct unrecorded earlier calls.

Implementation: [hardening-agency.html](../../examples/workflow/hardening-agency.html).

## Brief and original direction

Offset Practice is a fictional independent creative agency. Cultural founders should understand the practice, inspect two original project concepts, and choose a project interest in a local demonstration contact dialog. No message, purchase, form submission, account, or external asset is involved.

The existing composition uses a pale grey-green ground `#e9eae5`, dark green ink `#20241f`, a red-orange project action `#e64722`, original violet/yellow identity artwork and blue architectural geometry. Arial/Helvetica and a staggered heading keep the work primary. The desktop work pair becomes one column on mobile. This was kept after visual inspection; the reference sites did not justify replacing the legible project route with a full-screen animated scene.

## Fresh discovery and visual selection

Search completed at **2026-10-20 09:48:21 UTC**: Astro and Nuxt, lexical query `creative agency editorial independent design studio`, eight returned candidates. No browser launched during the search.

The first selected preview batch returned actual ordered MCP images for:

| Original | Source attribution | Observed result | Decision |
|---|---|---|---|
| [Dardo](https://dardo.studio/) | Astro Showcase; reference `4569813fd2816b171afd888f` | Captured hero, readable navigation and oversized serif typography | Selected for hierarchy and navigation comparison |
| [Blinkpath](https://www.blinkpath.com/) | Astro Showcase; `de8a1dbf18c61da632324243` | Visible loading overlay; original image resources blocked | Excluded from underlying-page design judgments |

A second batch tried [0No Co.](https://0no.co/) (`ea70ac0d90e74ea5ca6aeab1`, Astro) and explicitly permitted Blinkpath's observed public image origin `images.prismic.io`. Blinkpath still displayed its loader and remained **partial-render**. 0No Co.'s actual hero was visible and useful, while an unapproved Cloudflare analytics script kept its result labeled **partial-render**. Analytics was not enabled to obtain a more favorable status.

Original preview-image evidence, retained as hashes rather than site images:

| Selection | Original JPEG bytes | SHA-256 |
|---|---:|---|
| Dardo, first batch index 0 | 17,263 | `990295a1fb1693a46e8902bc691e1cef76fe5d12d213d8d29a6b1d7f029e839a` |
| Blinkpath, first batch index 1 | 5,528 | `78a4385045b5c44dd18507252eb276f20be15dafa63c232ff7e6c8383f302dfa` |
| 0No Co., second batch index 0 | 33,035 | `ea8db3b98b6d58492aa4bcacf62b9250c9c26f9cc9d9b01f2e88e6e371f2dfd5` |
| Blinkpath, second batch index 1 | 5,524 | `4ef6266a919f16f78d3e65749107e321c524a4b1c118054cabb183c02cde664a` |

The agent viewed these MCP images in their attributed order. Development display resizing did not alter the original image hashes. Source frames stayed in RAM and were not written to the repository.

## Selected analysis, comparison and implementation verification

Dardo and 0No Co. were opened simultaneously at 1280×800. The agent explored Dardo's semantic controls, clicked its actual menu, analyzed only its `h1` at 1280×800 and 390×844, and fetched the resulting implementation spec. Analysis ID: `4af67b9c-2482-451f-b44d-54dc295ce386`; selected component `6c6f269df52725c2b13f10d554df`.

`mimicus_compare_references` received an agency-specific brief with `reading` and `conversion` priorities, original sections and audience. It returned competing measured composition directions and missing-evidence notes. The agent judged the large headline and explicit work/contact route useful. It did not treat the guidance as a calibrated aesthetic ranking, copy a proprietary font, or copy either site's visual assets.

`mimicus_verify_implementation` reobserved the original agency heading against the selected reference at both widths. It correctly returned **`withinMeasuredTolerances: false`**:

| Constraint | Dardo reference | Original implementation |
|---|---:|---:|
| Desktop heading font size | 143.36px | 111.36px |
| Mobile heading font size | 76.0868px | 72px |
| Desktop font weight | 320 | 500 |
| Desktop line height | 130.458px | 104.678px |

The different typeface, spacing, weight, colors and content are deliberate original design choices. A successful measurement comparison is not a claim of visual identity or of winning the brief.

## Actual browser checks

| Check | Actual result |
|---|---|
| 1280×800 desktop image | Viewed; two original project artworks, clear hierarchy and project action |
| 390×844 mobile, reduced motion | Viewed; readable staggered heading, single-column work, visible project action; document width 390px |
| Mobile menu | Opened; actual menu image viewed; Escape closed it and returned focus via the implementation's handler |
| Tab navigation | Dispatched through MCP; no page error; visible focus styles exist |
| Digital project filter | Clicked; actual image showed only Open Assembly, with active filter state |
| Project detail | Opened the visible original project; Escape dismissed the native dialog |
| Project inquiry | Opened; selected Digital; viewed dialog with local choice feedback and explicit no-send copy |
| Dialog dismissal | Escape closed the contact dialog |
| Browser errors | Empty diagnostics on these owned-page interactions |

The MCP key schema supports Tab, Escape and arrow keys; Enter/Space activation and a screen-reader session were not separately exercised. Native button/dialog semantics and source inspection complement these limited checks. This is not an exhaustive accessibility audit.

## Cost, cleanup and limits

- **26 actual MCP tool calls**, including cleanup/status calls; no MCP errors. The four preview results include the honest partial renders above.
- Recorded completion interval: **09:48:21.221–09:52:40.766 UTC**, **259.545 seconds**. This is the recovery discovery/QA interval, not the earlier implementation time or a controlled design budget.
- Maximum three simultaneous owned sessions: two references plus the original implementation. All three closed through one bounded cleanup call.
- Final status: active/closing/opening sessions **0/0/0**, temporary analyses **0**, discovery operations **0**, retained references **0**. The stdio client was then closed.
- One agent continuation and one fictional brief; no blind judge, matched control, aesthetic ground truth, or statistical design-quality improvement is claimed here.
