/**
 * The hero, upgraded from a demonstration into the thing itself.
 *
 * The previous version played a canned run through a fixed machine. It was honest — the real
 * renderer, a real automaton — but it was still a performance, and a visitor cannot tell a
 * good performance from a recording. This one hands them the engine: type an expression and
 * the DFA is built in front of you, by the same code the workbench runs.
 *
 * ## The rule it has to keep
 *
 * Phase 5 E4: the overview must paint before WebAssembly arrives. So this component starts as
 * the canned run — no engine, no wait, nothing deferred — and *upgrades in place* once the
 * module has loaded. On a fast connection the swap happens before anyone has finished reading
 * the headline; on a slow one, the fallback is a complete experience rather than a spinner.
 *
 * The engine is requested only after the first paint has definitely happened, which is what
 * keeps this from quietly becoming a blocking dependency of the front page.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DiagramView } from '@/canvas/DiagramView';
import { wrappedRowLayout } from '@/canvas/geometry';
import { construction, partial } from '@/convert/construction';
import { HeroDemo } from '@/site/HeroDemo';
import { loadEngine, type Engine } from '@/wasm/loader';
import type { Route } from '@/router';

/**
 * Expressions worth one click.
 *
 * Chosen so the first thing a visitor sees is a machine that is interesting rather than
 * trivial: `(a|b)*abb` is the canonical textbook conversion, five DFA states from fourteen
 * ε-NFA ones, and it is the example every course uses.
 */
const PRESETS = ['(a|b)*abb', 'a*b*', '(ab)*+b', 'a(b|c)*'] as const;

/** How long each construction step is held while it plays itself. */
const BEAT = 620;

export function LiveHero({ onNavigate }: { onNavigate: (to: Route) => void }) {
  const engine = useDeferredEngine();
  const [source, setSource] = useState<string>(PRESETS[0]);

  // Before the engine lands, the canned run. Not a placeholder — a finished thing that
  // happens to be replaced.
  if (!engine) return <HeroDemo />;

  return <Live engine={engine} source={source} onSource={setSource} onNavigate={onNavigate} />;
}

