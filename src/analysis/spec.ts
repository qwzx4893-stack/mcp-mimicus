import { animationGroups, trajectory } from '../browser/temporal.js';
import type { ComponentEvidence, Observation } from '../types.js';
import { styleProfile } from './style-profile.js';

function originalExample(p: ComponentEvidence, o: Observation) {
  const sequence = o.views[0]?.sequences.find(
    (s) => s.selector === p.selector && s.trigger === 'hover',
  );
  if (!sequence?.samples.length || p.family !== 'hover-transition') return null;
  const first = sequence.samples[0]!;
  const furthest = sequence.samples.reduce(
    (a, b) => (Math.abs(b.box.x - first.box.x) > Math.abs(a.box.x - first.box.x) ? b : a),
    first,
  );
  const transition = p.facts.transition as { duration?: string; easing?: string } | undefined;
  const css = p.facts.cssMotion as { transitions: { easing: string }[] } | undefined;
  const easing =
    css?.transitions[0]?.easing ??
    transition?.easing?.match(/^(?:cubic-bezier|steps|linear)\([^)]*\)|^[^,]+/)?.[0] ??
    'linear';
  const seconds = Number.parseFloat(transition?.duration ?? '');
  if (!Number.isFinite(seconds)) return null;
  const x = Math.round(furthest.box.x - first.box.x),
    opacity = Math.min(...sequence.samples.map((s) => s.opacity));
  const active = sequence.phases?.find((p) => p.name === 'active'),
    end = active ? sequence.samples.filter((p) => p.t <= active.endMs).at(-1) : undefined;
  if (end && first.clipPath !== end.clipPath)
    return {
      kind: 'independently-authored-minimal-example',
      language: 'html',
      scope: 'Measured clip reveal; independently choose artwork and content.',
      code: `<div class="reveal" tabindex="0">Original content</div>\n<style>\n.reveal { clip-path:${first.clipPath}; transition:clip-path ${seconds}s ${easing}; }\n.reveal:hover,.reveal:focus-visible { clip-path:${end.clipPath}; }\n.reveal:focus-visible { outline:3px solid currentColor; }\n@media(prefers-reduced-motion:reduce) { .reveal { transition:none; clip-path:${end.clipPath}; } }\n</style>`,
      lifecycle: [
        'Initial clipped state → hover/focus reveal → exit/blur reset',
        'Use a visible hit area and preserve keyboard access.',
      ],
      limitation:
        'Numeric clip geometry is measured; hidden source structure and artwork are not reconstructed.',
    };
  if (x === 0 && opacity === 1) return null;
  return {
    kind: 'independently-authored-minimal-example',
    language: 'html',
    scope:
      'Single measured horizontal hover response; adapt content, sizing and layout independently.',
    code: `<div class="interaction"><button type="button">Explore</button></div>\n<style>\n.interaction { display:inline-block; padding:48px; }\n.interaction button { transition:transform ${seconds}s ${easing}, opacity ${seconds}s ${easing}; }\n.interaction:hover button, .interaction:focus-within button { transform:translateX(${x}px); opacity:${opacity}; }\nbutton:focus-visible { outline:3px solid currentColor; outline-offset:6px; }\n@media(prefers-reduced-motion:reduce) { .interaction button { transition:none; } .interaction:hover button, .interaction:focus-within button { transform:none; } }\n</style>`,
    lifecycle: [
      'Idle → hover/focus active → exit/blur reset',
      'CSS transitions reverse from the current state when interrupted.',
      'No listeners, timers or allocated resources require cleanup.',
    ],
    limitation:
      'Original example covers the measured axes only; it does not reconstruct site markup, artwork or hidden application state.',
  };
}

