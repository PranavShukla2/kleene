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
 */

import { STATE_DRAG } from '@/editor/dragState';

export function StatePalette() {
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
        /*
          A button rather than a bare div, so it is reachable and announced. It has no click
          behaviour — the canvas's own double-click and context menu already cover the
          pointer-free paths — so the label carries the instruction instead.
        */
        aria-label="Drag onto the canvas to add a state"
        title="Drag me onto the canvas — or double-click the canvas"
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
