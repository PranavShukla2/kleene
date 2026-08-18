/**
 * Automatic layout: elkjs, loaded on demand.
 *
 * ## Why the import is dynamic
 *
 * elk is 1.5MB. The roadmap's whole performance posture is that the page paints before a 400KB
 * wasm module arrives, and shipping four times that in the entry chunk to support a button most
 * sessions never press would undo it. Auto-layout is an explicit action, so paying for it at
 * the moment it is asked for is exactly right — and the first press is the only one that waits.
 *
 * ## Why a worker
 *
 * Task G4 was conditional: *"layout runs in a Web Worker if it blocks the main thread beyond
 * 100ms — only needed if measured."* Measured, on machines shaped like `synthetic.ts` builds
 * them:
 *
 * | States | Median | Max |
 * |---|---|---|
 * | 10 | 14ms | 20ms |
 * | 30 | 42ms | 45ms |
 * | 60 | **104ms** | **122ms** |
 * | 120 | 360ms | 369ms |
 * | 250 | 1651ms | 1662ms |
 *
 * It crosses at 60 states, which is precisely the size Track B chose for its own frame-rate
 * floor — so the two measurements agree about what "a large teaching automaton" means. On the
 * main thread, a 120-state layout would drop twenty-two frames and a 250-state one would look
 * like the tab had hung. In a worker it costs nothing visible, and the button can honestly say
 * it is working.
 *
 * ## Why layered, left to right
 *
 * Because that is how automata are drawn. Start state on the left, accepting states toward the
 * right, and the reading order of the diagram matches the reading order of the string. A
 * force-directed blob is a perfectly good graph drawing and a bad automaton drawing.
 */

import { GEOM, type Layout, type Point } from '@/canvas/geometry';
import type { Automaton, StateId } from '@/model/automaton';

/**
 * Spacing, in the units elkjs works in — which are the same units the canvas uses.
 *
 * `nodeNode` is the gap between states in the same layer and `layerLayer` between layers.
 * Both are derived from `GEOM.nodeDistance` rather than picked, so a change to the diagram's
 * scale moves the layout with it instead of leaving the two quietly disagreeing.
 */
const SPACING = {
  /** Between states in the same column. Self-loops sit above, so columns need vertical room. */
  nodeNode: GEOM.nodeDistance * 0.75,
  /** Between columns. Wider than tall: labels sit along edges, and edges run horizontally. */
  layerLayer: GEOM.nodeDistance,
};

/** Where the laid-out diagram starts, so it is not flush against the canvas origin. */
const ORIGIN: Point = { x: 90, y: 90 };

/** The elkjs graph shape, narrowed to what this uses. */
interface ElkNode {
  id: string;
  layoutOptions?: Record<string, string>;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  children?: ElkNode[];
  edges?: { id: string; sources: string[]; targets: string[] }[];
}

interface ElkLike {
  layout: (graph: ElkNode) => Promise<ElkNode>;
}

/**
 * The shape elk's own types describe is looser than what it returns — `children` is typed as
 * `any[]`, so nothing about the result is checked. Narrowing at the single point where the
 * module is loaded means the rest of this file is typed against `ElkNode`, and the one
 * unchecked step is visible rather than spread across every field access.
 */

/** Loaded once, on the first press. */
let elk: Promise<ElkLike> | undefined;

function loadElk(): Promise<ElkLike> {
  elk ??= import('elkjs/lib/elk-api.js').then((module) => {
    const Elk = module.default as unknown as new (options: {
      workerFactory: () => Worker;
    }) => ElkLike;

    return new Elk({
      // Vite resolves this at build time and emits the worker as its own asset, so the 1.5MB
      // of algorithm never touches the main thread's bundle at all — it is fetched by the
      // worker, on the first press, off the critical path twice over.
      workerFactory: () =>
        new Worker(new URL('elkjs/lib/elk-worker.min.js', import.meta.url), {
          type: 'classic',
        }),
    });
  });
  return elk;
}

/**
 * Lay the machine out left to right.
 *
 * Returns positions for every state that has one in the result. Self-loops are dropped before
 * the graph is handed over: elk treats a self-edge as a routing problem and reserves space for
 * it, which pushes states apart for a loop the renderer draws *inside* that space anyway.
 */
