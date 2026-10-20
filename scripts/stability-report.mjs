// Export only derived audit metrics. Private scanner outputs stay outside Git.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const read = (name) => JSON.parse(readFileSync('.release/' + name, 'utf8'));
const local = read('opengrep-final.json'),
  upstream = read('opengrep-upstream-final.json');
const osv = read('osv-final.json'),
  mutation = read('stryker-final.json');
const tally = (mutants) =>
  mutants.reduce((out, m) => {
    out[m.status] = (out[m.status] ?? 0) + 1;
    return out;
  }, {});
const files = Object.fromEntries(
  Object.entries(mutation.files).map(([file, data]) => [
    file,
    {
      total: data.mutants.length,
      statuses: tally(data.mutants),
      survivors: data.mutants
        .filter((m) => m.status === 'Survived')
        .map((m) => ({ line: m.location.start.line, replacement: m.replacement })),
    },
  ]),
);
const all = Object.values(mutation.files).flatMap((f) => f.mutants),
  statuses = tally(all);
const report = {
  assembledAt: new Date().toISOString(),
  version: '1.0.0',
  tools: {
    opengrep: '1.31.0',
    osvScanner: '2.7.0',
    stryker: '10.0.0',
    upstreamRules: 'trailofbits/semgrep-rules@31390b3a99c04c81522d1b37c8d1900aa2dd4094',
  },
  static: {
    projectRules: 7,
    localFiles: local.paths.scanned.length,
    errors: local.errors.length,
    warnings: local.results.map((r) => ({
      rule: r.check_id,
      file: r.path.replaceAll('\\', '/'),
      line: r.start.line,
      disposition: 'Reviewed best-effort cleanup; retained visibly; see STABILITY_AUDIT.md',
    })),
    upstreamTargets: upstream.paths.scanned.length,
    upstreamFindings: upstream.results.length,
    upstreamErrors: upstream.errors.length,
  },
  dependencies: {
    packages: osv.results.reduce((n, group) => n + group.packages.length, 0),
    packagesWithKnownVulnerabilities: osv.results
      .flatMap((g) => g.packages)
      .filter((p) => p.vulnerabilities?.length).length,
    scope: 'Exact lockfile, production and development; point-in-time OSV advisories',
  },
  mutation: {
    total: all.length,
    statuses,
    detectedPercent: (100 * ((statuses.Killed ?? 0) + (statuses.Timeout ?? 0))) / all.length,
    assertionKilledPercent: (100 * (statuses.Killed ?? 0)) / all.length,
    files,
    limits: [
      'Selected compiled runtime scope, not whole-project coverage',
      'Timeouts are separate from assertion kills',
      'Remaining survivors are not all classified equivalent',
      'Native node:test TAP runner misclassification excluded; final command runner uses exit codes',
      'Earlier baseline code/scope differs and is not a directly comparable percentage',
    ],
  },
};
mkdirSync('artifacts/stability', { recursive: true });
writeFileSync(
  'artifacts/stability/static-and-mutation.json',
  JSON.stringify(report, null, 2) + '\n',
);
const suites = ['brave', 'edge'].map((browser) => {
  const text = readFileSync(`.release/stable-${browser}-final.tap`, 'utf8');
  const field = (name) => Number(text.match(new RegExp(`^# ${name} ([\\d.]+)`, 'm'))?.[1]);
  const result = {
    browser,
    tests: field('tests'),
    passed: field('pass'),
    failed: field('fail'),
    skipped: field('skipped'),
    cancelled: field('cancelled'),
    durationMs: field('duration_ms'),
  };
  if (
    result.failed !== 0 ||
    result.skipped !== 0 ||
    result.cancelled !== 0 ||
    result.tests !== result.passed
  )
    throw Error('Incomplete full-suite evidence');
  return result;
});
writeFileSync(
  'artifacts/stability/local-verification.json',
  JSON.stringify(
    {
      assembledAt: new Date().toISOString(),
      version: '1.0.0',
      platform: process.platform,
      node: process.version,
      suites,
    },
    null,
    2,
  ) + '\n',
);
console.log('artifacts/stability/static-and-mutation.json');
