import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Config } from '../config.js';
import { BrowserSessions } from './sessions.js';

/** Owned local fixture only: no gallery content, public-site traversal or persistent files. */
export async function browserSelfTest(config: Config) {
  const html =
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>Mimicus owned browser self-test</title><style>body{font:24px system-ui;background:#e9e6dd;color:#172820;margin:32px}button{font:inherit;padding:12px}canvas{display:block;width:240px;height:100px}section{height:300px}</style><body><h1>Mimicus visual self-test</h1><button id="menu" aria-expanded="false" onclick="this.setAttribute(\'aria-expanded\',this.getAttribute(\'aria-expanded\')!==\'true\')">Open navigation</button><canvas width="240" height="100"></canvas><section><h2>Owned reference content</h2></section><script>const c=document.querySelector("canvas"),x=c.getContext("2d");x.fillStyle="#b1683a";x.fillRect(0,0,240,100);</script></body></html>';
  const server = createServer((req, res) => {
    res.writeHead(200, {
      'content-type': req.url === '/robots.txt' ? 'text/plain' : 'text/html',
    });
    res.end(req.url === '/robots.txt' ? 'User-agent: *\nAllow: /' : html);
  });
  let sessions: BrowserSessions | undefined;
  try {
    await new Promise<void>((ok, fail) => {
      server.once('error', fail);
      server.listen(0, '127.0.0.1', ok);
    });
    const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    sessions = new BrowserSessions({
      ...config,
      developmentOrigins: [origin],
      assets: 'permitted',
    });
    const opened = await sessions.open({ url: origin, authorized: true }),
      capture = await sessions.capture(opened.sessionId),
      before = await sessions.explore(opened.sessionId);
    await sessions.interact(opened.sessionId, {
      action: 'click',
      selector: '#menu',
    });
    const after = await sessions.explore(opened.sessionId),
      menu = after.regions.find((r) => r.selector === '#menu');
    if (menu?.expanded !== 'true') throw new Error('Owned navigation failed to open');
    await sessions.interact(opened.sessionId, {
      action: 'resize',
      viewport: { width: 390, height: 844 },
      reducedMotion: true,
    });
    const mobile = await sessions.capture(opened.sessionId);
    await sessions.close(opened.sessionId);
    if (
      !capture.images[0]?.data.startsWith('/9j/') ||
      !before.regions.length ||
      mobile.data.viewport?.width !== 390 ||
      mobile.data.viewport.height !== 844 ||
      sessions.status().activeSessions !== 0 ||
      existsSync(opened.diagnostics.browser.profile.path)
    )
      throw new Error(
        'Owned visual self-test failed image, exploration, mobile viewport or ephemeral profile cleanup',
      );
    try {
      process.kill(opened.diagnostics.browser.processId!, 0);
      throw new Error('Owned browser process remained after close');
    } catch (e) {
      if (!(e instanceof Error && 'code' in e && e.code === 'ESRCH')) throw e;
    }
    return {
      passed: true,
      browser: opened.diagnostics.browser,
      rendering: opened.diagnostics.readinessAtOpen,
      checks: {
        actualDefaultBinary: opened.diagnostics.browser.selection === 'windows-default',
        explicitOverride: opened.diagnostics.browser.selection === 'explicit-override',
        jpeg: capture.images[0]?.data.startsWith('/9j/'),
        regions: before.regions.length,
        navigation: true,
        mobileViewport: mobile.data.viewport,
        cleanup: sessions.status(),
      },
      persistence:
        'No screenshot files, gallery content, website catalog, personal profile or model vectors written. Browser-owned temporary profile is removed on close.',
    };
  } finally {
    await sessions?.closeAll();
    server.closeAllConnections();
    await new Promise<void>((ok) => server.close(() => ok()));
  }
}
