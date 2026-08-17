/**
 * What a pointer drag on the canvas means.
 *
 * A canvas drag is ambiguous at the moment it starts. Pressing on a state might move it, might
 * select it, or might begin drawing a transition; pressing on empty space might be a marquee or
 * might be a click that clears the selection. Which one it was is only known once the pointer
 * moves — or does not.
 *
 * Implemented as an explicit state machine over a handful of pure functions rather than as
 * booleans on a component, for two reasons. Booleans admit states that make no sense (dragging
 * *and* marqueeing), and every one of the decisions below is a behaviour someone will
 * eventually disagree with, which is much easier to argue about when it is a function with a
 * name than when it is a condition three levels into an event handler.
 *
 * Nothing here touches the store. Transitions return {@link Intent}s describing what should
 * happen, and the hook that owns the store turns those into commands. That keeps the rules of
 * interaction testable without React, a document, or a DOM.
 */

import type { Layout, Point } from '@/canvas/geometry';
import {
  dragged,
  onRim,
  rectBetween,
  selectionAfterClick,
  selectionAfterMarquee,
  stateAt,
  statesInRect,
  type SelectionRect,
} from '@/canvas/selection';
import type { StateId } from '@/model/automaton';

/**
 * How far the pointer must move before a press becomes a drag, in screen pixels.
 *
 * Without a threshold every click on a state emits a move, so clicking a state costs an undo
 * press to reverse something the user did not do. Three pixels is below the noise floor of a
 * deliberate click and well under the smallest intentional drag.
 */
export const DRAG_THRESHOLD = 3;

/** What the pointer is currently doing. */
export type Interaction =
  | { kind: 'idle' }
  /** Pressed on a state, not yet moved far enough to count as a drag. */
  | {
      kind: 'pressing';
      on: StateId;
      at: Point;
      additive: boolean;
      /** Whether the press landed on the rim, where a drag draws an edge instead. */
      rim: boolean;
    }
  | {
      kind: 'dragging';
      ids: StateId[];
      /** The state actually grabbed — the one that snaps to the grid. */
      anchor: StateId;
      from: Point;
      /** Positions when the drag began, so every frame is computed from the same base. */
      origin: Layout;
    }
  | {
      kind: 'marquee';
      from: Point;
      to: Point;
      /** Selection when the drag began, so an additive marquee can be swept back off. */
      before: StateId[];
      additive: boolean;
    }
  | { kind: 'connecting'; from: StateId; to: Point; over?: StateId };

/** Something the editor should do. The hook turns these into commands. */
export type Intent =
  | { kind: 'select'; ids: StateId[] }
  | { kind: 'move'; moves: { id: StateId; to: Point }[] }
  | { kind: 'connect'; from: StateId; to: StateId };

/** What the canvas knows about the document, for hit-testing. */
export interface Scene {
  ids: readonly StateId[];
  layout: Layout;
  selection: readonly StateId[];
  /** Rounds a diagram point to the snap grid. */
  snap: (point: Point) => Point;
}

/** A transition's result: where the machine is now, and what should happen. */
export interface Step {
  next: Interaction;
  intents: Intent[];
}

const step = (next: Interaction, ...intents: Intent[]): Step => ({ next, intents });

/**
 * The pointer went down on the canvas.
 *
 * Selecting an *unselected* state happens here rather than on release, because a selection that
 * waits for mouseup makes dragging feel unresponsive — the highlight appears after the state
 * has already moved. Pressing an *already selected* state changes nothing yet: that press might
 * be the start of dragging the whole group, and collapsing the selection first would make
 * dragging a group impossible.
 */
export function pointerDown(at: Point, additive: boolean, scene: Scene): Step {
  const hit = stateAt(at, scene.ids, scene.layout);

  if (hit === undefined) {
    // Empty canvas. A marquee that turns out to be a click clears the selection on release.
    return step({ kind: 'marquee', from: at, to: at, before: [...scene.selection], additive });
  }

  const centre = scene.layout[hit];
  const rim = centre ? onRim(at, centre) : false;
  const alreadySelected = scene.selection.includes(hit);
  const pressing: Interaction = { kind: 'pressing', on: hit, at, additive, rim };

  if (alreadySelected && !additive) return step(pressing);
  return step(pressing, {
    kind: 'select',
    ids: selectionAfterClick(scene.selection, hit, additive),
  });
}

