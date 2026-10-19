import assert from 'node:assert/strict';
import { test } from 'node:test';
import { synthesizeDesignBrief } from '../dist/analysis/design-brief.js';

const ref = (sessionId) => ({
  sessionId,
  url: 'https://owned.example/' + sessionId,
  attribution: { kind: 'owned-test' },
  measured: {
    styleProfile: {
      palette: [{ hex: '#153f42', count: 3 }],
      spacingScale: [8, 16],
      fonts: [],
      evidence: 'Owned test computed-style fixture',
    },
    layouts: [],
    navigation: [],
    animations: [],
    engines: [],
  },
});
test('A design brief keeps source observations separate from original advice and respects the chosen anchor', () => {
  const brief = {
      project: 'Owned coffee shop',
      audience: 'Local customers',
      primaryAction: 'Explore coffee',
      sections: ['Hero', 'Products', 'Visit'],
      motion: 'subtle',
      anchorSessionId: 'second',
    },
    result = synthesizeDesignBrief(brief, [ref('first'), ref('second')]);
  assert.equal(result.selectedAnchor.sessionId, 'second');
  assert.equal(result.observedReferences.length, 2);
  assert.equal(result.observedReferences[0].attribution.kind, 'owned-test');
  assert.deepEqual(result.direction.composition.sectionOrder, brief.sections);
  assert.equal(result.kind, 'independently-written-evidence-grounded-guidance');
  assert.ok(result.verificationCriteria.some((c) => c.method.includes('aesthetic superiority')));
});
test('Unsupported design anchors fail rather than silently synthesizing from the wrong page', () => {
  assert.throws(
    () =>
      synthesizeDesignBrief(
        {
          project: 'Owned',
          audience: 'Readers',
          primaryAction: 'Read',
          sections: ['Stories'],
          motion: 'none',
          anchorSessionId: 'missing',
        },
        [ref('first'), ref('second')],
      ),
    /anchor/,
  );
});
