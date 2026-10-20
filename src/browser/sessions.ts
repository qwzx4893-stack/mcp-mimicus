import { randomUUID } from 'node:crypto';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';
import { extractComponents } from '../analysis/extract.js';
import { implementationSpec } from '../analysis/spec.js';
import { verifyComponent } from '../analysis/verify.js';
import type { Config } from '../config.js';
import { guardedFetch } from '../security/fetch.js';
import { GuardedProxy, NetworkPolicy } from '../security/network.js';
import { robotsAllowed } from '../security/robots.js';
import type { ComponentEvidence, Observation } from '../types.js';
import { canonicalUrl, safeLabel } from '../util.js';
import { inspectAccessGate } from './access-gate.js';
import {
  createBrowserEnvironment,
  renderingReadiness,
  resolveBrowserBackend,
  verifyBrowserLaunch,
} from './backend.js';
import { reviewNavigation, safeClick, safeDrag, safeHover } from './interactions.js';
import { measurePage, type ObserveOptions } from './observe.js';
import { captureDocument } from './probe.js';

export type Image = { type: 'image'; data: string; mimeType: 'image/jpeg' };
type Analysis = {
  id: string;
  observation: Observation;
  components: ComponentEvidence[];
};
type Session = {
  id: string;
  browser: Browser;
  browserEnvironment: Awaited<ReturnType<typeof createBrowserEnvironment>>;
  browserInfo: Awaited<ReturnType<typeof verifyBrowserLaunch>>;
  readiness: Awaited<ReturnType<typeof renderingReadiness>> | null;
  context: BrowserContext;
  page: Page;
  proxy: GuardedProxy;
  policy: NetworkPolicy;
  origin: string;
  created: number;
  expires: number;
  absoluteExpires: number;
  images: number;
  operations: number;
  busy: boolean;
  closed: boolean;
  requests: number;
  blocked: string[];
  errors: string[];
  robots: Map<string, string | null>;
  analyses: Map<string, Analysis>;
  reducedMotion: boolean;
  attribution: unknown;
};
export type OpenOptions = {
  url: string;
  authorized: true;
  viewport?: { width: number; height: number };
  reducedMotion?: boolean;
  resourceOrigins?: string[];
  attribution?: unknown;
};
export type Interaction = {
  action:
    | 'hover'
    | 'click'
    | 'touch'
    | 'drag'
    | 'focus'
    | 'pointer'
    | 'scroll'
    | 'navigate'
    | 'resize'
    | 'key'
    | 'renew'
    | 'wait';
  waitMs?: number;
  selector?: string;
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  steps?: number;
  url?: string;
  key?: 'Escape' | 'Tab' | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
  viewport?: { width: number; height: number };
  reducedMotion?: boolean;
};
export class BrowserSessions {
  private sessions = new Map<string, Session>();
  private opening = 0;
  private shuttingDown = false;
  private timer: ReturnType<typeof setInterval>;
  private lifetime = new AbortController();
  private pendingOpens = new Set<Promise<unknown>>();
  private closing = new Set<Promise<unknown>>();
  private closingById = new Map<string, ReturnType<BrowserSessions['closeInternal']>>();
  private maintenanceErrors: string[] = [];
  private observe(promise: Promise<unknown>) {
    void promise.catch((error) => {
      this.maintenanceErrors.push(
        safeLabel(error instanceof Error ? error.message : String(error), 300),
      );
      if (this.maintenanceErrors.length > 8) this.maintenanceErrors.shift();
    });
  }
  constructor(readonly config: Config) {
    this.timer = setInterval(
      () => this.observe(this.expire()),
      Math.min(10000, config.sessionTtlMs),
    );
    this.timer.unref();
  }
  private async expire() {
    await Promise.all(
      [...this.sessions.values()]
        .filter((s) => !s.busy && Math.min(s.expires, s.absoluteExpires) <= Date.now())
        .map((s) => this.close(s.id)),
    );
  }
  private get(id: string) {
    const s = this.sessions.get(id);
    if (!s || s.closed) throw new Error('Browser session closed or unknown');
    if (Math.min(s.expires, s.absoluteExpires) <= Date.now()) {
      this.observe(this.close(id));
      throw new Error(
        'Browser session expired; reopen the selected original URL with authorization. Prior analysis identifiers cannot be reused.',
      );
    }
    s.expires = Math.min(s.absoluteExpires, Date.now() + this.config.sessionTtlMs);
    return s;
  }
  private async access(s: Session, url: string, signal?: AbortSignal) {
    const target = await s.policy.target(url);
    if (target.url.origin !== s.origin)
      throw new Error(
        'Navigation must remain in selected original origin; open another reference explicitly',
      );
    let rules = s.robots.get(target.url.origin);
    if (rules === undefined) {
      const r = await guardedFetch(
        s.policy.config,
        target.url.origin + '/robots.txt',
        {},
        0,
        'GET',
        100000,
        signal,
      );
      if (r.status !== 200 && r.status !== 404) throw new Error('robots access HTTP ' + r.status);
      rules = r.status === 404 ? null : r.body;
      s.robots.set(target.url.origin, rules);
    }
    if (rules !== null && !robotsAllowed(rules, target.url.pathname + target.url.search))
      throw new Error('robots disallows selected path');
  }
  async open(options: OpenOptions, signal?: AbortSignal) {
    const linked = AbortSignal.any([
        this.lifetime.signal,
        AbortSignal.timeout(this.config.timeoutMs),
        ...(signal ? [signal] : []),
      ]),
      task = this.openInternal(options, linked);
    this.pendingOpens.add(task);
    try {
      return await task;
    } finally {
      this.pendingOpens.delete(task);
    }
  }
  private async openInternal(options: OpenOptions, signal: AbortSignal) {
    signal.throwIfAborted();
    if (options.authorized !== true)
      throw new Error('Original-site browser access must be explicitly authorized');
    if (this.shuttingDown) throw new Error('Browser runtime is shutting down');
    await this.expire();
    signal.throwIfAborted();
    if (this.sessions.size + this.opening >= this.config.maxSessions)
      throw new Error('Browser session limit reached; close a session');
    canonicalUrl(options.url);
    reviewNavigation(options.url);
    const origin = new URL(options.url).origin;
    this.opening++;
    let browser: Browser | undefined,
      proxy: GuardedProxy | undefined,
      s: Session | undefined,
      browserEnvironment: Awaited<ReturnType<typeof createBrowserEnvironment>> | undefined;
    try {
      const backend = await resolveBrowserBackend(this.config);
      signal.throwIfAborted();
      const config = {
          ...this.config,
          allowedOrigins: [
            ...new Set([
              ...this.config.allowedOrigins,
              origin,
              ...(options.resourceOrigins ?? []).map((u) => new URL(u).origin),
            ]),
          ],
        },
        policy = new NetworkPolicy(config);
      await policy.target(options.url);
      for (const url of options.resourceOrigins ?? []) await policy.target(url);
      signal.throwIfAborted();
      proxy = new GuardedProxy(policy);
      const server = await proxy.start();
      browserEnvironment = await createBrowserEnvironment();
      browser = await chromium.launch({
        headless: true,
        chromiumSandbox: true,
        timeout: config.timeoutMs,
        executablePath: backend.executablePath,
        env: browserEnvironment.env,
        proxy: { server, bypass: '<-loopback>' },
        args: [
          '--enable-automation',
          '--disable-quic',
          '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
          '--disable-background-networking',
        ],
      });
      signal.throwIfAborted();
      const browserInfo = await verifyBrowserLaunch(browser, backend);
      const context = await browser.newContext({
        viewport: options.viewport ?? { width: 1280, height: 800 },
        hasTouch: true,
        serviceWorkers: 'block',
        acceptDownloads: false,
        reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference',
        permissions: [],
      });
      signal.throwIfAborted();
      s = {
        id: randomUUID(),
        browser,
        browserEnvironment,
        browserInfo,
        readiness: null,
        context,
        page: undefined as unknown as Page,
        proxy,
        policy,
        origin,
        created: Date.now(),
        expires: Date.now() + Math.min(config.sessionTtlMs, config.sessionAbsoluteTtlMs),
        absoluteExpires: Date.now() + config.sessionAbsoluteTtlMs,
        images: 0,
        operations: 0,
        busy: false,
        closed: false,
        requests: 0,
        blocked: [],
        errors: [],
        robots: new Map(),
        analyses: new Map(),
        reducedMotion: options.reducedMotion ?? false,
        attribution: options.attribution ?? {
          kind: 'operator-supplied-original-url',
        },
      };
      const session = s;
      browser.on('disconnected', () => {
        this.observe(this.close(session.id));
      });
      context.on('page', (p) => {
        if (session.page) this.observe(p.close());
        p.on('download', (d) => this.observe(d.cancel()));
        p.on('dialog', (d) => this.observe(d.dismiss()));
      });
      await context.routeWebSocket('**/*', (ws) => ws.close());
      await context.route('**/*', async (route) => {
        try {
          const req = route.request();
          if (
            ++session.requests > config.maxRequests ||
            !['GET', 'HEAD'].includes(req.method()) ||
            (config.assets === 'blocked' && ['image', 'font', 'media'].includes(req.resourceType()))
          )
            throw new Error('Session request/resource budget');
          await policy.target(req.url());
          if (req.isNavigationRequest()) await this.access(session, req.url());
          await route.continue();
        } catch (e) {
          if (session.blocked.length < 24)
            session.blocked.push(
              (
                new URL(route.request().url()).origin +
                ' [' +
                route.request().resourceType() +
                ']: ' +
                String(e)
              ).slice(0, 250),
            );
          await route.abort().catch(() => {});
        }
      });
      session.page = await context.newPage();
      session.page.setDefaultTimeout(Math.min(5000, config.timeoutMs));
      session.page.on('pageerror', (e) => {
        if (session.errors.length < 10) session.errors.push(safeLabel(e.message, 200));
      });
      this.sessions.set(s.id, s);
      return await this.run(s.id, signal, async (current) => {
        await this.access(current, options.url, signal);
        const r = await current.page.goto(options.url, {
          waitUntil: 'domcontentloaded',
          timeout: config.timeoutMs,
        });
        if (!r || r.status() >= 400) throw new Error('Original website HTTP ' + r?.status());
        await current.page.waitForTimeout(config.settleMs);
        current.readiness = await renderingReadiness(current.page);
        const gate = await inspectAccessGate(current.page);
        if (gate.blocked)
          throw new Error('Access challenge encountered; no bypass attempted: ' + gate.reason);
        return {
          sessionId: current.id,
          url: current.page.url(),
          title: safeLabel(await current.page.title()),
          viewport: current.page.viewportSize(),
          expiresAt: new Date(current.expires).toISOString(),
          lease: this.lease(current),
          attribution: current.attribution,
          diagnostics: this.diagnostics(current),
          persistentContent: false,
        };
      });
    } catch (e) {
      if (s && this.sessions.has(s.id)) await this.close(s.id);
      else {
        await browser?.close().catch(() => {});
        try {
          await proxy?.close();
        } finally {
          await browserEnvironment?.close();
        }
      }
      throw e;
    } finally {
      this.opening--;
    }
  }
  private diagnostics(s: Session) {
    return {
      browser: s.browserInfo,
      readinessAtOpen: s.readiness,
      requests: s.requests,
      lease: this.lease(s),
      blocked: s.blocked,
      errors: s.errors,
      meaning:
        'Missing cross-origin resources are reported; additional resource origins require explicit approval. Session budgets are cumulative. Readiness is a bounded observation, not a claim of complete site rendering.',
    };
  }
  private lease(s: Session) {
    return {
      idleExpiresAt: new Date(Math.min(s.expires, s.absoluteExpires)).toISOString(),
      absoluteExpiresAt: new Date(s.absoluteExpires).toISOString(),
      idleWindowMs: this.config.sessionTtlMs,
      images: s.images,
      imageLimit: this.config.maxSessionImages,
      operations: s.operations,
      operationLimit: this.config.maxSessionOperations,
      renewal:
        'Use interact action renew before idle expiry. Renewal cannot extend the absolute lifetime or reset cumulative budgets. Reopen the selected original URL after expiry.',
    };
  }
  private async run<T>(
    id: string,
    signal: AbortSignal | undefined,
    fn: (s: Session, combined: AbortSignal) => Promise<T>,
  ) {
    const s = this.get(id);
    if (s.busy) throw new Error('Session operation already running');
    if (s.operations >= this.config.maxSessionOperations) {
      await this.close(id);
      throw new Error(
        'Session operation budget exhausted; resources closed. Reopen the selected original URL deliberately.',
      );
    }
    const combined = AbortSignal.any([
        this.lifetime.signal,
        AbortSignal.timeout(this.config.timeoutMs),
        AbortSignal.timeout(Math.max(1, s.absoluteExpires - Date.now())),
        ...(signal ? [signal] : []),
      ]),
      abort = () => {
        this.observe(this.close(id));
      };
    combined.throwIfAborted();
    s.busy = true;
    s.operations++;
    s.expires = Math.min(s.absoluteExpires, Date.now() + this.config.sessionTtlMs);
    combined.addEventListener('abort', abort, { once: true });
    try {
      const result = await fn(s, combined);
      combined.throwIfAborted();
      return result;
    } finally {
      combined.removeEventListener('abort', abort);
      s.busy = false;
      s.expires = Math.min(s.absoluteExpires, Date.now() + this.config.sessionTtlMs);
    }
  }
  private async image(s: Session, selector?: string): Promise<Image> {
    if (s.images >= this.config.maxSessionImages)
      throw new Error(
        'Session image budget exhausted; close and deliberately reopen for additional images.',
      );
    let buffer: Buffer;
    if (selector) {
      const target = s.page.locator(selector).first();
      const box = await target.boundingBox();
      if (!box || box.width > 2560 || box.height > 1600)
        throw new Error('Selected capture region exceeds viewport bounds');
      buffer = await target.screenshot({
        type: 'jpeg',
        quality: 65,
        animations: 'allow',
        timeout: 5000,
      });
    } else
      buffer = await s.page.screenshot({
        type: 'jpeg',
        quality: 65,
        fullPage: false,
        animations: 'allow',
        timeout: 5000,
      });
    if (buffer.length > 1500000) throw new Error('Screenshot exceeds image byte limit');
    s.images++;
    return {
      type: 'image',
      data: buffer.toString('base64'),
      mimeType: 'image/jpeg',
    };
  }
  async capture(id: string, selector?: string, signal?: AbortSignal) {
    return this.run(id, signal, async (s) => {
      const readiness = await renderingReadiness(s.page);
      const image = await this.image(s, selector);
      return {
        data: {
          sessionId: id,
          url: s.page.url(),
          viewport: s.page.viewportSize(),
          capturedAt: new Date().toISOString(),
          readiness,
          selector: selector ?? null,
          diagnostics: this.diagnostics(s),
          untrustedEvidence: true,
        },
        images: [image],
      };
    });
  }
  async explore(
    id: string,
    signal?: AbortSignal,
    options: { offset?: number; limit?: number; visibleOnly?: boolean } = {},
  ) {
    return this.run(id, signal, async (s) => {
      const offset = Math.min(1200, Math.max(0, Math.trunc(options.offset ?? 0))),
        limit = Math.min(80, Math.max(1, Math.trunc(options.limit ?? 40)));
      const evidence = await s.page.evaluate(
        ({ offset, limit, visibleOnly }) => {
          const selector = (el: Element) => {
            const parts: string[] = [];
            let n: Element | null = el;
            while (n && parts.length < 12) {
              if (n.id && document.querySelectorAll('#' + CSS.escape(n.id)).length === 1) {
                parts.unshift('#' + CSS.escape(n.id));
                break;
              }
              const tag = n.tagName.toLowerCase(),
                siblings = n.parentElement
                  ? [...n.parentElement.children].filter((x) => x.tagName === n!.tagName)
                  : [n];
              parts.unshift(
                tag +
                  (siblings.length > 1 ? ':nth-of-type(' + (siblings.indexOf(n) + 1) + ')' : ''),
              );
              n = n.parentElement;
            }
            return parts.join(' > ');
          };
          const nodes = [
            ...document.querySelectorAll(
              'header,nav,main,section,article,aside,footer,h1,h2,h3,summary,button,a[href],[role=navigation],[aria-expanded],[role=slider],canvas,video,svg',
            ),
          ];
          const regions = nodes
            .slice(0, 1200)
            .map((el) => {
              const b = el.getBoundingClientRect(),
                style = getComputedStyle(el);
              return {
                selector: selector(el),
                tag: el.tagName.toLowerCase(),
                label: (
                  el.getAttribute('aria-label') ??
                  el.querySelector('h1,h2,h3')?.textContent ??
                  el.textContent ??
                  ''
                )
                  .trim()
                  .slice(0, 120),
                box: { x: b.x, y: b.y, width: b.width, height: b.height },
                documentX: b.x + scrollX,
                documentY: b.y + scrollY,
                visible:
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  b.width > 0 &&
                  b.height > 0 &&
                  b.bottom > 0 &&
                  b.right > 0 &&
                  b.top < innerHeight &&
                  b.left < innerWidth,
                display: style.display,
                position: style.position,
                expanded:
                  el.getAttribute('aria-expanded') ??
                  (el.matches('summary') && el.parentElement instanceof HTMLDetailsElement
                    ? String(el.parentElement.open)
                    : null),
                href: el instanceof HTMLAnchorElement ? el.href : undefined,
              };
            })
            .filter((r) => !visibleOnly || r.visible);
          return {
            regions: regions.slice(offset, offset + limit),
            pagination: {
              offset,
              limit,
              total: regions.length,
              nextOffset: offset + limit < regions.length ? offset + limit : null,
              hasMore: offset + limit < regions.length,
              scanLimit: 1200,
              truncated: nodes.length > 1200,
            },
            scroll: {
              x: scrollX,
              y: scrollY,
              width: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight,
            },
            viewport: { width: innerWidth, height: innerHeight },
            limitation:
              'Current DOM semantic regions only; lazy content appears after explicit scrolling/waiting. Positions describe current rendering, including sticky/fixed positioning.',
          };
        },
        { offset, limit, visibleOnly: options.visibleOnly ?? false },
      );
      return {
        sessionId: id,
        url: s.page.url(),
        ...evidence,
        diagnostics: this.diagnostics(s),
        untrustedEvidence: true,
      };
    });
  }
  private async action(s: Session, input: Interaction, signal?: AbortSignal, settle = true) {
    const target = () => {
      if (!input.selector) throw new Error('Action requires a selector');
      return s.page.locator(input.selector).first();
    };
    if (input.action === 'wait') {
      await s.page.waitForTimeout(Math.min(5000, Math.max(0, input.waitMs ?? 1000)));
    } else if (input.action === 'hover') {
      target();
      await safeHover(s.page, input.selector!);
    } else if (input.action === 'click' || input.action === 'touch') {
      target();
      await safeClick(s.page, input.selector!, input.action === 'touch' ? 'touch' : 'mouse');
    } else if (input.action === 'drag') {
      target();
      await safeDrag(s.page, input.selector!, input);
    } else if (input.action === 'focus') await target().focus();
    else if (input.action === 'pointer') {
      const b = await target().boundingBox();
      if (!b) throw new Error('Pointer target unavailable');
      await s.page.mouse.move(b.x + b.width * (input.x ?? 0.5), b.y + b.height * (input.y ?? 0.5));
    } else if (input.action === 'scroll') {
      if (input.selector)
        await target().evaluate(
          (el, v) =>
            el.scrollTo({
              left: v.x ?? el.scrollLeft,
              top: v.y ?? el.scrollTop,
              behavior: 'instant',
            }),
          { x: input.x, y: input.y },
        );
      else
        await s.page.evaluate(
          (v) =>
            window.scrollTo({
              left: v.x ?? scrollX,
              top: v.y ?? scrollY,
              behavior: 'instant',
            }),
          { x: input.x, y: input.y },
        );
    } else if (input.action === 'navigate') {
      if (!input.url) throw new Error('Navigation requires URL');
      reviewNavigation(input.url);
      await this.access(s, input.url, signal);
      const r = await s.page.goto(input.url, { waitUntil: 'domcontentloaded' });
      if (r && r.status() >= 400) throw new Error('Navigation HTTP ' + r.status());
    } else if (input.action === 'resize') {
      if (!input.viewport) throw new Error('Resize requires viewport');
      await s.page.setViewportSize(input.viewport);
      s.reducedMotion = input.reducedMotion ?? s.reducedMotion;
      await s.page.emulateMedia({
        reducedMotion: s.reducedMotion ? 'reduce' : 'no-preference',
      });
    } else if (input.action === 'key') {
      if (!input.key) throw new Error('Key required');
      await s.page.keyboard.press(input.key);
    }
    if (settle) await s.page.waitForTimeout(this.config.settleMs);
  }
  async interact(id: string, input: Interaction, signal?: AbortSignal) {
    if (input.action === 'renew')
      return this.run(id, signal, async (s) => ({
        data: {
          sessionId: id,
          action: 'renew',
          url: s.page.url(),
          lease: this.lease(s),
          untrustedEvidence: true,
        },
        images: [] as Image[],
      }));
    return this.run(id, signal, async (s, combined) => {
      await this.action(s, input, combined);
      const image = await this.image(s);
      return {
        data: {
          sessionId: id,
          action: input.action,
          url: s.page.url(),
          viewport: s.page.viewportSize(),
          diagnostics: this.diagnostics(s),
          untrustedEvidence: true,
        },
        images: [image],
      };
    });
  }
  async motion(
    id: string,
    options: {
      selector?: string;
      action?: Interaction;
      frames: number;
      intervalMs: number;
    },
    signal?: AbortSignal,
  ) {
    return this.run(id, signal, async (s, combined) => {
      if (options.action?.action === 'hover' || options.action?.action === 'pointer') {
        await s.page.mouse.move(-1, -1);
        await s.page.waitForTimeout(Math.min(this.config.sampleMs, 600));
      }
      const images: Image[] = [],
        frames: { index: number; tMs: number; url: string }[] = [],
        start = performance.now();
      let scrollStart: { x: number; y: number } | undefined;
      if (options.action?.action === 'scroll') {
        const selected = options.action.selector;
        scrollStart = selected
          ? await s.page
              .locator(selected)
              .first()
              .evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }))
          : await s.page.evaluate(() => ({ x: scrollX, y: scrollY }));
      }
      for (let i = 0; i < options.frames; i++) {
        combined.throwIfAborted();
        if (i > 0) {
          if (scrollStart && options.action) {
            const fraction = i / (options.frames - 1);
            await this.action(
              s,
              {
                ...options.action,
                x: scrollStart.x + ((options.action.x ?? scrollStart.x) - scrollStart.x) * fraction,
                y: scrollStart.y + ((options.action.y ?? scrollStart.y) - scrollStart.y) * fraction,
              },
              combined,
              false,
            );
          } else if (i === 1 && options.action)
            await this.action(s, options.action, combined, false);
          await s.page.waitForTimeout(options.intervalMs);
        }
        images.push(await this.image(s, options.selector));
        frames.push({
          index: i,
          tMs: performance.now() - start,
          url: s.page.url(),
        });
      }
      return {
        data: {
          sessionId: id,
          frames,
          viewport: s.page.viewportSize(),
          diagnostics: this.diagnostics(s),
          limitation:
            'Actual timestamped screenshots; cadence includes capture overhead. Scroll actions sample progressive positions, not a recovered author timeline.',
          untrustedEvidence: true,
        },
        images,
      };
    });
  }
  async analyze(id: string, options: ObserveOptions, signal?: AbortSignal) {
    return this.run(id, signal, async (s, combined) => {
      let observation: Observation;
      try {
        observation = await measurePage(s.page, this.config, id, {
          ...options,
          signal: combined,
        });
      } finally {
        await s.page.emulateMedia({
          reducedMotion: s.reducedMotion ? 'reduce' : 'no-preference',
        });
      }
      const analysis = {
        id: observation.id,
        observation,
        components: extractComponents(observation),
      };
      s.analyses.set(analysis.id, analysis);
      while (s.analyses.size > 6) s.analyses.delete(s.analyses.keys().next().value!);
      return {
        sessionId: id,
        analysisId: analysis.id,
        url: s.page.url(),
        components: analysis.components,
        observation,
        diagnostics: this.diagnostics(s),
        retention: 'RAM only, removed when the session closes/expires',
        untrustedEvidence: true,
      };
    });
  }
  private evidence(sessionId: string, analysisId: string, componentId?: string) {
    const s = this.get(sessionId),
      a = s.analyses.get(analysisId);
    if (!a) throw new Error('Analysis expired or not in this session');
    const component = componentId
      ? a.components.find((p) => p.id === componentId)
      : a.components[0];
    if (!component) throw new Error('Measured component not found');
    return { s, a, component };
  }
  spec(sessionId: string, analysisId: string, componentId?: string) {
    const { s, a, component } = this.evidence(sessionId, analysisId, componentId);
    return {
      ...implementationSpec(component, a.observation),
      sessionId,
      analysisId,
      url: s.page.url(),
      attribution: s.attribution,
      retention: 'Temporary session evidence only',
    };
  }
  async verify(
    referenceSessionId: string,
    analysisId: string,
    targetSessionId: string,
    selector: string,
    componentId?: string,
    scrollContainer?: string,
    signal?: AbortSignal,
  ) {
    const { a, component } = this.evidence(referenceSessionId, analysisId, componentId),
      sequence = a.observation.views[0]?.sequences.find((q) => q.selector === component.selector);
    const target = await this.analyze(
      targetSessionId,
      {
        selector,
        trigger: sequence?.trigger,
        scrollContainer: scrollContainer ?? sequence?.samples[0]?.containerScroll?.selector,
        probeReset: sequence?.phases?.some((p) => p.name === 'reset'),
        viewports: a.observation.views.map((v) => v.viewport),
      },
      signal,
    );
    const reports = target.observation.views.map((v) =>
      verifyComponent(component, a.observation, { ...target.observation, views: [v] }, selector),
    );
    return {
      reports,
      withinMeasuredTolerances: reports.every((r) => r.withinMeasuredTolerances),
      limitation:
        'Selected measured properties at matching viewports; no aesthetic or asset equivalence claim.',
    };
  }
  async insights(id: string, signal?: AbortSignal) {
    return this.run(id, signal, async (s) => {
      const data = await s.page.evaluate(captureDocument, {
        maxElements: this.config.maxElements,
      });
      const { styleProfile } = await import('../analysis/style-profile.js');
      return {
        sessionId: id,
        url: s.page.url(),
        attribution: s.attribution,
        measured: {
          viewport: s.page.viewportSize() ?? undefined,
          typography: data.elements.filter((e) => /^h[1-6]$|^p$/.test(e.tag)).slice(0, 12),
          sections: data.elements
            .filter((e) => /^(header|nav|main|section|article|aside|footer)$/.test(e.tag))
            .slice(0, 12),
          selectedMotion: [...s.analyses.values()]
            .flatMap((a) =>
              a.observation.views.flatMap((v) =>
                v.sequences.map((q) => ({
                  ...q,
                  analysisId: a.id,
                  viewport: v.viewport,
                  reducedMotion: v.reducedMotion,
                })),
              ),
            )
            .slice(0, 12),
          responsiveViews: [
            ...new Map(
              [...s.analyses.values()].flatMap((a) =>
                a.observation.views.map(
                  (v) =>
                    [
                      v.viewport.width + 'x' + v.viewport.height,
                      {
                        viewport: v.viewport,
                        layouts: v.elements
                          .filter((e) => ['grid', 'flex'].includes(e.styles.display ?? ''))
                          .slice(0, 8),
                        typography: v.elements
                          .filter((e) => /^h[1-6]$|^p$/.test(e.tag))
                          .slice(0, 12),
                        navigation: v.elements
                          .filter(
                            (e) => e.tag === 'nav' || e.signals?.componentRole === 'navigation',
                          )
                          .slice(0, 8),
                      },
                    ] as const,
                ),
              ),
            ).values(),
          ].slice(0, 3),
          sampling: {
            capturedElements: data.elements.length,
            truncated: data.elements.length >= this.config.maxElements,
          },
          styleProfile: styleProfile(data.elements),
          layouts: data.elements
            .filter((e) => ['grid', 'flex'].includes(e.styles.display ?? ''))
            .slice(0, 8),
          navigation: data.elements
            .filter((e) => e.tag === 'nav' || e.signals?.componentRole === 'navigation')
            .slice(0, 8),
          animations: data.animations.slice(0, 12),
          engines: data.engines,
        },
        guidance: {
          kind: 'independently-written-guidance',
          steps: [
            'Choose structural/typographic relationships appropriate to your own content.',
            'Use selected controls and targeted motion analysis to inspect activation and reset.',
            'Implement original code and authorized assets; do not copy branding or artwork.',
          ],
          missing:
            'Aesthetic quality, brand suitability and hidden author intent require the external agent to assess the actual visual references.',
        },
        untrustedEvidence: true,
      };
    });
  }
  status() {
    return {
      activeSessions: this.sessions.size,
      closingSessions: this.closing.size,
      maintenanceErrors: [...this.maintenanceErrors],
      opening: this.opening,
      temporaryAnalyses: [...this.sessions.values()].reduce((n, s) => n + s.analyses.size, 0),
      sessionLimit: this.config.maxSessions,
      sessions: [...this.sessions.values()].map((s) => ({
        sessionId: s.id,
        url: s.page.url(),
        busy: s.busy,
        ...this.lease(s),
      })),
      persistentContent: false,
    };
  }
  async close(id: string) {
    const existing = this.closingById.get(id);
    if (existing) return await existing;
    const task = this.closeInternal(id);
    this.closingById.set(id, task);
    this.closing.add(task);
    try {
      return await task;
    } finally {
      this.closing.delete(task);
      this.closingById.delete(id);
    }
  }
  private async closeInternal(id: string) {
    const s = this.sessions.get(id);
    if (!s) return { sessionId: id, closed: false };
    s.closed = true;
    this.sessions.delete(id);
    s.analyses.clear();
    s.robots.clear();
    // Each session owns its entire browser. Close that owner directly: a serial
    // context-close RPC can remain pending after a long-lived renderer disconnects,
    // preventing process/proxy/home teardown from being reached.
    const failures: unknown[] = [];
    try {
      await s.browser.close();
    } catch (error) {
      if (s.browser.isConnected()) failures.push(error);
    }
    try {
      await s.proxy.close();
    } catch (error) {
      failures.push(error);
    }
    try {
      await s.browserEnvironment.close();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        'Owned browser cleanup failed: ' +
          failures.map((e) => (e instanceof Error ? e.message : String(e))).join('; '),
      );
    return {
      sessionId: id,
      closed: true,
      released: 'Browser context, proxy, analysis and temporary page state',
    };
  }
  async closeAll() {
    this.shuttingDown = true;
    this.lifetime.abort();
    clearInterval(this.timer);
    await Promise.allSettled([...this.pendingOpens]);
    const remaining = await Promise.allSettled(
      [...this.sessions.keys()].map((id) => this.close(id)),
    );
    const pending = await Promise.allSettled([...this.closing]);
    const failures = [...remaining, ...pending].filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (failures.length)
      throw new AggregateError(
        failures.map((r) => r.reason),
        'Owned browser shutdown cleanup failed',
      );
  }
}
