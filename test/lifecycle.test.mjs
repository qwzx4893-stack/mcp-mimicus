import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BrowserSessions } from '../dist/browser/sessions.js';
import { Federation } from '../dist/discovery/federation.js';
import { config, fixture } from './helpers.mjs';

test('Same-document fragment links work while external and download anchors stay restricted', {
  timeout: 45000,
}, async () => {
  const f = await fixture();
  f.setHtml(
    '<!doctype html><title>Owned links</title><a id="local" href="#work">Work</a><a id="external" href="https://example.com/">External</a><a id="file" href="#work" download>Download</a><section id="work" style="margin-top:1000px">Work</section>',
  );
  const sessions = new BrowserSessions(config('.', f.origin));
  try {
    const s = await sessions.open({ url: f.url, authorized: true }),
      result = await sessions.interact(s.sessionId, { action: 'click', selector: '#local' });
    assert.ok(result.data.url.endsWith('#work'));
    await assert.rejects(
      () => sessions.interact(s.sessionId, { action: 'click', selector: '#external' }),
      /restricted/,
    );
    await assert.rejects(
      () => sessions.interact(s.sessionId, { action: 'click', selector: '#file' }),
      /restricted/,
    );
  } finally {
    await sessions.closeAll();
    await f.close();
  }
});
test('Native details navigation is clickable, measurable and resets after a controlled probe', {
  timeout: 45000,
}, async () => {
  const f = await fixture();
  f.setHtml(
    '<!doctype html><title>Owned native details</title><details><summary id="toggle">Menu</summary><nav>Projects and contact</nav></details>',
  );
  const sessions = new BrowserSessions(config('.', f.origin));
  try {
    const s = await sessions.open({ url: f.url, authorized: true });
    await sessions.interact(s.sessionId, { action: 'click', selector: '#toggle' });
    assert.equal(
      (await sessions.explore(s.sessionId)).regions.find((r) => r.selector === '#toggle').expanded,
      'true',
    );
    await sessions.interact(s.sessionId, { action: 'click', selector: '#toggle' });
    const a = await sessions.analyze(s.sessionId, {
      selector: '#toggle',
      trigger: 'click',
      probeReset: true,
    });
    assert.ok(a.components.some((c) => c.family === 'sampled-state-interaction'));
    assert.equal(
      (await sessions.explore(s.sessionId)).regions.find((r) => r.selector === '#toggle').expanded,
      'false',
    );
  } finally {
    await sessions.closeAll();
    await f.close();
  }
});
test('Session expiry, aborted page interaction and shutdown release real Chromium contexts', {
  timeout: 45000,
}, async () => {
  const f = await fixture(),
    sessions = new BrowserSessions({ ...config('.', f.origin), sessionTtlMs: 1000 });
  try {
    const first = await sessions.open({ url: f.url, authorized: true }),
      native = sessions.sessions.get(first.sessionId).browser;
    await new Promise((ok) => setTimeout(ok, 1250));
    await assert.rejects(() => sessions.capture(first.sessionId), /expired|closed|unknown/);
    assert.equal(sessions.status().activeSessions, 0);
    const cleanupDeadline = Date.now() + 5000;
    while (
      (native.isConnected() || sessions.status().closingSessions > 0) &&
      Date.now() < cleanupDeadline
    )
      await new Promise((ok) => setTimeout(ok, 25));
    assert.equal(native.isConnected(), false);
    assert.equal(sessions.status().closingSessions, 0);
    const second = await sessions.open({ url: f.url, authorized: true });
    const browser = sessions.sessions.get(second.sessionId).browser,
      controller = new AbortController(),
      pending = sessions.interact(
        second.sessionId,
        { action: 'wait', waitMs: 5000 },
        controller.signal,
      );
    setTimeout(() => controller.abort(), 100);
    await assert.rejects(() => pending);
    assert.equal(sessions.status().activeSessions, 0);
    await sessions.closeAll();
    assert.equal(browser.isConnected(), false);
  } finally {
    await sessions.closeAll();
    await f.close();
  }
});
test('Selected alias selectors produce usable specs; guarded navigation never executes destructive URLs', {
  timeout: 45000,
}, async () => {
  const f = await fixture(),
    sessions = new BrowserSessions(config('.', f.origin));
  try {
    const s = await sessions.open({ url: f.url, authorized: true }),
      alias = 'section[id="editorial"]',
      a = await sessions.analyze(s.sessionId, { selector: alias });
    assert.ok(a.components.length);
    assert.ok(a.components.every((c) => c.selector === alias));
    assert.equal(sessions.spec(s.sessionId, a.analysisId).measured.selector, alias);
    await assert.rejects(
      () =>
        sessions.interact(s.sessionId, { action: 'navigate', url: f.origin + '/account/delete' }),
      /state-changing/,
    );
    assert.equal(f.hits.includes('/account/delete'), false);
  } finally {
    await sessions.closeAll();
    await f.close();
  }
});
test('Discovery rejects unsupported streams and expires RAM operations without worker activity', async () => {
  let calls = 0;
  const fed = new Federation({ ...config('.'), operationTtlMs: 1000 }, undefined, [
    {
      id: 'nuxt',
      search: async () => {
        calls++;
        return [
          {
            provider: 'nuxt',
            stream: 'showcase',
            status: 'available',
            records: [],
            coverage: 'Owned empty adapter',
            diagnostics: [],
            retrievedAt: new Date().toISOString(),
          },
        ];
      },
    },
  ]);
  try {
    await assert.rejects(
      () => fed.search({ providers: ['codrops'], stream: 'websites' }),
      /Stream/,
    );
    const r = await fed.search({ providers: ['nuxt'], retrieval: 'lexical' });
    await new Promise((ok) => setTimeout(ok, 1250));
    assert.equal(fed.status().activeOperations, 0);
    assert.throws(() => fed.categories(r.operationId), /expired|closed/);
    assert.equal(calls, 1);
  } finally {
    await fed.close();
  }
});
test('A source deadline retains completed source results and closing an operation aborts its active fetch', async () => {
  let stopped = 0;
  const quick = {
      id: 'nuxt',
      search: async () => [
        {
          provider: 'nuxt',
          stream: 'showcase',
          status: 'available',
          records: [],
          coverage: 'Owned quick adapter',
          diagnostics: [],
          retrievedAt: new Date().toISOString(),
        },
      ],
    },
    slow = {
      id: 'astro',
      search: (c) =>
        new Promise((_, reject) => {
          c.signal.addEventListener(
            'abort',
            () => {
              stopped++;
              reject(c.signal.reason);
            },
            { once: true },
          );
        }),
    };
  const fed = new Federation({ ...config('.'), timeoutMs: 1000 }, undefined, [quick, slow]);
  try {
    const r = await fed.search({ retrieval: 'lexical' });
    assert.ok(r.sources.some((s) => s.provider === 'nuxt' && s.status === 'available'));
    assert.ok(r.sources.some((s) => s.provider === 'astro' && s.status === 'unavailable'));
    assert.equal(stopped, 1);
    fed.end(r.operationId);
    const pending = fed.search({ retrieval: 'lexical' });
    await new Promise((ok) => setTimeout(ok, 30));
    const operationId = [...fed.operations.keys()][0];
    fed.end(operationId);
    await assert.rejects(() => pending);
    assert.equal(stopped, 2);
    assert.equal(fed.status().retainedReferences, 0);
  } finally {
    await fed.close();
  }
});
