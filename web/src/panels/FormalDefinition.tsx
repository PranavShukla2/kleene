/**
 * `M = (Q, Σ, δ, q₀, F)`.
 *
 * Task I4. This is the thing exams ask for verbatim — "give the formal definition of the
 * machine below" — and it is the notation that connects a drawing to every proof a student
 * will read. Showing it beside the diagram means the connection is never something they have
 * to reconstruct from memory.
 *
 * δ is deliberately *not* expanded here. It is the transition table sitting above this panel,
 * and restating it would be a second copy that could disagree with the first.
 */

import { Panel } from '@/panels/Alphabet';
import type { FormalDefinition as Definition } from '@/model/automaton';

/** How an empty set is written when a component genuinely has no members. */
const EMPTY = '∅';

export function FormalDefinitionPanel({ definition }: { definition: Definition | undefined }) {
  if (!definition || definition.states.length === 0) {
    return (
      <Panel title="Formal definition">
        <p className="text-sm text-k-text-faint">Add a state to see the 5-tuple.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Formal definition">
      <p className="font-mono text-sm text-k-text">
        M = (Q, Σ, δ, q<sub>0</sub>, F)
      </p>

      <dl className="mt-2 space-y-1 font-mono text-xs">
        <Component name="Q" value={set(definition.states)} />
        <Component name="Σ" value={set(definition.alphabet)} />
        {/*
          δ points at the table rather than restating it. Two copies of a transition function
          on one screen is one copy too many, and the reader would have to check they agree.
        */}
        <Component name="δ" value="see the transition table" muted />
        <Component name="q₀" value={definition.start} />
        <Component
          name="F"
          value={set(definition.accepting)}
          // An empty F is legal and is almost always a mistake — a machine that accepts
          // nothing. The validation strip already says so; this just does not hide it.
          muted={definition.accepting.length === 0}
        />
      </dl>
    </Panel>
  );
}

function Component({ name, value, muted }: { name: string; value: string; muted?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-5 shrink-0 text-k-text-faint">{name}</dt>
      <dd className={`min-w-0 break-words ${muted ? 'text-k-text-faint' : 'text-k-text'}`}>
        {value}
      </dd>
    </div>
  );
}

/** Set-builder braces, or the empty-set glyph. */
function set(members: readonly string[]): string {
  return members.length === 0 ? EMPTY : `{${members.join(', ')}}`;
}