/**
 * The pointer moved.
 *
 * `threshold` is in diagram units — the caller divides {@link DRAG_THRESHOLD} by the zoom, so a
 * drag takes the same physical movement to start whatever the zoom is. A fixed diagram-space
 * threshold would need a four-pixel nudge at 0.25× and would trigger on a shaky click at 4×.
 */
export function pointerMove(
  state: Interaction,
  at: Point,
  scene: Scene,
  threshold = DRAG_THRESHOLD,
): Step {
  switch (state.kind) {
    case 'pressing': {
      if (Math.hypot(at.x - state.at.x, at.y - state.at.y) < threshold) return step(state);

      // A drag from the rim draws a transition; from anywhere else it moves the state.
      if (state.rim) {
        return step({ kind: 'connecting', from: state.on, to: at, over: overState(at, scene) });
      }

      // Drag whatever is selected, which includes this state — either it was already
      // selected, or `pointerDown` just selected it.
      const ids = scene.selection.includes(state.on) ? [...scene.selection] : [state.on];
      return moveStep(
        {
          kind: 'dragging',
          ids,
          anchor: state.on,
          from: state.at,
          origin: { ...scene.layout },
        },
        at,
        scene,
      );
    }

    case 'dragging':
      return moveStep(state, at, scene);

    case 'connecting':
      return step({ ...state, to: at, over: overState(at, scene) });

    case 'marquee': {
      const next: Interaction = { ...state, to: at };
      const covered = statesInRect(marqueeRect(next), scene.ids, scene.layout);
      return step(next, {
        kind: 'select',
        ids: selectionAfterMarquee(state.before, covered, state.additive),
      });
    }

    default:
      return step(state);
  }
}

/**
 * The pointer came up.
 *
 * This is where a press that never became a drag is resolved. Clicking a state that was part of
 * a group collapses the selection to just that state — the decision deferred at `pointerDown`,
 * now that it is known no drag followed. Clicking empty canvas clears the selection.
 */
export function pointerUp(state: Interaction, scene: Scene): Step {
  switch (state.kind) {
    case 'pressing':
      // A plain click on a member of a group means "just this one", which could not be
      // decided on the way down without breaking group drags.
      if (!state.additive && scene.selection.length > 1 && scene.selection.includes(state.on)) {
        return step({ kind: 'idle' }, { kind: 'select', ids: [state.on] });
      }
      return step({ kind: 'idle' });

    case 'connecting':
      // Dropping on empty space cancels rather than creating a state. Creating one would make
      // a slipped drag add something the user then has to find and delete.
      return state.over === undefined
        ? step({ kind: 'idle' })
        : step({ kind: 'idle' }, { kind: 'connect', from: state.from, to: state.over });

    case 'marquee': {
      const isClick = state.from.x === state.to.x && state.from.y === state.to.y;
      return isClick && !state.additive
        ? step({ kind: 'idle' }, { kind: 'select', ids: [] })
        : step({ kind: 'idle' });
    }

    default:
      return step({ kind: 'idle' });
  }
}

/** The pointer was cancelled — a system gesture, or the window losing it mid-drag. */
export function pointerCancel(): Step {
  return step({ kind: 'idle' });
}

/** The rectangle a marquee currently covers. */
export function marqueeRect(state: Interaction): SelectionRect {
  if (state.kind !== 'marquee') return { x: 0, y: 0, width: 0, height: 0 };
  return rectBetween(state.from, state.to);
}

/** Whether an interaction should suppress the canvas's own click handling. */
export function isDragging(state: Interaction): boolean {
  return state.kind === 'dragging' || state.kind === 'connecting' || state.kind === 'marquee';
}

/** A drag frame: recompute every position from the origin, never from the last frame. */
function moveStep(
  state: Extract<Interaction, { kind: 'dragging' }>,
  at: Point,
  scene: Scene,
): Step {
  // From the origin rather than incrementally, so rounding cannot accumulate across a
  // 200-frame drag and leave states a few pixels from where the pointer says they are.
  const moves = dragged(
    state.origin,
    state.ids,
    at.x - state.from.x,
    at.y - state.from.y,
    scene.snap,
    state.anchor,
  );
  return step(state, { kind: 'move', moves });
}

/** Which state a connection drag is currently over, excluding none — self-loops are legal. */
function overState(at: Point, scene: Scene): StateId | undefined {
  return stateAt(at, scene.ids, scene.layout);
}
