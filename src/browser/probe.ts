import type { AnimationRecord, ElementRecord, Sample, ViewportObservation } from '../types.js';

/** Executed in a hostile page realm. Results are data only; no page text is
 * promoted to instructions. DOM traversal, CSSOM and returned data are bounded. */
export function captureDocument(
  options: number | { maxElements: number; targetSelector?: string },
) {
  const { maxElements, targetSelector } =
    typeof options === 'number' ? { maxElements: options, targetSelector: undefined } : options;
  const target = targetSelector ? document.querySelector(targetSelector) : null;
  const selector = (el: Element): string => {
    if (targetSelector && el === target) return targetSelector;
    if (el.id && el.id.length <= 100) return '#' + CSS.escape(el.id);
    const parts: string[] = [];
    let current: Element | null = el;
    for (let i = 0; current && i < 6; i++, current = current.parentElement) {
      const p: Element | null = current.parentElement;
      const index = p ? [...p.children].indexOf(current) + 1 : 1;
      parts.unshift(
        CSS.escape(current.tagName.toLowerCase().slice(0, 64)) + `:nth-child(${index})`,
      );
    }
    return parts.join(' > ');
  };
  const props = [
    'display',
    'position',
    'top',
    'left',
    'width',
    'height',
    'padding',
    'margin',
    'gap',
    'grid-template-columns',
    'flex-direction',
    'align-items',
    'justify-content',
    'font-family',
    'font-size',
    'font-weight',
    'line-height',
    'letter-spacing',
    'color',
    'background-color',
    'border-radius',
    'z-index',
    'overflow',
    'transition-property',
    'transition-duration',
    'transition-delay',
    'transition-timing-function',
    'animation-name',
    'animation-duration',
    'animation-delay',
    'animation-iteration-count',
    'animation-timing-function',
    'transform-origin',
    'perspective',
    'touch-action',
    'cursor',
  ];
  const candidates = (
    target ? [target, ...target.querySelectorAll('*')] : [...document.querySelectorAll('body *')]
  ).slice(0, 2500);
  const selected = candidates
    .filter((el) => {
      const s = getComputedStyle(el),
        r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        !['SCRIPT', 'STYLE', 'LINK', 'META', 'BR', 'NOSCRIPT'].includes(el.tagName) &&
        (el.matches(
          'main,section,header,footer,nav,h1,h2,h3,button,a,[role],[data-mimicus],canvas,svg',
        ) ||
          ['grid', 'flex'].includes(s.display) ||
          ['sticky', 'fixed'].includes(s.position) ||
          s.transform !== 'none' ||
          s.animationName !== 'none' ||
          s.transitionDuration.split(',').some((v) => parseFloat(v) > 0))
      );
    })
    .slice(0, maxElements);
  if (target && !selected.includes(target)) {
    if (selected.length >= maxElements) selected.pop();
    selected.unshift(target);
  }
  const elements: ElementRecord[] = selected.map((el) => {
    const s = getComputedStyle(el),
      r = el.getBoundingClientRect();
    const vars: Record<string, string> = {};
    for (let i = 0; i < s.length && Object.keys(vars).length < 20; i++) {
      const k = s.item(i);
      if (k.startsWith('--')) vars[k] = s.getPropertyValue(k).slice(0, 160);
    }
    const styles: Record<string, string> = {};
    for (const k of props) styles[k] = s.getPropertyValue(k).slice(0, 200);
    styles['transform-kind'] = s.transform.startsWith('matrix3d')
      ? '3d'
      : s.transform === 'none'
        ? 'none'
        : '2d';
    // Untransformed layout dimensions make content fingerprints independent of animation phase.
    if (el instanceof HTMLElement) {
      styles['layout-width'] = String(el.offsetWidth);
      styles['layout-height'] = String(el.offsetHeight);
      styles['layout-left'] = String(el.offsetLeft);
      styles['layout-top'] = String(el.offsetTop);
    }
    return {
      selector: selector(el),
      tag: el.tagName.toLowerCase().slice(0, 64),
      parent: el.parentElement ? selector(el.parentElement) : null,
      signals: {
        transformed: s.transform !== 'none',
        interactive:
          el.matches('button,a,[role=tab],[role=slider],[aria-expanded]') || s.cursor === 'pointer',
        scrollHint: el.hasAttribute('data-aos') || el.hasAttribute('data-scroll'),
        componentRole: el.matches('nav,header')
          ? 'navigation'
          : el.hasAttribute('aria-expanded')
            ? 'disclosure'
            : el.getAttribute('role') === 'tab'
              ? 'tab'
              : el.tagName === 'H1'
                ? 'hero-heading'
                : el.tagName === 'CANVAS'
                  ? 'render-surface'
                  : el.children.length >= 3 && ['grid', 'flex'].includes(s.display)
                    ? 'collection'
                    : el.tagName === 'SECTION'
                      ? 'section'
                      : 'element',
        childCount: el.children.length,
      },
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
      styles,
      variables: vars,
      accessible: {
        role: el.getAttribute('role')?.slice(0, 100) ?? null,
        focusable: el instanceof HTMLElement && el.tabIndex >= 0,
        labelPresent: !!(
          el.getAttribute('aria-label') ||
          el.getAttribute('aria-labelledby') ||
          el.textContent?.trim()
        ),
        headingLevel: /^H[1-6]$/.test(el.tagName) ? Number(el.tagName[1]) : null,
      },
    };
  });
  const animations: AnimationRecord[] = [];
  for (const a of document.getAnimations().slice(0, 100)) {
    const effect = a.effect;
    if (!(effect instanceof KeyframeEffect) || !(effect.target instanceof Element)) continue;
    const timing = effect.getTiming();
    animations.push({
      selector: selector(effect.target),
      kind: a.constructor.name.slice(0, 100),
      name: 'animationName' in a ? String(a.animationName).slice(0, 160) : null,
      playState: a.playState,
      timing: {
        duration:
          typeof timing.duration === 'number' ? timing.duration : String(timing.duration ?? 'auto'),
        delay: timing.delay ?? 0,
        iterations: Number.isFinite(timing.iterations) ? (timing.iterations ?? 1) : 'infinite',
        easing: timing.easing ?? 'linear',
        fill: timing.fill ?? 'none',
        direction: timing.direction ?? 'normal',
      },
      keyframes: effect
        .getKeyframes()
        .slice(0, 30)
        .map(
          (f) =>
            Object.fromEntries(
              Object.entries(f)
                .filter(
                  ([k, v]) =>
                    v !== undefined &&
                    [
                      'offset',
                      'easing',
                      'opacity',
                      'transform',
                      'clipPath',
                      'filter',
                      'width',
                      'height',
                      'left',
                      'top',
                      'computedOffset',
                    ].includes(k),
                )
                .map(([k, v]) => [
                  k,
                  typeof v === 'string' ? v.slice(0, 500) : typeof v === 'number' ? v : null,
                ]),
            ) as Record<string, string | number | null>,
        ),
    });
  }
  let inaccessibleStylesheets = 0;
  const cssKeyframes: ViewportObservation['cssKeyframes'] = [];
  const readRules = (rules: CSSRuleList, depth = 0) => {
    if (depth > 4) return;
    for (const rule of [...rules].slice(0, 500)) {
      if (rule instanceof CSSKeyframesRule && cssKeyframes.length < 60)
        cssKeyframes.push({
          name: rule.name.slice(0, 160),
          frames: [...rule.cssRules].slice(0, 30).map((f) => ({
            key: (f as CSSKeyframeRule).keyText.slice(0, 100),
            css: (f as CSSKeyframeRule).style.cssText.slice(0, 1000),
          })),
        });
      else if ('cssRules' in rule) readRules((rule as CSSGroupingRule).cssRules, depth + 1);
    }
  };
  for (const sheet of [...document.styleSheets].slice(0, 40))
    try {
      readRules(sheet.cssRules);
    } catch {
      inaccessibleStylesheets++;
    }
  const w = window as unknown as Record<string, any>;
  const engines: string[] = [];
  if (w.gsap) engines.push('gsap-global');
  if (w.__lenis) engines.push('lenis-global');
  if (w.THREE) engines.push('three-global');
  const scrollTriggers: ViewportObservation['scrollTriggers'] = [];
  try {
    if (typeof w.ScrollTrigger?.getAll === 'function')
      for (const st of w.ScrollTrigger.getAll().slice(0, 60))
        scrollTriggers.push({
          selector: st.trigger instanceof Element ? selector(st.trigger) : null,
          start: Number(st.start),
          end: Number(st.end),
          pin: !!st.pin,
          scrub: st.vars?.scrub ?? false,
          progress: Number(st.progress),
        });
  } catch {}
  return {
    elements,
    animations,
    cssKeyframes,
    engines,
    scrollTriggers,
    inaccessibleStylesheets,
    truncated: candidates.length >= 2500 || selected.length >= maxElements,
    canvasCount: document.querySelectorAll('canvas').length,
  };
}

