import type { BrowserSessions, Image } from './sessions.js';

export type PreviewReference = {
  key: string;
  url?: string;
  title?: string;
  attribution?: unknown;
  resourceOrigins?: string[];
  error?: string;
  alternatives?: { id: string; url: string; title: string }[];
};

function failure(reason: string, timedOut = false) {
  const code =
    timedOut || /timeout|timed out|deadline/i.test(reason)
      ? 'deadline-exceeded'
      : /origin.*not.*approv/i.test(reason)
        ? 'origin-approval-required'
        : /robots/i.test(reason)
          ? 'robots-denied'
          : /challenge|permission|not authorized|restricted/i.test(reason)
            ? 'access-denied'
            : /cleanup|shutdown/i.test(reason)
              ? 'cleanup-failed'
              : /capacity|session limit|budget exhausted|queue full/i.test(reason)
                ? 'resource-limit'
                : /unsafe|credential|HTTP\(S\)/i.test(reason)
                  ? 'unsafe-url'
                  : 'navigation-or-capture-failed';
  const nextAction =
    code === 'origin-approval-required'
      ? 'Review the selected original and explicitly approve only the required origin; no origin is approved automatically.'
      : code === 'robots-denied' || code === 'access-denied' || code === 'unsafe-url'
        ? 'Select another permitted reference. Do not bypass this refusal.'
        : code === 'cleanup-failed'
          ? 'Inspect cleanup diagnostics before admitting another browser batch.'
          : code === 'resource-limit'
            ? 'Close unneeded sessions or choose a smaller batch, then explicitly try again.'
            : 'Explicitly select this original for a deeper open, or choose a larger bounded preview budget. No automatic retry was performed.';
  return { code, nextAction };
}

/** Individually selected originals only. Sequential launches and finally-close bound
 * process ownership; no remote gallery image is fetched or persistently cached. */
