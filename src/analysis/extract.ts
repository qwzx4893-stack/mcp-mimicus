import { summarizeSequence } from '../browser/behavior.js';
import { stableCssMotion } from '../browser/css-motion.js';
import { animationGroups, trajectory } from '../browser/temporal.js';
import {
  type ComponentEvidence,
  ComponentSchema,
  type ElementRecord,
  type Observation,
} from '../types.js';
import { hash } from '../util.js';

export function extractComponents(o: Observation): ComponentEvidence[] {
  const patterns: ComponentEvidence[] = [];
  const base = o.views[0];
  if (!base) return patterns;
  const groups = animationGroups(base.animations);
  const grouped = new Set(groups.flatMap((g) => g.members.map((m) => m.selector)));
  function add(
    el: ElementRecord,
    category: ComponentEvidence['category'],
    family: string,
    facts: Record<string, unknown>,
    description: string,
    confidence: number,
    kind: ComponentEvidence['confidenceKind'] = 'directly-measured',
    identity?: string,
  ) {
    const id = hash(
      identity ? [o.sourceId, el.selector, family, identity] : [o.sourceId, el.selector, family],
    ).slice(0, 28);
    const limitations = [...o.limitations];
    if (base!.diagnostics.truncated)
      limitations.push('DOM selection reached configured element bound');
    if (!o.complete)
      limitations.push(
        'Targeted or selected-viewport observation; this record does not establish full-site coverage.',
      );
    if (base!.diagnostics.inaccessibleStylesheets)
      limitations.push('Some CSSOM stylesheets were inaccessible');
    patterns.push(
      ComponentSchema.parse({
        id,
        sourceId: o.sourceId,
        title: `${family.replaceAll('-', ' ')} · ${el.tag}`,
        family,
        category,
        tags: [
          family,
          el.tag,
          ...new Set(o.views.flatMap((v) => v.engines)),
          ...(el.styles.display ? [el.styles.display] : []),
        ],
        description,
        selector: el.selector,
        evidenceIds: [o.id],
        confidence,
        confidenceKind: kind,
        facts: {
          ...facts,
          intelligence: {
            unit: facts.validation === 'declaration-only' ? 'declaration' : 'component',
            purpose: description,
            evidenceLevel: facts.validation ?? kind,
          },
        },
        limitations,
        observedAt: o.capturedAt,
      }),
    );
  }
  const candidates: ElementRecord[] = [];
  const seen = new Set<string>();
  for (const view of o.views)
    for (const el of view.elements)
      if (!seen.has(el.selector)) {
        seen.add(el.selector);
        candidates.push(el);
      }
  for (const el of candidates.filter(
    (el) => !o.targetSelector || el.selector === o.targetSelector,
  )) {
    const measuredView = o.views.find((v) => v.elements.some((e) => e.selector === el.selector))!;
    const responsive = o.views.map((v) => {
      const e = v.elements.find((e) => e.selector === el.selector);
      return {
        viewport: v.viewport,
        reducedMotion: v.reducedMotion,
        present: !!e,
        styles: e?.styles,
        variables: e?.variables,
        accessible: e?.accessible,
      };
    });
    const common = {
      responsive,
      accessibility: el.accessible,
      cssMotion: stableCssMotion(measuredView.cssMotion)?.find((x) => x.selector === el.selector),
      component: {
        role: el.signals?.componentRole ?? el.tag,
        parent: el.parent,
        children: measuredView.elements
          .filter((child) => child.parent === el.selector)
          .map((child, flowOrder) => ({
            selector: child.selector,
            tag: child.tag,
            flowOrder,
            widthFraction:
              Number(child.styles['layout-width'] ?? child.box.width) /
              Math.max(1, Number(el.styles['layout-width'] ?? el.box.width)),
            layoutOffsetLeft: child.styles['layout-left'],
            layoutOffsetTop: child.styles['layout-top'],
          })),
      },
    };
    if (
      ['grid', 'flex'].includes(el.styles.display ?? '') ||
      ['main', 'section', 'header', 'nav'].includes(el.tag)
    ) {
      const family =
        el.styles.display === 'grid'
          ? 'responsive-grid'
          : el.styles.display === 'flex'
            ? 'flex-composition'
            : 'section-layout';
      add(
        el,
        'layout',
        family,
        { ...common, styles: el.styles },
        `Observed ${el.styles.display} composition with ${el.styles['grid-template-columns'] ?? 'no grid'} tracks and computed spacing.`,
        0.98,
      );
    }
    if (['h1', 'h2', 'h3'].includes(el.tag))
      add(
        el,
        'typography',
        'type-scale',
        {
          ...common,
          fontSize: el.styles['font-size'],
          lineHeight: el.styles['line-height'],
          fontFamily: el.styles['font-family'],
          fontWeight: el.styles['font-weight'],
        },
        'Measured heading typography and responsive sizes; font files are not copied.',
        0.98,
      );
    if (el.styles['transform-kind'] === '3d' && (el.signals?.childCount ?? 0) >= 6)
      add(
        el,
        'layout',
        'spatial-transform-composition',
        {
          ...common,
          childCount: el.signals?.childCount,
          transformKind: '3d',
          validation: 'geometry-measured',
        },
        'Measured CSS 3D container with multiple transformed children; scene/camera intent and hidden timeline are unavailable.',
        0.9,
        'derived-from-measurements',
      );
    const animations = measuredView.animations.filter((a) => a.selector === el.selector);
    const transition = el.styles['transition-duration']?.split(',').some((v) => parseFloat(v) > 0);
    const sequences = measuredView.sequences.filter((s) => s.selector === el.selector);
    if (transition || (animations.length && !grouped.has(el.selector))) {
      const family = transition ? 'hover-transition' : 'keyframe-animation';
      const behaviorMeasured = sequences.some((s) => {
        const x = summarizeSequence(s);
        return (
          x.displacementX > 1 ||
          x.displacementDocumentY > 1 ||
          x.states.length > 1 ||
          (x.opacityRange[1] ?? 0) - (x.opacityRange[0] ?? 0) > 0.02 ||
          new Set(s.samples.map((p) => p.transform)).size > 1 ||
          new Set(s.samples.map((p) => p.clipPath)).size > 1
        );
      });
      add(
        el,
        transition ? 'interaction' : 'motion',
        family,
        {
          ...common,
          animations,
          transition: transition
            ? {
                property: el.styles['transition-property'],
                duration: el.styles['transition-duration'],
                delay: el.styles['transition-delay'],
                easing: el.styles['transition-timing-function'],
              }
            : null,
          measuredTriggers: sequences.map((s) => s.trigger),
          behavior: sequences.filter((s) => s.trigger !== 'time').map(summarizeSequence),
          sequenceEvidence: { observationId: o.id, selector: el.selector },
          reducedMotionTested: o.views.some((v) => v.reducedMotion),
          validation: behaviorMeasured
            ? 'behavior-measured'
            : animations.length
              ? 'timing-measured'
              : 'declaration-only',
        },
        transition
          ? 'Computed transition declaration; behavioral verification status is explicit. A declaration alone does not prove a hover interaction.'
          : 'Browser Web Animations API exposed real timing and keyframes.',
        behaviorMeasured || animations.length > 0 ? 0.95 : 0.65,
      );
      // Evidence pointers are not content; refresh hashes must not depend on observation UUIDs.
    }
    if (!animations.length && !transition) {
      const interaction = sequences.find((s) =>
        ['click', 'focus', 'hover', 'pointer', 'drag', 'touch'].includes(s.trigger),
      );
      if (interaction) {
        const summary = summarizeSequence(interaction);
        if (
          summary.states.length > 1 ||
          summary.displacementX > 2 ||
          summary.displacementDocumentY > 2 ||
          summary.opacityRange[0] !== summary.opacityRange[1]
        )
          add(
            el,
            'interaction',
            'sampled-state-interaction',
            { ...common, behavior: summary },
            'A controlled interaction changed sampled element or controlled-region state; no hidden implementation is inferred.',
            0.9,
            'derived-from-measurements',
          );
      }
      const timed = sequences.find((s) => s.trigger === 'time');
      if (timed && new Set(timed.samples.map((p) => p.transform)).size > 2)
        add(
          el,
          'motion',
          'runtime-transform-motion',
          {
            ...common,
            profile: trajectory(timed),
            behavior: summarizeSequence(timed),
            validation: 'behavior-measured',
          },
          'Time-sampled JavaScript-driven transform trajectory; hidden engine and original timeline unavailable.',
          0.8,
          'derived-from-measurements',
        );
    }
    if (['sticky', 'fixed'].includes(el.styles.position ?? '')) {
      const seq = sequences.find((s) => s.trigger === 'scroll');
      add(
        el,
        'scroll',
        el.styles.position === 'sticky' ? 'sticky-composition' : 'fixed-composition',
        {
          ...common,
          position: el.styles.position,
          top: el.styles.top,
          scrollObserved: !!seq,
          scrollVerified: seq?.settled ?? false,
          positions:
            seq?.samples.map((s) => ({
              scrollY: Math.round(s.scrollY),
              y: Math.round(s.box.y),
              height: Math.round(s.box.height),
            })) ?? [],
          engineTriggers: measuredView.scrollTriggers.filter((t) => t.selector === el.selector),
        },
        'Positioning declaration with measured document scroll and viewport geometry; sticky does not by itself prove GSAP pinning.',
        seq?.settled?.valueOf() ? 0.93 : 0.7,
        'derived-from-measurements',
      );
    }
    const scroll = sequences.find((s) => s.trigger === 'scroll');
    if (scroll?.samples[0]?.containerScroll?.axis === 'x')
      add(
        el,
        'scroll',
        'horizontal-scroll-component',
        {
          ...common,
          scrollContext: scroll.samples[0].containerScroll,
          positions: scroll.samples.map((s) => ({
            progress: s.progress,
            x: s.box.x,
            position: s.containerScroll?.position,
          })),
          validation: 'behavior-measured',
        },
        'Element progression measured against an explicitly controlled horizontal scroll container; document scroll is separate.',
        0.95,
        'derived-from-measurements',
      );
    const pointer = sequences.find((s) => s.trigger === 'pointer' && (s.inputs?.length ?? 0) >= 3);
    if (pointer && new Set(pointer.samples.map((s) => s.transform)).size > 2)
      add(
        el,
        'interaction',
        'pointer-responsive-component',
        {
          ...common,
          inputs: pointer.inputs,
          profile: trajectory(pointer),
          validation: 'behavior-measured',
        },
        'Measured transform response to three controlled pointer positions; magnetic physics and intent are not inferred.',
        0.9,
        'derived-from-measurements',
      );
    const svg = common.cssMotion?.svg;
    if (
      svg?.pathLength &&
      sequences.some((s) => new Set(s.samples.map((p) => p.strokeDashoffset)).size > 2)
    )
      add(
        el,
        'motion',
        'svg-stroke-animation',
        {
          ...common,
          pathLength: svg.pathLength,
          validation: 'behavior-measured',
          strokeRanges: sequences.map((s) => ({
            trigger: s.trigger,
            offsets: s.samples.map((p) => p.strokeDashoffset),
          })),
        },
        'SVG stroke offset changes measured against browser path length; original vector path is not retained.',
        0.95,
      );
    if (scroll && scroll.samples.length >= 3) {
      const opacity = scroll.samples.map((s) => s.opacity);
      const changing = Math.max(...opacity) - Math.min(...opacity) > 0.3;
      if (changing)
        add(
          el,
          'scroll',
          'scroll-reveal',
          {
            ...common,
            positions: scroll.samples.map((s) => ({
              progress: s.progress,
              opacity: s.opacity,
              x: Math.round(s.box.x),
              y: Math.round(s.box.y),
            })),
            validation: scroll.settled ? 'behavior-measured' : 'partial-scroll',
          },
          'Measured opacity reveal across controlled scroll progress; activation interval is bounded by samples, not an exact recovered trigger.',
          scroll.settled ? 0.9 : 0.65,
          'derived-from-measurements',
        );
      const pinned = scroll.samples.filter(
        (s) => Math.abs(s.box.y - parseFloat(el.styles.top ?? '0')) < 3,
      );
      if (
        pinned.length >= 3 &&
        el.signals?.childCount &&
        ['sticky', 'fixed'].includes(el.styles.position ?? '')
      )
        add(
          el,
          'scroll',
          'pinned-composition',
          {
            ...common,
            position: el.styles.position,
            stableScrollRange: [
              Math.min(...pinned.map((s) => s.scrollY)),
              Math.max(...pinned.map((s) => s.scrollY)),
            ],
            validation: 'behavior-measured',
          },
          'Component remains at its viewport inset over multiple measured scroll positions. Narrative intent and hidden pin engine are not inferred.',
          0.9,
          'derived-from-measurements',
        );
    }
    if (
      scroll &&
      !scroll.samples[0]?.containerScroll &&
      !['sticky', 'fixed'].includes(el.styles.position ?? '') &&
      scroll.samples.length > 1
    ) {
      const xs = scroll.samples.map((s) => s.box.x),
        ys = scroll.samples.map((s) => s.box.y + s.scrollY);
      if (Math.max(...xs) - Math.min(...xs) > 2 || Math.max(...ys) - Math.min(...ys) > 8)
        add(
          el,
          'scroll',
          'scroll-linked-motion',
          {
            ...common,
            positions: scroll.samples.map((s) => ({
              scrollY: Math.round(s.scrollY),
              x: Math.round(s.box.x),
              documentY: Math.round(s.box.y + s.scrollY),
            })),
            scrollVerified: scroll.settled,
          },
          'Relative element movement measured at controlled scroll positions; the underlying engine is not inferred from motion alone.',
          0.85,
          'derived-from-measurements',
        );
    }
    if (el.tag === 'canvas')
      add(
        el,
        'canvas',
        'canvas-surface',
        { ...common, count: measuredView.canvas.count, probes: measuredView.canvas.probes ?? [] },
        measuredView.canvas.limitation,
        0.65,
        'inferred-with-uncertainty',
      );
    if (o.targetSelector && !patterns.some((p) => p.selector === el.selector))
      add(
        el,
        'layout',
        'element-style',
        { ...common, styles: el.styles },
        'Computed selected-element styles and geometry; no unobserved interaction or layout purpose inferred.',
        0.98,
      );
  }
  if (!o.targetSelector)
    for (const group of groups) {
      const el = base.elements.find((e) => e.selector === group.members[0]?.selector);
      if (el)
        add(
          el,
          'motion',
          group.staggered ? 'staggered-sequence' : 'repeated-motion-component',
          {
            group,
            validation: 'timing-measured',
            relationship:
              'Effects share name/duration; delay offsets and repeat count are directly read, not proof of a shared hidden timeline',
          },
          group.staggered
            ? 'Repeated animation effects with distinct measured delay offsets.'
            : 'Repeated animation effects grouped into one component reference instead of duplicate child records.',
          0.92,
          'derived-from-measurements',
          group.name ?? 'anonymous-effects',
        );
    }
  return patterns;
}
