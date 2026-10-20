export default {
  plugins: [],
  testRunner: 'command',
  commandRunner: { command: 'node --test --test-reporter=tap test/preview-contracts.test.mjs' },
  mutate: ['dist/browser/previews.js'],
  ignorePatterns: ['**', '!dist/**/*.js', '!test/preview-contracts.test.mjs', '!package.json'],
  coverageAnalysis: 'off', concurrency: 2, timeoutMS: 5000, timeoutFactor: 2,
  tempDirName: '.release/preview-mutation-sandbox', cleanTempDir: true,
  reporters: ['clear-text', 'json'], jsonReporter: { fileName: '.release/preview-mutation.json' },
  thresholds: { high: 85, low: 70, break: null },
};
