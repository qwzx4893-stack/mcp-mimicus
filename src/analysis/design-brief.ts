import type { AnimationRecord, ElementRecord, Sequence } from '../types.js';
import type { styleProfile } from './style-profile.js';

export type ProjectBrief = {
  project: string;
  audience: string;
  primaryAction: string;
  tone?: string;
  industry?: string;
  sections: string[];
  motion: 'none' | 'subtle' | 'expressive';
  anchorSessionId?: string;
  priorities?: ('conversion' | 'reading' | 'product-selection' | 'exploration')[];
};
export type VisualEvidence = {
  sessionId: string;
  url: string;
  attribution?: unknown;
  measured: {
    styleProfile: ReturnType<typeof styleProfile>;
    layouts: ElementRecord[];
    navigation: ElementRecord[];
    animations: AnimationRecord[];
    engines: string[];
    viewport?: { width: number; height: number };
    typography?: ElementRecord[];
    sections?: ElementRecord[];
    selectedMotion?: (Sequence & {
      analysisId?: string;
      viewport?: { width: number; height: number };
      reducedMotion?: boolean;
    })[];
    responsiveViews?: {
      viewport: { width: number; height: number };
      layouts: ElementRecord[];
      typography: ElementRecord[];
      navigation: ElementRecord[];
    }[];
    sampling?: { capturedElements: number; truncated: boolean };
  };
};

type Priority = NonNullable<ProjectBrief['priorities']>[number];
type Decision = {
  domain: string;
  constraint: string;
  basis: 'measurement-and-project-need' | 'project-need' | 'designer-judgment';
  evidenceIds: string[];
  briefFields: string[];
  uncertainty: string;
  fallback: string;
  verify: string;
};

const rounded = (n: number) => Math.round(n * 100) / 100;
function substantial(el: ElementRecord, viewport?: { width: number; height: number }) {
  const { x, y, width, height } = el.box;
  return (
    width >= 40 &&
    height >= 16 &&
    el.styles.display !== 'none' &&
    el.styles.visibility !== 'hidden' &&
    el.styles.opacity !== '0' &&
    x + width > 0 &&
    y + height > 0 &&
    (!viewport || (x < viewport.width && y < viewport.height))
  );
}
function px(value: string | undefined) {
  if (!value || !/^-?[\d.]+px$/.test(value)) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}
/** Computed grid tracks can contain nested functions; split only at top level. */
function tracks(value: string | undefined) {
  if (!value || value === 'none' || /subgrid|masonry|repeat\(/.test(value)) return null;
  value = value.replace(/\[[^\]]*\]/g, '');
  let depth = 0;
  let count = 0;
  let token = false;
  for (const c of value) {
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (/\s/.test(c) && depth === 0) {
      if (token) count++;
      token = false;
    } else token = true;
  }
  return count + Number(token) || null;
}
function projectNeeds(brief: ProjectBrief) {
  if (brief.priorities?.length)
    return {
      priorities: [...new Set(brief.priorities)],
      basis: 'explicit-project-brief' as const,
      matchedTerms: [] as string[],
      uncertainty:
        'Priority ordering is supplied by the agent; brand suitability still needs visual judgment.',
    };
  const text = [brief.project, brief.primaryAction, ...brief.sections].join(' ').toLowerCase();
  const rules: [Priority, RegExp][] = [
    ['product-selection', /\b(shop|buy|products?|retail|cart|coffee|store)\b/g],
    ['reading', /\b(read|articles?|journal|stories|editorial|publication|essays?)\b/g],
    ['conversion', /\b(sign\s?up|demo|trial|subscribe|pricing|saas|contact|book)\b/g],
    ['exploration', /\b(explore|immersive|3d|webgl|exhibition|gallery|portfolio)\b/g],
  ];
  const matches = rules.map(([priority, rule]) => ({ priority, terms: text.match(rule) ?? [] }));
  return {
    priorities: matches.filter((m) => m.terms.length).map((m) => m.priority),
    basis: 'text-rule-inference' as const,
    matchedTerms: [...new Set(matches.flatMap((m) => m.terms))],
    uncertainty:
      'Word matches suggest content needs, not audience research. Supply priorities to override this inference.',
  };
}

