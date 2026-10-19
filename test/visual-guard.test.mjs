import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BrowserSessions } from '../dist/browser/sessions.js';
import { config, fixture } from './helpers.mjs';

test('Visual reset controls work while account resets remain blocked', {
  timeout: 60000,
}, async () => {
  const f = await fixture(),
    browser = new BrowserSessions(config('.', f.origin));
  try {
    f.setHtml(
      '<!doctype html><title>Visual controls</title><button id="view" onclick="this.textContent=\'Centered\'">Reset view</button><button id="account">Reset account</button><form><button id="form" type="button">Reset camera</button></form>',
    );
    const s = await browser.open({ url: f.url, authorized: true });
    await browser.interact(s.sessionId, { action: 'click', selector: '#view' });
    await assert.rejects(
      () => browser.interact(s.sessionId, { action: 'click', selector: '#account' }),
      /restricted/,
    );
    await assert.rejects(
      () => browser.interact(s.sessionId, { action: 'click', selector: '#form' }),
      /restricted/,
    );
  } finally {
    await browser.closeAll();
    await f.close();
  }
});

test('Ordinary waiting prose stays browseable while actual access-layer challenge pages stay blocked', {
  timeout: 60000,
}, async () => {
  const f = await fixture(),
    browser = new BrowserSessions(config('.', f.origin));
  try {
    f.setHtml(
      '<!doctype html><title>Original light exhibit</title><h1>A study in light</h1><p>No photographs. No sound. Just a moment to explore.</p>',
    );
    const s = await browser.open({ url: f.url, authorized: true });
    assert.equal(s.title, 'Original light exhibit');
    await browser.close(s.sessionId);
    f.setHtml(
      '<!doctype html><title>Just a moment...</title><form id="challenge-form">Verify you are human. Enable JavaScript and cookies to continue.</form>',
    );
    await assert.rejects(() => browser.open({ url: f.url, authorized: true }), /Access challenge/);
    assert.equal(browser.status().activeSessions, 0);
  } finally {
    await browser.closeAll();
    await f.close();
  }
});
test('An empty transient canvas readback is inconclusive rather than evidence of a static composited scene', {
  timeout: 60000,
}, async () => {
  const f = await fixture(),
    browser = new BrowserSessions(config('.', f.origin));
  try {
    f.setHtml(
      '<!doctype html><title>Owned empty readback</title><h1>Canvas boundary</h1><canvas id="surface" width="400" height="200" style="background:navy"></canvas><script>document.querySelector("canvas").getContext("2d");</script>',
    );
    const s = await browser.open({ url: f.url, authorized: true }),
      a = await browser.analyze(s.sessionId, { selector: '#surface' }),
      probe = a.observation.views[0].canvas.probes[0];
    assert.equal(probe.readable, true);
    assert.equal(probe.changed, null);
    assert.match(probe.limitation, /composited|screenshots/);
  } finally {
    await browser.closeAll();
    await f.close();
  }
});