/** rAF timestamps measure actual cadence, not nominal sleep intervals. */
export function sampleElement({
  selector,
  durationMs,
  epochMs,
  adaptive = false,
}: {
  selector: string;
  durationMs: number;
  epochMs?: number;
  adaptive?: boolean;
}): Promise<{ samples: Sample[]; intervals: number[] }> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (!el) {
      resolve({ samples: [], intervals: [] });
      return;
    }
    const samples: Sample[] = [];
    const intervals: number[] = [];
    const start = performance.now();
    let last = start;
    const frame = (now: number) => {
      const s = getComputedStyle(el),
        r = el.getBoundingClientRect();
      intervals.push(now - last);
      last = now;
      const previous = samples.at(-1);
      if (
        adaptive &&
        previous &&
        now - (epochMs ?? start) - previous.t < 100 &&
        Math.abs(r.x - previous.box.x) < 0.25 &&
        Math.abs(r.y - previous.box.y) < 0.25 &&
        Math.abs(parseFloat(s.opacity) - previous.opacity) < 0.005 &&
        s.transform === previous.transform &&
        s.clipPath === previous.clipPath &&
        now - start < durationMs
      ) {
        requestAnimationFrame(frame);
        return;
      }
      const controlled = (el.getAttribute('aria-controls') ?? '')
        .split(/\s+/)
        .slice(0, 4)
        .map((id) => document.getElementById(id))
        .filter((e): e is HTMLElement => !!e)
        .map((e) => ({
          id: e.id.slice(0, 100),
          display: getComputedStyle(e).display,
          visible: e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0,
        }));
      samples.push({
        t: now - (epochMs ?? start),
        scrollY: window.scrollY,
        progress: window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight),
        box: { x: r.x, y: r.y, width: r.width, height: r.height },
        transform: s.transform.slice(0, 500),
        opacity: parseFloat(s.opacity),
        visibility: s.visibility.slice(0, 100),
        clipPath: s.clipPath.slice(0, 500),
        filter: s.filter.slice(0, 500),
        strokeDashoffset: s.strokeDashoffset,
        state: {
          expanded:
            el.getAttribute('aria-expanded')?.slice(0, 20) ??
            (el.matches('summary') && el.parentElement instanceof HTMLDetailsElement
              ? String(el.parentElement.open)
              : null),
          pressed: el.getAttribute('aria-pressed')?.slice(0, 20) ?? null,
          focused: document.activeElement === el,
          controlled,
        },
      });
      if (now - start < durationMs && samples.length < 200) requestAnimationFrame(frame);
      else resolve({ samples, intervals });
    };
    // Initial state is retained before the next rendering opportunity.
    frame(start);
  });
}

