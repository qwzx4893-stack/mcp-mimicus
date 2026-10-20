import { readFileSync } from 'node:fs';

// Private pinned installation; exercise the compiled runtime in disposable copies.
const navigation = readFileSync('dist/browser/interactions.js', 'utf8');
const navigationEnd = navigation.slice(0, navigation.indexOf('export async function reachablePoint')).split('\n').length - 1;

export default {
  plugins: [],
  testRunner: 'command',
  commandRunner: {
    command: 'node --test --test-concurrency=1 --test-reporter=tap test/security.test.mjs test/stability-boundaries.test.mjs test/stability-queue.test.mjs',
  },
  mutate: ['dist/security/robots.js', 'dist/util.js:3-999', `dist/browser/interactions.js:1-${navigationEnd}`],
  ignorePatterns: ['**', '!dist/**/*.js', '!test/security.test.mjs', '!test/stability-boundaries.test.mjs', '!test/stability-queue.test.mjs', '!test/helpers.mjs', '!examples/visual-lab.html', '!package.json'],
  coverageAnalysis: 'off',
  concurrency: 2,
  timeoutMS: 5000,
  timeoutFactor: 2,
  dryRunTimeoutMinutes: 2,
  tempDirName: '.release/stryker-sandbox',
  cleanTempDir: true,
  reporters: ['clear-text', 'json'],
  jsonReporter: { fileName: '.release/stryker-final.json' },
  thresholds: { high: 85, low: 70, break: null },
};
