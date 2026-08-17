/**
 * What is selected, and what a pointer is over.
 *
 * Pure functions on ids and points, with no React and no store. Selection is the one piece of
 * editor state that almost every interaction reads — dragging, deleting, the properties panel,
 * the keyboard model — so it is worth having somewhere it can be reasoned about on its own.
 *
 * Selection deliberately holds *ids*, never state objects. An id survives a rename, a move and
 * an undo; a captured object goes stale the moment anything edits the document, and the bug
 * that produces is a selection that silently refers to a state that no longer exists.
 */

import { GEOM, type Layout, type Point } from '@/canvas/geometry';
import type { StateId } from '@/model/automaton';

/** A rectangle in diagram space, corners normalised so width and height are positive. */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The rectangle between two dragged corners.
 *
 * Normalised, because a marquee dragged up and to the left produces negative extents and every
 * downstream test would otherwise need to handle both orders.
 */
export function rectBetween(a: Point, b: Point): SelectionRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/**
 * Which state is under a point, if any.
 *
 * Searches in reverse draw order, so the state visually on top is the one that gets hit.
 * States are drawn in array order, which makes the last one the topmost.
 */
export function stateAt(
  point: Point,
  ids: readonly StateId[],
  layout: Layout,
  radius = GEOM.radius,
): StateId | undefined {
  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const id = ids[i]!;
    const at = layout[id];
    if (at && Math.hypot(point.x - at.x, point.y - at.y) <= radius) return id;
  }
  return undefined;
}

/**
 * Whether a point is on a state's rim, where dragging starts a transition rather than a move.
 *
 * A band just inside the edge of the circle. Inside the band a drag draws an edge; anywhere
 * further in it moves the state. The band is on the *inside* so it stays within the visible
 * circle — a hit target hanging outside the shape it belongs to catches drags meant for the
 * empty canvas next to it.
 */
export function onRim(point: Point, at: Point, band = 8): boolean {
  const distance = Math.hypot(point.x - at.x, point.y - at.y);
  return distance <= GEOM.radius && distance >= GEOM.radius - band;
}

/**
 * Which states a marquee covers.
 *
 * Touching counts, rather than requiring full containment. Dragging a box that must completely
 * swallow every circle means people miss states they visibly dragged over, and the correction
 * is invisible — nothing indicates *why* the state was left out.
 */
export function statesInRect(
  rect: SelectionRect,
  ids: readonly StateId[],
  layout: Layout,
): StateId[] {
  return ids.filter((id) => {
    const at = layout[id];
    if (!at) return false;

    // Closest point of the rectangle to the circle's centre; inside the radius means they
    // touch. Handles the centre being inside the rectangle for free, since the closest point
    // is then the centre itself and the distance is zero.
    const nearestX = Math.max(rect.x, Math.min(at.x, rect.x + rect.width));
    const nearestY = Math.max(rect.y, Math.min(at.y, rect.y + rect.height));
    return Math.hypot(at.x - nearestX, at.y - nearestY) <= GEOM.radius;
  });
}

/**
 * The selection after clicking `id`.
 *
 * `additive` is shift or the platform modifier being held. Additive clicks *toggle*, which is
 * what makes a mis-shift-click undoable by repeating it; plain clicks replace.
 */
export function selectionAfterClick(
  current: readonly StateId[],
  id: StateId,
  additive: boolean,
): StateId[] {
  if (!additive) {
    // Clicking something already selected keeps the whole selection, so clicking one member of
    // a group and dragging moves the group rather than collapsing it to one state.
    return current.includes(id) ? [...current] : [id];
  }
  return current.includes(id) ? current.filter((other) => other !== id) : [...current, id];
}

/**
 * The selection after a marquee, given what was selected when the drag began.
 *
 * Additive marquees union with the starting selection rather than with the live one. Unioning
 * with the live selection would make states latch on as the box swept over them and never let
 * go when it swept back — a marquee has to be as reversible as the drag that draws it.
 */
export function selectionAfterMarquee(
  before: readonly StateId[],
  covered: readonly StateId[],
  additive: boolean,
): StateId[] {
  if (!additive) return [...covered];
  return [...before, ...covered.filter((id) => !before.includes(id))];
}

/**
 * Move several states by a drag, snapping the one under the cursor.
 *
 * **Only the anchor is snapped, and everything else follows its delta.** Snapping each state
 * independently looks right and is wrong: two states 100px apart, dragged together, land on
 * grid points 96px apart, so the group *shears*. Nudge it a few more times and a layout
 * someone arranged deliberately has quietly rearranged itself. Dragging a group must be rigid.
 *
 * The anchor is the state the pointer actually grabbed, so the state under the cursor is the
 * one that lands on the grid — which is the state whose alignment the user can see.
 *
 * Snapping the anchor's *destination* rather than the delta is still the right choice for the
 * anchor itself: snapping the delta preserves whatever off-grid offset it already had, so
 * "snap to grid" would do nothing for exactly the layouts that need it.
 */
export function dragged(
  origin: Layout,
  ids: readonly StateId[],
  dx: number,
  dy: number,
  snap: (point: Point) => Point,
  anchor?: StateId,
): { id: StateId; to: Point }[] {
  const lead = anchor !== undefined && ids.includes(anchor) ? anchor : ids[0];
  const leadFrom = lead === undefined ? undefined : origin[lead];

  let deltaX = dx;
  let deltaY = dy;
  if (leadFrom) {
    const snapped = snap({ x: leadFrom.x + dx, y: leadFrom.y + dy });
    deltaX = snapped.x - leadFrom.x;
    deltaY = snapped.y - leadFrom.y;
  }

  return ids.flatMap((id) => {
    const from = origin[id];
    return from ? [{ id, to: { x: from.x + deltaX, y: from.y + deltaY } }] : [];
  });
}
