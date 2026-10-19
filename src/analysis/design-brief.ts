import type { AnimationRecord, ElementRecord } from '../types.js';
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
  };
};

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
