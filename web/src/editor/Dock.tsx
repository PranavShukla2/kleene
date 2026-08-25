/**
 * The rail, and the panel it opens.
 *
 * ## Why the rail is always there
 *
 * The panels used to live in a column that was open by default, and the reason given was
 * discoverability: someone who cannot see the transition table has no way to learn it exists.
 * That reason was right and the solution was expensive — 288px of permanent width, on the page
 * whose whole job is a diagram.
 *
 * A rail keeps the reason and drops most of the cost. Five labelled buttons, always on screen,
 * naming everything the editor can show. Nothing is hidden behind a menu, and the canvas gets
 * the other 236px back.
 *
 * ## Why one at a time
 *
 * Because the alternative is what was there before. Seven panels stacked in a scrolling column
 * means the one you want is usually off-screen, and the six you are not reading are still
 * taking the width away from the diagram.
 *
 * ## Glyphs, not an icon set
 *
 * `δ`, `M`, `▶`. These are the notation the subject already uses, and a student who has seen a
 * transition function knows what `δ` opens without being taught. They also cost nothing: no
 * icon font, no sprite sheet, no 40 KB of SVG paths on a page with a 400 KB budget for its
 * entire engine. Each is paired with a word, because a glyph alone is a puzzle.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

import { PANELS, panelSpec, type PanelId } from '@/editor/panels';

/** Motion that matches the algorithm easing rather than the marketing spring. */
const EASE = [0.22, 0.61, 0.36, 1] as const;

/**
 * The open panel.
 *
 * ## The two edges behave differently on purpose
 *
 * A **side** panel floats over the canvas. Reflowing the diagram every time one opens moves
 * the thing you were looking at sideways, and the diagram is usually centred, so it moves by
 * half the panel's width.
 *
 * A **bottom** panel takes its space from the column instead. It is the one that hurts to get
 * wrong the other way: overlaying it hides the problem strip — "3 states are unreachable" —
 * at the exact moment someone opened the transition table to work out why. Losing a little
 * height is cheaper than losing the sentence explaining what is broken.
 */
export function DockPanel({
  open,
  onClose,
  children,
}: {
  open: PanelId | undefined;
  onClose: () => void;
  /** The open panel's contents. Rendered by the editor, which owns the state they show. */
  children: React.ReactNode;
}) {
  const still = useReducedMotion();
  const spec = open ? panelSpec(open) : undefined;

  // Escape closes whatever is open. Expected of anything that covers what you were looking at,
  // and the canvas is still visible behind it — so without this, the way out is to find the
  // same rail button again, which is a worse answer than the one every dialog already gives.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence mode="wait">
      {spec && (
        <motion.aside
          key={spec.id}
          aria-label={spec.label}
          data-panel={spec.id}
          initial={
            still ? false : spec.edge === 'side' ? { x: 24, opacity: 0 } : { y: 24, opacity: 0 }
          }
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={
            still
              ? undefined
              : spec.edge === 'side'
                ? { x: 24, opacity: 0 }
                : { y: 24, opacity: 0 }
          }
          transition={{ duration: 0.18, ease: EASE }}
          className={
            spec.edge === 'side'
              ? 'absolute inset-y-0 right-13 z-30 flex w-[22rem] flex-col border-l border-k-border bg-k-surface/95 shadow-xl backdrop-blur'
              : /*
                  In the column's flow, not over it — see the note above. Height is a fraction
                  of the window rather than a fixed number of pixels: a transition table's
                  useful size is "enough rows to see the machine", which scales with the
                  screen, and 40% leaves the diagram the majority it should keep.
                */
                'relative z-30 flex max-h-[40vh] min-h-64 shrink-0 flex-col border-t border-k-border bg-k-surface'
          }
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-k-border/60 px-4 py-2.5">
            <span aria-hidden className="font-mono text-sm text-k-primary">
              {spec.glyph}
            </span>
            <h2 className="text-sm font-medium tracking-tight">{spec.label}</h2>
            <p className="truncate text-xs text-k-text-faint">{spec.hint}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close ${spec.label}`}
              className="ml-auto rounded-full px-2 py-0.5 font-mono text-xs text-k-text-faint hover:text-k-text"
            >
              esc
            </button>
          </header>

          {/* The one scrolling region. A panel that scrolls its own header away loses the
                close button, which is the control someone reaches for when they are lost. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/**
 * The rail.
 *
 * A sibling of the canvas column, spanning the full height, so it is the one piece of panel
 * furniture that never moves. Everything else in this file appears and disappears; the rail is
 * what makes that safe, because there is always a visible way back to any of it.
 */
export function DockRail({
  open,
  onToggle,
}: {
  open: PanelId | undefined;
  onToggle: (id: PanelId) => void;
}) {
  return (
    <nav
      aria-label="Panels"
      className="absolute inset-y-0 right-0 z-40 flex w-13 shrink-0 flex-col items-center gap-1 border-l border-k-border bg-k-surface/70 py-2 backdrop-blur"
    >
      {PANELS.map((panel) => {
        const on = open === panel.id;
        return (
          <button
            key={panel.id}
            type="button"
            onClick={() => {
              onToggle(panel.id);
            }}
            title={panel.hint}
            aria-pressed={on}
            className={`flex w-11 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors duration-(--duration-k-hover) ${
              on
                ? 'bg-k-primary/12 text-k-primary'
                : 'text-k-text-faint hover:bg-k-surface-raised hover:text-k-text'
            }`}
          >
            <span aria-hidden className="font-mono text-sm leading-none">
              {panel.glyph}
            </span>
            <span className="text-[9px] leading-none">{panel.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
