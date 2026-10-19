# Immersive coding-agent trial: Tidal Instrument

Trial date: 2026-10-19 UTC. Agent: `immersive-release-agent`. Original implementation: `examples/workflow/immersive.html`. This report records an actual official SDK client / Mimicus server workflow, not a simulated transcript or a fixture standing in for a live source.

## Brief and design decision

Build a quiet digital gallery exhibit for curious phone and laptop visitors. The primary action is to turn a luminous object with drag or arrow keys, then hold a moment. The exhibit must remain useful with motion reduced. The success criterion is an understandable, readable, directly controllable sculpture, with no account, sound, external assets or source artwork required. Recovery is a camera-centering control and a still fallback when WebGL2 is unavailable.

Before implementation, the actual Galaxy Configurator image showed an expressive particle sculpture occupying almost the whole screen, with dense developer controls in a corner. The second original, Dreamfold, exposed a key-onboarding screen instead of its city. This made two useful decisions concrete: keep the principal visual immediate, and make the exhibit work without a credential or external tile service. Use a contained stage and a small group of named controls rather than a parameter inspector. The later Interlude inspection supplied a second fully accessible visual reference and a contrasting case: strong typographic navigation and transition choices would be unnecessary friction for this single-object exhibit.

The original visual direction is a tidal ring, not a galaxy, city or transition catalogue. Tokens are deep sea `#081c2b`, pale ink `#eff5f8`, muted blue `#a7bdc9`, sea light `#72ddd0`, and a restrained peach component inside the point shader. Georgia supplies a quiet exhibit title; Arial supplies legible control copy. The layout reads title → interactive stage → accessible controls, with mobile controls below the stage. A self-authored 24,000-point WebGL2 surface uses simple trigonometry, perspective and additive light. No original source shaders, JavaScript, images, logos or branding were downloaded or copied.

## Actual discovery and reference viewing

Fresh live search at `2026-10-19T11:07:47Z` queried Codrops, mesh3d and the official Three.js Resources source for `interactive 3d particles`. It reported ten guarded metadata HTTP requests, partial coverage, source-native labels and separate opaque Three.js directory taxonomy. Mesh continuation was explicitly limited by the robots-disallowed infinite-scroll API; it was not bypassed. Bounded ranking selected candidates from current pages, not a persistent corpus.

