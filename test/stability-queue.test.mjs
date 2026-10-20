import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { LocalSemantic } from '../dist/semantic.js';
import { mapBounded } from '../dist/util.js';
import { config } from './helpers.mjs';

test('Queued inference cancellation returns promptly while later inference remains serialized', {
  timeout: 5000,
}, async () => {
  const model = new LocalSemantic({ ...config('.'), semanticEnabled: true });
  let releaseFirst,
    started,
    active = 0,
    maximum = 0;
  const held = new Promise((r) => (releaseFirst = r)),
    firstStarted = new Promise((r) => (started = r));
  model.extractor = async (texts) => {
    active++;
    maximum = Math.max(maximum, active);
    try {
      if (texts[0] === 'first') {
        started();
        await held;
      }
      return { tolist: () => texts.map(() => Array(384).fill(1 / Math.sqrt(384))) };
    } finally {
      active--;
    }
  };
  const first = model.embed(['first']);
  await firstStarted;
  const cancel = new AbortController();
  const queued = model.embed(['queued'], cancel.signal).then(
    () => 'resolved',
    () => 'cancelled',
  );
  const third = model.embed(['third']);
  try {
    cancel.abort(new Error('Caller stopped queued inference'));
    const result = await Promise.race([queued, delay(150).then(() => 'still queued')]);
    assert.equal(result, 'cancelled');
    assert.equal(active, 1);
    releaseFirst();
    await first;
    await third;
    assert.equal(maximum, 1);
    assert.equal(model.status().pending, 0);
  } finally {
    releaseFirst();
    await Promise.allSettled([first, queued, third]);
    await model.close();
  }
});

test('Bounded work rejects falsy thrown values and stops admitting new siblings', async () => {
  for (const reason of [0, false, null, undefined]) {
    let state,
      started = 0;
    await mapBounded([1, 2, 3, 4], 2, async (n) => {
      started++;
      if (n === 1) throw reason;
      await delay(5);
      return n;
    }).then(
      () => (state = 'resolved'),
      (e) => (state = Object.is(e, reason) ? 'rejected' : 'wrong reason'),
    );
    assert.equal(state, 'rejected');
    assert.ok(started <= 2);
  }
});

test('Bounded work preserves input order, enforces parallelism and rejects pre-aborted work before calling it', async () => {
  let active = 0,
    maximum = 0;
  const result = await mapBounded([3, 1, 2], 2, async (n) => {
    active++;
    maximum = Math.max(maximum, active);
    await delay(n * 5);
    active--;
    return n * 10;
  });
  assert.deepEqual(result, [30, 10, 20]);
  assert.equal(maximum, 2);
  const controller = new AbortController();
  controller.abort(new Error('Stopped before admission'));
  let called = false;
  await assert.rejects(
    mapBounded(
      [1],
      1,
      async () => {
        called = true;
      },
      controller.signal,
    ),
    /Stopped before admission/,
  );
  assert.equal(called, false);
});

test('Cancelled inference slots remain bounded until their predecessor ends and concurrent close disposes the model once', {
  timeout: 5000,
}, async () => {
  const model = new LocalSemantic({ ...config('.'), semanticEnabled: true });
  let release,
    started,
    disposed = 0;
  const held = new Promise((r) => (release = r));
  const running = new Promise((r) => (started = r));
  model.extractor = Object.assign(
    async (texts) => {
      started();
      await held;
      return { tolist: () => texts.map(() => Array(384).fill(1 / Math.sqrt(384))) };
    },
    {
      dispose: async () => {
        disposed++;
      },
    },
  );
  const first = model.embed(['held']);
  await running;
  try {
    for (let i = 0; i < 7; i++) {
      const controller = new AbortController();
      controller.abort(new Error('Cancelled queued work'));
      await assert.rejects(model.embed(['queued'], controller.signal), /Cancelled queued work/);
    }
    assert.equal(model.status().pending, 8);
    await assert.rejects(model.embed(['overflow']), /queue full/);
    const a = model.close(),
      b = model.close();
    assert.equal(a, b);
    release();
    await first;
    await a;
    assert.equal(disposed, 1);
    assert.equal(model.status().pending, 0);
    await assert.rejects(model.embed(['closed']), /closed/);
  } finally {
    release();
    await Promise.allSettled([first, model.close()]);
  }
});
