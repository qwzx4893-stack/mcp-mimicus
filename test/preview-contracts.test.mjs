import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { previewReferences } from '../dist/browser/previews.js';

function fake({ openError, captureError, closeError, onClose } = {}) {
  const events = [],
    active = new Set();
  return {
    events,
    active,
    async open(o, signal) {
      events.push(['open', o.url]);
      if (openError) throw Error(openError);
      signal?.throwIfAborted();
      active.add(o.url);
      return {
        sessionId: o.url,
        diagnostics: { browser: { selection: 'test-only', browser: 'fault-injection' } },
      };
    },
    async capture(id) {
      if (captureError) throw Error(captureError);
      return {
        images: [
          { type: 'image', mimeType: 'image/jpeg', data: Buffer.from(id).toString('base64') },
        ],
        data: {
          url: id,
          readiness: { visualState: {}, images: { visible: 0, visibleLoaded: 0 }, fonts: 'loaded' },
          diagnostics: { blocked: [], requests: 0, errors: [] },
        },
      };
    },
    async close(id) {
      events.push(['close', id]);
      await onClose?.();
      active.delete(id);
      if (closeError) throw Error(closeError);
    },
  };
}
const refs = (n) =>
  Array.from({ length: n }, (_, i) => ({ key: String(i), url: `https://owned.example/${i}` }));

test('Preview diagnostics distinguish origin approval, refusal, deadline and capacity without automatic retries', async () => {
  for (const [message, code, status] of [
    [
      'Origin is not operator-approved; configure MIMICUS_ALLOWED_ORIGINS',
      'origin-approval-required',
      'blocked',
    ],
    ['robots access HTTP 403', 'robots-denied', 'blocked'],
    ['Access challenge encountered', 'access-denied', 'blocked'],
    ['Navigation timed out', 'deadline-exceeded', 'unavailable'],
    ['Temporary browser session capacity reached', 'resource-limit', 'unavailable'],
  ]) {
    const browser = fake({ openError: message });
    const { data } = await previewReferences(browser, refs(1));
    assert.equal(data.references[0].failureCode, code);
    assert.equal(data.references[0].status, status);
    assert.ok(data.references[0].nextAction.length);
    assert.equal(browser.events.length, 1);
  }
});

test('Captured frames survive a reported cleanup failure and the batch stops admitting new owners', async () => {
  const browser = fake({ closeError: 'Injected proxy cleanup report' });
  const result = await previewReferences(browser, refs(3));
  assert.equal(result.images.length, 1);
  assert.equal(result.data.executionStatus, 'cleanup-failed');
  assert.equal(result.data.references[0].cleanup.status, 'failed');
  assert.equal(result.data.references[1].failureCode, 'cleanup-failed');
  assert.equal(result.data.references[2].status, 'not-yet-previewed');
  assert.equal(browser.events.filter(([e]) => e === 'open').length, 1);
  assert.equal(browser.active.size, 0);
});

test('Cancellation during the final close is observed after owned cleanup and cannot return successful images', async () => {
  const controller = new AbortController();
  const browser = fake({
    onClose: async () => {
      controller.abort(new Error('Stopped during cleanup'));
      await delay(10);
    },
  });
  await assert.rejects(
    previewReferences(browser, refs(1), { signal: controller.signal }),
    /Stopped during cleanup/,
  );
  assert.equal(browser.active.size, 0);
});

test('Seeded batch fault campaign preserves ordering, byte limits and zero owned references', async () => {
  let seed = 0x51a77e;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed;
  };
  for (let trial = 0; trial < 500; trial++) {
    const count = 1 + (random() % 8);
    const kind = random() % 4;
    const browser = fake(
      kind === 1
        ? { captureError: 'Injected capture timeout' }
        : kind === 2
          ? { openError: 'robots denied' }
          : {},
    );
    const byteLimit = 1 + (random() % 200);
    const result = await previewReferences(browser, refs(count), { byteLimit });
    assert.equal(result.data.references.length, count);
    assert.equal(browser.active.size, 0);
    assert.ok(result.data.bytes <= byteLimit);
    assert.equal(
      result.data.bytes,
      result.images.reduce((n, i) => n + Buffer.from(i.data, 'base64').length, 0),
    );
    const indices = result.data.references
      .filter((r) => r.imageIndex !== null)
      .map((r) => r.imageIndex);
    assert.deepEqual(
      indices,
      result.images.map((_, i) => i),
    );
    assert.deepEqual(
      result.data.references.map((r) => r.inputIndex),
      Array.from({ length: count }, (_, i) => i),
    );
    assert.equal(
      browser.events.filter(([e]) => e === 'close').length,
      browser.events.filter(([e]) => e === 'open').length * (kind === 2 ? 0 : 1),
    );
  }
});