function features(ref: VisualEvidence) {
  const id = (part: string, i: number) => `${ref.sessionId}:${part}:${i}`;
  const layouts = ref.measured.layouts.map((el, i) => ({
    evidenceId: id('layout', i),
    usableForDirection: substantial(el, ref.measured.viewport),
    selector: el.selector || null,
    display: el.styles.display ?? null,
    columns: el.styles['grid-template-columns'] ?? null,
    columnCount: tracks(el.styles['grid-template-columns']),
    direction: el.styles['flex-direction'] ?? null,
    gapPx: px(el.styles.gap),
    box: el.box,
    childCount: el.signals?.childCount ?? null,
  }));
  const typography = (ref.measured.typography ?? []).map((el, i) => ({
    evidenceId: id('type', i),
    usableForDirection: substantial(el, ref.measured.viewport),
    selector: el.selector || null,
    tag: el.tag,
    headingLevel: el.accessible.headingLevel,
    sizePx: px(el.styles['font-size']),
    lineHeightPx: px(el.styles['line-height']),
    weight: el.styles['font-weight'] ?? null,
    family: el.styles['font-family'] ?? null,
    widthPx: el.box.width,
  }));
  const sizes = [
    ...new Set(ref.measured.styleProfile.fonts.flatMap((f) => f.usages.map((u) => u.size))),
  ]
    .filter((size) => Number.isFinite(size) && size > 0)
    .sort((a, b) => a - b);
  const body = typography.find((t) => t.usableForDirection && t.tag === 'p' && t.sizePx !== null);
  const heading = typography.find(
    (t) => t.usableForDirection && t.headingLevel === 1 && t.sizePx !== null,
  );
  const navigation = ref.measured.navigation.map((el, i) => ({
    evidenceId: id('navigation', i),
    usableForDirection: substantial(el, ref.measured.viewport),
    selector: el.selector || null,
    position: el.styles.position ?? null,
    box: el.box,
    role: el.accessible.role,
    focusable: el.accessible.focusable,
    behavior:
      'Static geometry only; menu activation and focus behavior require selected interaction evidence.',
  }));
  const motion = (ref.measured.selectedMotion ?? []).map((seq, i) => {
    const states = seq.samples.map((s) => ({
      t: s.t,
      expanded: s.state?.expanded ?? null,
      pressed: s.state?.pressed ?? null,
      focused: s.state?.focused ?? null,
      controlled: s.state?.controlled.map((c) => ({ id: c.id, visible: c.visible })) ?? [],
      opacity: s.opacity,
      transform: s.transform,
    }));
    return {
      evidenceId: id('motion', i),
      selector: seq.selector || null,
      trigger: seq.trigger,
      analysisId: seq.analysisId ?? null,
      viewport: seq.viewport ?? null,
      reducedMotion: seq.reducedMotion ?? null,
      sampleCount: seq.samples.length,
      settled: seq.settled,
      phases: seq.phases ?? [],
      observedTransitions: states
        .slice(1)
        .filter((s, j) => JSON.stringify({ ...s, t: 0 }) !== JSON.stringify({ ...states[j], t: 0 }))
        .slice(0, 6)
        .map((s) => ({
          from: states[states.indexOf(s) - 1],
          to: s,
        })),
      limitation:
        seq.limitation ??
        'Only the sampled trigger and states were observed; other input/reset paths are unknown.',
    };
  });
  const responsive = (ref.measured.responsiveViews ?? []).slice(0, 3).map((view, i) => ({
    evidenceId: id('responsive', i),
    viewport: view.viewport,
    layouts: view.layouts.map((e) => ({
      selector: e.selector || null,
      columns: e.styles['grid-template-columns'] ?? null,
      direction: e.styles['flex-direction'] ?? null,
      box: e.box,
    })),
    typography: view.typography.map((e) => ({
      selector: e.selector || null,
      sizePx: px(e.styles['font-size']),
      widthPx: e.box.width,
    })),
    navigation: view.navigation.map((e) => ({
      selector: e.selector || null,
      position: e.styles.position ?? null,
      box: e.box,
    })),
  }));
  const observedWidths = [...new Set(responsive.map((v) => v.viewport.width))];
  const sortedViews = [...responsive].sort((a, b) => a.viewport.width - b.viewport.width);
  const narrow = sortedViews[0],
    wide = sortedViews.at(-1);
  const responsiveChanges =
    narrow && wide && narrow.viewport.width !== wide.viewport.width
      ? narrow.layouts.flatMap((layout) => {
          const other = wide.layouts.find(
            (candidate) => layout.selector && candidate.selector === layout.selector,
          );
          if (!other) return [];
          return [
            {
              selector: layout.selector,
              evidenceIds: [narrow.evidenceId, wide.evidenceId],
              narrowWidth: narrow.viewport.width,
              wideWidth: wide.viewport.width,
              columns: { narrow: layout.columns, wide: other.columns },
              direction: { narrow: layout.direction, wide: other.direction },
              widthPx: { narrow: layout.box.width, wide: other.box.width },
              reflowDifferenceObserved:
                layout.columns !== other.columns || layout.direction !== other.direction,
            },
          ];
        })
      : [];
  return {
    sessionId: ref.sessionId,
    url: ref.url,
    attribution: ref.attribution ?? null,
    viewport: ref.measured.viewport ?? null,
    layouts,
    typography,
    navigation,
    motion,
    typeScale: {
      sizesPx: sizes,
      adjacentRatios: sizes.slice(1).map((s, i) => rounded(s / sizes[i]!)),
      headingToBodyRatio:
        heading?.sizePx && body?.sizePx ? rounded(heading.sizePx / body.sizePx) : null,
    },
    sections: (ref.measured.sections ?? []).map((e, i) => ({
      evidenceId: id('section', i),
      selector: e.selector || null,
      tag: e.tag,
      parent: e.parent,
      box: e.box,
    })),
    densitySignals: {
      capturedElements: ref.measured.sampling?.capturedElements ?? null,
      truncated: ref.measured.sampling?.truncated ?? null,
      bodyLineHeightRatio:
        body?.sizePx && body.lineHeightPx ? rounded(body.lineHeightPx / body.sizePx) : null,
      layoutGapsPx: layouts.flatMap((l) => (l.gapPx === null ? [] : [l.gapPx])),
      limitation:
        'Bounded sample density signals; no whole-page whitespace, image occupancy or readability score is inferred.',
    },
    responsive: {
      observations: responsive,
      observedWidths,
      matchedLayoutChanges: responsiveChanges,
      status:
        observedWidths.length >= 2 ? 'multiple-width-observations' : 'not-measured-across-widths',
      limitation:
        'Only supplied observations are compared; exact CSS breakpoints and complete responsive behavior are unknown.',
    },
    declaredActiveEffects: ref.measured.animations.length,
    engines: ref.measured.engines,
  };
}

