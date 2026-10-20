# Littoral: interactive WebGL installation trial

Status: **VERIFIED rendering, drag/keyboard/touch, pause and reduced-motion integration; the initially reproduced canvas-touch guard gap was corrected and retested.**

The original implementation was prepared during earlier interrupted work. This recovery agent read it, performed fresh live discovery and visual selection through the official MCP SDK stdio interface, then completed actual browser verification on candidate `0.4.0-beta.1`. These are recorded recovery calls, not reconstructed earlier implementation activity or a claim that the existing code was first generated after these captures.

Implementation: [hardening-immersive.html](../../examples/workflow/hardening-immersive.html).

## Brief and original work

Littoral is a fictional public light-and-tide installation. Visitors should manipulate a water study, switch light and swell, adjust tide height, pause movement, and read field notes. An independently written WebGL2 mesh and shaders draw the water. All copy, markup, controls and artwork are original; there are no source-site models, textures, screenshots or external runtime assets.

The existing pale blue paper `#e8edf3`, navy ink `#172d44`, mint water and rounded scene corner were retained after inspection. The artwork is an embedded scene beside readable exhibition content rather than a full-screen developer control panel. Native buttons, a range control, an accessible canvas slider, story and field notes provide an alternate route to scene interaction. The animation uses one requestAnimationFrame loop, bounded device-pixel ratio, and stops for pause, reduced motion and document hiding. No CPU `readPixels` loop or fabricated shader reconstruction is present.

## Fresh discovery and actual previews

Search completed at **2026-10-20 09:52:48 UTC**: Codrops and Three.js Resources; lexical query `water ocean immersive interactive WebGL`, eight returned candidates. Provider coverage remained partial rather than being presented as a complete catalog.

Two selected references were both actually attributed to **Codrops**, despite the query including two providers. This report does not relabel them as Three.js results:

