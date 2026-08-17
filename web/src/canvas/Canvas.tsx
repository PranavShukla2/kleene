/**
 * The editing surface: a pannable, zoomable canvas holding one automaton.
 *
 * Wraps the pure {@link AutomatonView} renderer rather than replacing it. The renderer stays
 * presentational — a machine and a layout in, SVG out — and everything about *interaction*
 * lives here. Phase 2's interaction work therefore adds to this file rather than complicating
 * the thing that draws the diagram.
 */

import { useMemo } from 'react';

import { AutomatonGraphics } from '@/canvas/AutomatonView';
import { GEOM, type Layout, type Point } from '@/canvas/geometry';
import { useViewport } from '@/canvas/useViewport';
import type { Automaton } from '@/model/automaton';

interface Props {
  automaton: Automaton;
  layout: Layout;
  /** Accessible description of the diagram. */
  title: string;
  className?: string;
}

export function Canvas({ automaton, layout, title, className }: Props) {
  const { viewport, ref, panning, fit, reset } = useViewport();

  const points = useMemo(
    () => automaton.states.map((state) => layout[state.id]).filter((p): p is Point => !!p),
    [automaton.states, layout],
  );

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-k-canvas ${className ?? ''}`}
      style={{ cursor: panning ? 'grabbing' : 'default', touchAction: 'none' }}
    >
      {/*
        The grid is drawn in *screen* space and scrolled by the viewport, rather than being
        part of the zoomed diagram. A grid that scales with the zoom becomes a grey wash at
        0.25x and a sparse scatter at 4x; one that keeps its pitch stays a reference for
        where things are, which is the only reason it is there.
      */}
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
          {/*
            Drawn in diagram coordinates; the group transform above does the rest, so
            nothing inside has to know that pan or zoom exist.
          */}
          <AutomatonGraphics automaton={automaton} layout={layout} />
        </g>
      </svg>

      <div className="absolute right-3 bottom-3 flex gap-2">
        <CanvasButton
          onClick={() => {
            fit(points);
          }}
          disabled={points.length === 0}
        >
          Fit
        </CanvasButton>
        <CanvasButton onClick={reset}>{Math.round(viewport.scale * 100)}%</CanvasButton>
      </div>
    </div>
  );
}

function CanvasButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-k-border bg-k-surface-raised px-2.5 py-1 font-mono text-xs text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text disabled:opacity-40"
    >
      {children}
    </button>
  );
}
