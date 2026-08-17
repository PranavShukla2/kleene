/**
 * The editing surface: a pannable, zoomable canvas holding one automaton.
 *
 * Wraps the pure {@link AutomatonView} renderer rather than replacing it. The renderer stays
 * presentational — a machine and a layout in, SVG out — and everything about *interaction*
 * lives here and in the hooks it composes:
 *
 * - `useViewport` owns pan and zoom.
 * - `useCanvasEditing` owns select, drag, and drawing transitions.
 * - `useShortcuts` owns the keyboard.
 *
 * Three hooks rather than one because they are independent: panning works during a drag,
 * shortcuts work whatever the pointer is doing, and none of the three needs to know the
 * others exist.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { AutomatonGraphics } from '@/canvas/AutomatonView';
import { GEOM, pointOnRim, type Layout, type Point } from '@/canvas/geometry';
import { InlineEditor } from '@/canvas/InlineEditor';
import { marqueeRect, type Interaction } from '@/canvas/interaction';
import { useCanvasEditing } from '@/canvas/useCanvasEditing';
import { useShortcuts } from '@/canvas/useShortcuts';
import { useViewport } from '@/canvas/useViewport';
import { formatSymbols, newSymbols, parseSymbols } from '@/canvas/symbols';
import { SNAP, toScreen } from '@/canvas/viewport';
import type { Automaton, StateId } from '@/model/automaton';
import {
  deleteStates,
  moveStates,
  renameState,
  setEdgeSymbols,
  setStart,
} from '@/store/commands';
import { labelTaken } from '@/store/document';
import { useActions } from '@/store/editor';

/** How far an arrow key moves the selection, and how far with shift held. */
const NUDGE = SNAP;
const NUDGE_FAR = GEOM.grid * 2;

/** One notch of keyboard zoom. Matches roughly two wheel notches. */
const ZOOM_STEP = 1.25;

/** What is being edited inline, and where the input should sit on screen. */
type Editing =
  | { kind: 'state'; id: StateId; at: Point }
  | { kind: 'edge'; from: StateId; to: StateId; at: Point };

interface Props {
  automaton: Automaton;
  layout: Layout;
  selection: readonly StateId[];
  /** Accessible description of the diagram. */
  title: string;
  className?: string;
  /** Open the shortcut sheet. */
  onHelp?: () => void;
}

