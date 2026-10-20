import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BrowserSessions } from '../dist/browser/sessions.js';
import { ConfigSchema } from '../dist/config.js';
import { config, fixture } from './helpers.mjs';

test('Default capacity supports three observed references and idle renewal preserves absolute and cumulative budgets', {
  timeout: 60000,
}, async () => {
  assert.equal(ConfigSchema.parse({}).maxSessions, 3);
  const f = await fixture(),
    runtime = new BrowserSessions({
      ...config('.', f.origin),
      sessionTtlMs: 1000,
      sessionAbsoluteTtlMs: 30000,
    });
  try {
    const opened = await runtime.open({ url: f.url, authorized: true });
    const original = runtime.status().sessions[0];
    await new Promise((r) => setTimeout(r, 700));
    const renewal = await runtime.interact(opened.sessionId, { action: 'renew' });
    assert.equal(renewal.images.length, 0);
    assert.equal(renewal.data.lease.absoluteExpiresAt, original.absoluteExpiresAt);
    assert.ok(Date.parse(renewal.data.lease.idleExpiresAt) > Date.parse(original.idleExpiresAt));
    await new Promise((r) => setTimeout(r, 650));
    const capture = await runtime.capture(opened.sessionId);
    assert.equal(capture.images.length, 1);
    assert.equal(capture.data.diagnostics.lease.images, 1);
    assert.equal(runtime.status().sessions[0].images, 1);
  } finally {
    await runtime.closeAll();
    await f.close();
  }
});

test('Image budgets cannot be reset by renewal; absolute expiry closes an in-flight wait', {
  timeout: 60000,
}, async () => {
  const f = await fixture();
  const runtime = new BrowserSessions({
    ...config('.', f.origin),
    maxSessionImages: 1,
    maxSessionOperations: 10,
    sessionAbsoluteTtlMs: 5000,
  });
  try {
    const s = await runtime.open({ url: f.url, authorized: true });
    await runtime.capture(s.sessionId);
    await runtime.interact(s.sessionId, { action: 'renew' });
    await assert.rejects(runtime.capture(s.sessionId), /image budget/);
    await assert.rejects(
      runtime.interact(s.sessionId, { action: 'wait', waitMs: 5000 }),
      /closed|aborted|Timeout|expired/i,
    );
    await runtime.closeAll();
    assert.equal(runtime.status().activeSessions, 0);
    assert.equal(runtime.status().closingSessions, 0);
  } finally {
    await runtime.closeAll();
    await f.close();
  }
});

test('Exhausted operation budget closes its owned session instead of being reset by renewal', {
  timeout: 45000,
}, async () => {
  const f = await fixture(),
    runtime = new BrowserSessions({ ...config('.', f.origin), maxSessionOperations: 2 });
  try {
    const s = await runtime.open({ url: f.url, authorized: true });
    await runtime.interact(s.sessionId, { action: 'renew' });
    await assert.rejects(
      runtime.interact(s.sessionId, { action: 'renew' }),
      /operation budget exhausted/,
    );
    assert.equal(runtime.status().activeSessions, 0);
    assert.equal(runtime.status().closingSessions, 0);
  } finally {
    await runtime.closeAll();
    await f.close();
  }
});

test('Awwwards authorized browser navigation reaches normal executable validation without a source-wide ban', async () => {
  const runtime = new BrowserSessions(
    ConfigSchema.parse({ browserExecutable: 'C:/mimicus-nonexistent-test-browser/chrome.exe' }),
  );
  try {
    await assert.rejects(
      runtime.open({ url: 'https://www.awwwards.com/websites/', authorized: true }),
      /ENOENT|not found|executable|not exist|missing|unsupported/i,
    );
    assert.equal(runtime.status().activeSessions, 0);
  } finally {
    await runtime.closeAll();
  }
});
