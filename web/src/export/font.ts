/**
 * The font, as bytes (task C2).
 *
 * An exported SVG that names `JetBrains Mono` and does not carry it renders in whatever the
 * viewer happens to have. Monospace fallbacks differ in advance width, so state labels stop
 * being centred in their circles — a diagram that is subtly, unfixably wrong in someone else's
 * document.
 *
 * ## What this costs
 *
 * The Latin subset is about 28KB, and it is added to every exported SVG that embeds it. That
 * is a real cost and it is why embedding is a choice rather than a default for PNG, where the
 * font has already been rasterised and the bytes would be dead weight.
 *
 * Only the Latin subset travels. Greek is a separate file, and a diagram whose labels are
 * Greek is rare enough that paying 28KB more on every export to cover it is the wrong trade —
 * the fallback there is a slightly different epsilon, not a broken layout.
 */

import fontUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';

/** Fetched once. The bytes do not change, and an export is not a reason to re-download them. */
let cached: Promise<string> | undefined;

/**
 * The embeddable font, base64-encoded.
 *
 * Resolves to `undefined` rather than rejecting if the fetch fails: an export without an
 * embedded font is worse than one with it, and far better than no export at all.
 */
export function embeddableFont(): Promise<string | undefined> {
  cached ??= fetch(fontUrl)
    .then((response) => response.arrayBuffer())
    .then(toBase64);

  return cached.catch(() => undefined);
}

/**
 * Base64 without blowing the stack.
 *
 * `String.fromCharCode(...bytes)` is the obvious one-liner and throws on a 28KB font — the
 * argument list is longer than the engine's limit. Chunking is the whole reason this is a
 * function rather than an expression.
 */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return btoa(binary);
}
