/**
 * Renders an automaton as SVG.
 *
 * Pure and presentational: it takes a machine and a layout and draws them. No editing, no
 * store, no state. Phase 2 builds interaction *around* this component rather than into it.
 *
 * SVG rather than Canvas, per roadmap §2.5: hit-testing for drag comes free, CSS transitions
 * work, keyboard focus works, and SVG export becomes almost trivial because the DOM being
 * rendered is already the thing to export.
 */

import type { Automaton } from '@/model/automaton';
import {
  GEOM,
  curvedEdge,
  groupEdges,
  hasReverse,
  rowLayout,
  selfLoop,
  straightEdge,
  type Layout,
  type Point,
} from '@/canvas/geometry';

interface Props {
  automaton: Automaton;
  /** Where each state sits. Defaults to a simple left-to-right row. */
  layout?: Layout;
  /** Accessible description of what this diagram shows. */
  title: string;
  className?: string;
}

export function AutomatonView({ automaton, layout, title, className }: Props) {
  const ids = [...automaton.states.keys()];
  const positions = layout ?? rowLayout(ids);
  const edges = groupEdges(automaton.transitions);

  const box = viewBoxFor(Object.values(positions));

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      className={className}
      role="img"
      aria-label={title}
      // Rendered at whatever size the container gives it; the viewBox does the work.
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title}</title>

      <defs>
        {/*
          `context-stroke` makes one marker inherit whichever colour its own edge uses,
          instead of needing a separate <marker> per semantic state. That matters once
          Phase 3 starts colouring edges by meaning.
        */}
        <marker
          id="k-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6.5"
          markerHeight="6.5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>

        <pattern id="k-grid" width={GEOM.grid} height={GEOM.grid} patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="fill-k-grid-dot" />
        </pattern>
      </defs>

      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill="url(#k-grid)"
        className="text-k-grid-dot"
      />

      <g className="stroke-k-text-muted">
        {edges.map((edge) => (
          <Edge
            key={`${edge.from}->${edge.to}`}
            from={positions[edge.from]}
            to={positions[edge.to]}
            symbols={edge.symbols}
            curve={hasReverse(edges, edge.from, edge.to)}
            selfLoop={edge.from === edge.to}
          />
        ))}
      </g>

      {ids.map((id) => {
        const state = automaton.states.get(id);
        const at = positions[id];
        if (!state || !at) return null;
        return <StateNode key={id} at={at} label={state.label} accepting={state.accepting} />;
      })}

      <StartMarker at={positions[automaton.start]} />
    </svg>
  );
}

function StateNode({ at, label, accepting }: { at: Point; label: string; accepting: boolean }) {
  return (
    <g>
      <circle
        cx={at.x}
        cy={at.y}
        r={GEOM.radius}
        strokeWidth={GEOM.stateStroke}
        className={
          accepting
            ? 'fill-k-surface-raised stroke-k-accepting'
            : 'fill-k-surface-raised stroke-k-text-muted'
        }
      />
      {accepting && (
        <circle
          cx={at.x}
          cy={at.y}
          r={GEOM.radius - GEOM.acceptingInset}
          fill="none"
          strokeWidth={GEOM.stateStroke}
          className="stroke-k-accepting"
        />
      )}
      <text
        x={at.x}
        y={at.y}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-k-text font-mono text-[13px] font-medium select-none"
      >
        {label}
      </text>
    </g>
  );
}

function StartMarker({ at }: { at: Point | undefined }) {
  if (!at) return null;
  const tipX = at.x - GEOM.radius - GEOM.startGap;
  return (
    <line
      x1={tipX - GEOM.startArrow}
      y1={at.y}
      x2={tipX}
      y2={at.y}
      strokeWidth={GEOM.edgeStroke}
      markerEnd="url(#k-arrow)"
      className="stroke-k-text-muted"
    />
  );
}

interface EdgeProps {
  from: Point | undefined;
  to: Point | undefined;
  symbols: string[];
  curve: boolean;
  selfLoop: boolean;
}

function Edge({ from, to, symbols, curve, selfLoop: isLoop }: EdgeProps) {
  if (!from || !to) return null;

  const geom = isLoop ? selfLoop(from) : curve ? curvedEdge(from, to) : straightEdge(from, to);
  const text = symbols.join(', ');

  return (
    <g>
      <path
        d={geom.path}
        fill="none"
        strokeWidth={GEOM.edgeStroke}
        markerEnd="url(#k-arrow)"
        className="stroke-k-text-muted"
      />
      {/*
        The label sits on a filled plate that cuts the line behind it. Without this the
        stroke runs straight through the glyphs and both become hard to read — the single
        most common way a generated automaton diagram looks amateur.
      */}
      <text
        x={geom.label.x}
        y={geom.label.y}
        textAnchor="middle"
        dominantBaseline="central"
        stroke="var(--color-k-canvas)"
        strokeWidth="4"
        paintOrder="stroke"
        className="fill-k-text font-mono text-[12px] select-none"
      >
        {text}
      </text>
    </g>
  );
}

/** Fit the viewBox to the states, with room for labels, loops and the start arrow. */
function viewBoxFor(points: Point[]) {
  if (points.length === 0) return { x: 0, y: 0, width: 320, height: 200 };

  const pad = GEOM.radius + GEOM.startArrow + GEOM.loopRadius + 24;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;

  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) + pad - minX,
    height: Math.max(...ys) + pad - minY,
  };
}