export async function autoLayout(automaton: Automaton): Promise<Layout> {
  if (automaton.states.length === 0) return {};

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      // Left to right, which is the only direction an automaton is ever drawn.
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': String(SPACING.nodeNode),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(SPACING.layerLayer),
      // NETWORK_SIMPLEX gives the tightest layering, which matters because a teaching-sized
      // automaton should fit on one screen without zooming out.
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      // Fewer crossings is worth the extra passes at these sizes; the whole graph is tens of
      // nodes, not thousands.
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      // Break ties using the order the states are declared in. State ids are rarely
      // arbitrary — a subset construction emits them in the order it discovered the subsets,
      // and someone drawing by hand adds them in the order they think about them. When two
      // arrangements cost the same, the one matching that order is the one the user can
      // already read.
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: automaton.states.map((state) => ({
      id: String(state.id),
      width: GEOM.radius * 2,
      height: GEOM.radius * 2,
      // The start state is pinned to the first layer. Without this, elk lays out by graph
      // structure alone and has no idea which state is special — and because an automaton is
      // full of back edges, the layer a state lands in depends on how the cycles happened to
      // be broken. The first run of this put the accepting state on the left and the start
      // state in the middle, which is not merely ugly: a diagram read left to right is how
      // someone follows a string through the machine.
      ...(state.id === automaton.start
        ? { layoutOptions: { 'elk.layered.layering.layerConstraint': 'FIRST' } }
        : {}),
    })),
    edges: automaton.transitions
      .map((transition, index) => ({
        id: `e${String(index)}`,
        sources: [String(transition.from)],
        targets: [String(transition.to)],
      }))
      // A self-loop is not a layout constraint. Leaving them in makes elk reserve horizontal
      // space to route an edge the renderer draws as an arc above the state.
      .filter((edge) => edge.sources[0] !== edge.targets[0]),
  };

  const laid = await (await loadElk()).layout(graph);

  const layout: Layout = {};
  for (const child of laid.children ?? []) {
    const id = Number(child.id);
    // elk positions by top-left corner; the canvas positions by centre.
    layout[id] = {
      x: ORIGIN.x + (child.x ?? 0) + GEOM.radius,
      y: ORIGIN.y + (child.y ?? 0) + GEOM.radius,
    };
  }
  return layout;
}

/**
 * Nudge overlapping states apart, keeping the shape of the drawing.
 *
 * G3's "shake it out", written here rather than pulled in from `d3-force`. A general force
 * simulation solves a harder problem than this one: it would also pull *connected* states
 * together, which fights the layered arrangement someone has deliberately made. What is
 * actually wanted after a few drags is separation, and separation alone.
 *
 * Repulsion only, and only between states that genuinely overlap. States that are merely close
 * are left where they were put.
 */
export function shake(layout: Layout, ids: readonly StateId[], rounds = 60): Layout {
  const minimum = GEOM.radius * 2 + GEOM.clearance;
  // Separated to *just past* the minimum rather than exactly onto it. Landing on the boundary
  // leaves `distance < minimum` true by a floating-point hair, so the pair is pushed again
  // every round, the loop never converges, and `hasOverlap` keeps reporting a problem that has
  // already been solved — which would leave the Shake button enabled forever after one press.
  const target = minimum + 0.5;
  const next: Layout = { ...layout };

  for (let round = 0; round < rounds; round += 1) {
    let moved = false;

    for (const a of ids) {
      for (const b of ids) {
        if (a >= b) continue;
        const pa = next[a];
        const pb = next[b];
        if (!pa || !pb) continue;

        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= minimum) continue;

        // Two states at exactly the same point have no direction to separate along, so they
        // get an arbitrary but deterministic one. Random would make the result different on
        // every press, which is the one thing a layout button must not be.
        const push = (target - distance) / 2;
        const ux = distance === 0 ? 1 : dx / distance;
        const uy = distance === 0 ? 0 : dy / distance;

        next[a] = { x: pa.x - ux * push, y: pa.y - uy * push };
        next[b] = { x: pb.x + ux * push, y: pb.y + uy * push };
        moved = true;
      }
    }

    // Converged: nothing overlaps, so more rounds would change nothing.
    if (!moved) break;
  }

  return next;
}

/** Whether any two states are close enough that shaking would do something. */
export function hasOverlap(layout: Layout, ids: readonly StateId[]): boolean {
  const minimum = GEOM.radius * 2 + GEOM.clearance;
  return ids.some((a, index) =>
    ids.slice(index + 1).some((b) => {
      const pa = layout[a];
      const pb = layout[b];
      return (
        pa !== undefined && pb !== undefined && Math.hypot(pb.x - pa.x, pb.y - pa.y) < minimum
      );
    }),
  );
}
