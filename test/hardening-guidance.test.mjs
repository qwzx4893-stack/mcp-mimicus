import assert from 'node:assert/strict';
import { test } from 'node:test';
import { synthesizeDesignBrief } from '../dist/analysis/design-brief.js';

const el = (selector, tag, styles, width = 900) => ({
  selector,
  tag,
  parent: 'main',
  box: { x: 0, y: 0, width, height: 160 },
  styles,
  variables: {},
  accessible: {
    role: null,
    focusable: false,
    labelPresent: false,
    headingLevel: tag === 'h1' ? 1 : null,
  },
  signals: {
    transformed: false,
    interactive: false,
    scrollHint: false,
    componentRole: 'section',
    childCount: 6,
  },
});
const sample = (t, expanded, opacity) => ({
  t,
  scrollY: 0,
  progress: 0,
  box: { x: 0, y: 0, width: 100, height: 20 },
  transform: 'none',
  opacity,
  visibility: 'visible',
  clipPath: 'none',
  filter: 'none',
  state: {
    expanded,
    pressed: null,
    focused: false,
    controlled: [{ id: 'panel', display: opacity ? 'block' : 'none', visible: !!opacity }],
  },
});
const refs = [
  {
    sessionId: 'editorial',
    url: 'https://owned.example/editorial',
    attribution: { kind: 'owned-test' },
    measured: {
      viewport: { width: 1280, height: 900 },
      sampling: { capturedElements: 40, truncated: false },
      styleProfile: {
        palette: [],
        spacingScale: [8, 24],
        fonts: [
          {
            family: 'serif',
            total: 4,
            usages: [
              { size: 18, weight: 400, count: 3 },
              { size: 72, weight: 600, count: 1 },
            ],
          },
        ],
        evidence: 'Owned computed-style fixture',
      },
      layouts: [
        el('#reading', 'main', { display: 'flex', 'flex-direction': 'column', gap: '24px' }),
      ],
      typography: [
        el('h1', 'h1', { 'font-size': '72px' }),
        el('p', 'p', { 'font-size': '18px', 'line-height': '30px' }, 660),
      ],
      navigation: [],
      sections: [],
      animations: [],
      engines: [],
    },
  },
  {
    sessionId: 'catalog',
    url: 'https://owned.example/catalog',
    attribution: { kind: 'owned-test' },
    measured: {
      viewport: { width: 1280, height: 900 },
      styleProfile: {
        palette: [],
        spacingScale: [12, 24],
        fonts: [],
        evidence: 'Owned computed-style fixture',
      },
      layouts: [
        el('#products', 'section', {
          display: 'grid',
          'grid-template-columns': '300px 300px 300px',
          gap: '24px',
        }),
      ],
      typography: [el('h1', 'h1', { 'font-size': '48px' })],
      navigation: [el('#nav', 'nav', { position: 'sticky' })],
      sections: [],
      animations: [],
      engines: ['Three.js'],
      selectedMotion: [
        {
          selector: '#menu',
          trigger: 'click',
          analysisId: 'owned-analysis',
          viewport: { width: 1280, height: 900 },
          reducedMotion: false,
          settled: true,
          samples: [sample(0, 'false', 0), sample(300, 'true', 1), sample(600, 'false', 0)],
        },
      ],
      responsiveViews: [1280, 390].map((width) => ({
        viewport: { width, height: 900 },
        layouts: [
          el(
            '#products',
            'section',
            {
              display: 'grid',
              'grid-template-columns': width === 390 ? '350px' : '300px 300px 300px',
            },
            width,
          ),
        ],
        typography: [],
        navigation: [],
      })),
    },
  },
];
const brief = (priorities, extra = {}) => ({
  project: 'Owned project',
  audience: 'People comparing the supplied content',
  primaryAction: 'Choose a next step',
  sections: ['Introduction', 'Content', 'Details'],
  motion: 'subtle',
  anchorSessionId: 'editorial',
  priorities,
  ...extra,
});

test('Three project priorities generate distinct actionable plans from the same measured references', () => {
  const retail = synthesizeDesignBrief(
    brief(['product-selection'], { project: 'Coffee retail', primaryAction: 'Shop coffees' }),
    refs,
  );
  const reading = synthesizeDesignBrief(
    brief(['reading'], {
      project: 'Literary journal',
      primaryAction: 'Read the issue',
      motion: 'none',
    }),
    refs,
  );
  const immersive = synthesizeDesignBrief(
    brief(['exploration'], {
      project: 'Interactive exhibition',
      primaryAction: 'Enter the exhibition',
      motion: 'expressive',
    }),
    refs,
  );
  assert.equal(retail.projectNeeds.basis, 'explicit-project-brief');
  assert.equal(retail.compatibleMixedSpec.assignments.composition, 'catalog');
  assert.equal(reading.compatibleMixedSpec.assignments.composition, 'editorial');
  assert.equal(reading.compatibleMixedSpec.assignments.motion, null);
  assert.equal(immersive.compatibleMixedSpec.assignments.motion, 'catalog');
  assert.match(retail.compatibleMixedSpec.decisions[0].constraint, /repeatable item slots/);
  assert.match(reading.compatibleMixedSpec.decisions[0].constraint, /ordered content index/);
  assert.match(immersive.compatibleMixedSpec.decisions[0].constraint, /alongside any visual scene/);
  assert.match(reading.compatibleMixedSpec.decisions[1].constraint, /60–70ch.*designer judgment/);
  assert.equal(retail.directionOptions.length, 2);
  assert.notEqual(
    retail.directionOptions[0].decisions[0].constraint,
    retail.directionOptions[1].decisions[0].constraint,
  );
});

