import type { Page } from 'playwright';
export function reviewNavigation(url: string) {
  const u = new URL(url);
  if (
    /(?:^|[/_.-])(delete|remove|logout|signout|unsubscribe|checkout|purchase|payment|reset)(?:$|[/_.-])/i.test(
      u.pathname,
    ) ||
    [...u.searchParams].some(
      ([key, value]) =>
        /^(action|do|cmd|operation)$/i.test(key) &&
        /delete|remove|logout|unsubscribe|purchase|pay|reset/i.test(value),
    )
  )
    throw new Error('Navigation URL appears to invoke a state-changing action');
}
export async function reachablePoint(page: Page, selector: string) {
  const p = await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const b = el.getBoundingClientRect();
      for (const fx of [0.5, 0.1, 0.9, 0.02, 0.98])
        for (const fy of [0.5, 0.1, 0.9]) {
          const x = b.x + b.width * fx,
            y = b.y + b.height * fy,
            hit = document.elementFromPoint(x, y);
          if (hit && (hit === el || el.contains(hit))) return { x, y };
        }
      return null;
    });
  if (!p) throw new Error('Target has no reachable hit-test point');
  return p;
}
export async function safeClick(
  page: Page,
  selector: string,
  modality: 'mouse' | 'touch' = 'mouse',
) {
  const target = page.locator(selector).first(),
    safe = await target.evaluate((el) => {
      let fragment = false;
      if (el instanceof HTMLAnchorElement && !el.hasAttribute('download') && !el.target) {
        const u = new URL(el.href, location.href);
        fragment =
          u.origin === location.origin &&
          u.pathname === location.pathname &&
          u.search === location.search &&
          u.hash.length > 1;
      }
      const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 180);
      const visualReset = /^reset (view|camera|zoom|orientation)$/i.test(label);
      return (
        (fragment ||
          el.matches(
            'button:not([type=submit]),details > summary,[role=button],[role=tab],[aria-expanded]',
          )) &&
        !el.closest('form') &&
        !el.hasAttribute('form') &&
        !/delete|remove|pay|buy|checkout|submit|unsubscribe|logout|purchase|confirm order/i.test(
          label,
        ) &&
        (!/reset/i.test(label) || visualReset)
      );
    });
  if (!safe)
    throw new Error(
      'Click/touch restricted to non-destructive non-form controls and same-document fragments; navigate to reviewed URLs explicitly',
    );
  if (modality === 'touch') await target.tap();
  else await target.click({ noWaitAfter: true });
}
export async function safeDrag(
  page: Page,
  selector: string,
  input: {
    x?: number;
    y?: number;
    endX?: number;
    endY?: number;
    steps?: number;
  },
) {
  const target = page.locator(selector).first();
  await target.evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
  const points = await target.evaluate(
    (el, v) => {
      const b = el.getBoundingClientRect();
      if (
        b.width <= 0 ||
        b.height <= 0 ||
        b.width > 5000 ||
        b.height > 5000 ||
        el.closest('form,a,button,input,select,textarea,[contenteditable=true]')
      )
        return null;
      const start = { x: b.x + b.width * v.x, y: b.y + b.height * v.y },
        end = { x: b.x + b.width * v.endX, y: b.y + b.height * v.endY };
      for (const p of [start, end]) {
        if (p.x < 0 || p.y < 0 || p.x >= innerWidth || p.y >= innerHeight) return null;
        const hit = document.elementFromPoint(p.x, p.y);
        if (
          !hit ||
          !(hit === el || el.contains(hit)) ||
          hit.closest('form,a,button,input,select,textarea,[contenteditable=true]')
        )
          return null;
      }
      return { start, end };
    },
    {
      x: input.x ?? 0.2,
      y: input.y ?? 0.5,
      endX: input.endX ?? 0.8,
      endY: input.endY ?? 0.5,
    },
  );
  if (!points)
    throw new Error(
      'Drag restricted to visible non-form visual regions with safe in-target endpoints',
    );
  await page.mouse.move(points.start.x, points.start.y);
  await page.mouse.down();
  try {
    await page.mouse.move(points.end.x, points.end.y, {
      steps: Math.min(20, Math.max(1, input.steps ?? 8)),
    });
  } finally {
    await page.mouse.up().catch(() => {});
  }
}
export async function safeHover(page: Page, selector: string) {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
  const p = await reachablePoint(page, selector);
  await page.mouse.move(p.x, p.y);
}