export async function previewReferences(
  browser: BrowserSessions,
  references: PreviewReference[],
  options: {
    signal?: AbortSignal;
    viewport?: { width: number; height: number };
    byteLimit?: number;
    budgetMs?: number;
    perReferenceTimeoutMs?: number;
    waitForReadyMs?: number;
  } = {},
) {
  if (!references.length || references.length > 8)
    throw new Error('Select between one and eight references');
  const images: Image[] = [],
    results: Record<string, unknown>[] = [];
  const started = performance.now(),
    budgetMs = Math.min(60000, options.budgetMs ?? 45000);
  const byteLimit = Math.min(4000000, options.byteLimit ?? 4000000);
  let bytes = 0;
  let cleanupFailed = false;
  for (const [inputIndex, reference] of references.entries()) {
    options.signal?.throwIfAborted();
    const base = {
      inputIndex,
      key: reference.key,
      url: reference.url ?? null,
      requestedUrl: reference.url ?? null,
      title: reference.title ?? null,
      attribution: reference.attribution ?? null,
      alternatives: reference.alternatives ?? [],
      imageIndex: null as number | null,
    };
    if (reference.error || !reference.url) {
      results.push({
        ...base,
        status: 'unavailable',
        reason: reference.error ?? 'Missing selected original URL',
        failureCode: 'invalid-reference',
        nextAction: 'Select an active discovery reference or an explicit authorized original URL.',
      });
      continue;
    }
    const remaining = budgetMs - (performance.now() - started);
    if (cleanupFailed || remaining < 1000 || bytes >= byteLimit) {
      results.push({
        ...base,
        status: 'not-yet-previewed',
        reason: cleanupFailed
          ? 'Admission stopped after an owned cleanup failure; inspect diagnostics before another batch.'
          : 'Batch deadline or image-byte budget reached; explicitly select this reference in a later batch.',
        failureCode: cleanupFailed ? 'cleanup-failed' : 'batch-budget-exhausted',
      });
      continue;
    }
    let sessionId: string | undefined;
    let signal: AbortSignal | undefined;
    let stage = 'open';
    const itemStarted = performance.now();
    try {
      signal = AbortSignal.any([
        AbortSignal.timeout(
          Math.min(
            20000,
            options.perReferenceTimeoutMs ?? 10000,
            Math.max(1, Math.floor(remaining)),
          ),
        ),
        ...(options.signal ? [options.signal] : []),
      ]);
      const opened = await browser.open(
        {
          url: reference.url,
          authorized: true,
          viewport: options.viewport ?? { width: 1024, height: 640 },
          resourceOrigins: reference.resourceOrigins,
          attribution: reference.attribution,
        },
        signal,
      );
      sessionId = opened.sessionId;
      stage = 'capture';
      const capture = await browser.capture(sessionId, undefined, signal, {
        waitForReadyMs: options.waitForReadyMs ?? 1500,
      });
      const image = capture.images[0]!;
      const imageBytes = Buffer.byteLength(image.data, 'base64');
      if (bytes + imageBytes > byteLimit) {
        results.push({
          ...base,
          status: 'not-yet-previewed',
          reason:
            'Actual captured image exceeded the remaining batch byte budget; it was discarded.',
        });
        continue;
      }
      const ready = capture.data.readiness;
      const reasons: string[] = [];
      if (ready.visualState.loadingOverlay)
        reasons.push('Visible substantial loading overlay; the underlying scene is not verified');
      if (ready.visualState.consentOverlay)
        reasons.push('Visible consent/cookie overlay; underlying content may be obscured');
      if (ready.visualState.keyGate)
        reasons.push('Visible password/key input; no hidden scene inspection or bypass is claimed');
      if (ready.images.visible > ready.images.visibleLoaded)
        reasons.push('One or more visible images are incomplete or failed');
      if (ready.fonts !== 'loaded') reasons.push('Font readiness wait was incomplete');
      if (capture.data.diagnostics.blocked.length)
        reasons.push(
          'Some resource requests were blocked; inspect diagnostics before assuming visual completeness',
        );
      results.push({
        ...base,
        imageIndex: images.length,
        url: capture.data.url,
        actualUrl: capture.data.url,
        status: reasons.length ? 'partial-render' : 'captured',
        kind: 'fresh-original-site-screenshot',
        capturedAt: capture.data.capturedAt,
        viewport: capture.data.viewport,
        readiness: ready,
        reasons,
        diagnostics: {
          requests: capture.data.diagnostics.requests,
          blocked: capture.data.diagnostics.blocked,
          errors: capture.data.diagnostics.errors,
        },
        byteLength: imageBytes,
        processSelection: opened.diagnostics.browser.selection,
        observedBrowser: opened.diagnostics.browser.browser,
        nextAction: reasons.length
          ? 'Inspect this partial frame and its diagnostics; explicitly open the original for further observation without dismissing access or consent controls.'
          : 'View this actual frame before choosing a deeper investigation; readiness is not an aesthetic verdict.',
      });
      images.push(image);
      bytes += imageBytes;
    } catch (error) {
      options.signal?.throwIfAborted();
      const reason = error instanceof Error ? error.message : 'Preview failed';
      const diagnostic = failure(reason, signal?.aborted);
      if (diagnostic.code === 'cleanup-failed') cleanupFailed = true;
      results.push({
        ...base,
        status: [
          'origin-approval-required',
          'robots-denied',
          'access-denied',
          'unsafe-url',
        ].includes(diagnostic.code)
          ? 'blocked'
          : 'unavailable',
        reason: reason.slice(0, 1200),
        failureCode: diagnostic.code,
        stage,
        nextAction: diagnostic.nextAction,
      });
    } finally {
      const result = results.at(-1);
      if (sessionId) {
        try {
          await browser.close(sessionId);
          if (result?.inputIndex === inputIndex) result.cleanup = { status: 'closed' };
        } catch (error) {
          cleanupFailed = true;
          if (result?.inputIndex === inputIndex)
            result.cleanup = {
              status: 'failed',
              reason: (error instanceof Error ? error.message : 'Owned cleanup failed').slice(
                0,
                1200,
              ),
            };
        }
      }
      if (result?.inputIndex === inputIndex)
        result.elapsedMs = Math.round(performance.now() - itemStarted);
    }
  }
  options.signal?.throwIfAborted();
  return {
    data: {
      references: results,
      capturedImages: images.length,
      bytes,
      elapsedMs: performance.now() - started,
      executionStatus: cleanupFailed
        ? 'cleanup-failed'
        : results.some((r) => r.status !== 'captured')
          ? 'completed-with-limits'
          : 'completed',
      limits: {
        budgetMs,
        perReferenceTimeoutMs: Math.min(20000, options.perReferenceTimeoutMs ?? 10000),
        waitForReadyMs: options.waitForReadyMs ?? 1500,
        byteLimit,
        deadlines: 'Soft admission/abort budgets; owned browser launch and cleanup can add time.',
      },
      retention:
        'Images exist only in this MCP response. Every acquired session has close awaited; cleanup failures are explicit and stop further admission. No preview cache or site/media file is created.',
      interpretation:
        'An image proves a captured frame, not complete rendering, source licensing, aesthetic suitability or inspection of content behind a gate.',
      next: 'View images in imageIndex order. Select an authorized original URL to open an interactive session; partial/blocked references need diagnosis or another explicitly selected candidate.',
      untrustedEvidence: true,
    },
    images,
  };
}
