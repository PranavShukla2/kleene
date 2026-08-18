/**
 * Moving states from where they were to where a layout put them, visibly.
 *
 * Roadmap §7 and task G2: **auto-layout must never silently overwrite manual positions.** Part
 * of that is being undoable, which the command stack gives for free. The other part is being
 * *legible* — a diagram that teleports into a new arrangement gives no way to tell what moved,
 * and no reason to believe it can be undone. Half a second of motion answers both.
 *
 * ## The animation is not in the document
 *
 * The command runs once, immediately, with the final positions: one undo entry, and the stored
 * document is correct from the first frame. Only the *rendering* is interpolated. Animating
 * through the store instead would write a layout per frame into the history, and undo would
 * walk back through thirty intermediate arrangements nobody asked for.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Layout } from '@/canvas/geometry';

/**
 * How long the move takes.
 *
 * Long enough to follow a state across the canvas, short enough not to be a wait. Below about
 * 250ms the eye cannot track individual states through a rearrangement, which is the one thing
 * this exists to allow.
 */
const DURATION_MS = 420;

/**
 * Ease-out cubic.
 *
 * Fast at the start, settling at the end. Linear motion reads as mechanical, and ease-*in*
 * would delay the moment the change becomes apparent — which is the moment that matters here.
 */
function ease(t: number): number {
  return 1 - (1 - t) ** 3;
}

export interface AnimatedLayout {
  /** The layout to render: the real one, unless a move is in flight. */
  layout: Layout;
  /** Play a move from `from` to the layout the document now holds. */
  animateFrom: (from: Layout) => void;
  /** Whether a move is currently playing. */
  animating: boolean;
}

/**
 * Interpolate from a previous layout toward the current one.
 *
 * Returns `target` itself — the same object, not a copy — whenever nothing is animating. That
 * referential equality is what keeps the canvas's routing and label-placement memo intact
 * during ordinary editing; rebuilding the layout object every render would silently undo the
 * work that measurement in B6 depends on.
 */
export function useAnimatedLayout(target: Layout): AnimatedLayout {
  const [frame, setFrame] = useState<Layout | undefined>(undefined);
  const fromRef = useRef<Layout>({});
  const startRef = useRef(0);
  const rafRef = useRef(0);

  // The target is read inside the animation loop, which outlives the render that started it.
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const animateFrom = useCallback((from: Layout) => {
    cancelAnimationFrame(rafRef.current);
    fromRef.current = from;
    startRef.current = performance.now();

    const tick = () => {
      const t = Math.min(1, (performance.now() - startRef.current) / DURATION_MS);
      const eased = ease(t);
      const to = targetRef.current;

      const next: Layout = {};
      for (const [key, end] of Object.entries(to)) {
        const id = Number(key);
        const start = fromRef.current[id];
        // A state with no previous position is new to the diagram, so it simply appears where
        // the layout put it rather than flying in from an origin it never occupied.
        next[id] = start
          ? {
              x: start.x + (end.x - start.x) * eased,
              y: start.y + (end.y - start.y) * eased,
            }
          : end;
      }

      if (t < 1) {
        setFrame(next);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Cleared rather than set to the final frame, so the hook goes back to returning
        // `target` by reference and the memo downstream stops being invalidated.
        setFrame(undefined);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  return { layout: frame ?? target, animateFrom, animating: frame !== undefined };
}
