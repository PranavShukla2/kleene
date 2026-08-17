/**
 * The mapping between screen pixels and diagram coordinates.
 *
 * One transform, in one place. Hit-testing and rendering must never disagree about where a
 * state is, and the reliable way to guarantee that is for both to go through the same two
 * functions rather than each doing its own arithmetic.
 *
 * The transform is deliberately just pan and uniform zoom — no rotation, no skew. Automata
 * are read left to right, and a rotated diagram is a novelty rather than a feature; keeping
 * the transform this small means {@link toWorld} and {@link toScreen} are exact inverses,
 * which is a property worth having and worth testing.
 */

import type { Point } from '@/canvas/geometry';
import { GEOM } from '@/canvas/geometry';

/**
 * Where the diagram sits on screen, and how large.
 *
 * `screen = world * scale + offset`
 */
export interface Viewport {
  /** Horizontal pan, in screen pixels. */
  x: number;
  /** Vertical pan, in screen pixels. */
  y: number;
  /** Zoom. 1 means one diagram unit per screen pixel. */
  scale: number;
}

/** Unzoomed, unpanned. */
export const IDENTITY: Viewport = { x: 0, y: 0, scale: 1 };

/** Interactive zoom limits, from design-system.md §4.4. */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

/**
 * How far {@link fitTo} may zoom out, below the interactive floor.
 *
 * The two differ deliberately. `ZOOM_MIN` exists so wheel-zooming cannot leave someone
 * staring at 12px states by accident. But "fit to content" is an explicit request to see
 * *everything*, and honouring it only when the content happens to be small enough would make
 * the command's name a lie — a 40-state NFA would silently fit part of itself. An overview
 * that is too small to read is still an overview; a fit that does not fit is a bug.
 */
export const ZOOM_FIT_MIN = 0.05;

/**
 * Snap distance.
 *
 * Deliberately smaller than the 24px visible grid: snapping to every visible dot feels
 * rigid, and 8px is enough to align neighbours without fighting someone placing a state
 * deliberately. Design-system §4.4.
 */
export const SNAP = 8;

function clampScale(scale: number, min = ZOOM_MIN): number {
  return Math.min(ZOOM_MAX, Math.max(min, scale));
}

/** Screen point to diagram point. */
export function toWorld(viewport: Viewport, screen: Point): Point {
  return {
    x: (screen.x - viewport.x) / viewport.scale,
    y: (screen.y - viewport.y) / viewport.scale,
  };
}

/** Diagram point to screen point. */
export function toScreen(viewport: Viewport, world: Point): Point {
  return {
    x: world.x * viewport.scale + viewport.x,
    y: world.y * viewport.scale + viewport.y,
  };
}

/** Move the diagram by a screen-space delta. */
export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
}

/**
 * Zoom, keeping the diagram point under `at` exactly where it is.
 *
 * Cursor-anchored rather than centre-anchored. Centre-anchored zoom makes the thing you are
 * pointing at slide away as you scroll toward it, which reads as the canvas fighting you —
 * and the fix is these three lines, not a redesign.
 */
export function zoomAt(viewport: Viewport, at: Point, factor: number): Viewport {
  const scale = clampScale(viewport.scale * factor);

  // Solve `toWorld(next, at) === toWorld(viewport, at)` for the new offset.
  const world = toWorld(viewport, at);
  return { x: at.x - world.x * scale, y: at.y - world.y * scale, scale };
}

/** Set an absolute zoom, keeping a screen point fixed. */
export function zoomTo(viewport: Viewport, at: Point, scale: number): Viewport {
  return zoomAt(viewport, at, clampScale(scale) / viewport.scale);
}

/** A rectangle in diagram space. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The area a set of states occupies, including their radius. */
export function boundsOf(points: readonly Point[], pad = GEOM.radius): Bounds | undefined {
  if (points.length === 0) return undefined;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs) - pad,
    minY: Math.min(...ys) - pad,
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad,
  };
}

/**
 * The viewport that shows `bounds` centred inside a viewport of `size`.
 *
 * Never zooms past 1. Scaling a three-state machine up to fill a wide screen makes it look
 * like a different diagram every time a state is added, and the states themselves are drawn
 * at a fixed radius for a reason.
 */
export function fitTo(
  bounds: Bounds | undefined,
  size: { width: number; height: number },
  padding = 48,
): Viewport {
  if (!bounds || size.width <= 0 || size.height <= 0) return IDENTITY;

  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);

  const scale = clampScale(
    Math.min(1, (size.width - padding * 2) / width, (size.height - padding * 2) / height),
    ZOOM_FIT_MIN,
  );

  return {
    scale,
    x: size.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    y: size.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
  };
}

/**
 * Round a diagram point to the snap grid.
 *
 * Ties round *away from zero* rather than using `Math.round`, which rounds halves toward
 * positive infinity — so `+12` would snap to `+16` while `-12` snapped to `-8`. The
 * asymmetry is invisible until someone aligns two states either side of the origin and finds
 * they do not line up.
 */
export function snapPoint(point: Point, grid = SNAP): Point {
  const round = (value: number) => Math.sign(value) * Math.round(Math.abs(value) / grid) * grid;
  return { x: round(point.x), y: round(point.y) };
}

/**
 * Turn a wheel event's delta into a zoom factor.
 *
 * Exponential rather than linear, so a notch scrolled at 4× zoom feels like the same gesture
 * as at 0.25×. A linear step would crawl when zoomed out and lurch when zoomed in.
 */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.002);
}
