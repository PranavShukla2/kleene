/**
 * The validation strip: what is wrong with the machine, and where.
 *
 * **Never a dialog.** Editing an automaton passes through invalid states constantly — a state
 * exists for a second before it has any transitions, a transition exists before it has a
 * symbol — and a tool that interrupts for each one is a tool people stop using. The strip sits
 * there, updates as you work, and waits.
 *
 * Every problem is click-to-focus, which is the point of it. Telling a student that `q2` has
 * no transition on `b` is worth something; putting their cursor on `q2` is worth more.
 *
 * The report itself comes from Rust. See `Engine.validate` — a second definition of
 * well-formedness in TypeScript would drift silently.
 *
 * Styled as a **dock**, not a card: flush to the canvas above it, with a top border and no
 * radius. A card floating below the canvas reads as a separate thing that happens to be about
 * the diagram; a dock reads as part of it, which is what it is.
 */

import type { Problem, Report, StateId } from '@/model/automaton';

interface Props {
  report: Report | undefined;
  /** Select and reveal the states a problem concerns. */
  onFocus: (states: StateId[]) => void;
}

export function Validation({ report, onFocus }: Props) {
  const problems = report?.problems ?? [];

  // Errors first, then warnings, each keeping the order the core reported them in. The core
  // already sorts by severity; sorting again here would be a second opinion about priority
  // that the core is better placed to hold.
  const errors = problems.filter((problem) => problem.severity === 'error');

  if (problems.length === 0) {
    return (
      <p className="flex h-8 shrink-0 items-center gap-2 border-t border-k-border bg-k-surface px-3 text-xs text-k-text-faint">
        <Dot className="bg-k-success" />
        No problems.
      </p>
    );
  }

  return (
    <section
      aria-label="Problems"
      // Capped so a machine with twenty problems cannot eat the canvas. The list scrolls;
      // the canvas does not shrink to fit a report about it.
      className="flex max-h-44 shrink-0 flex-col border-t border-k-border bg-k-surface"
    >
      <h2 className="flex h-8 shrink-0 items-center gap-2 px-3 text-[11px] font-semibold tracking-[0.06em] text-k-text-faint uppercase">
        <Dot className={errors.length > 0 ? 'bg-k-error' : 'bg-k-warning'} />
        {summarise(errors.length, problems.length - errors.length)}
      </h2>

      <ul className="divide-y divide-k-border overflow-y-auto border-t border-k-border">
        {problems.map((problem, index) => (
          <ProblemRow
            // Kind plus the states it names is unique in practice, but two "missing
            // transition" problems on one state for different symbols are not — so the index
            // disambiguates. The list is rebuilt wholesale on every change, never reordered.
            key={`${problem.kind}-${(problem.states ?? []).join('-')}-${String(index)}`}
            problem={problem}
            onFocus={onFocus}
          />
        ))}
      </ul>
    </section>
  );
}

function ProblemRow({ problem, onFocus }: { problem: Problem; onFocus: Props['onFocus'] }) {
  const states = problem.states ?? [];
  const focusable = states.length > 0;

  return (
    <li>
      <button
        type="button"
        disabled={!focusable}
        onClick={() => {
          onFocus(states);
        }}
        className="flex w-full items-baseline gap-2.5 px-3 py-1.5 text-left text-sm transition-colors duration-(--duration-k-hover) hover:bg-k-primary/5 disabled:hover:bg-transparent"
      >
        <Dot
          className={`mt-1.5 shrink-0 ${problem.severity === 'error' ? 'bg-k-error' : 'bg-k-warning'}`}
        />
        <span className="text-k-text-muted">{problem.message}</span>
      </button>
    </li>
  );
}

function Dot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-block size-1.5 rounded-full ${className ?? ''}`} />
  );
}

/** "2 errors, 1 warning" — pluralised, and silent about whichever count is zero. */
function summarise(errors: number, warnings: number): string {
  const parts = [
    ...(errors > 0 ? [`${String(errors)} ${errors === 1 ? 'error' : 'errors'}`] : []),
    ...(warnings > 0 ? [`${String(warnings)} ${warnings === 1 ? 'warning' : 'warnings'}`] : []),
  ];
  return parts.join(', ');
}
