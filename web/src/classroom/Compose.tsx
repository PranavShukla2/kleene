/**
 * Setting an assignment (phase C5.2).
 *
 * The form is small — a title, a prompt, a target language, an optional budget and a due
 * date — and almost all the care is in one place: **the target is checked by the real engine
 * while it is being typed.**
 *
 * ## Why that matters more than it looks
 *
 * A lecturer setting a problem is writing a regular expression from memory, usually quickly,
 * often between other things. The failure modes are silent and expensive:
 *
 * - The expression does not parse. Thirty students open a broken link.
 * - The expression parses but says something else. Every correct answer is marked wrong, and
 *   the students who trust the tool conclude they are bad at the subject.
 * - The budget is below the minimum. The problem is unsolvable, and it is unsolvable in a way
 *   that looks exactly like being bad at minimization.
 *
 * All three are catchable *here*, before the link is handed out, by the engine that is already
 * loaded in this tab. So the form shows the machine the target describes, the number of states
 * the smallest correct answer needs, and refuses to save a budget below it.
 *
 * The third one is why `minimum_states` exists in the core at all.
 */

import { useMemo, useState } from 'react';

import { AutomatonView } from '@/canvas/AutomatonView';
import { rowLayout } from '@/canvas/geometry';
import { Lift } from '@/site/motion';
import type { Assignment } from '@/classroom/api';
import type { Engine } from '@/wasm/loader';

/** What the engine can tell us about a target, live. */
interface Check {
  ok: boolean;
  /** Why not, in words a lecturer can act on. */
  problem?: string;
  /** The DFA the target describes, for the preview. */
  automaton?: ReturnType<Engine['example']>;
  /** The fewest states any correct answer needs. */
  minimum?: number;
}

function inspect(engine: Engine | undefined, target: string, budget: string): Check {
  if (!engine) return { ok: false, problem: 'The engine is still loading.' };
  if (target.trim() === '') return { ok: false };

  const compiled = engine.compileRegex(target);
  if (!compiled) return { ok: false };
  if (compiled.kind !== 'parsed') {
    return {
      ok: false,
      problem: `That is not a regular expression: ${compiled.error.message}`,
    };
  }

  const minimum = engine.minimumStates(JSON.stringify({ version: 1, prompt: '', target }));

  if (budget.trim() !== '') {
    const wanted = Number(budget);
    if (!Number.isInteger(wanted) || wanted < 1) {
      return { ok: false, problem: 'A budget is a whole number of states.' };
    }
    if (minimum !== undefined && wanted < minimum) {
      return {
        ok: false,
        // The specific number, not "too small": a lecturer who is told the floor can decide
        // whether to raise the budget or change the language.
        problem: `A budget of ${String(wanted)} cannot be met — the smallest machine for this language has ${String(minimum)} states.`,
        automaton: compiled.dfa.automaton,
        ...(minimum !== undefined ? { minimum } : {}),
      };
    }
  }

  return {
    ok: true,
    automaton: compiled.dfa.automaton,
    ...(minimum !== undefined ? { minimum } : {}),
  };
}

export function Compose({
  engine,
  onCreate,
  onCancel,
}: {
  engine: Engine | undefined;
  onCreate: (input: Omit<Assignment, 'id' | 'classId'>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [target, setTarget] = useState('');
  const [budget, setBudget] = useState('');
  const [dueAt, setDueAt] = useState('');

  const check = useMemo(() => inspect(engine, target, budget), [engine, target, budget]);
  const ready = check.ok && title.trim() !== '' && prompt.trim() !== '';

  return (
    <form
      className="space-y-5 rounded-3xl border border-k-border bg-k-surface p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        onCreate({
          title: title.trim(),
          prompt: prompt.trim(),
          targetRegex: target.trim(),
          ...(budget.trim() !== '' ? { budget: Number(budget) } : {}),
          ...(dueAt !== '' ? { dueAt: new Date(dueAt).toISOString() } : {}),
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            placeholder="Week 3 — parity"
            className="mt-1 w-full rounded-lg border border-k-border bg-k-surface-raised px-3 py-2 text-sm outline-none focus:border-k-primary"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Due</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => {
              setDueAt(event.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-k-border bg-k-surface-raised px-3 py-2 text-sm outline-none focus:border-k-primary"
          />
          <span className="mt-1 block text-xs text-k-text-faint">
            Optional. A late submission is recorded and flagged, never refused — refusing loses
            the work.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">What to build</span>
        <textarea
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
          }}
          rows={2}
          placeholder="Strings over {a, b} with an even number of a’s."
          className="mt-1 w-full rounded-lg border border-k-border bg-k-surface-raised px-3 py-2 text-sm outline-none focus:border-k-primary"
        />
        <span className="mt-1 block text-xs text-k-text-faint">
          Shown to students. This is the only part they see.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="block">
          <span className="text-sm font-medium">The answer, as a regular expression</span>
          <input
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
            }}
            placeholder="(b + ab*a)*"
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-k-border bg-k-surface-raised px-3 py-2 font-mono text-sm outline-none focus:border-k-primary"
          />
          <span className="mt-1 block text-xs text-k-text-faint">
            Never shown to students. Any machine accepting the same language is marked correct.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">State budget</span>
          <input
            value={budget}
            onChange={(event) => {
              setBudget(event.target.value);
            }}
            inputMode="numeric"
            placeholder="optional"
            className="mt-1 w-full rounded-lg border border-k-border bg-k-surface-raised px-3 py-2 font-mono text-sm outline-none focus:border-k-primary"
          />
        </label>
      </div>

      {/* The whole point of the form. Checked as it is typed, by the engine already in this
          tab, so a broken problem is caught here rather than by thirty students. */}
      <div
        role="status"
        className={`rounded-2xl border p-4 text-sm ${
          check.problem
            ? 'border-k-error/40 bg-k-error/5'
            : check.ok
              ? 'border-k-accepting/40 bg-k-accepting/10'
              : 'border-k-border bg-k-surface-raised'
        }`}
      >
        {check.problem ? (
          <p className="text-k-error">{check.problem}</p>
        ) : check.ok ? (
          <div className="flex flex-wrap items-center gap-4">
            <p>
              This language needs <strong>{check.minimum}</strong> states at minimum.
              {budget.trim() !== '' && ' The budget is achievable.'}
            </p>
            {check.automaton && (
              <div className="h-24 w-full max-w-sm overflow-hidden rounded-xl border border-k-border sm:ml-auto sm:w-64">
                <AutomatonView
                  automaton={check.automaton}
                  layout={rowLayout(check.automaton.states.map((state) => state.id))}
                  title="The machine this target describes"
                  grid={false}
                  className="h-full w-full"
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-k-text-faint">
            Type a target and the machine it describes appears here, with the number of states
            the smallest correct answer needs.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Lift>
          <button
            type="submit"
            disabled={!ready}
            className="k-glow rounded-full bg-k-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Set the assignment
          </button>
        </Lift>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm text-k-text-faint hover:text-k-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
