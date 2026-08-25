/**
 * The thing you can pick up.
 *
 * An empty canvas is honest about having nothing on it and silent about how to change that.
 * Double-click works and is faster, but nothing on screen says so — which is why the first-run
 * tour spends its opening card explaining a gesture, and why anyone who dismisses the tour
 * without reading it is left with a blank rectangle.
 *
 * A chip solves a different half of the problem. It is visible without being read, it says
 * "state" in words, and dragging it does the obvious thing. It does not replace double-click;
 * it is the affordance that lets someone discover there is anything to do here at all.
 *
 * Top-left, under the command bar, deliberately small. It was bottom-left until the transition
 * table started opening along the bottom edge and covered it — an affordance that disappears
 * when a panel opens is one that is missing whenever someone is midway through something.
 *
 * A hint, not a toolbar. A palette that grows a second row has started to become the panel
 * column this editor just removed.
 *
 * ## It has to work without a mouse
 *
 * HTML5 drag-and-drop is a mouse protocol — `dragstart` does not fire from a touch. Double
 * click is not a touchscreen gesture either. So on a phone the two ways of creating a state
 * were both dead, which is not a degraded experience but a missing feature: there was no way
 * to put anything on the canvas. Tapping the chip is the answer, and it doubles as the
 * keyboard path, because a real button is activated by Enter.
 */

import { STATE_DRAG } from '@/editor/dragState';

export function StatePalette({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-2">
      <button
        type="button"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(STATE_DRAG, 'state');
          // `copy`, not `move`: nothing leaves the palette. The cursor is the only thing
          // telling a user whether they are about to take the chip away or make a new state.
          event.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={onAdd}
        /*
          Tapping works too, and on a phone it is the only thing that does.

          HTML5 drag-and-drop is a mouse protocol: `dragstart` never fires from a touch, so on
          a phone this chip did nothing at all — and neither does double-click, which is not a
          gesture a touchscreen has. Between them that left no way to put a state on the
          canvas, which is most of what the editor is for.

          So a tap adds one in the middle of the view. Not a mobile special case: it is also
          the keyboard path, since the chip is a real button that Enter activates.
        */
        aria-label="Add a state — drag onto the canvas, or tap to place one"
        title="Drag me onto the canvas, or tap to add a state in the middle"
        className="pointer-events-auto flex cursor-grab items-center gap-2 rounded-full border border-k-border bg-k-surface-raised/90 py-1.5 pr-3 pl-1.5 shadow-sm backdrop-blur transition-colors duration-(--duration-k-hover) hover:border-k-primary/50 active:cursor-grabbing"
      >
        <span
          aria-hidden
          className="grid h-6 w-6 place-items-center rounded-full border-2 border-k-text-muted bg-k-surface-raised font-mono text-[9px] text-k-text-faint"
        >
          q
        </span>
        <span className="text-xs text-k-text-muted">drag a state</span>
      </button>
    </div>
  );
}