| Original reference | Actual observation and disposition |
| --- | --- |
| [Galaxy Configurator](https://galaxy-configurator.netlify.app/) by Thibaut Lefrançois, discovered through Codrops Creative Hub | Actual MCP image at `11:08:07.744Z` showed the bright three-armed particle galaxy and visible controls. All three recorded requests succeeded, with no blocked resources. Used as the visual/interaction anchor. Native labels were `glsl`, `particles`, `Three.js`; they were not invented mood labels. |
| [Dreamfold](https://cityfold.vercel.app/) by David Ronai, Codrops Creative Hub | Actual MCP image at `11:08:53.358Z` showed a centered “First, get a free key” dialog, explanatory copy and blurred background. Its city was **not** rendered or assessed. No key was obtained, no authentication was bypassed, and no city-quality claim is made. Rejected as a dependency model for this exhibit. |
| [Interlude](https://interlude.crnacura.workers.dev/), official Codrops organization repository homepage | Independently fresh repository search at `11:16:38.860Z`, then `mimicus_get_reference`, returned actual MIT metadata and repository revision timestamp. Actual MCP image at `11:17:09.847Z` showed the white typographic transition index, large words and simple top navigation. Ten requests, no blocked resources/errors. Used as a post-build contrast, not falsely described as a second immersive scene. |
| [Volatile Nexus](https://dasprinzip.com/tinker/day42) | Opening failed with `Metadata response exceeds byte bound`. No visual judgment made. |
| [ASCII Logo](https://tympanus.net/Tutorials/ASCIILogo) | Opening failed HTTP 403. No retries that bypassed access controls, no visual judgment made. |

Two fully accessible original references and a third, visibly key-gated original were inspected as actual image blocks. Only Galaxy was verified here as a fully rendered 3D scene. This trial does not claim two fully accessible independent 3D scenes.

## Brief synthesis and targeted measurements

`mimicus_compare_references` was called on the two initially open original references with the gallery brief. Its large response exceeded the chosen transcript output allowance; it was not used to invent hidden measurements. A later comparison of Galaxy and the original exhibit returned readable `designBrief` guidance: keep the principal visual interruptible, preserve readable content, provide reduced motion and keyboard/touch alternatives, and adapt structural relationships without copying source material. Computed CSS palette describes DOM chrome; it did not describe Galaxy's shader colors. Both compared views reported zero active DOM animation effects, which is not evidence that WebGL content is static.

Targeted Galaxy canvas observation used pointer input at 1280×800 and 390×844. `mimicus_get_implementation_spec` returned a real `canvas-surface` component and measured fixed positioning, `touch-action: none`, no accessible canvas label, and no keyboard focusability. An initial drag-analysis request was rejected because the source canvas did not declare a verified slider/draggable affordance; the pointer probe succeeded. No source camera physics or shader was recovered.

The original running client exposed an important negative result: Galaxy's low-resolution canvas readback returned tiny constant luminance and zero differences despite a visibly rendered galaxy. The trial reported this to the runtime owner rather than treating it as a static scene. The parent subsequently changed near-empty WebGL readbacks to inconclusive with a compositor/readback limitation. This report preserves the observed old result; it does not pretend the original client had the new behavior.

The final original canvas was measured separately at desktop and mobile widths under reduced motion. It had `role=img`, a label and keyboard focusability. Its readable probe reported luminance about `16.6982`, five stable samples, and `changed: false`, consistent with the actual still state. This is bounded pixel evidence, not reconstructed geometry.

## Actual implementation QA and corrections

Actual desktop and mobile MCP images were inspected; third-party screenshots stayed in RAM and were not exported. Original-page checks used `http://127.0.0.1:45812/immersive.html`, an explicitly authorized owned development origin.

| Check | Observed result |
| --- | --- |
| Desktop 1280×800 | Title, stage and controls visible. Initial sculpture was too small relative to its stage; changed original shader projection scale only on wide stages, then reloaded and viewed the result. |
| Mobile 390×844 | Readable wrapped title, entire sculpture, orientation and formation/pause controls. The final artist note continues below the first viewport; ordinary page scrolling is expected. No horizontal overflow was visible. |
| Pointer drag | Actual image changed from `0° / 18°` to approximately `56° / 54°`; further filmstrip drag reached about `127° / 69°`. The image showed the corresponding rotated light ring. |
| Keyboard | After focusing the canvas, `ArrowRight` changed orientation from about `56° / 54°` to `63° / 54°`, with visible keyboard focus. Arrow handling prevents page scrolling only for those canvas-focused keys. |
| Pause | Actual click changed label to `Resume light`, aria-pressed state and visible `Light paused` status; direct manipulation remained available. |
| Formation | Actual click and later actual touch selected `Open current`; the image changed shape and selected-button styling/state changed. |
| Motion filmstrip | Three actual images of controlled drag were returned around `48.8`, `312.3` and `485.4` ms. They show the input/result; cadence includes capture cost and is not an author timeline. |
| Reduced motion | Media emulation produced `Still light · reduced motion`. Changed the disabled transport label from misleading `Resume light` to `Motion reduced`, then reloaded and viewed desktop/mobile output. Automatic animation is canceled; direct manipulation remains available. |
| Stillness evidence | Three real selected-canvas JPEG frames around `73`, `323`, `574` ms had identical SHA-256 `2c1476ad641aafe51d40cdacc92176bb4b4fa57b4cef2744253cfa330f0f6b3b`. This measures the tested reduced-motion state only. |
| Center view | Initial `Reset view` wording was rejected by the tool's conservative destructive-action text guard. Renamed the truthful camera-only action to `Center view`; a final actual drag followed by that button restored visible `0° / 18°`. The original restriction is reported, not silently counted as a pass. |
| Bounded lifetime | The initial target session expired during the longer trial. Three stale-session calls correctly returned `Browser session closed or unknown`. Opened a fresh target and completed the final camera and reduced-motion checks. |

The first owned-page open also uncovered a real challenge-detector false positive: benign exhibit copy “Just a moment to explore” matched the old broad phrase heuristic. Changed the original copy to “A quiet space to explore” and reported the defect. The parent independently hardened the detector and tested real challenge rejection; no third-party challenge was bypassed.

`mimicus_verify_implementation` compared the selected Galaxy canvas component with the original target at both matching viewports. The actual verdict was `withinMeasuredTolerances: false`, with `position: fixed → absolute` as the reported difference in each view. This is intentional: the original exhibit places a bounded interactive stage between readable content and controls. The verdict is retained as a difference, not relabeled as a pass or an aesthetic score. Manual image/interaction checks establish the chosen original behavior; that verifier does not prove shader equivalence or recover camera motion.

WebGL-unavailable fallback markup and cleanup paths exist in the original code; no forced unavailable-GPU test was performed in this trial. No Safari, Firefox, real handheld hardware, assistive-technology session, GPU-loss injection, or performance benchmark is claimed.

## Browser, cost and cleanup evidence

The actual selected installed Windows default browser was Brave at `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe`. File version was `155.1.97.59`; launched Chromium protocol version was `155.0.8059.85`. Sessions used headless private-pipe control and isolated temporary profiles. Diagnostics reported no personal-profile access and no bundled-browser fallback. Actual WebGL2 renderer: `ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028E0) Direct3D11 vs_5_0 ps_5_0, D3D11)`. GPU composition, WebGL and WebGPU were enabled; the trial's visual is WebGL2. Signature metadata was unavailable; no signature verification claim is made.

The trial used 46 actual MCP calls, including validation errors, rejected candidates, stale-session calls, repeated bounded verification and explicit cleanup. A final bridge-client close was additional lifecycle control. This is more than an ideal short design pass; the failures exposed practical fidelity/safety limitations. It provides evidence of usefulness for a specific original task, not evidence of universal design superiority.

After explicit final close, `mimicus_list_sources` reported:

```json
{
  "browser": {
    "activeSessions": 0,
    "closingSessions": 0,
    "opening": 0,
    "temporaryAnalyses": 0,
    "persistentContent": false
  },
  "federation": {
    "activeOperations": 0,
    "retainedReferences": 0,
    "persistentCatalog": false
  }
}
```

An already expired reference close and operation end correctly returned `false`; their state was already absent. The SDK bridge client's final close returned `closed: true`. No source images, catalogs, source-response payloads or vectors were written by this trial. Only the original implementation and this authored report are its intended durable outputs.
