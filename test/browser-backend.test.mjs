import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import {
  classifyBrowser,
  commandExecutable,
  inspectWindowsAssociation,
  resolveBrowserBackend,
} from '../dist/browser/backend.js';
import { BrowserSessions } from '../dist/browser/sessions.js';
import { config, fixture } from './helpers.mjs';

test('A real browser page-setup failure before session registration releases browser, proxy, profile and home', {
  timeout: 45000,
}, async () => {
  const f = await fixture(),
    runtime = new BrowserSessions(config(null, f.origin)),
    originalLaunch = chromium.launch;
  let launched, home, profile, proxy;
  chromium.launch = async function (options) {
    const browser = await originalLaunch.call(this, options);
    launched = browser;
    home = options.env.USERPROFILE;
    proxy = options.proxy.server;
    const connection = await browser.newBrowserCDPSession();
    try {
      const command = await connection.send('Browser.getBrowserCommandLine');
      profile = command.arguments
        .find((a) => a.startsWith('--user-data-dir='))
        .slice('--user-data-dir='.length);
    } finally {
      await connection.detach();
    }
    const originalContext = browser.newContext.bind(browser);
    browser.newContext = async (options) => {
      const context = await originalContext(options);
      context.newPage = async () => {
        throw new Error('Owned injected page-setup failure');
      };
      return context;
    };
    return browser;
  };
  try {
    await assert.rejects(
      runtime.open({ url: f.url, authorized: true }),
      /Owned injected page-setup failure/,
    );
    assert.ok(launched);
    assert.equal(launched.isConnected(), false);
    assert.equal(existsSync(home), false);
    assert.equal(existsSync(profile), false);
    assert.equal(runtime.status().activeSessions, 0);
    assert.equal(runtime.status().opening, 0);
    await assert.rejects(fetch(proxy));
  } finally {
    chromium.launch = originalLaunch;
    await runtime.closeAll();
    await f.close();
  }
});

test('Default browser command parsing never runs registry arguments and unsupported engines fail explicitly', async () => {
  assert.equal(
    commandExecutable('"C:\\Unusual location\\Brave\\brave.exe" --single-argument %1'),
    'C:\\Unusual location\\Brave\\brave.exe',
  );
  assert.throws(() => commandExecutable('C:\\Program Files\\Brave\\brave.exe %1'), /unambiguous/);
  assert.throws(() => commandExecutable('cmd.exe /c start brave.exe %1'), /unambiguous/);
  assert.throws(() => classifyBrowser('firefox.exe', 'Mozilla Firefox'), /incompatible/);
  assert.throws(() => classifyBrowser('powershell.exe'), /Unsupported/);
  assert.equal(
    classifyBrowser(
      process.platform === 'win32' ? 'C:\\Browsers\\brave.exe' : '/Browsers/brave.exe',
    ),
    'Brave',
  );
  await assert.rejects(
    resolveBrowserBackend({ browserExecutable: 'relative/brave.exe' }),
    /absolute/,
  );
  await assert.rejects(
    resolveBrowserBackend({ browserExecutable: resolve('not-an-installed-browser.exe') }),
    /ENOENT/,
  );
});

test('Actual OS-selected binary renders with GPU diagnostics in isolated ephemeral processes and releases profiles', async () => {
  const f = await fixture(),
    runtime = new BrowserSessions(config(null, f.origin));
  try {
    const selected = await resolveBrowserBackend(runtime.config),
      one = await runtime.open({ url: f.url, authorized: true }),
      two = await runtime.open({ url: f.url, authorized: true });
    assert.equal(
      one.diagnostics.browser.selection,
      process.env.MIMICUS_BROWSER_EXECUTABLE ? 'explicit-override' : 'windows-default',
    );
    assert.equal(one.diagnostics.browser.launchedExecutable, selected.executablePath);
    assert.ok(one.diagnostics.browser.version.match(/^\d+\./));
    assert.equal(one.diagnostics.browser.globalGpuDisabled, false);
    assert.equal(one.diagnostics.browser.control, 'private-pipe');
    assert.equal(one.diagnostics.browser.personalProfileAccess, false);
    assert.equal(one.diagnostics.browser.bundledBrowserFallback, false);
    assert.notEqual(one.diagnostics.browser.processId, two.diagnostics.browser.processId);
    assert.notEqual(one.diagnostics.browser.profile.path, two.diagnostics.browser.profile.path);
    const first = runtime.sessions.get(one.sessionId),
      second = runtime.sessions.get(two.sessionId);
    assert.notEqual(first.browserEnvironment.home, second.browserEnvironment.home);
    assert.ok(first.browserEnvironment.env.LOCALAPPDATA.startsWith(first.browserEnvironment.home));
    await first.context.addCookies([
      { name: 'mimicus-isolation-test', value: 'owned-first-context', url: f.origin },
    ]);
    assert.equal((await second.context.cookies()).length, 0);
    assert.equal(typeof one.diagnostics.readinessAtOpen.webgl.available, 'boolean');
    const paths = [
        ...[one, two].map((s) => s.diagnostics.browser.profile.path),
        first.browserEnvironment.home,
        second.browserEnvironment.home,
      ],
      pids = [one, two].map((s) => s.diagnostics.browser.processId);
    await runtime.closeAll();
    assert.equal(runtime.status().activeSessions, 0);
    for (const path of paths)
      assert.equal(existsSync(path), false, 'Owned ephemeral profile removed');
    for (const pid of pids)
      assert.throws(() => process.kill(pid, 0), 'Owned browser process exited');
  } finally {
    await runtime.closeAll();
    await f.close();
  }
});

