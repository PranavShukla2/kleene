/**
 * Binds the interaction machine to real pointer events and to the store.
 *
 * The only layer that knows about both. `interaction.ts` decides what a drag means and returns
 * intents; this turns those into commands and DOM listeners, and nothing else. Keeping the
 * translation in one small file is what lets the rules themselves stay testable without a
 * browser.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Layout, Point } from '@/canvas/geometry';
import {
  DRAG_THRESHOLD,
  pointerCancel,
  pointerDown,
  pointerMove,
  pointerUp,
  type Interaction,
  type Intent,
  type Scene,
} from '@/canvas/interaction';
import { stateAt } from '@/canvas/selection';
import { snapPoint } from '@/canvas/viewport';
import type { Automaton, StateId } from '@/model/automaton';
import { addState, addTransition, moveStates, toggleAccepting } from '@/store/commands';
import { nextStateId } from '@/store/document';
import { useActions } from '@/store/editor';

/** Which mouse button edits. Middle is pan, right opens a context menu. */
const LEFT_BUTTON = 0;

interface Options {
  automaton: Automaton;
  layout: Layout;
  selection: readonly StateId[];
  /** Converts a pointer event to diagram coordinates. */
  toWorld: (event: { clientX: number; clientY: number }) => Point;
  /** Current zoom, so the drag threshold stays constant in screen pixels. */
  scale: number;
  /** Whether panning owns the pointer right now. */
  panning: boolean;
  /** Open the symbol editor for an edge, anchored on the label that was clicked. */
  onEditEdge: (edge: { from: StateId; to: StateId }, at: DOMRect) => void;
  /** A transition was just drawn, and wants its symbols typed. */
  onConnected: (edge: { from: StateId; to: StateId }) => void;
}

export interface CanvasEditing {
  /** Attach to the canvas element. */
  ref: (element: HTMLElement | null) => void;
  /** What the pointer is doing, for drawing the marquee and the preview edge. */
  interaction: Interaction;
}

export function useCanvasEditing({
  automaton,
  layout,
  selection,
  toWorld,
  scale,
  panning,
  onEditEdge,
  onConnected,
}: Options): CanvasEditing {
  const [interaction, setInteraction] = useState<Interaction>({ kind: 'idle' });
  const elementRef = useRef<HTMLElement | null>(null);

  const { run, select } = useActions();

  // Everything the handlers read, in refs. Pointer listeners are attached once and must not be
  // torn down and rebuilt on every document change — a listener replaced mid-drag drops the
  // drag, and rebinding on each frame of a 60-state drag is exactly the work Track B's
  // performance floor was measured without.
  const scene = useRef<Scene>({ ids: [], layout, selection, snap: snapPoint });
  const automatonRef = useRef(automaton);
  const scaleRef = useRef(scale);
  const panningRef = useRef(panning);

  // Written after commit rather than during render. Assigning a ref while rendering is a real
  // hazard under concurrent rendering, where a render can be thrown away — the ref would keep
  // the discarded value. Handlers only ever fire from user events, which is always after a
  // commit, so an effect with no dependency list is both correct and current.
  useEffect(() => {
    scene.current = {
      ids: automaton.states.map((state) => state.id),
      layout,
      selection,
      snap: snapPoint,
    };
    automatonRef.current = automaton;
    scaleRef.current = scale;
    panningRef.current = panning;
  });

  const apply = useCallback(
    (intents: Intent[]) => {
      for (const intent of intents) {
        switch (intent.kind) {
          case 'select':
            select(intent.ids);
            break;
          case 'move':
            // One command for the whole group, so a multi-drag is one undo press.
            if (intent.moves.length > 0) run(moveStates(intent.moves));
            break;
          case 'connect':
            // Committed without a symbol, then the editor opens on it. Demanding a symbol
            // *during* the drag would mean a modal in the middle of a gesture; leaving it
            // blank and saying nothing would let drawing an edge silently turn a DFA into an
            // ε-NFA, which is a change to what the machine *is*.
            run(addTransition(intent.from, intent.to));
            onConnected({ from: intent.from, to: intent.to });
            break;
        }
      }
    },
    [run, select, onConnected],
  );

  const ref = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const onPointerDown = ((event: PointerEvent) => {
      if (event.button !== LEFT_BUTTON || panningRef.current) return;

      // A press on an edge label edits its symbols rather than starting a marquee. Checked
      // here rather than handled on the label itself: this listener sits on an ancestor and
      // is native, so it runs *before* React's delegated handlers — a stopPropagation from
      // the label would arrive after the marquee had already begun.
      const edge = edgeLabelUnder(event.target);
      if (edge) {
        event.preventDefault();
        onEditEdge(edge.ids, edge.rect);
        return;
      }

      const at = toWorld(event);
      const step = pointerDown(
        at,
        event.shiftKey || event.metaKey || event.ctrlKey,
        scene.current,
      );
      setInteraction(step.next);
      apply(step.intents);
    }) as EventListener;

    const onDoubleClick = ((event: MouseEvent) => {
      const at = toWorld(event);
      const hit = stateAt(at, scene.current.ids, scene.current.layout);

      // D1 and D3 share this gesture, which reads naturally: double-click a state to change
      // what it is, double-click the canvas to put something there.
      if (hit !== undefined) {
        run(toggleAccepting(hit));
        return;
      }

      run(addState(snapPoint(at)));
      // Selected on creation, so it can be renamed or nudged straight away without first
      // having to click the thing that just appeared under the pointer.
      select([nextStateId(automatonRef.current)]);
    }) as EventListener;

    // Right-click on a label edits it too, so the gesture is not the only way in once
    // context menus arrive (D7).

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('dblclick', onDoubleClick);
    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('dblclick', onDoubleClick);
    };
  }, [apply, run, select, toWorld, onEditEdge]);

  // Move and release are on the window, so a fast drag that leaves the canvas keeps working
  // rather than stopping dead at the edge — and so releasing outside still ends the drag
  // instead of leaving the canvas stuck mid-gesture.
  useEffect(() => {
    if (interaction.kind === 'idle') return;

    const onMove = (event: PointerEvent) => {
      // The threshold is in screen pixels, so dividing by the zoom keeps a drag needing the
      // same physical movement at 0.25x and at 4x.
      const step = pointerMove(
        interaction,
        toWorld(event),
        scene.current,
        DRAG_THRESHOLD / scaleRef.current,
      );
      setInteraction(step.next);
      apply(step.intents);
    };

    const onUp = () => {
      const step = pointerUp(interaction, scene.current);
      setInteraction(step.next);
      apply(step.intents);
    };

    // A cancelled gesture is not a completed one: the system taking the pointer mid-connect
    // must not create the transition.
    const onCancel = () => {
      setInteraction(pointerCancel().next);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [interaction, apply, toWorld]);

  return { ref, interaction };
}

/** The edge whose label sits under an event target, if any. */
function edgeLabelUnder(
  target: EventTarget | null,
): { ids: { from: StateId; to: StateId }; rect: DOMRect } | undefined {
  if (!(target instanceof SVGElement)) return undefined;

  const from = target.dataset.edgeFrom;
  const to = target.dataset.edgeTo;
  if (from === undefined || to === undefined) return undefined;

  // The rendered box, so the editor opens exactly over the text it replaces rather than at a
  // position recomputed from the layout and liable to disagree with it by a pixel.
  return { ids: { from: Number(from), to: Number(to) }, rect: target.getBoundingClientRect() };
}