test('Every major mixed decision is traceable to actual evidence or explicit project needs', () => {
  const result = synthesizeDesignBrief(brief(['product-selection']), refs);
  const ids = new Set(
    result.measuredComparisons.flatMap((r) =>
      [r.layouts, r.typography, r.navigation, r.motion, r.responsive.observations]
        .flat()
        .map((e) => e.evidenceId),
    ),
  );
  for (const d of result.compatibleMixedSpec.decisions) {
    assert.ok(d.briefFields.length, d.domain);
    for (const id of d.evidenceIds) assert.ok(ids.has(id), id);
    assert.ok(d.fallback && d.verify && d.uncertainty);
  }
  const catalog = result.measuredComparisons[1];
  assert.equal(catalog.layouts[0].columnCount, 3);
  assert.equal(catalog.motion[0].analysisId, 'owned-analysis');
  assert.equal(catalog.motion[0].observedTransitions.length, 2);
  assert.equal(catalog.motion[0].observedTransitions[1].to.expanded, 'false');
  assert.equal(catalog.responsive.status, 'multiple-width-observations');
  assert.equal(catalog.responsive.matchedLayoutChanges[0].selector, '#products');
  assert.equal(catalog.responsive.matchedLayoutChanges[0].reflowDifferenceObserved, true);
  assert.equal(catalog.responsive.matchedLayoutChanges[0].narrowWidth, 390);
  assert.equal(result.measuredComparisons[0].responsive.status, 'not-measured-across-widths');
  assert.equal(result.measuredComparisons[0].typeScale.headingToBodyRatio, 4);
});

test('Missing behavior and ambiguous brief are unknown rather than fabricated trigger or suitability claims', () => {
  const sparse = structuredClone(refs[0]);
  const result = synthesizeDesignBrief(
    { ...brief(undefined), project: 'Untitled', primaryAction: 'Continue', sections: ['Start'] },
    [sparse],
  );
  assert.equal(result.projectNeeds.basis, 'text-rule-inference');
  assert.deepEqual(result.projectNeeds.priorities, []);
  assert.equal(result.compatibleMixedSpec.assignments.motion, null);
  const motion = result.compatibleMixedSpec.decisions.find((d) => d.domain === 'motion');
  assert.deepEqual(motion.evidenceIds, []);
  assert.match(motion.constraint, /No selected trigger sequence/);
  assert.equal(result.measuredComparisons[0].motion.length, 0);
  assert.ok(result.nextActions.some((a) => a.includes('mimicus_analyze_element')));
  assert.ok(!('aestheticScore' in result));
});

test('Named grid lines and zero-size text do not inflate track or type-scale evidence', () => {
  const ref = structuredClone(refs[0]);
  ref.measured.layouts = [
    el('#named-grid', 'section', {
      display: 'grid',
      'grid-template-columns': '[start] 200px [middle] minmax(0px, 1fr) [end]',
    }),
  ];
  ref.measured.styleProfile.fonts[0].usages.push({ size: 0, weight: 400, count: 1 });
  const result = synthesizeDesignBrief(brief(['reading']), [ref]);
  assert.equal(result.measuredComparisons[0].layouts[0].columnCount, 2);
  assert.deepEqual(result.measuredComparisons[0].typeScale.sizesPx, [18, 72]);
  assert.deepEqual(result.measuredComparisons[0].typeScale.adjacentRatios, [4]);
});

test('Direction decisions skip offscreen links and visually hidden headings instead of treating them as the design system', () => {
  const ref = structuredClone(refs[0]);
  const skip = el('#skip', 'a', { display: 'flex' });
  skip.box = { x: 0, y: -36, width: 140, height: 30 };
  const hiddenHeading = el('#hidden-title', 'h1', { 'font-size': '16px' }, 1);
  hiddenHeading.box.height = 1;
  ref.measured.layouts.unshift(skip);
  ref.measured.typography.unshift(hiddenHeading);
  const result = synthesizeDesignBrief(brief(['reading']), [ref]);
  const decisions = result.compatibleMixedSpec.decisions;
  assert.deepEqual(decisions[0].evidenceIds, ['editorial:layout:1']);
  assert.deepEqual(decisions[1].evidenceIds, ['editorial:type:1']);
  assert.equal(result.measuredComparisons[0].typography[0].usableForDirection, false);
  assert.equal(result.measuredComparisons[0].layouts[0].usableForDirection, false);
  assert.equal(result.measuredComparisons[0].typeScale.headingToBodyRatio, 4);
});
