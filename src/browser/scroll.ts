// Adapted from intframe/scroll-qa src/scrollTo.js at
// 05f3a366563c6856e69966db26907574bffa6b14. MIT, (c) 2026 INTFRAME.
// See THIRD_PARTY_NOTICES.md. Added bounded settling and explicit failure result.
import type { Page } from 'playwright';
export async function scrollTo(page: Page, y: number, settleMs = 120) {
  await page.evaluate((target) => {
    const lenis = (window as unknown as { __lenis?: { scrollTo: (n: number, o: object) => void } })
      .__lenis;
    if (lenis && typeof lenis.scrollTo === 'function')
      lenis.scrollTo(target, { immediate: true, force: true });
    else window.scrollTo({ top: target, behavior: 'instant' });
  }, y);
  if (settleMs) await page.waitForTimeout(settleMs);
  return page.evaluate(() => window.scrollY);
}
export async function scrollToVerified(page: Page, y: number, tolerance = 8) {
  let actual = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    actual = await scrollTo(page, y);
    if (Math.abs(actual - y) <= tolerance) return { ok: true, actual, attempt };
  }
  return {
    ok: false,
    actual,
    attempt: 3,
    limitation:
      'Native scroll position did not settle; transformed or virtual scrolling may be active',
  };
}
