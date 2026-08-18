/**
 * The step scrubber — the plan calls it the centrepiece control of the product.
 *
 * It drives a trace the *engine* produced. Every sentence it displays was written in Rust
 * beside the code that made the move (Phase 1 D4); nothing here composes prose from structured
 * fields, because prose assembled in the frontend drifts from what the algorithm actually did
 * and there is no test that would catch it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { nextStep, position, SPEEDS, STEP_MS, type Speed } from '@/convert/scrubbing';
import type { Step } from '@/model/automaton';

export function Scrubber({
  steps,
  step,
  onStep,
  label,
}: {
  steps: readonly Step[];
  step: number;
  onStep: (next: number) => void;
  /** Names the trace for assistive technology: "subset construction steps". */
  label: string;
}) {
  const [speed, setSpeed] = useState<Speed>(1);
  const [playing, setPlaying] = useState(false);

  // The handler is read through a ref so the interval survives a step change. Restarting the
  // timer on every tick would make playback drift, and the drift would be worse at 4×.
  const advance = useRef<() => void>(() => undefined);
  useEffect(() => {
    advance.current = () => {
      const next = nextStep(step, steps);
      // Stops at the end rather than looping. A trace ends because the algorithm does.
      if (next === undefined) setPlaying(false);
      else onStep(next);
    };
  });

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      advance.current();
    }, STEP_MS / speed);
    return () => {
      clearInterval(timer);
    };
  }, [playing, speed]);

  const move = useCallback(
    (to: number) => {
      setPlaying(false);
      onStep(to);
    },
    [onStep],
  );

  if (steps.length === 0) return null;
  const last = steps.length - 1;

  return (
    <div className="border-t border-k-border">
      <div className="flex items-center gap-2 px-4 py-2">
        <IconButton
          label="First step"
          disabled={step === 0}
          onClick={() => {
            move(0);
          }}
        >
          ⏮
        </IconButton>
        <IconButton
          label="Previous step"
          disabled={step === 0}
          onClick={() => {
            move(step - 1);
          }}
        >
          ◀
        </IconButton>
        <IconButton
          label={playing ? 'Pause' : 'Play'}
          onClick={() => {
            // Playing from the end would sit there doing nothing, so it starts over.
            if (!playing && step === last) onStep(0);
            setPlaying((on) => !on);
          }}
        >
          {playing ? '❙❙' : '▶'}
        </IconButton>
        <IconButton
          label="Next step"
          disabled={step === last}
          onClick={() => {
            move(step + 1);
          }}
        >
          ▶❙
        </IconButton>

        {/*
          A range input rather than a custom track. It is draggable, clickable and arrow-key
          operable for free — and task C3 asks for keyboard-first scrubbing, which a div with
          pointer handlers would have to reimplement and would get subtly wrong.
        */}
        <input
          type="range"
          min={0}
          max={last}
          value={step}
          aria-label={label}
          aria-valuetext={`Step ${position(step, steps)}`}
          onChange={(event) => {
            move(Number(event.target.value));
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-k-border accent-k-primary"
        />

        <span className="shrink-0 font-mono text-[11px] text-k-text-faint">
          {position(step, steps)}
        </span>

        <select
          value={speed}
          aria-label="Playback speed"
          onChange={(event) => {
            setSpeed(Number(event.target.value) as Speed);
          }}
          className="shrink-0 rounded border border-k-border bg-k-surface-raised px-1 py-0.5 font-mono text-[11px] text-k-text-muted"
        >
          {SPEEDS.map((option) => (
            <option key={option} value={option}>
              {option}×
            </option>
          ))}
        </select>
      </div>

      <Reasoning step={steps[step]} />
    </div>
  );
}

/**
 * The sentence for the current step.
 *
 * Task C5, and the architecture's whole claim in one component: this renders `step.detail`
 * and nothing else. The reasoning was written in Rust next to the line that made the move, so
 * the explanation and the algorithm cannot disagree — and the same string reaches the CLI and
 * the docs site.
 */
function Reasoning({ step }: { step: Step | undefined }) {
  if (!step) return null;

  return (
    <p
      // A live region, so someone using a screen reader hears each step as they scrub rather
      // than having to go looking for what changed.
      aria-live="polite"
      className="border-t border-k-border bg-k-surface-raised px-4 py-2.5 text-sm leading-relaxed text-k-text-muted"
    >
      {step.detail}
    </p>
  );
}

function IconButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded border border-k-border px-1.5 py-0.5 text-xs text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text disabled:opacity-30"
    >
      {children}
    </button>
  );
}
