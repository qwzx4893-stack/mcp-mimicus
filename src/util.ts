import { createHash } from 'node:crypto';
export const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function canonicalUrl(raw: string) {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
    throw new Error('Only credential-free HTTP(S) URLs are accepted');
  if (u.href.length > 2048) throw new Error('URL too long');
  u.hash = '';
  for (const k of [...u.searchParams.keys()])
    if (/^(utm_|fbclid$|gclid$)/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  // A terminal slash can select a different resource; do not merge those URLs.
  return u.href;
}
export const safeLabel = (s: string, max = 300) =>
  s.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, max);
export function abortCheck(signal?: AbortSignal) {
  signal?.throwIfAborted();
}
export async function mapBounded<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
) {
  const out: R[] = new Array(items.length);
  let cursor = 0,
    failure: unknown,
    failed = false;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length && !failed) {
        const i = cursor++;
        try {
          abortCheck(signal);
          out[i] = await fn(items[i]!, i);
        } catch (e) {
          failure = e;
          failed = true;
        }
      }
    }),
  );
  if (failed) throw failure;
  return out;
}
