import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { ConfigSchema, sourceOrigins } from '../dist/config.js';
export const temporary = () => mkdtempSync(join(tmpdir(), 'mimicus-test-'));
export const cleanup = (path) => {
  const p = resolve(path);
  if (!p.startsWith(resolve(tmpdir()) + sep + 'mimicus-test-'))
    throw new Error('Unsafe test cleanup path');
  rmSync(p, { recursive: true, force: true });
};
export const config = (_unused, origin) =>
  ConfigSchema.parse({
    developmentOrigins: origin ? [origin] : [],
    allowedOrigins: sourceOrigins,
    semanticEnabled: false,
    assets: 'blocked',
    sampleMs: 450,
    timeoutMs: 45000,
    settleMs: 100,
    browserExecutable: process.env.MIMICUS_BROWSER_EXECUTABLE,
  });
export async function fixture() {
  let html = readFileSync(new URL('../examples/visual-lab.html', import.meta.url), 'utf8'),
    revision = 1;
  const hits = [];
  let origin = '';
  const server = createServer((req, res) => {
    hits.push(req.url);
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('User-agent: *\nAllow: /\nDisallow: /private');
    } else if (req.url.startsWith('/source')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          revision,
          items: [
            {
              title: 'Owned editorial reference revision ' + revision,
              url: origin + '/reference',
              native: { categories: ['Editorial'], tags: ['GSAP'], technologies: ['Astro'] },
            },
          ],
        }),
      );
    } else if (req.url === '/redirect') {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' });
      res.end();
    } else {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);
    }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    url: origin + '/reference',
    origin,
    hits,
    setHtml: (value) => (html = value),
    advance: () => revision++,
    async close() {
      server.closeAllConnections();
      await new Promise((ok) => server.close(ok));
    },
  };
}
