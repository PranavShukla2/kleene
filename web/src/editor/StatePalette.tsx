/**
 * The thing you can pick up.
 *
 * An empty canvas is honest about having nothing on it and silent about how to change that.
 * Double-click works and is faster, but nothing on screen says so — which is why the first-run
 * tour has to spend its opening card on a gesture, and why anyone who dismisses the tour is
 * left with a blank rectangle.
 *
 * ## Pointer events, not HTML5 drag-and-drop
 *
 * This chip used `draggable` and `dragstart`, and that was wrong twice over:
 *
 * - **On a phone it did nothing.** HTML5 drag-and-drop is a mouse protocol; `dragstart` does
 *   not fire from a touch. Combined with double-click not being a touchscreen gesture, there
 *   was no way to create a state at all.
 * - **In the desktop build it did nothing either**, because a webview hands OS-level drags to
 *   the shell before the page sees them.
 *
 * Pointer events have none of that. One code path for mouse, touch and pen, no dependence on
 * what the host does with a native drag, and `setPointerCapture` keeps the gesture alive when
 * the finger leaves the button — which it does immediately, since the whole point is to move
 * it somewhere else.
 *
 * A tap still works, because a tap is a press and release that never moved.
 *
 * Top-left, under the command bar, deliberately small. It was bottom-left until the transition
 * table started opening along the bottom edge and covered it. A hint, not a toolbar — a
 * palette that grows a second row has started to become the panel column this editor removed.
 */

export function StatePalette({
  onPlaceStart,
  connecting,
  onToggleConnect,
}: {
  /** A press on the chip. The canvas tracks the pointer from here and decides where it lands. */
  onPlaceStart: (event: React.PointerEvent) => void;
  /** Whether the canvas is waiting for two states to join. */
  connecting: boolean;
  onToggleConnect: () => void;
}) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-20 flex items-center gap-2">
      <button
        type="button"
        onPointerDown={onPlaceStart}
        // Without this a touch drag scrolls the page instead of moving the chip, and the
        // gesture ends before it starts.
        style={{ touchAction: 'none' }}
        aria-label="Add a state — drag it onto the canvas, or tap to place one"
        title="Drag me onto the canvas, or tap to add a state"
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

      {/*
        Transitions, the other way round.

        A transition already has a gesture — drag from a state's *rim* — and it is the single
        least guessable thing in the editor, which is why the tour spends a card on it. It is
        also close to unusable with a finger: the rim is a few pixels wide, and on a phone
        those pixels are under the fingertip that is trying to hit them.
        
        So this is the same job as a mode rather than a drag: press it, tap the state the arrow
        leaves, tap the state it arrives at. Two taps, both of them on targets the size of a
        state. The rim drag stays for anyone who has learned it — it is quicker — and this is
        the path that works with a finger and with a keyboard.
      */}
      {/* `data-connect` is a stable handle for tests: the visible label changes with the
          mode, which is right for a reader and useless for a locator — the control is named
          one way before it is pressed and another way after. */}
      <button
        type="button"
        onClick={onToggleConnect}
        aria-pressed={connecting}
        data-connect
        title={
          connecting
            ? 'Tap the state the arrow leaves, then the one it arrives at. Esc to stop.'
            : 'Connect two states — or drag from a state’s rim, which is quicker'
        }
        className={`pointer-events-auto flex items-center gap-2 rounded-full border py-1.5 pr-3 pl-1.5 shadow-sm backdrop-blur transition-colors duration-(--duration-k-hover) ${
          connecting
            ? 'border-k-primary bg-k-primary/12'
            : 'border-k-border bg-k-surface-raised/90 hover:border-k-primary/50'
        }`}
      >
        <span
          aria-hidden
          className="grid h-6 w-6 place-items-center rounded-full border border-k-border bg-k-surface font-mono text-[11px] text-k-text-faint"
        >
          →
        </span>
        <span className="text-xs text-k-text-muted">
          {connecting ? 'pick two states' : 'connect'}
        </span>
      </button>
    </div>
  );
}
