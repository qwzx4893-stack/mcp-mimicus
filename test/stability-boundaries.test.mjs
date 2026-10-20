import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewNavigation } from '../dist/browser/interactions.js';
import { robotsAllowed } from '../dist/security/robots.js';
import { canonicalUrl, safeLabel } from '../dist/util.js';

test('Encoded account/action routes are reviewed before navigation while ordinary content stays usable', () => {
  for (const url of [
    'https://example.com/%64elete',
    'https://example.com/%6Cogout',
    'https://example.com/?action=signout',
    'https://example.com/?operation=checkout',
    'https://example.com/?cmd=%2572eset',
    'https://example.com/%2525252564elete',
    'https://example.com/%2525252561bout',
    'https://example.com/%E0%A4',
  ])
    assert.throws(() => reviewNavigation(url), /state-changing/);
  for (const url of [
    'https://example.com/projects',
    'https://example.com/design/motion-case-study',
    'https://example.com/?category=payment-design',
    'https://example.com/caf%C3%A9',
    'https://example.com/paymentdesign',
    'https://example.com/?metaaction=reset&actionSuffix=reset',
  ])
    assert.doesNotThrow(() => reviewNavigation(url));
});

test('Robots rules do not borrow another product token and retain explicit empty group boundaries', () => {
  assert.equal(
    robotsAllowed(
      'User-agent: *\nDisallow: /private\nUser-agent: not-mimicus\nAllow: /private',
      '/private',
    ),
    false,
  );
  assert.equal(
    robotsAllowed(
      'User-agent: mcp-mimicus\nDisallow:\nUser-agent: OtherBot\nDisallow: /',
      '/public',
    ),
    true,
  );
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /%61dmin', '/admin'), false);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /café', '/caf%C3%A9'), false);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /foo/bar', '/foo%2Fbar'), true);
});

test('Robots matching keeps Unicode paths distinct and combines groups with longest-rule and allow-tie precedence', () => {
  const cases = [
    ['User-agent: *\nDisallow: /café', '/caf%C3%A8', true],
    ['User-agent: *\nDisallow: /日本', '/%E6%97%A5%E6%9C%AC', false],
    ['User-agent: *\nDisallow: /private/*/data$', '/private/a/b/data', false],
    ['User-agent: *\nDisallow: /private/*/data$', '/private/a/data/more', true],
    ['User-agent: *\nDisallow: /private/*', '/private/', false],
    ['User-agent: *\nDisallow: /private/**', '/private/', false],
    ['User-agent: *\nDisallow: /private\nAllow: /private', '/private', true],
    ['User-agent: *\nAllow: /private\nDisallow: /private', '/private', true],
    ['User-agent: *\nAllow: /private\nDisallow: /private/secret', '/private/secret', false],
    ['User-agent: OtherBot\nUser-agent: MCP-MIMICUS\nDisallow: /secret', '/secret', false],
    [
      'User-agent: mcp-mimicus\nDisallow: /secret\nUser-agent: mcp-mimicus\nAllow: /secret/public',
      '/secret/public',
      true,
    ],
    [
      '# comment\nSitemap: https://example.com/map.xml\nUser-agent : *\nDisallow : /secret # private\nAllow: /secret/open',
      '/secret',
      false,
    ],
    ['garbage user-agent: *\nDisallow: /', '/public', true],
  ];
  for (const [rules, path, expected] of cases)
    assert.equal(robotsAllowed(rules, path), expected, `${rules} -> ${path}`);
  assert.equal(
    robotsAllowed(
      'User-agent: OtherBot\nUser-agent: MCP-MIMICUS\nDisallow: /secret',
      '/secret',
      'OtherBot',
    ),
    false,
  );
});

test('Canonical reference identity preserves a meaningful path slash and strips tracking without losing functional parameters', () => {
  assert.notEqual(
    canonicalUrl('https://example.com/work'),
    canonicalUrl('https://example.com/work/'),
  );
  assert.equal(
    canonicalUrl('https://example.com/work/?utm_source=gallery&variant=wide#hero'),
    'https://example.com/work/?variant=wide',
  );
  assert.equal(canonicalUrl('https://example.com/?b=2&a=1'), 'https://example.com/?a=1&b=2');
  assert.equal(
    canonicalUrl(
      'https://example.com/?fbclid=x&gclid=x&UTM_campaign=x&myfbclid=keep&fbclid_suffix=keep&gclid_suffix=keep&myutm_source=keep',
    ),
    'https://example.com/?fbclid_suffix=keep&gclid_suffix=keep&myfbclid=keep&myutm_source=keep',
  );
  const exact = 'https://example.com/' + 'a'.repeat(2048 - 'https://example.com/'.length);
  assert.equal(canonicalUrl(exact), exact);
  assert.throws(() => canonicalUrl(exact + 'a'), /URL too long/);
  for (const url of [
    'file:///local',
    'https://u:p@example.com/',
    'javascript:alert(1)',
    'https://example.com/' + 'a'.repeat(2050),
  ])
    assert.throws(() => canonicalUrl(url));
});

test('Untrusted labels remove control and directional overrides while preserving readable Unicode and respecting the output bound', () => {
  assert.equal(safeLabel('A\u0000\nB\u007f\u202eC\u2066日本\u2069'), 'ABC日本');
  assert.equal(safeLabel('x'.repeat(301)).length, 300);
  assert.equal(safeLabel('Mimicus example', 7), 'Mimicus');
});
