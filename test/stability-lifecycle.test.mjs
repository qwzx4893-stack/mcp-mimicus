import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { BrowserSessions } from '../dist/browser/sessions.js';
import { GuardedProxy, NetworkPolicy } from '../dist/security/network.js';
import { Mimicus } from '../dist/server.js';
import { config } from './helpers.mjs';

test('Failed background expiry is bounded diagnostic state rather than an unhandled rejection', async () => {
  const runtime = new BrowserSessions({ ...config('.'), sessionTtlMs: 1000 });
  runtime.expire = async () => {
    throw Error('Injected background expiry failure');
  };
  try {
    await delay(1150);
    assert.ok(runtime.status().maintenanceErrors.some((x) => x.includes('Injected background')));
    assert.equal(runtime.status().activeSessions, 0);
  } finally {
    await runtime.closeAll();
  }
});

test('Concurrent application shutdown joins one operation and waits for both resource owners even if one fails', async () => {
  const app = new Mimicus(config('.'));
  await app.browser.closeAll();
  await app.federation.close();
  let calls = 0,
    browserDone = false;
  app.federation.close = async () => {
    calls++;
    throw Error('Injected source cleanup failure');
  };
  app.browser.closeAll = async () => {
    await delay(50);
    browserDone = true;
  };
  const a = app.close(),
    b = app.close();
  assert.equal(a, b);
  await assert.rejects(a, /shutdown cleanup failed/);
  assert.equal(browserDone, true);
  assert.equal(calls, 1);
});

test('Closing an HTTP proxy tears down its owned upstream stream after a completed GET', {
  timeout: 10000,
}, async () => {
  let ended = false,
    resolveStarted;
  const started = new Promise((r) => (resolveStarted = r));
  const server = createServer((_, res) => {
    res.writeHead(200);
    res.write('first');
    const timer = setInterval(() => res.write('more'), 30);
    res.once('close', () => {
      clearInterval(timer);
      ended = true;
    });
    resolveStarted();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port,
    proxy = new GuardedProxy(new NetworkPolicy(config('.', origin))),
    url = new URL(await proxy.start());
  let client, received;
  try {
    const firstChunk = new Promise((resolve) => (received = resolve));
    client = request({ hostname: url.hostname, port: url.port, path: origin + '/' }, (res) => {
      res.once('data', () => received());
      res.resume();
      res.on('error', () => {});
    });
    client.on('error', () => {});
    client.end();
    await started;
    await firstChunk;
    await delay(30);
    await proxy.close();
    for (let n = 0; n < 20 && !ended; n++) await delay(10);
    assert.equal(ended, true, 'Origin socket remains live after owned proxy shutdown');
  } finally {
    client?.destroy();
    await proxy.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
