import { readFileSync, writeFileSync } from 'node:fs';
import { BrowserSessions } from '../dist/browser/sessions.js';
import { config, fixture } from '../test/helpers.mjs';

const percentile = (a, p) => [...a].sort((x, y) => x - y)[Math.ceil(a.length * p) - 1];
const summary = (a) => ({
  samples: a.length,
  p50Ms: percentile(a, 0.5),
  p95Ms: percentile(a, 0.95),
});
const source = JSON.parse(readFileSync('artifacts/final-release/source-acceptance.json', 'utf8'));
const semantic = JSON.parse(readFileSync('artifacts/final-release/semantic-live.json', 'utf8'));
const f = await fixture(),
  browser = new BrowserSessions(config('.', f.origin));
const samples = [];
try {
  for (let i = 0; i < 3; i++) {
    let start = performance.now();
    const opened = await browser.open({ url: f.url, authorized: true });
    const launchAndNavigationMs = performance.now() - start;
    start = performance.now();
    const capture = await browser.capture(opened.sessionId);
    const captureMs = performance.now() - start;
    start = performance.now();
    const filmstrip = await browser.motion(opened.sessionId, { frames: 3, intervalMs: 100 });
    const filmstripMs = performance.now() - start;
    start = performance.now();
    await browser.close(opened.sessionId);
    samples.push({
      launchAndNavigationMs,
      captureMs,
      filmstripMs,
      cleanupMs: performance.now() - start,
      jpegBytes: Buffer.from(capture.images[0].data, 'base64').length,
      filmstripImages: filmstrip.images.length,
      backend: opened.diagnostics.browser.backend,
      browserVersion: opened.diagnostics.browser.version,
    });
  }
  const report = {
    at: new Date().toISOString(),
    node: process.version,
    sourceTransport: source.transport,
    sourceCases: source.cases.map((c) => ({
      name: c.name,
      elapsedMs: c.elapsedMs,
      passed: c.gatePassed,
    })),
    sourceElapsed: summary(
      source.cases.filter((c) => !c.expectedRestriction).map((c) => c.elapsedMs),
    ),
    semantic: {
      candidates: semantic.candidates,
      cases: semantic.queries,
      rssDeltaBytes: semantic.rssDeltaBytes,
    },
    browser: {
      meaning:
        'Actual installed default browser, owned animated HTTP fixture; not third-party load-time evidence',
      samples,
      launchAndNavigation: summary(samples.map((s) => s.launchAndNavigationMs)),
      capture: summary(samples.map((s) => s.captureMs)),
      filmstrip: summary(samples.map((s) => s.filmstripMs)),
      cleanup: summary(samples.map((s) => s.cleanupMs)),
      finalStatus: browser.status(),
    },
    limitations: [
      'Empirical nearest-rank p95 with 3 browser samples is the maximum, not a production SLO.',
      'Source cases mix different providers, pagination and queries; aggregate is descriptive, not a controlled provider comparison.',
      'Four semantic queries x three modes on 58 live candidates measure execution, not relevance or aesthetic quality.',
      'RSS includes model/runtime allocations and is not peak aggregate browser-process memory.',
    ],
  };
  writeFileSync('artifacts/final-release/performance.json', JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      source: report.sourceElapsed,
      browser: {
        launch: report.browser.launchAndNavigation,
        capture: report.browser.capture,
        cleanup: report.browser.cleanup,
      },
      report: 'artifacts/final-release/performance.json',
    }),
  );
} finally {
  await browser.closeAll();
  await f.close();
}
