import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { BrowserSessions } from '../dist/browser/sessions.js';
import { config, fixture } from './helpers.mjs';

test('Actual temporary visual browsing, navigation/reset, responsive viewing, filmstrip, targeted analysis/spec and cleanup', {
  timeout: 150000,
}, async () => {
  const f = await fixture(),
    sessions = new BrowserSessions({ ...config('.', f.origin), sampleMs: 650 });
  let reference, target;
  try {
    reference = await sessions.open({ url: f.url, authorized: true });
    assert.ok(reference.title);
    const capture = await sessions.capture(reference.sessionId);
    const bytes = Buffer.from(capture.images[0].data, 'base64');
    assert.equal(bytes[0], 255);
    assert.equal(bytes[1], 216);
    assert.ok(bytes.length > 5000);
    const sections = await sessions.explore(reference.sessionId);
    assert.ok(sections.regions.some((r) => r.selector === '#editorial'));
    await sessions.interact(reference.sessionId, { action: 'click', selector: '#menu' });
    const opened = await sessions.explore(reference.sessionId);
    assert.equal(opened.regions.find((r) => r.selector === '#menu').expanded, 'true');
    await sessions.interact(reference.sessionId, { action: 'key', key: 'Escape' });
    assert.equal(
      (await sessions.explore(reference.sessionId)).regions.find((r) => r.selector === '#menu')
        .expanded,
      'false',
    );
    await sessions.interact(reference.sessionId, {
      action: 'resize',
      viewport: { width: 390, height: 844 },
      reducedMotion: true,
    });
    assert.equal((await sessions.capture(reference.sessionId)).data.viewport.width, 390);
    await sessions.interact(reference.sessionId, {
      action: 'resize',
      viewport: { width: 1280, height: 800 },
      reducedMotion: false,
    });
    await sessions.interact(reference.sessionId, { action: 'hover', selector: '#reveal' });
    const motion = await sessions.motion(reference.sessionId, {
      selector: 'svg',
      frames: 3,
      intervalMs: 130,
    });
    assert.equal(motion.images.length, 3);
    assert.ok(
      new Set(motion.images.map((i) => createHash('sha256').update(i.data).digest('hex'))).size > 1,
      'Filmstrip must show actual changing frames',
    );
    assert.ok(motion.data.frames[2].tMs > motion.data.frames[0].tMs);
    const analysis = await sessions.analyze(reference.sessionId, {
      selector: '#reveal',
      trigger: 'hover',
    });
    const component = analysis.components.find((c) => c.family === 'hover-transition');
    assert.ok(component);
    const spec = sessions.spec(reference.sessionId, analysis.analysisId, component.id);
    assert.match(spec.implementation.example.code, /clip-path/);
    assert.equal(spec.retention, 'Temporary session evidence only');
    target = await sessions.open({ url: f.origin + '/implementation', authorized: true });
    const verified = await sessions.verify(
      reference.sessionId,
      analysis.analysisId,
      target.sessionId,
      '#reveal',
      component.id,
    );
    assert.equal(verified.withinMeasuredTolerances, true, JSON.stringify(verified));
    const nested = await sessions.analyze(reference.sessionId, {
      selector: '#slide',
      trigger: 'scroll',
      scrollContainer: '#horizontal',
    });
    assert.ok(nested.components.some((c) => c.family === 'horizontal-scroll-component'));
    const svg = await sessions.analyze(reference.sessionId, {
      selector: '#stroke',
      trigger: 'time',
    });
    assert.ok(svg.components.some((c) => c.family === 'svg-stroke-animation'));
    await assert.rejects(
      () =>
        sessions.interact(reference.sessionId, { action: 'navigate', url: f.origin + '/private' }),
      /robots/,
    );
    await assert.rejects(
      () => sessions.open({ url: 'http://169.254.169.254/latest/meta-data', authorized: true }),
      /limit|Unsafe/,
    );
    const native = sessions.sessions.get(reference.sessionId).browser;
    await sessions.close(reference.sessionId);
    assert.equal(native.isConnected(), false);
    assert.throws(() => sessions.spec(reference.sessionId, analysis.analysisId), /closed|unknown/);
    await sessions.close(target.sessionId);
    assert.equal(sessions.status().activeSessions, 0);
  } finally {
    await sessions.closeAll();
    await f.close();
  }
});