| Original | Reference ID | Actual preview |
|---|---|---|
| [Raging Sea](https://ragingsea-experience.netlify.app/) | `f1779a9ee4e66fd30a1ffa2c` | Visible animated water scene and developer controls; captured, no blocked resources/errors |
| [Hologram Shader](https://hologram-shader-thibautlfr.netlify.app/) | `3c70e46017c15e38ca0c5fc5` | Visible shaded objects and small controls; captured, no blocked resources/errors |

The batch returned two ordered MCP images, which the agent viewed before selecting deeper analysis. Original JPEG hashes:

| Index | Bytes | SHA-256 |
|---|---:|---|
| 0, Raging Sea | 36,608 | `6f97e78cf317e4c0bf6856eb59d5d9b6b00b1f9c5f4d2e74322e8c684455f51c` |
| 1, Hologram Shader | 23,245 | `002a61ba521bae04c213bc7fc52ea7fd552fa6511819846ca3d1a5598c6a7256` |

Both references opened at 1280×800 in isolated installed Brave sessions. Diagnostics observed WebGL2 with the installed NVIDIA/ANGLE renderer. No global GPU-disabling or bundled-browser fallback was used. Source images remained only in RAM; hashes and independent measurements are retained here.

## Measured guidance and honest limits

An attempted controlled drag analysis on Raging Sea's plain canvas was correctly refused: **`Drag requires safe slider/draggable`**. The agent kept that restriction, used a non-destructive pointer observation, and obtained a selected time analysis at 1280×800 and 390×844 instead.

Analysis `ee00b519-2954-4ebb-95cd-94429fa0b585` produced both a fixed-composition component and canvas-surface component. The agent fetched both specs, selecting canvas component `238b6497a9fd846244dd93156467` for verification. These observations measure a visible surface and responsive placement; they do not recover source shaders, hidden scene graphs or exact interaction intent.

The two-reference comparison received the Littoral audience, primary action, content sections, expressive motion and `exploration`/`reading` priorities. It suggested a reversible scene entry with an accessible reading route, with missing typography and trigger/reset evidence clearly listed. The agent retained the original quiet installation framing rather than copying the references' developer panels.

Verification against the selected canvas surface returned **`withinMeasuredTolerances: false`** at both widths: the reference canvas was `position: fixed; top: 0px`; the original is a static embedded canvas. This is a useful reported difference, not a failed claim of copying the whole scene. Shader quality, visual equivalence and frame rate are not established by this structural comparison.

## Actual owned-page interaction checks

| Check | Observed result |
|---|---|
| Desktop 1280×800 | Actual image viewed; original water mesh visible, no browser errors |
| Canvas focus + arrow key | ArrowRight issued; subsequent drag state observed; a later explicit ArrowLeft changed displayed bearing 183° → 171° |
| Safe canvas drag | Eight-step drag from relative x=.3 to .65 changed the original scene and bearing to 183° |
| Pause | Button changed to Resume the tide; two timestamped canvas MCP frames were byte-identical |
| Light | Blue hour changed the visible water from green to violet; touch on Morning later changed it back to green |
| Swell | Selected the Swell native button; active visual state observed |
| Tide keyboard control | Focused range + ArrowRight; displayed height changed 45 cm → 46 cm |
| Mobile 390×844 with reduced motion | Actual image viewed; Motion reduced state, original scene and all controls remain accessible |
| Reduced-motion stability | Two timestamped canvas frames were byte-identical; later arrow input still changed the scene |
| Mobile 320×800 | Actual image viewed; document scroll width exactly 320px; controls and story fit, no horizontal overflow |
| Field notes | Expanded the native details section; readable instructions and pause/reduced-motion explanation viewed |
| Motion restored | Reduced motion disabled, explicit Resume clicked; two canvas-frame hashes differed while the scene visibly moved |
| Touch on native light button | Worked through the real MCP touch action |
| Touch on canvas slider, initial build | Rejected by the click/touch safety predicate despite safe slider semantics; reported for a narrow runtime correction |

Frame evidence uses ordinary returned MCP screenshot content, not a claimed shader-internal observation:

| Condition | Frame completion offsets | Original image SHA-256 |
|---|---|---|
| Explicitly paused desktop | 99.824ms / 475.623ms | Both `e8ce57326c8d131284be356b3d9923970567b2294794b3965c64d29f5197cd18` |
| Reduced motion, mobile | 114.084ms / 500.022ms | Both `451be64b0985ab1acda0986e2eb2719dc5e72bbda0a8f8fd4c09818cfe70ad63` |
| Resumed desktop | 107.191ms / 511.587ms | `1ede277851467967cbfbaafebf14f7c547fb013dfca9890123097a28f4fba4f4` / `281ba17daad864df3785129c153f11835b0eade9caeed724d188f5beb71c5ae1` |

This bounded sample demonstrates visible change or stability during those intervals. It is not an FPS, sustained performance, full accessibility or physical-device touch benchmark.

## Cost and cleanup

- Initial recovery: **39 actual MCP calls**, including two safety-error responses, cleanup and status; **09:52:48.986–09:59:39.705 UTC**, **410.719 seconds**. This excludes earlier implementation time and any follow-up below.
- Maximum three simultaneous owned sessions: two source references and the original implementation. Before cleanup their cumulative successful image counters were 3, 2 and 24 respectively; preview sessions were already closed.
- All three closed in one bounded session cleanup. The five-minute discovery operation had naturally expired; end-discovery honestly returned `closed: false`. This did not invalidate already selected open-session analyses. Final status independently showed **0 active/closing/opening sessions**, **0 analyses**, **0 operations**, **0 retained references**. The stdio client then closed.
- One agent continuation and one fictional installation; no matched control, blind aesthetic judge, statistical improvement, GPU fallback failure test or screen-reader session is claimed.

## Canvas-touch follow-up

After the runtime owner added a narrow canvas-slider exception requiring an explicit slider role, keyboard focusability and finite valid ARIA bounds/value, this agent opened a **fresh stdio client** on the recompiled candidate. The initial error above remains part of the evidence rather than being erased.

At **10:01:47 UTC**, the original installation opened at 390×844 with reduced motion, showing bearing **26°**. At **10:01:52 UTC**, the real MCP `touch` action on `#sea` succeeded; the returned image showed bearing **44°** and the visibly rotated water surface while Motion reduced remained enabled. Diagnostics contained no errors. The session then closed and the independent status call showed all session, analysis and operation counts zero. The client closed at 10:02:06 UTC.

This follow-up used **4 additional MCP tool calls** (open, touch, close, status), bringing this trial's recorded total to **43**. The elapsed completion-to-completion interval for these four calls was **14.758 seconds**; it is separate from the initial recovery interval. The runtime owner's negative-control tests for unsafe surfaces are documented in the shared regression suite, not inferred from this one positive browser retest.
