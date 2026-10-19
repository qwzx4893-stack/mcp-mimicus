# Visual workflow evaluation

Two coding agents exercised different design briefs on 2026-10-19 using the actual production Mimicus tools through the official MCP SDK stdio client. They performed live discovery, viewed original-site MCP image blocks, compared references, selected evidence, authored original pages, inspected desktop/mobile output and tested selected behavior. This is qualitative task evidence, not a controlled aesthetic benchmark or a claim of superiority over an unaided agent.

The browser in these trials was the installed Windows HTTPS default Brave, launched headlessly with an isolated temporary profile and private-pipe control. Actual Chromium protocol version was `155.0.8059.85`; the immersive session reported WebGL2 on an NVIDIA RTX 4060 Laptop GPU. No bundled browser was downloaded and no personal browser profile was accessed. These results do not establish compatibility on every browser or operating system.

## Retail brief: Fieldwork Coffee

Build an independent roaster concept that helps a home brewer choose a seasonal coffee and read origin/brewing details. The agent inspected actual images from Tchibo and Main Coffee Lab, after rejecting a robots-blocked navigation demo. Tchibo supplied a merchandising comparison; the specialist coffee site was a closer conceptual reference. The agent authored its own brand, illustration, content, typography and composition, with no copied third-party media.

The useful selected evidence was a shop disclosure: a 200ms ease-in-out declaration and measured `aria-expanded` activation/reset, without invented displacement. The implementation retained the timing for color, added explicit controlled-region semantics, and supplied keyboard/touch disclosure, coffee filters and native product-detail dialogs.

Actual desktop/mobile images and independent owned-page QA confirmed no horizontal overflow, first-viewport mobile coffee action, working filters, dialog focus/Escape recovery and reduced-motion styles. Image review found an over-specific text selector; the agent fixed the secondary note hierarchy and viewed the correction. Targeted verification returned **false**, because the original implementation deliberately narrowed `transition-property: all` to `color` and exposed additional controlled-region evidence. That result was retained as a meaningful difference.

The trial also exposed source and rendering friction: an initial Webflow query supplied a popular feed rather than established coffee search coverage; the agent reported it, and later source acceptance separately exercised the repaired native query. Tchibo's first viewport was usable while many images remained incomplete. Neither fact was silently counted as full rendering or complete source coverage.

Deliverable: [original coffee page](../examples/workflow/coffee.html). Detailed evidence: [coffee trial](../artifacts/final-release/coffee-trial.md).

## Immersive brief: Tidal Instrument

Build a self-contained digital light exhibit that visitors can turn, pause and explore with pointer, keyboard or touch. Galaxy Configurator was visually inspected as a fully rendered particle scene. Dreamfold was also inspected, but showed a key-onboarding gate; its city was not assessed and the agent did not obtain a key or bypass the gate. Interlude supplied another fully accessible visual reference after the build, offering a useful contrast in typography and interaction density. Only one reference was verified as a fully rendered 3D scene in this trial.

The resulting page uses original WebGL2 point geometry and shaders, original copy and local fonts, without external assets. Actual desktop/mobile images prompted a larger wide-screen sculpture projection. Drag changed visible orientation; a focused arrow key rotated it further. Pause, formation selection, actual touch and the final Center view control were exercised. Reduced-motion output was inspected and three real canvas JPEG captures had identical hashes. The final canvas measurement recorded a label, focusability and stable nonempty pixel evidence.

Reference-to-target verification returned **false** for the intentional `fixed` to `absolute` canvas positioning difference at two widths. The exhibit places its stage between readable copy and controls; matching the reference's full-screen composition was not the brief. The verifier did not establish equivalent shaders or camera physics.

This workflow exposed a genuine limitation in the old canvas probe: near-empty WebGL readback looked constant even though the actual screenshot showed a rendered scene. The runtime was corrected to report that case as inconclusive, rather than imply static content. Benign copy also triggered an overly broad challenge phrase matcher, which was hardened separately. The original `Reset view` label was rejected by the conservative interaction guard; the final truthful `Center view` label was tested successfully. Stale sessions correctly rejected requests and required reopening.

Deliverable: [original immersive page](../examples/workflow/immersive.html). Detailed evidence: [immersive trial](../artifacts/final-release/immersive-trial.md).

## What the evidence supports

Mimicus helped the agents find current references, inspect actual rendering, distinguish source declarations from sampled behavior, obtain concrete selectors and constraints, and retain meaningful verification differences. Project-aware comparison supplied a useful evidence checklist; it did not make the visual direction or choose an aesthetic winner. Typography, illustration, content order and overall suitability still required agent judgment.

Both trials ended with zero active browser sessions, temporary analyses, discovery operations and retained references; their SDK clients were closed. Original-site images remained in temporary memory. Authored trial reports and original implementations are explicit evaluation outputs, not a persistent source catalog.

Access restrictions, incomplete assets, narrow metadata, conservative interaction heuristics, output-size handling and repeated calls added real cost. The immersive trial recorded 46 MCP calls including rejected candidates, retries, verification and cleanup; the coffee trial was not instrumented as a call-efficiency benchmark. These trials establish practical usefulness and identifiable weaknesses for two briefs. They do not establish universal source recall, exact animation reconstruction, statistical design-quality improvement or acceptance in every named MCP client.

For current boundaries, read [final limitations](FINAL_LIMITATIONS.md). Historical workflow reports describe the software they actually exercised; later fixes are called out separately rather than retroactively treated as tested.
