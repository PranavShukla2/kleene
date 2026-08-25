/**
 * The properties panel for whatever is selected.
 *
 * **Deliberately thin**, as the plan insists: the canvas is the primary interface, not this.
 * Everything here has a direct gesture on the diagram — double-click toggles accepting, `S`
 * sets the start, `Enter` renames. The panel exists so those are *discoverable* and so the
 * current values are readable at a glance, not because editing should happen here.
 *
 * That is why every control shows its gesture. A panel that quietly becomes the easier route
 * teaches people to ignore the canvas, which is the opposite of the point.
 */

import { Panel } from '@/panels/Alphabet';
import { stateById, type Automaton, type StateId } from '@/model/automaton';

interface Props {
  automaton: Automaton;
  selection: readonly StateId[];
  onToggleAccepting: (id: StateId) => void;
  onSetStart: (id: StateId) => void;
  onRename: (id: StateId) => void;
}

export function Properties({
  automaton,
  selection,
  onToggleAccepting,
  onSetStart,
  onRename,
}: Props) {
  if (selection.length === 0) {
    return (
      <Panel>
        <p className="text-sm text-k-text-faint">
          Nothing selected. Click a state, or drag a box across several.
        </p>
      </Panel>
    );
  }

  if (selection.length > 1) {
    // A multi-selection gets a count and the operations that are meaningful on a group,
    // rather than the first state's properties dressed up as the group's.
    return (
      <Panel>
        <p className="text-sm text-k-text-muted">
          <span className="font-mono text-k-text">{selection.length}</span> states selected.
        </p>
        <p className="mt-2 text-xs text-k-text-faint">
          Drag to move them together, or press <Key>⌫</Key> to delete them.
        </p>
      </Panel>
    );
  }

  const id = selection[0]!;
  const state = stateById(automaton, id);
  if (!state) return null;

  const isStart = automaton.start === id;
  const accepting = state.accepting ?? false;
  const outgoing = automaton.transitions.filter((t) => t.from === id).length;
  const incoming = automaton.transitions.filter((t) => t.to === id).length;

  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-base text-k-text">{state.label}</span>
        <button
          type="button"
          onClick={() => {
            onRename(id);
          }}
          className="text-xs text-k-text-faint underline decoration-dotted underline-offset-2 transition-colors duration-(--duration-k-hover) hover:text-k-text"
        >
          rename <Key>Enter</Key>
        </button>
      </div>

      <dl className="mt-3 space-y-1.5">
        <Toggle
          label="Accepting"
          on={accepting}
          gesture="double-click"
          onChange={() => {
            onToggleAccepting(id);
          }}
        />
        <Toggle
          label="Start state"
          on={isStart}
          gesture="S"
          // A machine has exactly one start state, so this can be turned on but not off —
          // turning it off would leave the automaton without one, which is not a state the
          // editor should be able to reach by clicking a switch.
          disabled={isStart}
          onChange={() => {
            onSetStart(id);
          }}
        />
      </dl>

      <p className="mt-3 font-mono text-[11px] text-k-text-faint">
        {outgoing} out · {incoming} in
      </p>
    </Panel>
  );
}

function Toggle({
  label,
  on,
  gesture,
  disabled,
  onChange,
}: {
  label: string;
  on: boolean;
  gesture: string;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-sm text-k-text-muted">{label}</dt>
      <dd className="flex items-center gap-2">
        <Key>{gesture}</Key>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={disabled}
          onClick={onChange}
          className={`relative h-4.5 w-8 rounded-full transition-colors duration-(--duration-k-hover) disabled:opacity-50 ${
            on ? 'bg-k-primary' : 'bg-k-border-strong'
          }`}
        >
          <span
            className={`absolute top-0.5 size-3.5 rounded-full bg-k-surface-raised transition-[left] duration-(--duration-k-hover) ${
              on ? 'left-4' : 'left-0.5'
            }`}
          />
        </button>
      </dd>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-k-border bg-k-surface-raised px-1 py-0.5 font-mono text-[10px] text-k-text-faint">
      {children}
    </kbd>
  );
}
