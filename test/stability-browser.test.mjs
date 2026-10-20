import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { BrowserSessions } from '../dist/browser/sessions.js';
import { config, fixture } from './helpers.mjs';

test('Concurrent closes join the same owned teardown and both observe completed release', {
  timeout: 45000,
}, async () => {
  const f = await fixture(),
    runtime = new BrowserSessions(config('.', f.origin));
  try {
    const opened = await runtime.open({ url: f.url, authorized: true }),
      owned = runtime.sessions.get(opened.sessionId),
      home = owned.browserEnvironment.home;
    const close = owned.browser.close.bind(owned.browser);
    let calls = 0;
    owned.browser.close = async () => {
      calls++;
      await delay(60);
      return close();
    };
    const results = await Promise.all([
      runtime.close(opened.sessionId),
      runtime.close(opened.sessionId),
    ]);
    assert.equal(calls, 1);
    assert.ok(results.every((r) => r.closed));
    assert.equal(existsSync(home), false);
    assert.equal(runtime.status().closingSessions, 0);
  } finally {
    await runtime.closeAll();
    await f.close();
  }
});

test('An observed proxy cleanup failure still releases the owned browser home', {
  timeout: 45000,
}, async () => {
  const f = await fixture(),
    runtime = new BrowserSessions(config('.', f.origin));
  try {
    const opened = await runtime.open({ url: f.url, authorized: true }),
      owned = runtime.sessions.get(opened.sessionId),
      home = owned.browserEnvironment.home;
    const close = owned.proxy.close.bind(owned.proxy);
    owned.proxy.close = async () => {
      await close();
      throw Error('Injected proxy cleanup report');
    };
    await assert.rejects(runtime.close(opened.sessionId), /Owned browser cleanup failed/);
    assert.equal(existsSync(home), false);
    assert.equal(runtime.status().activeSessions, 0);
    assert.equal(runtime.status().closingSessions, 0);
  } finally {
    await runtime.closeAll();
    await f.close();
  }
});
