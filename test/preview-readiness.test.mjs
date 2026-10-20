import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { previewReferences } from '../dist/browser/previews.js';
import { BrowserSessions } from '../dist/browser/sessions.js';
import { config, fixture } from './helpers.mjs';

const html =
  '<!doctype html><title>Owned readiness</title><style>body{font:40px system-ui;background:#345;color:white}#loader{position:fixed;inset:0;background:#111}</style><h1>Original content</h1><div id="loader" aria-busy="true">Loading</div>';

test('Actual capture waits for a transient loader and returns readiness evidence from the final frame', {
  timeout: 40000,
}, async () => {
  const f = await fixture();
  f.setHtml(html);
  const browser = new BrowserSessions(config('.', f.origin));
  try {
    const { sessionId } = await browser.open({ url: f.url, authorized: true });
    await browser.sessions
      .get(sessionId)
      .page.evaluate(() => setTimeout(() => document.querySelector('#loader').remove(), 700));
    const r = await browser.capture(sessionId, undefined, undefined, { waitForReadyMs: 2500 });
    assert.equal(r.data.readiness.visualState.loadingOverlay, false);
    assert.equal(r.data.readiness.readinessWait.outcome, 'ready-observed');
    assert.ok(r.data.readiness.readinessWait.samples > 1);
    assert.ok(Buffer.from(r.images[0].data, 'base64').length > 5000);
  } finally {
    await browser.closeAll();
    await f.close();
  }
});

test('Permanent preloaders and consent/password gates stay visible and have honest bounded outcomes', {
  timeout: 45000,
}, async () => {
  const f = await fixture();
  f.setHtml(html);
  const browser = new BrowserSessions(config('.', f.origin));
  try {
    const { sessionId } = await browser.open({ url: f.url, authorized: true });
    const permanent = await browser.capture(sessionId, undefined, undefined, {
      waitForReadyMs: 300,
    });
    assert.equal(permanent.data.readiness.visualState.loadingOverlay, true);
    assert.equal(permanent.data.readiness.readinessWait.outcome, 'budget-exhausted');
    await browser.sessions.get(sessionId).page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'password';
      document.body.append(input);
    });
    const gated = await browser.capture(sessionId, undefined, undefined, { waitForReadyMs: 5000 });
    assert.equal(gated.data.readiness.readinessWait.outcome, 'gate-observed');
    assert.equal(gated.data.readiness.readinessWait.samples, 1);
    assert.equal(gated.data.readiness.visualState.keyGate, true);
  } finally {
    await browser.closeAll();
    await f.close();
  }
});

test('An access challenge appearing during readiness waiting is refused and preview cleanup completes', {
  timeout: 40000,
}, async () => {
  const f = await fixture();
  f.setHtml(html);
  const browser = new BrowserSessions(config('.', f.origin));
  const open = browser.open.bind(browser);
  browser.open = async (...args) => {
    const result = await open(...args);
    await browser.sessions.get(result.sessionId).page.evaluate(() =>
      setTimeout(() => {
        document.title = 'Just a moment...';
      }, 200),
    );
    return result;
  };
  try {
    const r = await previewReferences(browser, [{ key: 'late', url: f.url }], {
      waitForReadyMs: 1000,
    });
    assert.equal(r.images.length, 0);
    assert.equal(r.data.references[0].status, 'blocked');
    assert.equal(r.data.references[0].failureCode, 'access-denied');
    assert.equal(r.data.references[0].stage, 'capture');
    assert.equal(browser.status().activeSessions, 0);
    assert.equal(browser.status().closingSessions, 0);
  } finally {
    await browser.closeAll();
    await f.close();
  }
});

test('Abort during a real readiness wait releases the owned process and home before shutdown completes', {
  timeout: 40000,
}, async () => {
  const f = await fixture();
  f.setHtml(html);
  const browser = new BrowserSessions(config('.', f.origin));
  try {
    const { sessionId } = await browser.open({ url: f.url, authorized: true });
    const home = browser.sessions.get(sessionId).browserEnvironment.home;
    const controller = new AbortController();
    const result = browser.capture(sessionId, undefined, controller.signal, {
      waitForReadyMs: 5000,
    });
    const rejection = assert.rejects(result);
    await delay(100);
    controller.abort(new Error('Cancelled waiting capture'));
    await rejection;
    await browser.closeAll();
    assert.equal(browser.status().activeSessions, 0);
    assert.equal(browser.status().closingSessions, 0);
    assert.equal(existsSync(home), false);
  } finally {
    await browser.closeAll();
    await f.close();
  }
});