test('Windows helper failure returns a bounded diagnostic without encoded commands or CLIXML', {
  skip: process.platform !== 'win32',
}, async () => {
  const original = process.env.SystemRoot;
  process.env.SystemRoot = 'C:\\Mimicus-no-Windows-here';
  try {
    await assert.rejects(
      inspectWindowsAssociation(),
      (error) =>
        error.message.length < 500 &&
        !error.message.includes('EncodedCommand') &&
        !error.message.includes('#< CLIXML') &&
        error.message.includes('mimicus doctor'),
    );
  } finally {
    if (original === undefined) delete process.env.SystemRoot;
    else process.env.SystemRoot = original;
  }
});

test('Real default browser supports progressive sections, safe touch/drag and rejects unsafe interaction regions', async () => {
  const f = await fixture();
  f.setHtml(
    '<!doctype html><title>Owned interaction edge cases</title><style>section{height:180px}#drag{width:300px;height:100px;background:coral;touch-action:none}</style><button id="menu" aria-expanded="false" onclick="this.setAttribute(\'aria-expanded\',\'true\')">Menu</button><div id="drag" onpointerdown="this.dataset.down=\'yes\'" onpointermove="if(event.buttons)this.dataset.drag=\'yes\'">Visual scrubber</div><form><button id="submit">Buy now</button></form>' +
      Array.from(
        { length: 15 },
        (_, i) => `<section id="section-${i}"><h2>Chapter ${i}</h2></section>`,
      ).join(''),
  );
  const runtime = new BrowserSessions(config(null, f.origin));
  try {
    const opened = await runtime.open({ url: f.url, authorized: true }),
      id = opened.sessionId;
    await runtime.interact(id, { action: 'touch', selector: '#menu' });
    assert.equal(
      (await runtime.explore(id)).regions.find((r) => r.selector === '#menu').expanded,
      'true',
    );
    await assert.rejects(
      runtime.interact(id, { action: 'touch', selector: '#submit' }),
      /restricted/,
    );
    await runtime.interact(id, {
      action: 'drag',
      selector: '#drag',
      x: 0.15,
      y: 0.5,
      endX: 0.85,
      endY: 0.5,
      steps: 6,
    });
    assert.equal(
      await runtime.sessions.get(id).page.locator('#drag').getAttribute('data-drag'),
      'yes',
    );
    await assert.rejects(runtime.interact(id, { action: 'drag', selector: 'form' }), /restricted/);
    const first = await runtime.explore(id, undefined, { offset: 0, limit: 5 }),
      next = await runtime.explore(id, undefined, {
        offset: first.pagination.nextOffset,
        limit: 5,
      });
    assert.equal(first.pagination.hasMore, true);
    assert.equal(next.pagination.offset, 5);
    assert.notDeepEqual(
      first.regions.map((r) => r.selector),
      next.regions.map((r) => r.selector),
    );
    assert.ok(next.regions.every((r) => Number.isFinite(r.documentY)));
    assert.ok(
      (await runtime.explore(id, undefined, { visibleOnly: true })).regions.every((r) => r.visible),
    );
  } finally {
    await runtime.closeAll();
    await f.close();
  }
});

test('Owned browser crash and operation timeout close only owned processes, proxies and temporary profiles', async () => {
  const f = await fixture(),
    runtime = new BrowserSessions(config(null, f.origin));
  try {
    const opened = await runtime.open({ url: f.url, authorized: true }),
      owned = runtime.sessions.get(opened.sessionId),
      profile = opened.diagnostics.browser.profile.path,
      cdp = await owned.browser.newBrowserCDPSession();
    await Promise.race([cdp.send('Browser.crash').catch(() => {}), delay(3000)]);
    for (
      let i = 0;
      i < 40 && (runtime.status().activeSessions || runtime.status().closingSessions);
      i++
    )
      await delay(100);
    assert.equal(runtime.status().activeSessions, 0);
    assert.equal(runtime.status().closingSessions, 0);
    assert.equal(existsSync(profile), false);
    const again = await runtime.open({ url: f.url, authorized: true });
    runtime.config.timeoutMs = 1000;
    await assert.rejects(
      runtime.interact(again.sessionId, { action: 'wait', waitMs: 5000 }),
      /closed|aborted|Timeout/i,
    );
    await runtime.closeAll();
    assert.equal(runtime.status().activeSessions, 0);
    assert.equal(existsSync(again.diagnostics.browser.profile.path), false);
  } finally {
    await runtime.closeAll();
    await f.close();
  }
});
