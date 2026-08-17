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

import { useMemo } from 'react';

import type { Automaton, StateId } from '@/model/automaton';
import {
  GEOM,
  bendSideBelow,
  chooseLoopDirection,
  curvedEdge,
  groupEdges,
  hasReverse,
  isObstructed,
  rowLayout,
  selfLoop,
  straightEdge,
  type Layout,
  type Point,
} from '@/canvas/geometry';
import {
  placeLabels,
  startArrowRect,
  stateRect,
  type PlacedLabel,
  type Rect,
} from '@/canvas/labels';

interface Props {
  automaton: Automaton;
  /** Where each state sits. Defaults to a simple left-to-right row. */
  layout?: Layout;
  /** Accessible description of what this diagram shows. */
  title: string;
  className?: string;
}

/**
 * A standalone diagram, sized to its content by a viewBox.
 *
 * For displaying a machine. The interactive canvas uses {@link AutomatonGraphics} instead,
 * because it supplies its own transform and cannot have a nested viewBox refitting itself
 * underneath.
 */
export function AutomatonView({ automaton, layout, title, className }: Props) {
  // Memoised so the fallback layout keeps its identity between renders. It feeds
  // `AutomatonGraphics`'s own memo, and a fresh object every render would defeat it.
  const positions = useMemo(
    () => layout ?? rowLayout(automaton.states.map((state) => state.id)),
    [layout, automaton.states],
  );
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
      <AutomatonGraphics automaton={automaton} layout={positions} grid />
    </svg>
  );
}

/**
 * The diagram itself, in diagram coordinates, with no `<svg>` of its own.
 *
 * Splitting this out is what lets the same drawing code serve a static view and a panned,
 * zoomed canvas: the canvas wraps it in a transformed `<g>`, and nothing in here has to know
 * that pan or zoom exist.
 */
export function AutomatonGraphics({
  automaton,
  layout: positions,
  grid = false,
}: {
  automaton: Automaton;
  layout: Layout;
  /** Draw the dot grid. The interactive canvas draws its own, in screen space. */
  grid?: boolean;
}) {
  const box = viewBoxFor(Object.values(positions));

  // Routing and label placement depend only on the machine and where its states sit — never
  // on the viewport. Without this memo, panning or zooming would redo both on every frame,
  // and label placement is the more expensive of the two because it compares every label
  // against every state and every label placed before it.
  const { paths, labels } = useMemo(() => layOut(automaton, positions), [automaton, positions]);

  return (
    <>
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

      {grid && (
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill="url(#k-grid)"
          className="text-k-grid-dot"
        />
      )}

      {/*
        Every path first, then every state, then every label. The order is the fix for a
        real defect, not housekeeping: labels used to be drawn with their own edge, so a
        later edge's curve painted straight through an earlier edge's text — which is why
        the 30-state render showed labels reading as `b)` and `a|`. A label's plate can only
        cut what was drawn before it, so all the lines have to come first.
      */}
      <g className="stroke-k-text-muted">
        {paths.map((edge) => (
          <path
            key={edge.key}
            d={edge.path}
            fill="none"
            strokeWidth={GEOM.edgeStroke}
            markerEnd="url(#k-arrow)"
            className="stroke-k-text-muted"
          />
        ))}
      </g>

      {automaton.states.map((state) => {
        const at = positions[state.id];
        if (!at) return null;
        return (
          <StateNode
            key={state.id}
            at={at}
            label={state.label}
            // Absent means non-accepting: the format omits the flag when false.
            accepting={state.accepting ?? false}
          />
        );
      })}

      <StartMarker at={positions[automaton.start]} />

      <g>
        {labels.map((label) => (
          <EdgeLabel key={label.key} label={label} />
        ))}
      </g>
    </>
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

function EdgeLabel({ label }: { label: PlacedLabel }) {
  return (
    /*
      The label sits on a plate — a canvas-coloured stroke painted under the fill — that cuts
      the line behind it. Without this the stroke runs straight through the glyphs and both
      become hard to read: the single most common way a generated automaton diagram looks
      amateur. `labels.ts` counts this halo as part of what the label occupies, so two labels
      it judges clear of each other really are.
    */
    <text
      x={label.at.x}
      y={label.at.y}
      textAnchor="middle"
      dominantBaseline="central"
      stroke="var(--color-k-canvas)"
      strokeWidth="4"
      paintOrder="stroke"
      className="fill-k-text font-mono text-[12px] select-none"
    >
      {label.text}
    </text>
  );
}

/** One drawn edge: its path, and the label that belongs to it. */
interface RoutedEdge {
  key: string;
  path: string;
  text: string;
  anchors: Point[];
}

/**
 * Route every edge, then place every label.
 *
 * Two passes rather than one, because they need different scopes. Routing is per-edge: an
 * edge bends around the states between its own endpoints and needs to know nothing else.
 * Placement is global: a label's position depends on where every *other* label ended up, so
 * it cannot be decided until all the shapes exist.
 */
function layOut(
  automaton: Automaton,
  positions: Layout,
): { paths: RoutedEdge[]; labels: PlacedLabel[] } {
  const ids = automaton.states.map((state) => state.id);
  const edges = groupEdges(automaton.transitions);

  const pointsExcept = (...exclude: StateId[]): Point[] =>
    ids
      .filter((id) => !exclude.includes(id))
      .map((id) => positions[id])
      .filter((p): p is Point => p !== undefined);

  const paths = edges.flatMap((edge): RoutedEdge[] => {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) return [];

    const geom = routeEdge(
      from,
      to,
      // Every state that is not an endpoint of this edge is a potential obstacle.
      pointsExcept(edge.from, edge.to),
      // A self-loop needs to know where everything else is, so it can pick a side that is
      // actually free (docs/notes/edge-routing.md, rule 1).
      pointsExcept(edge.from),
      hasReverse(edges, edge.from, edge.to),
      edge.from === edge.to,
    );

    return [
      {
        key: `${edge.from}->${edge.to}`,
        path: geom.path,
        text: edge.symbols.join(', '),
        anchors: geom.anchors,
      },
    ];
  });

  const obstacles: Rect[] = pointsExcept().map(stateRect);
  const start = positions[automaton.start];
  if (start) obstacles.push(startArrowRect(start));

  return {
    paths,
    labels: placeLabels(
      paths.map((edge) => ({ key: edge.key, text: edge.text, candidates: edge.anchors })),
      obstacles,
    ),
  };
}

/**
 * Choose how an edge is drawn, in priority order.
 *
 * A self-loop is its own shape. A bidirectional pair must bow apart — both halves pass the
 * same side and rely on the direction vector flipping. An edge that would cross an unrelated
 * state bows below it, far enough to actually clear it. Everything else is a straight line.
 */
function routeEdge(
  from: Point,
  to: Point,
  obstacles: Point[],
  neighbours: Point[],
  pairedWithReverse: boolean,
  isLoop: boolean,
) {
  if (isLoop) return selfLoop(from, chooseLoopDirection(from, neighbours));
  if (pairedWithReverse) return curvedEdge(from, to);
  if (isObstructed(from, to, obstacles)) {
    return curvedEdge(from, to, bendSideBelow(from, to), GEOM.bendClearance);
  }
  return straightEdge(from, to);
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
