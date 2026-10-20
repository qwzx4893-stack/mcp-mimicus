# Relay: unassisted SaaS control

Implementation: `examples/workflow/hardening-saas-control.html`.

This control used the parent's matched Relay brief, required palette, system
font, original assets and 15-minute budget. It used no external design
references, Mimicus discovery, source previews, comparison or design brief.
The assisted implementation and its reference notes were not read. General
frontend-design and UI/UX instructions were used. Production Mimicus was used
only to test the authored local page, as allowed for both conditions.

## Timing and input

- Start: 2026-10-19 19:57:14 UTC.
- Initial implementation written: 19:59:14 UTC.
- Design, implementation, repair and browser QA finished: 20:05:28 UTC.
- Elapsed: 8 minutes 14 seconds; no waiting to fill the 15-minute allowance.
- QA: 29 actual MCP tool calls, plus one bridge-client close request.
- Model token usage was unavailable. Retrieval implementation work happened in
  this agent before the control and was not a source of design references.

The independent control design uses a left-aligned statement and a readable
interactive decision log as the main product demonstration. White, slate
`#243348` and cobalt `#365df5` follow the brief. There are no external fonts,
images, libraries, customer logos, network account requests or payment requests.
The small overlapping-frame brand mark and feature icons are original SVG.

## Required behavior

- Hero and repeated CTA open a native dialog. The demo action shows an explicit
  local workspace-ready status; it creates no account and sends no data.
- Three decision categories, Product / Design / Engineering, each contain two
  readable decisions. Choosing a category or decision updates the detail pane.
- Two plans have Monthly / Annual billing controls. Actual rendered prices
  change from $10 / $20 to $8 / $16, with $96 / $192 annual totals and an accurate
  20% reduction. These are clearly marked illustrative prices.
- Four FAQ disclosures use native `<details>` / `<summary>` elements.
- Mobile navigation exposes its expanded state, closes on selection or Escape,
  and restores focus to its menu button. Dialog Escape restores CTA focus.
- Focus indicators, a skip link, native controls, live decision/status text and
  reduced-motion styles are included.

## Actual browser QA and correction

All QA used an official SDK stdio client through the owned workflow bridge and
the production browser. The actual browser was the installed Windows default
Brave, Chromium 155.0.8059.85, in an owned headless temporary profile. It did not
attach to a personal browser or open external reference sites.

Images were actually viewed at 1440 × 1000 desktop and 390 × 844 mobile:
desktop hero/product, category detail, annual plans, mobile hero/product,
Escape focus restoration, FAQ, Tab focus and the repaired keyboard progression.
There was no horizontal overflow: measured document widths were exactly 1440
and 390 respectively. Browser diagnostics reported no script errors or blocked
resource requests for the local page. These are observed cases, not a complete
accessibility or browser-compatibility audit.

A real defect was reproduced: selecting the second decision rebuilt the list,
so the next Tab jumped backward to the first decision. A delegated click handler
now restores focus to the selected row after the detail refresh. After an actual
reload and repeated second-row click, Tab advanced to the next control, Monthly
billing, with a visible focus outline. The repair used no assisted-page input.

The Design and Engineering filters, second decision selection, annual pricing,
trial dialog, local trial completion, mobile menu, Escape and FAQ disclosure
were actually exercised. Tab traversal and visible focus were observed. The
tool's keyboard allowlist did not expose Enter or Space, so keyboard activation
of native FAQ summaries was not independently executed; native semantics alone
are not claimed as a runtime test.

Reduced motion was enabled in the actual browser. A three-frame CTA hover
sequence was returned as real MCP images and viewed. It showed an immediate
color state change and stable subsequent frames, with no motion between the
last two samples. Source image hashes (no screenshots persisted):

1. `25b1c10a2fd3dfc4613c48fc2adbd260b83a542dd2301d8b2296c8355ef813cb`
2. `4208f17529adc0f7efc5f055abc062f53a9c118938b0ccb58ec0dce46c1b51bf`
3. `4208f17529adc0f7efc5f055abc062f53a9c118938b0ccb58ec0dce46c1b51bf`

The control session was explicitly closed, then status confirmed zero active,
closing or opening sessions, zero analyses, zero discovery operations,
references and queues. MiniLM was never loaded by this control client. The
isolated control SDK client was then closed. No third-party media was exported.

## Comparison limits

This is one independently authored control under a matched brief and budget.
No self-assigned aesthetic score or improvement claim is made. The parent's
separate reviewer should compare opaque renderings and required behaviors. A
reviewer who sees filenames, condition-specific copy or reports cannot be
described as fully blind. Different actual completion times are recorded, and
the 15-minute cap is not a claim of identical effort or statistical control.
