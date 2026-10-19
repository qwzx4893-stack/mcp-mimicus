import { summarizeSequence } from '../browser/behavior.js';
import { trajectory } from '../browser/temporal.js';
import type { ComponentEvidence, Observation } from '../types.js';

export function verifyComponent(
  p: ComponentEvidence,
  reference: Observation,
  target: Observation,
  selector: string,
) {
  const view = target.views[0];
  if (!view) throw new Error('No target viewport captured');
  const measured = view.elements.find((e) => e.selector === selector);
  if (!measured) throw new Error('Target selector was not captured within the element bound');
  const baseline = reference.views.find(
    (v) => v.viewport.width === view.viewport.width && v.viewport.height === view.viewport.height,
  );
  if (!baseline)
    throw new Error('No matching reference viewport; compare the same viewport dimensions');
  const original = baseline.elements.find((e) => e.selector === p.selector);
  if (!original) throw new Error('Reference element is absent from its evidence');
  const fields =
    p.category === 'layout'
      ? ['display', 'position', 'grid-template-columns', 'gap', 'layout-width', 'layout-height']
      : p.category === 'typography'
        ? ['font-size', 'font-weight', 'line-height', 'letter-spacing']
        : p.category === 'interaction' || p.category === 'motion'
          ? [
              'transition-property',
              'transition-duration',
              'transition-timing-function',
              'animation-duration',
              'animation-timing-function',
            ]
          : ['position', 'top'];
  const differences: {
    property: string;
    reference: unknown;
    actual: unknown;
    tolerance?: number;
  }[] = [];
  let comparisons = 0;
  for (const property of fields) {
    comparisons++;
    if (original.styles[property] !== measured.styles[property])
      differences.push({
        property,
        reference: original.styles[property],
        actual: measured.styles[property],
      });
  }
  const sequences = view.sequences.filter((s) => s.selector === selector);
  const relevantTrigger =
    p.family === 'pointer-responsive-component'
      ? 'pointer'
      : p.family === 'hover-transition'
        ? 'hover'
        : p.category === 'scroll'
          ? 'scroll'
          : p.category === 'motion'
            ? 'time'
            : null;
  const expectedSequences = baseline.sequences.filter(
    (s) => s.selector === p.selector && (!relevantTrigger || s.trigger === relevantTrigger),
  );
  const coverage: string[] = [];
  for (const expected of expectedSequences) {
    comparisons++;
    if (!sequences.some((s) => s.trigger === expected.trigger))
      differences.push({
        property: `trigger:${expected.trigger}`,
        reference: 'sampled sequence',
        actual: 'missing',
      });
  }
  for (const sequence of sequences) {
    if (relevantTrigger && sequence.trigger !== relevantTrigger) continue;
    const previous = baseline.sequences.find(
      (s) => s.selector === p.selector && s.trigger === sequence.trigger,
    );
    if (!previous) continue;
    const expected = summarizeSequence(previous),
      actual = summarizeSequence(sequence);
    const states = (s: typeof sequence) =>
      [
        ...new Set(
          s.samples
            .filter((x) => x.state)
            .map((x) =>
              JSON.stringify({
                expanded: x.state!.expanded,
                pressed: x.state!.pressed,
                controlled: x.state!.controlled.map((c) => ({
                  visible: c.visible,
                  display: c.display,
                })),
              }),
            ),
        ),
      ].sort();
    comparisons++;
    if (JSON.stringify(states(previous)) !== JSON.stringify(states(sequence)))
      differences.push({
        property: 'interactionStates',
        reference: states(previous),
        actual: states(sequence),
      });
    for (const name of ['initial', 'active', 'reset']) {
      const endpoint = (s: typeof sequence) => {
        const phase = s.phases?.find((p) => p.name === name);
        return phase
          ? s.samples.filter((p) => p.t >= phase.startMs && p.t <= phase.endMs).at(-1)
          : undefined;
      };
      const a = endpoint(previous),
        b = endpoint(sequence);
      if (!a || !b) continue;
      // Numeric inset coordinates tolerate browser rounding; other clip shapes remain explicit strings.
      comparisons++;
      const numbers = (s: string) => s.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      const x = numbers(a.clipPath),
        y = numbers(b.clipPath);
      const sameShape =
        a.clipPath.replace(/-?\d+(?:\.\d+)?/g, '#') === b.clipPath.replace(/-?\d+(?:\.\d+)?/g, '#');
      if (!sameShape || x.length !== y.length || x.some((n, i) => Math.abs(n - y[i]!) > 0.5))
        differences.push({
          property: `${name}:clipPath`,
          reference: a.clipPath,
          actual: b.clipPath,
          tolerance: 0.5,
        });
    }
    const expectedScroll = previous.samples[0]?.containerScroll,
      actualScroll = sequence.samples[0]?.containerScroll;
    if (expectedScroll) {
      comparisons++;
      if (
        !actualScroll ||
        expectedScroll.axis !== actualScroll.axis ||
        Math.abs(expectedScroll.maximum - actualScroll.maximum) > 2
      )
        differences.push({
          property: 'nestedScrollContext',
          reference: expectedScroll,
          actual: actualScroll ?? null,
          tolerance: 2,
        });
      const progress = sequence.samples.map((s) => s.progress);
      comparisons++;
      if (Math.min(...progress) > 0.01 || Math.max(...progress) < 0.99)
        differences.push({
          property: 'nestedScrollCoverage',
          reference: [0, 1],
          actual: [Math.min(...progress), Math.max(...progress)],
          tolerance: 0.01,
        });
    }
    if (p.family === 'svg-stroke-animation') {
      const range = (s: typeof sequence) => {
          const values = s.samples
            .map((x) => parseFloat(x.strokeDashoffset ?? ''))
            .filter(Number.isFinite);
          return values.length ? [Math.min(...values), Math.max(...values)] : [];
        },
        a = range(previous),
        b = range(sequence);
      const tolerance = Math.max(3, (Number(p.facts.pathLength) || 0) * 0.15);
      comparisons++;
      if (a.length !== b.length || a.some((n, i) => Math.abs(n - b[i]!) > tolerance))
        differences.push({ property: 'svgStrokeRange', reference: a, actual: b, tolerance });
    }
    for (const property of ['displacementX', 'displacementDocumentY'] as const) {
      comparisons++;
      if (Math.abs(expected[property] - actual[property]) > 2)
        differences.push({
          property,
          reference: expected[property],
          actual: actual[property],
          tolerance: 2,
        });
    }
    for (const i of [0, 1])
      if (expected.opacityRange[i] !== undefined && actual.opacityRange[i] !== undefined) {
        comparisons++;
        if (Math.abs(expected.opacityRange[i]! - actual.opacityRange[i]!) > 0.03)
          differences.push({
            property: `opacityRange[${i}]`,
            reference: expected.opacityRange[i],
            actual: actual.opacityRange[i],
            tolerance: 0.03,
          });
      }
    if (
      previous.phases?.some((p) => p.name === 'active') &&
      sequence.phases?.some((p) => p.name === 'active')
    ) {
      const a = trajectory(previous),
        b = trajectory(sequence);
      if (a.available && b.available) {
        for (const key of ['onsetMs', 'lastChangeMs', 'pathLengthPx'] as const) {
          const av = a[key],
            bv = b[key],
            tolerance = key === 'pathLengthPx' ? 3 : 65;
          if (av !== null && av !== undefined && bv !== null && bv !== undefined) {
            comparisons++;
            if (Math.abs(av - bv) > tolerance)
              differences.push({
                property: `${sequence.trigger}:${key}`,
                reference: av,
                actual: bv,
                tolerance,
              });
          }
        }
        // Compare displacement at equal elapsed times, not only extrema/endpoints.
        const frames = (s: typeof sequence) => {
          const phase = s.phases!.find((p) => p.name === 'active')!;
          return s.samples.filter((p) => p.t >= phase.startMs && p.t <= phase.endMs);
        };
        const r = frames(previous),
          t = frames(sequence);
        const interpolate = (f: typeof r, ms: number) => {
          const start = f[0]!;
          const at = start.t + ms;
          const right = f.findIndex((p) => p.t >= at);
          const b = f[right < 0 ? f.length - 1 : right]!,
            a = f[Math.max(0, right - 1)]!;
          const ratio =
            right < 0 ? 1 : Math.max(0, Math.min(1, (at - a.t) / Math.max(0.001, b.t - a.t)));
          return {
            x: a.box.x + (b.box.x - a.box.x) * ratio - start.box.x,
            y: a.box.y + (b.box.y - a.box.y) * ratio - start.box.y,
            opacity: a.opacity + (b.opacity - a.opacity) * ratio,
          };
        };
        if (r.length > 1 && t.length > 1) {
          let squared = 0;
          let opacityError = 0;
          const duration = Math.min(r.at(-1)!.t - r[0]!.t, t.at(-1)!.t - t[0]!.t);
          for (let i = 1; i <= 10; i++) {
            const a = interpolate(r, (duration * i) / 10),
              b = interpolate(t, (duration * i) / 10);
            squared += (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
            opacityError += Math.abs(a.opacity - b.opacity);
          }
          const rms = Math.sqrt(squared / 10);
          comparisons += 2;
          if (rms > 6)
            differences.push({
              property: 'trajectoryRmsPx',
              reference: 0,
              actual: rms,
              tolerance: 6,
            });
          if (opacityError / 10 > 0.08)
            differences.push({
              property: 'trajectoryOpacityMae',
              reference: 0,
              actual: opacityError / 10,
              tolerance: 0.08,
            });
        }
      }
    } else
      coverage.push(
        `${sequence.trigger}: reference or target lacks phase markers; sampled trajectory timing comparison unavailable`,
      );
    if (
      ['hover', 'pointer', 'focus', 'click'].includes(sequence.trigger) &&
      previous.phases?.some((p) => p.name === 'reset')
    ) {
      const reset = (s: typeof sequence) => {
        const first = s.samples[0],
          last = s.samples.at(-1);
        return (
          !!first &&
          !!last &&
          Math.hypot(first.box.x - last.box.x, first.box.y - last.box.y) < 2 &&
          Math.abs(first.opacity - last.opacity) < 0.03
        );
      };
      comparisons++;
      if (reset(previous) !== reset(sequence))
        differences.push({
          property: 'resetToInitial',
          reference: reset(previous),
          actual: reset(sequence),
        });
    }
    if (previous.settled && !sequence.settled) {
      comparisons++;
      differences.push({ property: 'settled', reference: true, actual: false });
    }
  }
  if (!expectedSequences.length)
    coverage.push('No reference sequence: only selected computed declarations can be compared');
  return {
    referenceId: p.id,
    target: measured,
    referenceFacts: p.facts,
    sequences,
    differences,
    comparisons,
    withinMeasuredTolerances: differences.length === 0,
    coverage,
    limitation:
      'Compares selected computed properties, triggers, ranges, reset, and phase-aligned trajectories where available at matching viewports. Timing tolerance 65ms, trajectory RMS 6px, opacity MAE .08; bounded sampling is not pixel, scene or aesthetic equivalence.',
    untrustedEvidence: true,
  };
}
