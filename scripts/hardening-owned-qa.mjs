// Supplemental functional assertions against original owned examples only.
// Actual MCP visual/inspection workflows are reported separately.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import {
  createBrowserEnvironment,
  resolveBrowserBackend,
  verifyBrowserLaunch,
} from '../dist/browser/backend.js';

const backend = await resolveBrowserBackend({
  browserExecutable: process.env.MIMICUS_BROWSER_EXECUTABLE,
});
const home = await createBrowserEnvironment();
let browser;
const cases = [];
try {
  browser = await chromium.launch({
    executablePath: backend.executablePath,
    headless: true,
    chromiumSandbox: true,
    args: ['--enable-automation'],
    env: home.env,
  });
  const identity = await verifyBrowserLaunch(browser, backend);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: true,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === 'http://127.0.0.1:45812'
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const kind of ['coffee', 'saas-interrupted']) {
    await page.goto(`http://127.0.0.1:45812/hardening-${kind}.html`);
    assert.equal(await page.locator('h1').count(), 1);
    if (kind === 'coffee') {
      await page.locator('[data-filter="bright"]').click();
      assert.equal(await page.locator('.product:visible').count(), 1);
      await page.locator('[data-coffee="Open Sky"]').click();
      assert.equal(await page.locator('#blend').inputValue(), 'Open Sky');
      await page.locator('#frequency').selectOption('Every 4 weeks');
      await page.locator('#plan-form button[type=submit]').click();
      assert.match(
        await page.locator('#confirmation').innerText(),
        /Open Sky.*Every 4 weeks.*No order placed/,
      );
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog').evaluate((x) => x.open), false);
      assert.equal(
        await page
          .locator('[data-coffee="Open Sky"]')
          .evaluate((x) => x === document.activeElement),
        true,
      );
    } else {
      for (const category of ['product', 'design', 'engineering']) {
        await page.locator(`[data-category="${category}"]`).click();
        assert.equal(await page.locator('.decision:visible').count(), 1);
        assert.equal(await page.locator('.decision:visible').getAttribute('data-kind'), category);
      }
      await page.locator('[data-period="annual"]').click();
      assert.deepEqual(await page.locator('.price strong').allTextContents(), ['8', '16']);
      await page.locator('[data-period="monthly"]').click();
      assert.deepEqual(await page.locator('.price strong').allTextContents(), ['10', '20']);
      await page.locator('.hero .trial').click();
      await page.locator('input[name=team]').fill('Northstar');
      await page.locator('#trial-form button').click();
      assert.match(
        await page.locator('#trial-status').innerText(),
        /Northstar.*No account created/,
      );
      await page.keyboard.press('Escape');
      assert.equal(
        await page.locator('.hero .trial').evaluate((x) => x === document.activeElement),
        true,
      );
      const question = page.locator('details summary').first();
      await question.focus();
      await page.keyboard.press('Enter');
      assert.equal(
        await page
          .locator('details')
          .first()
          .evaluate((x) => x.open),
        true,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://127.0.0.1:45812/hardening-${kind}.html`);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    const menu = page.locator('.menu');
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.evaluate((x) => x === document.activeElement), true);
    assert.equal(
      await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      true,
    );
    cases.push({
      kind,
      status: 'VERIFIED',
      desktop: { width: 1440, height: 900 },
      mobile: { width: 390, height: 844 },
      filters: true,
      localPrimaryAction: true,
      escapeAndFocusReturn: true,
      overflow: false,
      reducedMotion: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  assert.deepEqual(errors, []);
  await context.close();
  writeFileSync(
    'artifacts/product-hardening/owned-functional-qa.json',
    JSON.stringify(
      {
        at: new Date().toISOString(),
        browser: identity.browser,
        version: identity.version,
        selection: identity.selection,
        scope:
          'Supplemental Playwright assertions on original owned examples; not a substitute for actual MCP workflows or aesthetic review',
        cases,
        consoleErrors: errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ passed: true, cases: cases.length, browser: identity.browser }));
} finally {
  await browser?.close();
  await home.close();
}