test('Explicit preview options and original provenance reach the owned browser without silent approval changes', async () => {
  const browser = fake(),
    open = browser.open.bind(browser),
    capture = browser.capture.bind(browser);
  const reference = {
    ...refs(1)[0],
    title: 'Owned original',
    attribution: { source: 'selected' },
    resourceOrigins: ['https://assets.owned.example'],
    alternatives: [{ id: 'other', url: 'https://other.example', title: 'Other' }],
  };
  browser.open = async (input, signal) => {
    assert.equal(input.authorized, true);
    assert.deepEqual(input.viewport, { width: 390, height: 844 });
    assert.deepEqual(input.resourceOrigins, reference.resourceOrigins);
    assert.deepEqual(input.attribution, reference.attribution);
    return open(input, signal);
  };
  browser.capture = async (id, selector, signal, options) => {
    assert.equal(options.waitForReadyMs, 0);
    return capture(id, selector, signal);
  };
  const { data } = await previewReferences(browser, [reference], {
    viewport: { width: 390, height: 844 },
    waitForReadyMs: 0,
    perReferenceTimeoutMs: 50000,
    budgetMs: 100000,
    byteLimit: 9000000,
  });
  assert.equal(data.limits.waitForReadyMs, 0);
  assert.equal(data.limits.perReferenceTimeoutMs, 20000);
  assert.equal(data.limits.budgetMs, 60000);
  assert.equal(data.limits.byteLimit, 4000000);
  assert.equal(data.references[0].title, reference.title);
  assert.deepEqual(data.references[0].attribution, reference.attribution);
  assert.deepEqual(data.references[0].alternatives, reference.alternatives);
  assert.equal(data.references[0].requestedUrl, reference.url);
  assert.equal(data.references[0].actualUrl, reference.url);
  assert.equal(data.references[0].cleanup.status, 'closed');
  assert.equal(data.executionStatus, 'completed');
  assert.equal(data.untrustedEvidence, true);
});

test('A per-reference deadline actually interrupts pending open and does not become an unlimited wait', async () => {
  const browser = fake();
  browser.open = async (_, signal) =>
    Promise.race([
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
      ),
      delay(200).then(() => {
        throw Error('Upstream refused');
      }),
    ]);
  const r = await previewReferences(browser, refs(1), { perReferenceTimeoutMs: 20 });
  assert.equal(r.data.references[0].failureCode, 'deadline-exceeded');
  assert.equal(r.data.references[0].stage, 'open');
  assert.equal(r.data.capturedImages, 0);
});

test('Time and exact image-byte boundaries stop new admission while invalid references never launch a browser', async () => {
  await assert.rejects(previewReferences(fake(), []), /one and eight/);
  await assert.rejects(previewReferences(fake(), refs(9)), /one and eight/);
  const invalid = fake();
  const invalidResult = await previewReferences(invalid, [
    { key: 'missing' },
    { key: 'expired', url: 'https://owned.example/', error: 'Reference expired' },
  ]);
  assert.equal(invalid.events.length, 0);
  assert.ok(invalidResult.data.references.every((x) => x.failureCode === 'invalid-reference'));
  const exact = fake(),
    byteLength = Buffer.byteLength(refs(1)[0].url);
  const accepted = await previewReferences(exact, refs(2), { byteLimit: byteLength });
  assert.equal(accepted.images.length, 1);
  assert.equal(exact.events.filter(([x]) => x === 'open').length, 1);
  const expired = fake(),
    capture = expired.capture.bind(expired);
  expired.capture = async (...args) => {
    await delay(600);
    return capture(...args);
  };
  const bounded = await previewReferences(expired, refs(2), { budgetMs: 1500 });
  assert.equal(bounded.images.length, 1);
  assert.equal(bounded.data.references[1].failureCode, 'batch-budget-exhausted');
  assert.ok(bounded.data.elapsedMs >= 100 && bounded.data.elapsedMs < 3000);
});

test('Partial-frame guidance describes loading, consent, password, image, font and resource uncertainty independently', async () => {
  for (const [change, expected] of [
    [
      (r) => {
        r.data.readiness.visualState.loadingOverlay = true;
      },
      /loading/,
    ],
    [
      (r) => {
        r.data.readiness.visualState.consentOverlay = true;
      },
      /consent/,
    ],
    [
      (r) => {
        r.data.readiness.visualState.keyGate = true;
      },
      /password|key/,
    ],
    [
      (r) => {
        r.data.readiness.images.visible = 1;
      },
      /images/,
    ],
    [
      (r) => {
        r.data.readiness.fonts = 'loading';
      },
      /Font/,
    ],
    [
      (r) => {
        r.data.diagnostics.blocked = ['owned resource refusal'];
      },
      /resource/,
    ],
  ]) {
    const browser = fake(),
      capture = browser.capture.bind(browser);
    browser.capture = async (...args) => {
      const r = await capture(...args);
      change(r);
      return r;
    };
    const { data } = await previewReferences(browser, refs(1));
    assert.equal(data.executionStatus, 'completed-with-limits');
    assert.equal(data.references[0].status, 'partial-render');
    assert.match(data.references[0].reasons.join(' '), expected);
    assert.match(data.references[0].nextAction, /partial frame/);
  }
});

test('Caller abort reaches pending open and long failure diagnostics stay bounded', async () => {
  const controller = new AbortController(),
    browser = fake();
  browser.open = async (_, signal) => {
    controller.abort(new Error('Caller stopped'));
    signal.throwIfAborted();
  };
  await assert.rejects(
    previewReferences(browser, refs(1), { signal: controller.signal }),
    /Caller stopped/,
  );
  const r = await previewReferences(fake({ openError: 'x'.repeat(5000) }), refs(1));
  assert.equal(r.data.references[0].reason.length, 1200);
  assert.equal(r.data.references[0].failureCode, 'navigation-or-capture-failed');
});