function componentRecipe(
  p: ComponentEvidence,
  sequences: Observation['views'][number]['sequences'],
) {
  const measured = {
    kind: 'independently-written-recipe',
    family: p.family,
    measurements: p.facts,
    limitations: [
      'Measurements constrain an original implementation; source DOM and hidden program are unavailable.',
    ],
  };
  if (p.family === 'horizontal-scroll-component')
    return {
      ...measured,
      structure: [
        'Labelled keyboard-focusable overflow-x viewport',
        'Nonwrapping flex track',
        'Ordered semantic items',
      ],
      actions: [
        'Keep native scroll ownership; avoid intercepting page wheel input.',
        'Derive progress from scrollLeft / (scrollWidth - clientWidth).',
        'Keep item order and focus visible at narrow widths.',
      ],
      cleanup: 'Remove optional navigation listeners; no animation loop needed.',
    };
  if (p.family === 'pointer-responsive-component')
    return {
      ...measured,
      inputs: sequences.find((s) => s.trigger === 'pointer')?.inputs ?? [],
      actions: [
        'Cache resting bounds before pointer movement.',
        'Use measured input/output samples to choose a response gain; exact physics is not recovered.',
        'Write transforms in requestAnimationFrame and reset on pointerleave/blur.',
        'Disable pointer displacement under reduced motion; preserve semantic button activation.',
      ],
      cleanup: 'Cancel pending frame and remove pointer listeners.',
    };
  if (p.family === 'svg-stroke-animation')
    return {
      ...measured,
      actions: [
        'Author an original SVG path.',
        'Read its own getTotalLength rather than copying a reference path.',
        'Animate stroke-dashoffset using measured duration/direction when available.',
        'Provide an unanimated fully visible stroke under reduced motion.',
      ],
      cleanup: 'Cancel JS/WAAPI effects on teardown; CSS-only effects need no listeners.',
    };
  if (p.family === 'sampled-state-interaction')
    return {
      ...measured,
      states: sequences.flatMap((s) => s.samples.filter((x) => x.state).map((x) => x.state)),
      actions: [
        'Use a semantic button with aria-controls and synchronized aria-expanded.',
        'Keep controlled-region visibility synchronized with expanded state.',
        'Support Escape and restore focus; test close/reset rather than only opening.',
      ],
      cleanup: 'Remove keyboard and control listeners on teardown.',
    };
  return {
    ...measured,
    actions: [
      'Use measured responsive relationships and timing.',
      'Validate interaction activation, interruption, reset and reduced motion in the browser.',
    ],
  };
}
export function implementationSpec(p: ComponentEvidence, o: Observation) {
  const sequences = o.views.flatMap((v) =>
    v.sequences
      .filter((s) => s.selector === p.selector)
      .map((s) => ({ viewport: v.viewport, ...s })),
  );
  const measured = {
    family: p.family,
    category: p.category,
    selector: p.selector,
    facts: p.facts,
    sequences,
    evidenceIds: p.evidenceIds,
    sourceId: p.sourceId,
    observedAt: p.observedAt,
  };
  return {
    componentId: p.id,
    title: p.title,
    measured,
    implementation: {
      component: p.facts.component ?? null,
      styleProfiles: o.views.map((v) => ({
        viewport: v.viewport,
        profile: styleProfile(v.elements),
      })),
      temporalProfiles: sequences.map(trajectory),
      groups: animationGroups(o.views[0]?.animations ?? []).filter((g) =>
        g.members.some((m) => m.selector === p.selector),
      ),
      example: originalExample(p, o),
      recipe: componentRecipe(p, sequences),
      responsive: (p.facts.responsive as unknown[] | undefined) ?? [],
      lifecycle: {
        initial: 'Apply measured initial state before enabling motion.',
        activation: sequences.map((s) => s.trigger),
        interruption:
          'Restart or reverse from the current visible state; avoid stacking timelines.',
        cleanup:
          'Cancel requestAnimationFrame, observers and listeners on teardown when using JavaScript.',
      },
      evidenceLevel: p.facts.validation ?? p.confidenceKind,
      missingEvidence: [
        'Hidden source implementation and design intent are unavailable.',
        ...(!sequences.length
          ? [
              'No sampled interaction sequence for this component; validate trigger behavior before adoption.',
            ]
          : []),
      ],
    },
    guidance: {
      kind: 'independently-written-guidance',
      structure:
        p.category === 'layout'
          ? 'Use semantic sections with a CSS grid or flex container; adapt measured spacing and responsive tracks to new content.'
          : p.family === 'horizontal-scroll-component'
            ? 'Use a native overflow-x container and a nonwrapping flex track; preserve keyboard and touch scrolling.'
            : p.category === 'scroll'
              ? 'Use a containing section and a sticky child only when positioning evidence supports it; measure constraints against content height.'
              : p.category === 'typography'
                ? 'Use semantic heading levels and a responsive type scale with an authorized fallback font.'
                : 'Use an independently authored component. Treat recorded timing and state values as a behavioral reference.',
      trigger:
        p.category === 'interaction'
          ? 'Support hover and keyboard focus with equivalent state changes; reset on pointer exit or blur.'
          : p.category === 'scroll'
            ? 'Map actual measured scroll progress to the intended visual state.'
            : 'Use measured keyframes and timing only where present in evidence.',
      motion:
        'Prefer transform and opacity for movement. Keep interaction state interruptible; measure layout work when animating geometry.',
      accessibility: [
        'Honor prefers-reduced-motion with a stable end state.',
        'Keep semantic controls keyboard-operable.',
        'Maintain focus visibility and reading order.',
      ],
      performance: [
        'Avoid per-frame DOM writes mixed with layout reads.',
        'Bound scroll listeners and use requestAnimationFrame.',
        'Profile on target hardware; sampled frame gaps are not a universal performance score.',
      ],
      validation: [
        'Compare declared timing to browser timing evidence.',
        'Compare sampled displacement and endpoints with a tolerance justified by frame cadence.',
        'Verify narrow viewport and reduced-motion variants.',
      ],
    },
    confidence: {
      value: p.confidence,
      kind: p.confidenceKind,
      meaning:
        'Heuristic confidence in observation method, not a calibrated probability or aesthetic score.',
    },
    limitations: p.limitations,
    usage: p.usage,
    untrustedEvidence: true,
  };
}
