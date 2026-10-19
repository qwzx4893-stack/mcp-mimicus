import type { Page } from 'playwright';

/** Detect an access-layer challenge, not incidental prose about waiting/captchas. */
export async function inspectAccessGate(page: Page) {
  const evidence = await page.evaluate(() => {
    const title = document.title.trim().slice(0, 200);
    const body = (document.body?.innerText ?? '').trim().slice(0, 2000);
    const challenge = [
      ...document.querySelectorAll(
        '#challenge-form,#challenge-running,#cf-challenge-running,.cf-challenge-running',
      ),
    ].some((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    return { title, body, challenge };
  });
  const blockedTitle =
    /^(?:just a moment\s*(?:\.{3}|…)?|access denied|403 forbidden|attention required!?\s*[|—-]?\s*cloudflare|checking your browser.*)$/i.test(
      evidence.title,
    );
  const humanGate =
    /verify (?:that )?you are (?:a )?human|checking your browser|performing security verification|enable javascript and cookies to continue/i.test(
      evidence.body,
    );
  const blocked = blockedTitle || (evidence.challenge && humanGate);
  return {
    blocked,
    reason: blockedTitle
      ? 'Recognized access-challenge page title'
      : blocked
        ? 'Visible access-challenge controls and verification text'
        : null,
  };
}