function Live({
  engine,
  source,
  onSource,
  onNavigate,
}: {
  engine: Engine;
  source: string;
  onSource: (next: string) => void;
  onNavigate: (to: Route) => void;
}) {
  const still = useReducedMotion();
  const compilation = useMemo(() => engine.compileRegex(source), [engine, source]);
  const parsed = compilation?.kind === 'parsed' ? compilation : undefined;
  const stage = parsed?.dfa;

  const steps = stage?.steps.length ?? 0;

  /**
   * How far into the construction, and *which* construction.
   *
   * A pair rather than a number reset by an effect: editing the expression changes the machine
   * underneath the animation, and zeroing a plain counter from an effect is a cascading render
   * for something already knowable from the input.
   */
  const [play, setPlay] = useState({ of: source, step: 0 });

  // Plays itself, and keeps playing. A hero that waits to be pressed is a hero most people
  // scroll past; one already running is an argument being made before it is asked for.
  useEffect(() => {
    if (still || steps === 0) return;
    const timer = setInterval(() => {
      setPlay((was) => {
        if (was.of !== source) return { of: source, step: 0 };
        // Rests two beats on the finished machine before starting over, so the answer is
        // legible rather than flashing past on its way back to the beginning.
        return { of: source, step: was.step >= steps + 1 ? 0 : was.step + 1 };
      });
    }, BEAT);
    return () => {
      clearInterval(timer);
    };
  }, [still, steps, source]);

  const step = play.of === source ? play.step : 0;
  const at = Math.min(step, Math.max(steps - 1, 0));
  const built = stage ? construction(stage.automaton, stage.steps, at) : undefined;
  const drawn = stage && built ? partial(stage.automaton, built) : undefined;

  const layout = useMemo(
    () =>
      stage
        ? wrappedRowLayout(
            stage.automaton.states.map((state) => state.id),
            6,
          )
        : {},
    [stage],
  );

  return (
    <div className="k-glass overflow-hidden rounded-3xl">
      <div className="flex items-center gap-2 border-b border-k-border/60 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <Dot className="bg-k-error/60" />
          <Dot className="bg-k-warning/60" />
          <Dot className="bg-k-success/60" />
        </span>
        <span className="ml-1 font-mono text-[11px] text-k-text-faint">
          subset construction — live
        </span>
        <span className="ml-auto font-mono text-[10px] text-k-text-faint tabular-nums">
          {steps > 0 && `${String(Math.min(at + 1, steps))} / ${String(steps)}`}
        </span>
      </div>

      {/*
        A real input, not a fake one. Somebody will type in it — that is the entire point —
        and an input that looks typeable and is not is worse than no input at all.
      */}
      <div className="flex items-center gap-2 border-b border-k-border/60 px-4 py-2.5">
        <label htmlFor="hero-regex" className="font-mono text-[11px] text-k-text-faint">
          regex
        </label>
        <input
          id="hero-regex"
          value={source}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            onSource(event.target.value);
          }}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-k-text outline-none placeholder:text-k-text-faint"
          placeholder="type an expression"
        />
        {parsed ? (
          <span className="font-mono text-[10px] text-k-secondary">
            {parsed.dfa.automaton.states.length} states
          </span>
        ) : (
          <span className="font-mono text-[10px] text-k-error">no parse</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-k-border/60 px-4 py-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              onSource(preset);
            }}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors duration-(--duration-k-hover) ${
              source === preset
                ? 'border-k-primary/50 bg-k-primary/10 text-k-primary'
                : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      {drawn && built && stage ? (
        <DiagramView
          automaton={drawn}
          layout={layout}
          title={`The DFA for ${source}, being built`}
          className="h-52 w-full sm:h-60"
          selection={[built.current, built.arrived].filter((id) => id !== undefined)}
          entering={{
            state: built.fresh ? built.arrived : undefined,
            edge: built.drew,
            recognised: built.fresh ? undefined : built.arrived,
          }}
        />
      ) : (
        <div className="flex h-52 items-center justify-center px-6 text-center text-sm text-k-text-faint sm:h-60">
          That is not an expression this parser recognises — try one of the chips above.
        </div>
      )}

      {/*
        The sentence the engine wrote for this step. This is the product's whole claim, on the
        front page, generated rather than authored — which is why it is worth the space.
      */}
      <div className="min-h-[3.9rem] border-t border-k-border/60 px-4 py-2.5">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${source}-${String(at)}`}
            initial={still ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={still ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="text-[13px] leading-relaxed text-k-text-muted"
          >
            {stage?.steps[at]?.detail ?? ' '}
          </motion.p>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => {
          onNavigate('convert');
        }}
        className="w-full border-t border-k-border/60 px-4 py-2 text-left font-mono text-[11px] text-k-text-faint transition-colors duration-(--duration-k-hover) hover:text-k-primary"
      >
        open this in the full converter, with every stage →
      </button>
    </div>
  );
}

/**
 * The engine, requested after the page has painted.
 *
 * Two frames of delay rather than one. A single `requestAnimationFrame` fires *before* the
 * paint it was scheduled against; nesting a second one is what actually puts the fetch after
 * pixels have reached the screen. Without it the wasm request competes with the first paint,
 * which is exactly the thing Phase 5 E4 forbids.
 */
function useDeferredEngine(): Engine | undefined {
  const [engine, setEngine] = useState<Engine | undefined>(undefined);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    let live = true;
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void loadEngine().then(
          (loaded) => {
            if (live) setEngine(loaded);
          },
          () => {
            // The canned hero stays. A front page has nothing useful to say about a failed
            // WebAssembly fetch, and the visitor loses a feature they never saw offered.
          },
        );
      });
    });

    return () => {
      live = false;
      cancelAnimationFrame(outer);
    };
  }, []);

  return engine;
}

function Dot({ className }: { className: string }) {
  return <span className={`h-2.5 w-2.5 rounded-full ${className}`} />;
}
