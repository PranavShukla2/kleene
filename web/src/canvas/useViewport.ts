/**
 * Pan and zoom gestures, bound to an element.
 *
 * All the arithmetic lives in `viewport.ts`; this only turns pointer and wheel events into
 * calls on it, and tracks the element's size so "fit to content" knows what it is fitting
 * into.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Point } from '@/canvas/geometry';
import { isTypingTarget } from '@/canvas/shortcuts';
import {
  IDENTITY,
  boundsOf,
  fitTo,
  panBy,
  toWorld,
  wheelZoomFactor,
  zoomAt,
  zoomTo,
  type Viewport,
} from '@/canvas/viewport';

/** Which mouse button starts a pan when dragged. */
const MIDDLE_BUTTON = 1;

export interface ViewportControls {
  viewport: Viewport;
  /** Attach to the element that should receive gestures. */
  ref: (element: HTMLElement | SVGElement | null) => void;
  /** Whether a pan is in progress, for the cursor style. */
  panning: boolean;
  /** Convert a pointer event to diagram coordinates. */
  pointerToWorld: (event: { clientX: number; clientY: number }) => Point;
  /** Frame the given diagram points. */
  fit: (points: readonly Point[]) => void;
  /** Back to 1:1, centred on the same place. */
  reset: () => void;
  /** Zoom about the centre of the view, for keyboard zoom. */
  zoomBy: (factor: number) => void;
  /**
   * The element's measured size, or zeroes before it has been measured.
   *
   * Exposed because `fit` is silently a no-op until this is known — `fitTo` returns the
   * identity viewport for a zero-sized box, since there is nothing to fit *into*. A caller
   * that wants to frame content on mount has to wait for a real measurement, and cannot know
   * when that happened without being told.
   */
  size: { width: number; height: number };
}

/**
 * Wire pan and zoom to an element.
 *
 * Panning is space-drag or middle-drag, both of which leave the left button free for
 * selecting and dragging states — the canvas is for editing, and a plain drag should never
 * mean "move the paper".
 */
export function useViewport(): ViewportControls {
  const [viewport, setViewport] = useState<Viewport>(IDENTITY);
  const [panning, setPanning] = useState(false);

  const elementRef = useRef<HTMLElement | SVGElement | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  // Mirrored into state so a change can be *observed*. The ref is what the callbacks read on
  // demand; this is what tells a caller the measurement has arrived.
  const [size, setSize] = useState({ width: 0, height: 0 });
  const spaceHeld = useRef(false);
  const panFrom = useRef<{ x: number; y: number } | undefined>(undefined);

  /** Where the element sits, so client coordinates can be made relative to it. */
  const originOf = useCallback((): Point => {
    const box = elementRef.current?.getBoundingClientRect();
    return { x: box?.left ?? 0, y: box?.top ?? 0 };
  }, []);

  const pointerToWorld = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const origin = originOf();
      return toWorld(viewport, { x: event.clientX - origin.x, y: event.clientY - origin.y });
    },
    [viewport, originOf],
  );

  const ref = useCallback((element: HTMLElement | SVGElement | null) => {
    elementRef.current = element;
  }, []);

  // Track the element's size for `fit`. A ResizeObserver rather than a window listener,
  // because the canvas can change size without the window doing so — a panel opening, for
  // instance.
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      sizeRef.current = next;
      setSize((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Space held means "the next drag pans". Tracked on the window so it works wherever
  // focus is, and released on blur so tabbing away cannot leave it stuck on.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        spaceHeld.current = true;
        // Stop the page scrolling under the canvas while space is used as a modifier.
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeld.current = false;
    };
    const blur = () => {
      spaceHeld.current = false;
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // Wheel zoom, as a non-passive listener so the page does not scroll instead. React's
  // onWheel is passive and cannot preventDefault, which is why this is attached by hand.
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Typed as EventListener because addEventListener on a union of HTMLElement and
    // SVGElement widens the handler signature; the cast is at the boundary, once.
    const onWheel = ((event: WheelEvent) => {
      event.preventDefault();
      const origin = originOf();
      const at = { x: event.clientX - origin.x, y: event.clientY - origin.y };

      // Ctrl+wheel is what a trackpad pinch reports as, and it deserves the same
      // treatment — both mean "zoom about this point".
      setViewport((current) => zoomAt(current, at, wheelZoomFactor(event.deltaY)));
    }) as EventListener;

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
    };
  }, [originOf]);

  // Pointer-based panning, on the window so a fast drag that leaves the element keeps
  // working rather than stopping at the edge.
  useEffect(() => {
    if (!panning) return;

    const move = (event: PointerEvent) => {
      const from = panFrom.current;
      if (!from) return;
      panFrom.current = { x: event.clientX, y: event.clientY };
      setViewport((current) => panBy(current, event.clientX - from.x, event.clientY - from.y));
    };
    const stop = () => {
      panFrom.current = undefined;
      setPanning(false);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [panning]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const onPointerDown = ((event: PointerEvent) => {
      if (event.button !== MIDDLE_BUTTON && !spaceHeld.current) return;
      event.preventDefault();
      panFrom.current = { x: event.clientX, y: event.clientY };
      setPanning(true);
    }) as EventListener;

    element.addEventListener('pointerdown', onPointerDown);
    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  const fit = useCallback((points: readonly Point[]) => {
    setViewport(fitTo(boundsOf(points), sizeRef.current));
  }, []);

  const reset = useCallback(() => {
    const centre = { x: sizeRef.current.width / 2, y: sizeRef.current.height / 2 };
    setViewport((current) => zoomTo(current, centre, 1));
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const centre = { x: sizeRef.current.width / 2, y: sizeRef.current.height / 2 };
    // Anchored on the centre rather than the cursor, because a keyboard zoom has no cursor
    // to anchor to and the middle of the view is what the user is looking at.
    setViewport((current) => zoomAt(current, centre, factor));
  }, []);

  return { viewport, ref, panning, pointerToWorld, fit, reset, zoomBy, size };
}