function decisions(
  brief: ProjectBrief,
  ref: ReturnType<typeof features>,
  priority?: Priority,
): Decision[] {
  const usableLayouts = ref.layouts.filter((l) => l.usableForDirection);
  const usableType = ref.typography.filter((t) => t.usableForDirection);
  const grid = usableLayouts.find((l) => (l.columnCount ?? 0) > 1) ?? usableLayouts[0];
  const type = usableType.find((t) => t.headingLevel === 1) ?? usableType[0];
  const nav = ref.navigation.find((n) => n.usableForDirection);
  const sequence = ref.motion.find((m) => m.sampleCount > 1);
  const intent = {
    conversion: `Place “${brief.primaryAction}” beside the initial value statement and repeat it after the supplied proof/content sections; keep competing actions secondary.`,
    reading: `Make “${brief.primaryAction}” reachable through an ordered content index; preserve article hierarchy and a stable reading column before decorative effects.`,
    'product-selection': `Connect “${brief.primaryAction}” to the product/listing section; use repeatable item slots and a visible route back from details. Show price/availability only when supplied.`,
    exploration: `Provide a visible “${brief.primaryAction}” entry and an accessible content route alongside any visual scene; let exploration be reversible.`,
  };
  return [
    {
      domain: 'composition',
      constraint: `${priority ? intent[priority] : `Make “${brief.primaryAction}” explicit for ${brief.audience}.`} Keep requested content order: ${brief.sections.join(' → ')}.${grid ? ` Adapt the observed ${grid.display ?? 'layout'} relationship${grid.columnCount ? ` (${grid.columnCount} measured tracks)` : ''} to original content.` : ''}`,
      basis: grid ? 'measurement-and-project-need' : 'project-need',
      evidenceIds: grid ? [grid.evidenceId] : [],
      briefFields: ['audience', 'primaryAction', 'sections', 'priorities'],
      uncertainty:
        'Action placement is a proposal for this brief, not a measured conversion result.',
      fallback:
        'Use semantic source order and a single column when content cannot fit without compression.',
      verify:
        'Review the first viewport and complete required-content path using actual desktop/mobile images and keyboard navigation.',
    },
    {
      domain: 'typography',
      constraint: `${priority === 'reading' ? 'Prioritize body text and explicit heading levels; start with a 60–70ch maximum reading measure as designer judgment.' : priority === 'product-selection' ? 'Keep repeated item labels and primary actions readable at comparable sizes before increasing display-heading scale.' : priority === 'exploration' ? 'Keep scene instructions and navigation legible independently of decorative display type.' : 'Keep the value statement, proof and primary action in a clear size/weight hierarchy.'}${type?.sizePx ? ` The reference sample measures ${type.sizePx}px at ${type.selector ?? type.tag}; use this as a comparison, not a required token.` : ''}`,
      basis: type ? 'measurement-and-project-need' : 'project-need',
      evidenceIds: type ? [type.evidenceId] : [],
      briefFields: ['audience', 'tone', 'sections', 'priorities'],
      uncertainty:
        'Font licensing, optical size, text length and brand fit require an independent font choice and visual review.',
      fallback:
        'Use a licensed system-font stack and fluid sizes; allow labels/headings to wrap instead of truncating essential content.',
      verify:
        'Check longest real heading, text zoom, narrow widths and line wrapping; retain semantic heading order.',
    },
    {
      domain: 'navigation',
      constraint: `${nav ? `Consider the measured ${nav.position ?? 'position-unknown'} navigation geometry at ${nav.selector ?? 'the observed navigation'}. ` : ''}${priority === 'reading' ? 'Expose content sections and reading location without covering article text.' : priority === 'exploration' ? 'Keep entry, exit and scene controls discoverable with keyboard and touch.' : `Keep the route to “${brief.primaryAction}” visible alongside the supplied sections.`}`,
      basis: nav ? 'measurement-and-project-need' : 'project-need',
      evidenceIds: nav ? [nav.evidenceId] : [],
      briefFields: ['primaryAction', 'sections', 'priorities'],
      uncertainty:
        'A nav element does not prove its menu interaction, focus management or mobile state works.',
      fallback:
        'Use ordinary links and a native disclosure button; avoid essential hover-only navigation.',
      verify:
        'Inspect open → navigate → close, Escape, focus return and mobile tap states; check sticky content overlap.',
    },
    {
      domain: 'motion',
      constraint:
        brief.motion === 'none'
          ? 'Keep visual states stable; preserve focus and state feedback without nonessential animation.'
          : sequence
            ? `Adapt only the observed ${sequence.trigger} response at ${sequence.selector ?? 'the selected element'}; ${sequence.sampleCount} samples constrain visible states, not the hidden implementation.`
            : `No selected trigger sequence is available. Inspect a specific ${brief.motion === 'expressive' ? 'scene or transition' : 'navigation or feedback'} component before choosing timing or reset behavior.`,
      basis: brief.motion !== 'none' && sequence ? 'measurement-and-project-need' : 'project-need',
      evidenceIds: brief.motion !== 'none' && sequence ? [sequence.evidenceId] : [],
      briefFields: ['motion', 'primaryAction'],
      uncertainty:
        'Active CSS effects alone do not establish trigger, interruption, performance or reduced-motion behavior.',
      fallback:
        brief.motion === 'expressive'
          ? 'Offer a static scene/content path and pause control; keep conversion/navigation functional without canvas.'
          : 'Use immediate state changes under reduced motion and when animation cannot initialize.',
      verify:
        'Measure activation, interrupted state and reset with selected analysis; compare reduced-motion frames and keyboard/touch equivalents.',
    },
    {
      domain: 'responsive',
      constraint:
        ref.responsive.observedWidths.length >= 2
          ? `Compare the supplied ${ref.responsive.observedWidths.join('/')}px observations using matching selectors; adapt only observed changes.`
          : 'Responsive changes are unmeasured. Capture this selected reference at a second width before adopting its reflow.',
      basis:
        ref.responsive.observedWidths.length >= 2 ? 'measurement-and-project-need' : 'project-need',
      evidenceIds:
        ref.responsive.observedWidths.length >= 2
          ? ref.responsive.observations.map((v) => v.evidenceId)
          : [],
      briefFields: ['audience', 'sections'],
      uncertainty:
        'Sampled widths do not reveal exact media-query thresholds or behavior at every intervening width.',
      fallback:
        'Use intrinsic wrapping/minmax constraints, collapse columns when real content no longer fits, and preserve DOM reading order.',
      verify:
        'Test overflow, primary-action reachability, focus visibility and touch controls at 390px, desktop and an intervening width.',
    },
    {
      domain: 'implementation-burden',
      constraint: `${ref.engines.some((e) => /webgl|three|babylon|pixi/i.test(e)) ? 'Potentially high: a detected rendering engine may require scene lifecycle, GPU resources and an accessible static path.' : sequence || ref.declaredActiveEffects ? 'Potentially moderate: selected effects require interruption/reset and lifecycle handling.' : 'Potentially low for measured static layout/type; unobserved behavior may increase the work.'} This is an engineering estimate, not measured effort.`,
      basis: 'designer-judgment',
      evidenceIds: sequence ? [sequence.evidenceId] : grid ? [grid.evidenceId] : [],
      briefFields: ['motion'],
      uncertainty:
        'Engine presence neither proves which element uses it nor exposes proprietary source or actual implementation cost.',
      fallback:
        'Ship the semantic layout/action path first; add optional motion only after functional and performance checks.',
      verify:
        'Check frame pacing during interaction, cancel observers/listeners/frames, dispose scene resources and confirm teardown.',
    },
  ];
}

