/**
 * The input tester: type a string, see whether the machine accepts it, and step through why.
 *
 * **Nothing here simulates anything.** The run comes from `Engine.simulate`, and this walks the
 * configurations it returns. The plan is blunt about the reason and it is worth repeating: if a
 * simulation bug can exist in two places, the architecture has already failed. Two simulators
 * would eventually disagree about ε-closures, or about what "stuck" means, and both would be
 * tested separately and believed equally.
 *
 * What *is* here is the presentation: a tape with a cursor, a verdict, and a step control. Even
 * the split between consumed and remaining input comes from Rust (`Run::consumed_at`), because
 * it is a function of the run rather than of the display.
 */

import { Panel } from '@/panels/Alphabet';
import type { Run, Simulation, Verdict } from '@/model/automaton';

interface Props {
  simulation: Simulation | undefined;
  input: string;
  onInput: (value: string) => void;
  /** Which point in the run is being shown, and the states it is in. */
  step: number;
  onStep: (index: number) => void;
}

export function InputTester({ simulation, input, onInput, step, onStep }: Props) {
  const run = simulation?.run;
  const last = run ? run.configurations.length - 1 : 0;

  return (
    <Panel title="Input">
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={(event) => {
            onInput(event.target.value);
          }}
          onKeyDown={(event) => {
            // The canvas must not see a string being typed — `b` is a symbol here, not a
            // shortcut, and `Backspace` deletes a character rather than the selection.
            event.stopPropagation();
          }}
          placeholder="try a string"
          aria-label="Input string to test"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-k-border bg-k-surface-raised px-2 py-1 font-mono text-sm text-k-text outline-none placeholder:text-k-text-faint focus:border-k-primary"
        />
        <VerdictChip verdict={run?.verdict} empty={input.length === 0} />
      </div>

      {run && (
        <>
          <Tape run={run} step={step} />
          <StepControls step={step} last={last} onStep={onStep} />
          <Reasoning simulation={simulation} step={step} />
        </>
      )}
    </Panel>
  );
}

/**
 * The verdict, as three words rather than two.
 *
 * `Stuck` is separate from `Rejected` on purpose, and the distinction is the teaching one: a
 * rejected string was read to the end and landed somewhere non-accepting, while a stuck one
 * ran out of moves partway and the rest of the input was never looked at. Collapsing them into
 * "no" throws away the more instructive half.
 */
function VerdictChip({ verdict, empty }: { verdict: Verdict | undefined; empty: boolean }) {
  if (verdict === undefined) {
    return (
      <span className="flex items-center rounded-md border border-k-border px-2 font-mono text-xs text-k-text-faint">
        {empty ? 'ε' : '—'}
      </span>
    );
  }

  const tone =
    verdict === 'accepted'
      ? 'border-k-success/40 bg-k-success/10 text-k-success'
      : verdict === 'stuck'
        ? 'border-k-warning/40 bg-k-warning/10 text-k-warning'
        : 'border-k-error/40 bg-k-error/10 text-k-error';

  return (
    <span className={`flex items-center rounded-md border px-2 font-mono text-xs ${tone}`}>
      {verdict}
    </span>
  );
}

/**
 * The input as a tape, split at the read head.
 *
 * The split point comes from the run rather than from `input.slice(step)`, because those are
 * not the same thing: an ε-transition advances the configuration without consuming a symbol,
 * so step index and characters read part company the moment ε is involved.
 */
function Tape({ run, step }: { run: Run; step: number }) {
  const consumed = run.configurations[step]?.consumed ?? 0;
  const characters = [...run.input];

  if (characters.length === 0) {
    return (
      <p className="mt-2 font-mono text-sm text-k-text-faint">
        ε <span className="text-[11px]">(the empty string)</span>
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-px font-mono text-sm">
      {characters.map((character, index) => (
        <span
          // Characters repeat, so position is the only identity available — and the tape is
          // rebuilt whole on every change, never reordered.
          key={`${character}-${String(index)}`}
          className={`inline-flex size-6 items-center justify-center rounded ${
            index < consumed
              ? 'bg-k-primary/15 text-k-text'
              : 'border border-k-border text-k-text-faint'
          } ${index === consumed ? 'ring-2 ring-k-primary' : ''}`}
        >
          {character}
        </span>
      ))}
    </div>
  );
}

function StepControls({
  step,
  last,
  onStep,
}: {
  step: number;
  last: number;
  onStep: (index: number) => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-1">
      <StepButton
        label="Start"
        disabled={step === 0}
        onClick={() => {
          onStep(0);
        }}
      >
        ⏮
      </StepButton>
      <StepButton
        label="Back"
        disabled={step === 0}
        onClick={() => {
          onStep(step - 1);
        }}
      >
        ◀
      </StepButton>
      <StepButton
        label="Forward"
        disabled={step >= last}
        onClick={() => {
          onStep(step + 1);
        }}
      >
        ▶
      </StepButton>
      <StepButton
        label="End"
        disabled={step >= last}
        onClick={() => {
          onStep(last);
        }}
      >
        ⏭
      </StepButton>
      <span className="ml-1 font-mono text-[11px] text-k-text-faint">
        {step + 1} / {last + 1}
      </span>
    </div>
  );
}

function StepButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-k-border px-1.5 py-0.5 text-xs text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * The sentence explaining the current step.
 *
 * Written in Rust, beside the code that made the move. Prose composed in the frontend from
 * structured fields drifts from what the algorithm actually did — and this is the one algorithm
 * whose input the user chose, so it is the one they will read most closely.
 */
function Reasoning({ simulation, step }: { simulation: Simulation | undefined; step: number }) {
  // Steps and configurations are separate sequences: the trace opens with narration before any
  // input is read. Indexing by position within the steps that carry a configuration keeps them
  // aligned without the frontend having to model the trace's structure.
  const detail = simulation?.steps[step]?.detail;
  if (!detail) return null;

  return <p className="mt-2 text-xs leading-relaxed text-k-text-muted">{detail}</p>;
}
