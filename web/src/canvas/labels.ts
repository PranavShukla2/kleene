/**
 * Choosing where transition labels actually go.
 *
 * Routing decides an edge's *shape*; this decides where its text sits. They are separate
 * because they need different information. An edge knows its own two endpoints and can bend
 * around a state in the way — but it cannot see the label another edge placed three states
 * over, and that is exactly what makes a dense diagram unreadable.
 *
 * So each edge offers ordered candidates (`EdgeGeometry.anchors`) and this pass, which sees
 * every state and every label at once, picks between them. It is deliberately a greedy pass
 * rather than a global optimiser: labels are placed in a fixed order, each taking the first
 * candidate that collides with nothing already committed. Greedy is not optimal, but it is
 * *stable* — adding a transition at the end of a machine cannot rearrange the labels at the
 * start — and a diagram whose labels jump around as you edit it is worse than one with a
 * slightly suboptimal placement.
 */

import { GEOM, type Point } from '@/canvas/geometry';

/** An axis-aligned rectangle in diagram space. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Character advance for the 12px monospace label font.
 *
 * Measured rather than guessed: 0.6em is the advance width of the ui-monospace / SFMono /
 * Menlo stack the design system uses, and every glyph in a monospace font is the same width,
 * so `length * advance` is exact rather than an estimate. That is the reason labels are
 * monospace here and not merely a stylistic one — it means placement needs no DOM measurement
 * and stays a pure function, testable without a browser.
 */
const CHAR_ADVANCE = 7.2;

/** Height of a single line of label text, at the same size. */
const LINE_HEIGHT = 13;

/**
 * The halo the label's plate paints around its glyphs.
 *
 * Labels are drawn with a canvas-coloured stroke under the fill so they cut the line behind
 * them. That halo is part of what the label occupies visually, so collision must account for
 * it — otherwise two labels judged to be just clear of each other still touch.
 */
const PLATE = 3;

/** How much bigger a collision with a state counts than one with another label. */
const STATE_WEIGHT = 3;

/**
 * Cost of falling back to a less-preferred candidate.
 *
 * Small on purpose. It only ever decides between candidates that *all* collide, where the
 * search cannot win and is choosing the least-bad option; any clear candidate short-circuits
 * the search before this matters.
 */
const FALLBACK_COST = 1;

/** The space a label's text occupies, including its plate. */
export function labelSize(text: string): { width: number; height: number } {
  return {
    width: text.length * CHAR_ADVANCE + PLATE * 2,
    height: LINE_HEIGHT + PLATE * 2,
  };
}

/** The rectangle a label centred at `at` would cover. */
export function labelRect(at: Point, text: string): Rect {
  const { width, height } = labelSize(text);
  return { x: at.x - width / 2, y: at.y - height / 2, width, height };
}

/**
 * The area a state occupies, as a rectangle.
 *
 * A state is a circle, and squaring it off over-reports the four corners slightly. That error
 * is in the safe direction — it makes labels give states a marginally wider berth than
 * strictly necessary — and it keeps every obstacle in the diagram one shape, so the collision
 * test stays four comparisons rather than a case analysis.
 */
export function stateRect(centre: Point): Rect {
  const size = GEOM.radius * 2;
  return { x: centre.x - GEOM.radius, y: centre.y - GEOM.radius, width: size, height: size };
}

/** The area the start arrow occupies, entering `at` from the left. */
export function startArrowRect(at: Point): Rect {
  const tipX = at.x - GEOM.radius - GEOM.startGap;
  return {
    x: tipX - GEOM.startArrow,
    y: at.y - GEOM.edgeStroke * 2,
    width: GEOM.startArrow,
    height: GEOM.edgeStroke * 4,
  };
}

/** How much area two rectangles share. Zero when they do not overlap. */
export function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

/** A label looking for a home. */
export interface LabelRequest {
  /** Stable identity, for React keys and for tests. */
  key: string;
  text: string;
  /** Positions to try, best first — an edge's `anchors`. */
  candidates: readonly Point[];
}

/** A label and the position it was given. */
export interface PlacedLabel {
  key: string;
  text: string;
  at: Point;
  /**
   * Whether the label had to leave its preferred spot.
   *
   * Not used for rendering. It is here so the routing fixtures can assert on *how much*
   * displacement a layout causes, which is the number that tells you whether a change to the
   * router made diagrams better or merely different.
   */
  displaced: boolean;
  /** Whether even the chosen position still collides with something. */
  colliding: boolean;
}

/**
 * Place every label, avoiding states, fixed obstacles, and each other.
 *
 * Takes the first candidate that collides with nothing. If every candidate collides — a state
 * boxed in on all sides, or a machine drawn far more densely than it should be — it takes the
 * one with the least overlap and reports `colliding`, because a label sitting on top of
 * something is still readable and a missing label is not.
 */
export function placeLabels(
  requests: readonly LabelRequest[],
  obstacles: readonly Rect[],
): PlacedLabel[] {
  const placed: Rect[] = [];

  return requests.map((request) => {
    const fallback = request.candidates[0] ?? { x: 0, y: 0 };

    let bestAt = fallback;
    let bestRect = labelRect(fallback, request.text);
    let bestCost = Number.POSITIVE_INFINITY;
    let bestIndex = 0;

    for (const [index, candidate] of request.candidates.entries()) {
      const rect = labelRect(candidate, request.text);
      const collision = collisionCost(rect, obstacles, placed);

      if (collision === 0) {
        bestAt = candidate;
        bestRect = rect;
        bestCost = 0;
        bestIndex = index;
        break;
      }

      const cost = collision + index * FALLBACK_COST;
      if (cost < bestCost) {
        bestAt = candidate;
        bestRect = rect;
        bestCost = cost;
        bestIndex = index;
      }
    }

    // Committed before the next label is considered — this is what makes the pass greedy, and
    // what stops two labels being placed in the same free gap.
    placed.push(bestRect);

    return {
      key: request.key,
      text: request.text,
      at: bestAt,
      displaced: bestIndex > 0,
      colliding: bestCost > 0,
    };
  });
}

/** Total weighted overlap between a candidate rectangle and everything already committed. */
function collisionCost(
  rect: Rect,
  obstacles: readonly Rect[],
  placed: readonly Rect[],
): number {
  let total = 0;
  for (const obstacle of obstacles) total += overlapArea(rect, obstacle) * STATE_WEIGHT;
  for (const other of placed) total += overlapArea(rect, other);
  return total;
}