/** Transient, tiny canvas buffers are discarded in-page; only scalar evidence
 * survives. Cross-origin taint/readback denial is explicitly reported. */
export async function probeCanvas() {
  const surfaces = [...document.querySelectorAll('canvas')].slice(0, 3);
  const results = [];
  for (const canvas of surfaces) {
    try {
      const tiny = document.createElement('canvas');
      tiny.width = 32;
      tiny.height = 32;
      const ctx = tiny.getContext('2d', { willReadFrequently: true })!;
      let previous: Uint8ClampedArray | undefined;
      const frames = [];
      const epoch = performance.now();
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 80));
        ctx.clearRect(0, 0, 32, 32);
        ctx.drawImage(canvas, 0, 0, 32, 32);
        const pixels = ctx.getImageData(0, 0, 32, 32).data;
        let delta = 0,
          energy = 0,
          cx = 0,
          cy = 0;
        for (let p = 0; p < pixels.length; p += 4) {
          const light = (pixels[p]! + pixels[p + 1]! + pixels[p + 2]!) / 3;
          energy += light;
          if (previous) {
            const d = Math.abs(light - (previous[p]! + previous[p + 1]! + previous[p + 2]!) / 3);
            delta += d;
            cx += ((p / 4) % 32) * d;
            cy += Math.floor(p / 128) * d;
          }
        }
        frames.push({
          t: performance.now() - epoch,
          meanLuminance: energy / 1024,
          meanDifference: delta / 1024,
          changeCentroid: delta ? { x: cx / delta / 32, y: cy / delta / 32 } : null,
        });
        previous = pixels;
      }
      const emptyReadback = frames.every((f) => f.meanLuminance < 1 && f.meanDifference < 1);
      results.push({
        readable: true,
        frames,
        changed: emptyReadback ? null : frames.some((f) => f.meanDifference > 1),
        readbackConfidence: emptyReadback ? 'inconclusive' : 'bounded-pixel-sample',
        limitation: emptyReadback
          ? 'Readback is near empty and may omit the composited scene (for example WebGL without preserveDrawingBuffer). Use actual screenshots/filmstrips; no static or blank-page conclusion follows.'
          : '32×32 transient readback differences only. No detected difference does not establish a static visible scene; no scene, shader or camera reconstruction.',
      });
    } catch {
      results.push({
        readable: false,
        frames: [],
        changed: null,
        limitation: 'Canvas readback unavailable or cross-origin tainted',
      });
    }
  }
  return results;
}