export function Canvas({ automaton, layout, selection, title, className, onHelp }: Props) {
  const {
    viewport,
    ref: viewportRef,
    panning,
    pointerToWorld,
    fit,
    reset,
    zoomBy,
  } = useViewport();
  const { run, select, selectAll } = useActions();

  const points = useMemo(
    () => automaton.states.map((state) => layout[state.id]).filter((p): p is Point => !!p),
    [automaton.states, layout],
  );

  const [editing, setEditing] = useState<Editing | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const openEdgeEditor = useCallback((edge: { from: StateId; to: StateId }, rect: DOMRect) => {
    const box = containerRef.current?.getBoundingClientRect();
    setEditing({
      ...edge,
      kind: 'edge',
      // The label's own rendered box, made relative to the canvas, so the input opens
      // exactly over the text it replaces.
      at: {
        x: rect.x + rect.width / 2 - (box?.x ?? 0),
        y: rect.y + rect.height / 2 - (box?.y ?? 0),
      },
    });
  }, []);

  // A freshly drawn edge has no label element until React has rendered it, so opening the
  // editor waits one frame. The anchor has to come from the *rendered* label — the router
  // decides where that lands, and any guess would put the input somewhere the text is not.
  const editNewEdge = useCallback(
    (edge: { from: StateId; to: StateId }) => {
      requestAnimationFrame(() => {
        const label = containerRef.current?.querySelector(
          `[data-edge-from="${edge.from}"][data-edge-to="${edge.to}"]`,
        );
        if (label) openEdgeEditor(edge, label.getBoundingClientRect());
      });
    },
    [openEdgeEditor],
  );

  const { ref: editingRef, interaction } = useCanvasEditing({
    automaton,
    layout,
    selection,
    toWorld: pointerToWorld,
    scale: viewport.scale,
    panning,
    onEditEdge: openEdgeEditor,
    onConnected: editNewEdge,
  });

  // Both hooks want the same element, and a DOM ref can only be handed to one prop.
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      containerRef.current = element;
      viewportRef(element);
      editingRef(element);
    },
    [viewportRef, editingRef],
  );

  const closeEditor = useCallback(() => {
    setEditing(undefined);
  }, []);

  const commitEditor = useCallback(
    (text: string) => {
      if (!editing) return;
      run(
        editing.kind === 'state'
          ? renameState(editing.id, text.trim())
          : setEdgeSymbols(editing.from, editing.to, parseSymbols(text)),
      );
      setEditing(undefined);
    },
    [editing, run],
  );

  /** Rename the selected state, when there is exactly one. */
  const renameSelected = useCallback(() => {
    const [id, ...rest] = selection;
    if (id === undefined || rest.length > 0) return;
    const at = layout[id];
    if (!at) return;
    setEditing({ kind: 'state', id, at: toScreen(viewport, at) });
  }, [selection, layout, viewport]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (selection.length === 0) return;
      // Nudges are not snapped. Arrow keys are how someone fixes a position the grid got
      // wrong, and snapping each press would put the state straight back where it was —
      // the key would appear to do nothing at all.
      run(
        moveStates(
          selection.flatMap((id) => {
            const at = layout[id];
            return at ? [{ id, to: { x: at.x + dx, y: at.y + dy } }] : [];
          }),
        ),
      );
    },
    [run, selection, layout],
  );

  useShortcuts({
    edit: renameSelected,
    setStart: () => {
      // Only with exactly one state selected. "Make these four the start state" has no
      // meaning, and picking one of them for the user would be a guess.
      const [id, ...rest] = selection;
      if (id !== undefined && rest.length === 0) run(setStart(id));
    },
    delete: () => {
      if (selection.length > 0) run(deleteStates(selection));
    },
    selectAll,
    deselect: () => {
      // Escape while editing closes the editor, and does not also clear the selection —
      // one press, one effect.
      if (editing) {
        closeEditor();
        return;
      }
      select([]);
    },
    fit: () => {
      fit(points);
    },
    resetZoom: reset,
    zoomIn: () => {
      zoomBy(ZOOM_STEP);
    },
    zoomOut: () => {
      zoomBy(1 / ZOOM_STEP);
    },
    nudgeUp: () => {
      nudge(0, -NUDGE);
    },
    nudgeDown: () => {
      nudge(0, NUDGE);
    },
    nudgeLeft: () => {
      nudge(-NUDGE, 0);
    },
    nudgeRight: () => {
      nudge(NUDGE, 0);
    },
    nudgeUpFar: () => {
      nudge(0, -NUDGE_FAR);
    },
    nudgeDownFar: () => {
      nudge(0, NUDGE_FAR);
    },
    nudgeLeftFar: () => {
      nudge(-NUDGE_FAR, 0);
    },
    nudgeRightFar: () => {
      nudge(NUDGE_FAR, 0);
    },
    ...(onHelp ? { help: onHelp } : {}),
  });

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-k-canvas ${className ?? ''}`}
      style={{ cursor: cursorFor(panning, interaction), touchAction: 'none' }}
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
          <AutomatonGraphics automaton={automaton} layout={layout} selection={selection} />
          <PreviewEdge interaction={interaction} layout={layout} />
          <Marquee interaction={interaction} />
        </g>
      </svg>

      {editing && (
        <InlineEditor
          at={editing.at}
          value={editorValue(editing, automaton)}
          placeholder={editing.kind === 'edge' ? 'a, b' : 'q0'}
          hint={editorHint(editing, automaton)}
          error={editorError(editing, automaton)}
          onCommit={commitEditor}
          onCancel={closeEditor}
        />
      )}

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

/** What the input should start with. */
function editorValue(editing: Editing, automaton: Automaton): string {
  if (editing.kind === 'state') {
    return automaton.states.find((state) => state.id === editing.id)?.label ?? '';
  }
  return formatSymbols(
    automaton.transitions
      .filter((t) => t.from === editing.from && t.to === editing.to)
      .map((t) => t.on),
  );
}

/**
 * What an edit is about to add to the alphabet, said while it is still being typed.
 *
 * Extending the alphabet is the right behaviour — someone drawing a machine types the symbol
 * they mean, and refusing it before they have declared one is a rule enforced for its own
 * sake. Extending it *silently* is how the alphabet fills with typos nobody can account for.
 * Saying so as they type is the difference between a helpful default and an invisible one.
 */
function editorHint(editing: Editing, automaton: Automaton) {
  if (editing.kind !== 'edge') return undefined;

  return (text: string): string | undefined => {
    const added = newSymbols(parseSymbols(text), automaton.alphabet);
    return added.length === 0 ? undefined : `adds ${added.join(', ')} to \u03a3`;
  };
}

/**
 * Why the typed text cannot be committed, if it cannot.
 *
 * State labels must be unique: two states called `q1` make a diagram that cannot be read and a
 * TikZ export that cannot be compiled. The command refuses the rename anyway, so this exists to
 * make the refusal visible *before* someone commits and wonders why nothing happened.
 */
function editorError(editing: Editing, automaton: Automaton) {
  if (editing.kind !== 'state') return undefined;

  return (text: string): string | undefined => {
    const label = text.trim();
    if (label.length === 0) return 'a state needs a name';
    return labelTaken(automaton, label, editing.id) ? `${label} is taken` : undefined;
  };
}

/**
 * The edge being drawn, following the pointer.
 *
 * Dashed while it is a proposal and solid once it is over a valid target, so the drop is
 * legible before the mouse button comes up. A preview that looks identical to a committed edge
 * makes people release over the wrong thing and then wonder what they did.
 */
function PreviewEdge({ interaction, layout }: { interaction: Interaction; layout: Layout }) {
  if (interaction.kind !== 'connecting') return null;

  const from = layout[interaction.from];
  if (!from) return null;

  const over = interaction.over !== undefined ? layout[interaction.over] : undefined;
  const valid = over !== undefined;
  const target = over ?? interaction.to;

  const start = pointOnRim(from, target);
  // Clipped to the target's rim once it has one, so the preview ends where the committed edge
  // will. An arrowhead buried in the middle of a state is the one thing that would make the
  // preview *misleading* rather than merely provisional.
  const end = over ? pointOnRim(over, from) : target;

  return (
    <g className="pointer-events-none">
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        strokeWidth={GEOM.edgeStroke}
        strokeDasharray={valid ? undefined : '5 4'}
        markerEnd="url(#k-arrow)"
        className="stroke-k-primary"
      />
      {valid && (
        // A ring on the target, so the drop point is unambiguous even where several states
        // sit close together.
        <circle
          cx={target.x}
          cy={target.y}
          r={GEOM.radius + GEOM.selectionGap}
          fill="none"
          strokeWidth={GEOM.selectionStroke}
          className="stroke-k-primary"
        />
      )}
    </g>
  );
}

/** The selection box. */
function Marquee({ interaction }: { interaction: Interaction }) {
  if (interaction.kind !== 'marquee') return null;

  const rect = marqueeRect(interaction);
  if (rect.width === 0 && rect.height === 0) return null;

  return (
    <rect
      {...rect}
      className="fill-k-primary/10 stroke-k-primary pointer-events-none"
      strokeWidth={1}
    />
  );
}

/** What the cursor should say the canvas is about to do. */
function cursorFor(panning: boolean, interaction: Interaction): string {
  if (panning) return 'grabbing';
  if (interaction.kind === 'dragging') return 'grabbing';
  if (interaction.kind === 'connecting') return 'crosshair';
  return 'default';
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
