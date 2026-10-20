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
  } = {},
) {
  if (!references.length || references.length > 8)
    throw new Error('Select between one and eight references');
  const images: Image[] = [],
    results: Record<string, unknown>[] = [];
  const started = performance.now(),
    budgetMs = Math.min(45000, options.budgetMs ?? 45000);
  const byteLimit = Math.min(4000000, options.byteLimit ?? 4000000);
  let bytes = 0;
  for (const [inputIndex, reference] of references.entries()) {
    options.signal?.throwIfAborted();
    const base = {
      inputIndex,
      key: reference.key,
      url: reference.url ?? null,
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
      });
      continue;
    }
    const remaining = budgetMs - (performance.now() - started);
    if (remaining < 1000 || bytes >= byteLimit) {
      results.push({
        ...base,
        status: 'not-yet-previewed',
        reason:
          'Batch deadline or image-byte budget reached; explicitly select this reference in a later batch.',
      });
      continue;
    }
    let sessionId: string | undefined;
    try {
      const signal = AbortSignal.any([
        AbortSignal.timeout(Math.min(10000, Math.max(1, Math.floor(remaining)))),
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
      const capture = await browser.capture(sessionId, undefined, signal);
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
      });
      images.push(image);
      bytes += imageBytes;
    } catch (error) {
      options.signal?.throwIfAborted();
      const reason = error instanceof Error ? error.message : 'Preview failed';
      results.push({
        ...base,
        status: /robots|challenge|restricted|permission|not authorized/i.test(reason)
          ? 'blocked'
          : 'unavailable',
        reason: reason.slice(0, 1200),
      });
    } finally {
      if (sessionId) await browser.close(sessionId);
    }
  }
  return {
    data: {
      references: results,
      capturedImages: images.length,
      bytes,
      elapsedMs: performance.now() - started,
      retention:
        'Images exist only in this MCP response. Every preview session is closed; no preview cache or site/media file is created.',
      interpretation:
        'An image proves a captured frame, not complete rendering, source licensing, aesthetic suitability or inspection of content behind a gate.',
      next: 'View images in imageIndex order. Select an authorized original URL to open an interactive session; partial/blocked references need diagnosis or another explicitly selected candidate.',
      untrustedEvidence: true,
    },
    images,
  };
}
