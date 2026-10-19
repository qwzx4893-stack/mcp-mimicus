import type { AnimationRecord, Sequence } from '../types.js';
export function trajectory(s: Sequence) {
  const phase = s.phases?.find((p) => p.name === 'active');
  const frames = phase
    ? s.samples.filter((p) => p.t >= phase.startMs && p.t <= phase.endMs)
    : s.samples;
  const first = frames[0],
    last = frames.at(-1);
  if (!first || !last) return { available: false, trigger: s.trigger };
  const changed = (p: typeof first) =>
    Math.abs(p.box.x - first.box.x) > 0.5 ||
    Math.abs(p.box.y - first.box.y) > 0.5 ||
    Math.abs(p.opacity - first.opacity) > 0.01 ||
    p.transform !== first.transform ||
    p.clipPath !== first.clipPath;
  const onset = frames.find(changed);
  let path = 0;
  for (let i = 1; i < frames.length; i++)
    path += Math.hypot(
      frames[i]!.box.x - frames[i - 1]!.box.x,
      frames[i]!.box.y - frames[i - 1]!.box.y,
    );
  let lastChange = first.t;
  for (let i = 1; i < frames.length; i++)
    if (
      Math.hypot(frames[i]!.box.x - frames[i - 1]!.box.x, frames[i]!.box.y - frames[i - 1]!.box.y) >
        0.25 ||
      Math.abs(frames[i]!.opacity - frames[i - 1]!.opacity) > 0.005
    )
      lastChange = frames[i]!.t;
  return {
    available: true,
    trigger: s.trigger,
    onsetMs: onset?.t ?? null,
    lastChangeMs: lastChange,
    windowMs: last.t - first.t,
    samples: frames.length,
    pathLengthPx: path,
    displacement: {
      x: last.box.x - first.box.x,
      y: last.box.y - first.box.y,
      opacity: last.opacity - first.opacity,
    },
    normalizedTrajectory: frames
      .filter(
        (_, i) =>
          i === 0 ||
          i === frames.length - 1 ||
          i % Math.max(1, Math.floor(frames.length / 12)) === 0,
      )
      .map((p) => ({
        phase: (p.t - first.t) / Math.max(1, last.t - first.t),
        x: p.box.x - first.box.x,
        y: p.box.y - first.box.y,
        opacity: p.opacity,
        scrollProgress: p.progress,
      })),
    resetObserved: s.phases?.some((p) => p.name === 'reset') ?? false,
    settled: s.settled,
    uncertainty:
      'Onset/end bounded by sampled frames and control dispatch; exact underlying timeline/easing not recovered',
  };
}
export function animationGroups(animations: AnimationRecord[]) {
  const groups = new Map<string, AnimationRecord[]>();
  for (const a of animations) {
    const key = JSON.stringify([a.name, a.timing.duration, a.timing.iterations]);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => ({
      name: g[0]!.name,
      duration: g[0]!.timing.duration,
      iterations: g[0]!.timing.iterations,
      members: g.map((a) => ({ selector: a.selector, delayMs: a.timing.delay })),
      distinctDelays: [...new Set(g.map((a) => a.timing.delay))].sort((a, b) => a - b),
      staggered: new Set(g.map((a) => a.timing.delay)).size > 1,
      evidenceKind: 'directly-measured' as const,
    }));
}
