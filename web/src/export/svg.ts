/**
 * Turning the rendered diagram into a file (Phase 4 Track C).
 *
 * SVG export is nearly free here, and that is the payoff for a decision made in Phase 2: the
 * renderer draws real SVG, so the DOM on screen *is* the thing to export (roadmap §2.5).
 * Canvas would have meant writing a second renderer for export alone.
 *
 * ## What "export" has to mean
 *
 * An SVG that only looks right inside Kleene is not an export (task C2). Everything the
 * on-screen diagram gets from its surroundings has to be baked in:
 *
 * - **Colour** arrives through CSS custom properties on `:root`. Outside the app there is no
 *   `:root` to read, so every `fill` and `stroke` is resolved to a literal and written onto
 *   the element.
 * - **The font** is loaded by the page. Outside it, state labels fall back to whatever the
 *   viewer has — different metrics, different widths, labels no longer centred in their
 *   circles. So the font travels with the file.
 * - **Animation classes** mean nothing outside and would leave dead attributes, so they go.
 *
 * ## And what has to be left out
 *
 * The diagram on screen carries things that are true of *this moment* rather than of the
 * machine: which state is selected, where a simulation has got to. Exported into an
 * assignment, a purple halo round one state is a claim nobody can read. Anything the renderer
 * marks `data-ui` is chrome, and chrome does not travel.
 *
 * The export is also **cropped to the diagram**. The canvas is a viewport — usually far larger
 * than the machine in it — and exporting the viewport gives a small drawing marooned in white.
 */

/** Attributes whose value can be a paint the browser resolved from a custom property. */
const PAINTS = ['fill', 'stroke', 'color'] as const;

/** Other computed values worth keeping. Anything not here is either inherited or irrelevant. */
const KEPT = [
  'stroke-width',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'opacity',
] as const;

/** How the exported file names the font, so the embedded face and the CSS agree. */
const FONT_FAMILY = 'JetBrains Mono';

export interface SvgOptions {
  /** A base64 `woff2`, embedded as an `@font-face` so labels keep their metrics. */
  font?: string;
  /** Painted behind the diagram. `undefined` leaves it transparent. */
  background?: string;
}

/**
 * Serialize a live `<svg>` element into a standalone document.
 *
 * Works on a **clone**, because the alternative is mutating the diagram the user is looking
 * at — inlining every computed style onto the real nodes would survive the export and quietly
 * override the stylesheet from then on.
 */
export function toSvg(source: SVGSVGElement, options: SvgOptions = {}): string {
  const clone = source.cloneNode(true) as SVGSVGElement;

  // Computed styles have to be read from the *live* tree: a detached clone has no styles at
  // all, so the two are walked in step.
  inline(source, clone);

  for (const chrome of clone.querySelectorAll('[data-ui]')) chrome.remove();

  // Cropped to everything the diagram draws, measured on the *root*. Measuring the first `<g>`
  // was the first attempt and it silently cropped to the paths group — the arrows fitted and
  // the last state hung off the edge.
  const bounds = contentBox(source);

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  if (bounds) {
    clone.setAttribute(
      'viewBox',
      `${String(bounds.x)} ${String(bounds.y)} ${String(bounds.width)} ${String(bounds.height)}`,
    );
    clone.setAttribute('width', String(Math.round(bounds.width)));
    clone.setAttribute('height', String(Math.round(bounds.height)));
  } else {
    const box = source.getBoundingClientRect();
    clone.setAttribute('width', String(Math.round(box.width)));
    clone.setAttribute('height', String(Math.round(box.height)));
  }

  if (options.background !== undefined) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', options.background);
    clone.insertBefore(rect, clone.firstChild);
  }

  if (options.font) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    // `font-display: block` rather than `swap`: a rasteriser that snapshots mid-swap would
    // bake in the fallback, which is the exact failure the embedding exists to prevent.
    style.textContent = `@font-face{font-family:'${FONT_FAMILY}';font-display:block;src:url(data:font/woff2;base64,${options.font}) format('woff2');}`;
    clone.insertBefore(style, clone.firstChild);
  }

  return new XMLSerializer().serializeToString(clone);
}

/** Padding round the diagram, so strokes and labels are not flush against the edge. */
const MARGIN = 24;

