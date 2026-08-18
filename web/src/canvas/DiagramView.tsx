/**
 * A diagram you can pan and zoom, but not edit.
 *
 * Task B1 asks the conversion panes to be independently pannable and zoomable, and the reason
 * shows up immediately: Thompson's construction on `(a|b)*abb` produces fourteen states in a
 * chain, and a fitted viewBox shrinks that to an unreadable smear inside a pane. Fitting
 * guarantees you can see the whole machine and nothing else.
 *
 * Deliberately *not* `Canvas`. That surface owns selection, dragging, transition drawing and a
 * command bar — none of which mean anything for a machine the engine derived and the user
 * cannot edit in place. Sharing it would mean disabling four features to get one.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { AutomatonGraphics } from '@/canvas/AutomatonView';
import { GEOM, type Layout, type Point } from '@/canvas/geometry';
import { useViewport } from '@/canvas/useViewport';
import type { Automaton, StateId } from '@/model/automaton';

export function DiagramView({
  automaton,
  layout,
  title,
  className,
  selection,
  onHoverState,
}: {
  automaton: Automaton;
  layout: Layout;
  title: string;
  className?: string;
  selection?: readonly StateId[];
  onHoverState?: (id: StateId | undefined) => void;
}) {
  const { viewport, ref: viewportRef, panning, fit, reset, size } = useViewport();

  const points = useMemo(
    () => automaton.states.map((state) => layout[state.id]).filter((p): p is Point => !!p),
    [automaton.states, layout],
  );

  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      viewportRef(element);
    },
    [viewportRef],
  );

  /**
   * Re-frame whenever the machine changes shape.
   *
   * On this page that is every keystroke, and it has to be *shape* rather than identity: a
   * pane that kept its zoom while the diagram underneath it grew from three states to fourteen
   * would leave someone looking at empty canvas after adding one character.
   *
   * Keyed on the state count rather than on the object, so panning stays put while the user
   * explores a machine that is not changing — re-framing every render would make the pane
   * fight anyone trying to look at a corner of it.
   */
  const framedFor = useRef('');
  useEffect(() => {
    // `fit` is a no-op until the element has been measured — `fitTo` returns the identity
    // viewport for a zero-sized box, because there is nothing to fit *into*. Waiting for the
    // measurement is the whole fix: framing on mount alone left every pane at 100%, with the
    // diagram running off the edge and its arrows apparently missing.
    if (size.width === 0 || size.height === 0) return;

    const key = `${String(points.length)}x${String(size.width)}`;
    if (framedFor.current === key) return;
    framedFor.current = key;

    fit(points);
  }, [points, fit, size]);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-k-canvas ${className ?? ''}`}
      style={{ cursor: panning ? 'grabbing' : 'default', touchAction: 'none' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(var(--color-k-grid-dot) 1px, transparent 1px)',
          backgroundSize: `${GEOM.grid}px ${GEOM.grid}px`,
          backgroundPosition: `${viewport.x % GEOM.grid}px ${viewport.y % GEOM.grid}px`,
        }}
      />

      <svg className="absolute inset-0 h-full w-full" role="img" aria-label={title}>
        <title>{title}</title>
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
          <AutomatonGraphics
            automaton={automaton}
            layout={layout}
            selection={selection}
            onHoverState={onHoverState}
          />
        </g>
      </svg>

      <div className="absolute right-2 bottom-2 flex gap-1.5">
        <SmallButton
          onClick={() => {
            fit(points);
          }}
        >
          Fit
        </SmallButton>
        <SmallButton onClick={reset}>{Math.round(viewport.scale * 100)}%</SmallButton>
      </div>
    </div>
  );
}

function SmallButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-k-border bg-k-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-k-text-faint transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text"
    >
      {children}
    </button>
  );
}