/** Independent, deterministic design guidance grounded in selected active views.
 * This is not an LLM, aesthetic score, copied site brief, or hidden-source recovery. */
export function synthesizeDesignBrief(brief: ProjectBrief, references: VisualEvidence[]) {
  const anchor = references.find((r) => r.sessionId === brief.anchorSessionId) ?? references[0];
  if (!anchor || (brief.anchorSessionId && anchor.sessionId !== brief.anchorSessionId)) {
    throw new Error('The design anchor must be one of the selected open sessions');
  }
  const observations = references.map((ref) => ({
    sessionId: ref.sessionId,
    url: ref.url,
    attribution: ref.attribution ?? null,
    palette: ref.measured.styleProfile.palette,
    typography: ref.measured.styleProfile.fonts,
    recurrentSpacingPx: ref.measured.styleProfile.spacingScale,
    composition: ref.measured.layouts.map((el) => ({
      selector: el.selector,
      display: el.styles.display,
      columns: el.styles['grid-template-columns'],
      direction: el.styles['flex-direction'],
      gap: el.styles.gap,
      box: el.box,
    })),
    navigation: ref.measured.navigation.map((el) => ({
      selector: el.selector,
      position: el.styles.position,
    })),
    activeAnimationEffects: ref.measured.animations.length,
    exposedEngines: ref.measured.engines,
    evidenceLevel:
      'bounded computed styles and active effect declarations; selected behavior requires its own probe',
  }));
  const anchorFacts = observations.find((ref) => ref.sessionId === anchor.sessionId)!;
  const needs = projectNeeds(brief);
  const measured = references.map(features);
  const directionOptions = measured.map((ref) => ({
    id: `direction:${ref.sessionId}`,
    anchorSessionId: ref.sessionId,
    label: `Structural direction from ${ref.url}`,
    selectionBasis: 'A competing adaptation option, not an aesthetic ranking.',
    serves: {
      audience: brief.audience,
      primaryAction: brief.primaryAction,
      priority: needs.priorities[0] ?? null,
    },
    decisions: decisions(brief, ref, needs.priorities[0])
      .filter((d) => ['composition', 'typography'].includes(d.domain))
      .map(({ domain, constraint, basis, evidenceIds, briefFields }) => ({
        domain,
        constraint,
        basis,
        evidenceIds,
        briefFields,
      })),
    tradeoffs: {
      measured: {
        multiColumnLayouts: ref.layouts.filter(
          (l) => l.usableForDirection && (l.columnCount ?? 0) > 1,
        ).length,
        typeScale: ref.typeScale,
        declaredEffects: ref.declaredActiveEffects,
        selectedSequences: ref.motion.length,
      },
      judgment: `Assess this option against ${brief.audience} and ${brief.tone ?? 'the supplied project tone'} using the actual images. More columns/effects are not automatically more useful.`,
      missingEvidence: [
        ...(!ref.motion.length && brief.motion !== 'none'
          ? ['Selected trigger/reset behavior']
          : []),
        ...(ref.responsive.observedWidths.length < 2
          ? ['Matching observations at multiple widths']
          : []),
        ...(!ref.typography.length ? ['Role-linked typography samples'] : []),
      ],
    },
  }));
  const anchorFeatures = measured.find((r) => r.sessionId === anchor.sessionId)!;
  const layoutSource =
    needs.priorities[0] === 'product-selection'
      ? (measured.find((r) =>
          r.layouts.some((l) => l.usableForDirection && (l.columnCount ?? 0) > 1),
        ) ?? anchorFeatures)
      : anchorFeatures;
  const navigationSource =
    measured.find((r) => r.navigation.some((n) => n.usableForDirection)) ?? anchorFeatures;
  const motionSource =
    measured.find((r) => r.motion.some((m) => m.sampleCount > 1)) ?? anchorFeatures;
  const compatibleMixedSpec = {
    kind: 'proposed-original-adaptation',
    selectionBasis:
      'Explicit anchor supplies visual hierarchy; a measured multi-column candidate can supply product listing structure; first measured navigation/selected motion supply optional behavior. These rules are transparent proposals, not quality scores.',
    assignments: {
      composition: layoutSource.sessionId,
      typography: anchorFeatures.sessionId,
      navigation: navigationSource.sessionId,
      motion:
        brief.motion === 'none'
          ? null
          : motionSource.motion.some((m) => m.sampleCount > 1)
            ? motionSource.sessionId
            : null,
    },
    decisions: decisions(brief, anchorFeatures, needs.priorities[0]).map((d) => {
      const source =
        d.domain === 'composition'
          ? layoutSource
          : d.domain === 'navigation'
            ? navigationSource
            : d.domain === 'motion'
              ? motionSource
              : anchorFeatures;
      return {
        ...decisions(brief, source, needs.priorities[0]).find((s) => s.domain === d.domain)!,
        sourceSessionId: source.sessionId,
      };
    }),
    coherenceConstraints: [
      {
        constraint:
          'Use one independently chosen type/token system across mixed sections; reference fonts and palette frequencies do not establish licenses or contrast.',
        basis: 'designer-judgment',
        briefFields: ['tone', 'audience'],
        verify:
          'Review combined desktop/mobile images and measure chosen foreground/background contrast.',
      },
      {
        constraint: `Keep one dominant “${brief.primaryAction}” path and preserve ${brief.sections.length} required section(s); avoid combining conflicting sticky headers or scroll owners.`,
        basis: 'project-need',
        briefFields: ['primaryAction', 'sections'],
        verify:
          'Complete the primary action using keyboard and touch with every optional visual effect disabled.',
      },
      {
        constraint:
          'Reference selectors address only the observed source session; assign semantic selectors in the original implementation and compare relationships at matching viewports.',
        basis: 'measurement-boundary',
        verify:
          'Resolve each selected source element before analysis; if it has changed, recapture rather than reusing stale measurements.',
      },
    ],
    originality:
      'Implement independent markup, code, text, branding and authorized artwork; adapt relationships without reconstructing proprietary code.',
  };
  const motion =
    brief.motion === 'none'
      ? [
          'Use stable visual states without nonessential animation.',
          'Keep navigation state and focus feedback visible.',
        ]
      : [
          'Choose one purposeful interaction from the selected references and measure activation and reset before adopting its timing.',
          brief.motion === 'subtle'
            ? 'Keep motion concentrated on navigation and direct feedback.'
            : 'Make the principal visual sequence interruptible; keep content readable during transitions.',
          'Provide a reduced-motion state, cancel observers/listeners on teardown, and preserve keyboard/touch alternatives.',
        ];
  return {
    kind: 'independently-written-evidence-grounded-guidance',
    project: brief,
    selectedAnchor: {
      sessionId: anchor.sessionId,
      reason: 'Explicit agent choice, or first selected reference; no aesthetic ranking inferred.',
    },
    observedReferences: observations,
    projectNeeds: needs,
    measuredComparisons: measured,
    directionOptions,
    compatibleMixedSpec,
    nextActions: [
      'View the supplied reference images and choose a direction or override priorities; this comparison does not select an aesthetic winner.',
      ...(brief.motion !== 'none' && !measured.some((r) => r.motion.length)
        ? [
            'Use mimicus_analyze_element on the chosen control/scene with an explicit trigger, then compare again for measured states.',
          ]
        : []),
      ...(!measured.some((r) => r.responsive.observedWidths.length >= 2)
        ? [
            'Inspect selected reference behavior at desktop and narrow widths before accepting responsive constraints.',
          ]
        : []),
      'Build original content and verify the selected measured relationships, functional states and project needs separately.',
    ],
    direction: {
      composition: {
        primaryDecision: brief.primaryAction,
        sectionOrder: brief.sections,
        referenceRelationships: anchorFacts.composition,
        application:
          'Adapt these structural relationships to the supplied content; do not copy source text, branding, markup or artwork.',
      },
      typography: {
        observedHierarchy: anchorFacts.typography,
        application:
          'Choose authorized fonts and a readable hierarchy for the supplied audience. Validate long titles and narrow screens.',
      },
      colorAndRhythm: {
        observedPalette: anchorFacts.palette,
        observedSpacingPx: anchorFacts.recurrentSpacingPx,
        application:
          'Use these observations as comparisons; select original tokens with sufficient contrast and a consistent content rhythm.',
      },
      navigation: {
        observedOptions: observations.map((r) => ({
          sessionId: r.sessionId,
          navigation: r.navigation,
        })),
        application:
          'Make the primary action explicit. Test menu open, close, Escape, focus return and same-page navigation.',
      },
      motion,
      responsive: [
        'Inspect the original implementation at desktop and narrow widths.',
        'Check reading order, navigation, overflow, touch targets and reduced motion.',
      ],
    },
    verificationCriteria: [
      {
        criterion: 'Primary action and required sections',
        method:
          'Inspect the finished page against the supplied brief; external agent judgment required.',
      },
      {
        criterion: 'Navigation activation and reset',
        method:
          'Use actual click/key/touch states and timestamped frames, including Escape/focus return.',
      },
      {
        criterion: 'Chosen structural/behavioral constraints',
        method:
          'Measure selected elements at matching viewports; report intended differences instead of requiring asset identity.',
      },
      {
        criterion: 'Visual coherence and suitability',
        method:
          'View real implementation images and assess the project brief; metrics do not establish aesthetic superiority.',
      },
    ],
    limitations: [
      'This snapshot comparison does not establish complete site structure or hidden author intent.',
      'Do not infer asset licenses from a repository software license.',
      'No generative model or stored design corpus is involved.',
    ],
    untrustedEvidence: true,
  };
}