/**
 * The union of everything the SVG draws, in its own user coordinates.
 *
 * Taken from the root, which is what makes the answer the *whole* picture rather than one
 * group of it — and, since the exported render has no pan or zoom of its own, needs no
 * transform arithmetic.
 */
function contentBox(
  svg: SVGSVGElement,
): { x: number; y: number; width: number; height: number } | undefined {
  let box: DOMRect;
  try {
    box = svg.getBBox();
  } catch {
    // `getBBox` throws on an element that has never been laid out.
    return undefined;
  }
  if (box.width === 0 || box.height === 0) return undefined;

  return {
    x: box.x - MARGIN,
    y: box.y - MARGIN,
    width: box.width + MARGIN * 2,
    height: box.height + MARGIN * 2,
  };
}

/** Copy every computed paint and text style from `live` onto `clone`, recursively. */
function inline(live: Element, clone: Element): void {
  const computed = window.getComputedStyle(live);

  for (const property of PAINTS) {
    const value = computed.getPropertyValue(property);
    // `none` is meaningful and kept; an empty value means the property does not apply here.
    if (value !== '') clone.setAttribute(property, value);
  }

  for (const property of KEPT) {
    const value = computed.getPropertyValue(property);
    if (value !== '' && value !== 'normal') clone.setAttribute(property, value);
  }

  // Tailwind classes and animation names are meaningless outside the app, and an exported
  // file carrying `motion-safe:animate-[...]` invites someone to wonder what it does.
  clone.removeAttribute('class');

  const liveChildren = live.children;
  const cloneChildren = clone.children;
  for (let i = 0; i < liveChildren.length; i++) {
    const l = liveChildren[i];
    const c = cloneChildren[i];
    if (l && c) inline(l, c);
  }
}

/** A `data:` URL for an SVG string, for `<img>` and for download links. */
export function svgDataUrl(svg: string): string {
  // `encodeURIComponent` rather than base64: it avoids `btoa` throwing on the non-Latin-1
  // characters this app is full of — ε and Σ are in every second diagram.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Rasterize an SVG string to a PNG blob (task C3).
 *
 * Via an `<img>` and a canvas, which is the only route a browser offers.
 *
 * ## Why `decode()` is not enough on its own
 *
 * `decode()` resolves once the image is decoded, and for an SVG that is *before* the
 * `@font-face` inside it has loaded. Drawing straight after it produced a PNG with every
 * circle and arrow and not one label — the file was correct, the snapshot of it was taken too
 * early. The SVG opened directly looked perfect, which is what made it confusing.
 *
 * `createImageBitmap` is tried first because it resolves only once the image is fully
 * rendered, fonts included. Firefox has historically not accepted SVG blobs there, so the
 * `<img>` path stays as a fallback — with a settle, which is a race made very unlikely rather
 * than one closed. The bitmap path is the one that is actually correct.
 */
export async function toPng(
  svg: string,
  { scale = 2, background }: { scale?: number; background?: string } = {},
): Promise<Blob> {
  const image = await rasterSource(svg);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser did not provide a 2D canvas context.');

  if (background !== undefined) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ('close' in image) image.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The canvas produced no image data.'));
    }, 'image/png');
  });
}

/**
 * Something `drawImage` accepts, fully rendered.
 *
 * Preferring `createImageBitmap` is the whole fix: it waits for the image to be *rendered*,
 * where `HTMLImageElement.decode()` only waits for it to be decoded — and a font loading
 * inside an SVG happens after decoding.
 */
async function rasterSource(svg: string): Promise<ImageBitmap | HTMLImageElement> {
  const blob = new Blob([svg], { type: 'image/svg+xml' });

  try {
    return await createImageBitmap(blob);
  } catch {
    // Firefox has historically refused SVG blobs here. Fall back, and give the font a chance
    // to arrive before the draw.
    const image = new Image();
    image.src = svgDataUrl(svg);
    await image.decode();
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    return image;
  }
}

/** Hand the user a file. */
export function download(data: Blob | string, filename: string, type: string): void {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  // Revoked on the next frame rather than immediately: revoking before the browser has
  // started the download cancels it in Safari.
  requestAnimationFrame(() => {
    URL.revokeObjectURL(url);
  });
}

/** A filename that will not collide and says what it is. */
export function filenameFor(title: string, extension: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'automaton';
  return `${slug}.${extension}`;
}
