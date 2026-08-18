/**
 * The overview: what this is, for someone who has never seen it.
 *
 * Roadmap §2.8 calls the front door a different product from the workbench, and it is. The
 * editor optimises for density; this optimises for a stranger deciding, in about eight
 * seconds, whether to click through.
 *
 * Two rules it follows:
 *
 * **A working automaton, not a screenshot** (Phase 5 E1). The hero renders the same component
 * the editor does. A picture of a tool is a claim about a tool; the tool is not.
 *
 * **Every feature says whether it works** (Track K). Nothing here is labelled "coming soon" —
 * unbuilt features carry the phase they land in, which is specific enough to be wrong. See
 * `status.ts` for why that distinction is the whole point.
 */

import { AutomatonView } from '@/canvas/AutomatonView';
import { rowLayout } from '@/canvas/geometry';
import type { Automaton } from '@/model/automaton';
import { COMPARISON, FEATURES, type Feature } from '@/overview/content';
import { EXAMPLES, type Example } from '@/overview/examples';
import { statusLabel, type Status } from '@/overview/status';

/**
 * The machine in the hero.
 *
 * Hard-coded rather than fetched from the engine, deliberately: the overview must paint before
 * a 400KB wasm module arrives (Phase 5 E4), so the one thing a visitor is guaranteed to see
 * cannot depend on it. Six lines of literal is a cheap price for a page that works on a bad
 * connection.
 *
 * "Ends in ab" because it is small enough to read at a glance and still shows a self-loop, a
 * bidirectional pair and an accepting state — the whole visual vocabulary in three states.
 */
const HERO: Automaton = {
  alphabet: ['a', 'b'],
  states: [
    { id: 0, label: 'q0' },
    { id: 1, label: 'q1' },
    { id: 2, label: 'q2', accepting: true },
  ],
  start: 0,
  transitions: [
    { from: 0, to: 1, on: 'a' },
    { from: 0, to: 0, on: 'b' },
    { from: 1, to: 1, on: 'a' },
    { from: 1, to: 2, on: 'b' },
    { from: 2, to: 1, on: 'a' },
    { from: 2, to: 0, on: 'b' },
  ],
};

export function Overview({
  onOpenEditor,
  onOpenExample,
  themeLabel,
  onCycleTheme,
}: {
  onOpenEditor: () => void;
  /** Open the editor with a built-in machine already loaded. */
  onOpenExample: (key: string) => void;
  themeLabel: string;
  onCycleTheme: () => void;
}) {
  return (
    <div className="min-h-dvh bg-k-bg text-k-text">
      <header className="border-b border-k-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-lg font-medium tracking-tight text-k-primary">
              kleene
            </span>
            <span className="text-sm text-k-text-faint">automata workbench</span>
          </div>
          <div className="flex items-center gap-2">
            <GhostButton onClick={onCycleTheme}>{themeLabel}</GhostButton>
            <PrimaryButton onClick={onOpenEditor}>Open the editor</PrimaryButton>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6">
        <Hero onOpenEditor={onOpenEditor} />
        <Features />
        <Examples onOpen={onOpenExample} />
        <Comparison />
        <Closing onOpenEditor={onOpenEditor} />
      </main>

      <footer className="border-t border-k-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-sm text-k-text-faint">
          Built in Rust, compiled to WebAssembly. The engine that draws these diagrams is the
          same one that checks them.
        </div>
      </footer>
    </div>
  );
}

function Hero({ onOpenEditor }: { onOpenEditor: () => void }) {
  return (
    <section className="grid items-center gap-10 py-16 lg:grid-cols-[1fr_1.1fr] lg:py-24">
      <div>
        <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
          Automata theory you can <span className="text-k-primary">watch happen</span>.
        </h1>
        <p className="mt-5 max-w-prose text-lg text-k-text-muted">
          Draw a finite automaton, read it as a transition table, run a string through it one
          symbol at a time. Every conversion shows its working, not just its answer.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={onOpenEditor} large>
            Open the editor
          </PrimaryButton>
          <span className="font-mono text-xs text-k-text-faint">
            no account · nothing uploaded
          </span>
        </div>

        {/*
          Stated once, plainly, and not as a nag (roadmap §2.8, Phase 5 E7). When the teaching
          layer arrives this is the sentence that keeps the signed-out mode honest rather than
          quietly worse.
        */}
        <p className="mt-6 max-w-prose text-sm text-k-text-faint">
          Your work stays in this browser. There is no server to save it to, which also means
          there is nothing to sign into and nothing to leak.
        </p>
      </div>

      <figure className="rounded-xl border border-k-border bg-k-surface p-4">
        {/* The real renderer, not an image. A picture of a tool is a claim about a tool. */}
        <AutomatonView
          automaton={HERO}
          layout={rowLayout(HERO.states.map((state) => state.id))}
          title="A DFA accepting strings over {a, b} that end in ab"
          className="h-56 w-full sm:h-72"
        />
        <figcaption className="mt-3 border-t border-k-border pt-3 font-mono text-xs text-k-text-faint">
          strings over {'{a, b}'} ending in <span className="text-k-text">ab</span>
        </figcaption>
      </figure>
    </section>
  );
}

function Features() {
  return (
    <section className="border-t border-k-border py-16">
      <h2 className="text-2xl font-semibold tracking-tight">What it does</h2>
      <p className="mt-2 text-k-text-muted">
        Some of this works today. The rest says when it lands — there is nothing here labelled
        &ldquo;coming soon&rdquo;.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} />
        ))}
      </ul>
    </section>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const ready = feature.status.kind === 'ready';

  return (
    <li
      className={`rounded-[10px] border p-4 ${
        ready ? 'border-k-border bg-k-surface' : 'border-dashed border-k-border bg-transparent'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={`font-medium ${ready ? 'text-k-text' : 'text-k-text-muted'}`}>
          {feature.title}
        </h3>
        <StatusChip status={feature.status} />
      </div>
      <p className="mt-2 text-sm text-k-text-muted">{feature.detail}</p>
      {feature.status.kind === 'planned' && feature.status.detail && (
        <p className="mt-2 font-mono text-[11px] text-k-text-faint">{feature.status.detail}</p>
      )}
    </li>
  );
}

/**
 * The marker.
 *
 * Planned features are also drawn with a *dashed* border and muted text, because colour is
 * never the only channel — design-system §1.2. Someone who cannot separate the two chip
 * colours can still see which cards are outlines and which are filled.
 */
function StatusChip({ status }: { status: Status }) {
  const ready = status.kind === 'ready';
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] whitespace-nowrap ${
        ready
          ? 'border-k-success/40 bg-k-success/10 text-k-success'
          : 'border-k-border text-k-text-faint'
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

/**
 * The examples strip.
 *
 * Real machines from the engine, opened in one click — not mocked cards. Two of them today,
 * and the section says so rather than padding the row out to look fuller. A gallery that
 * pretends to be bigger than it is gets found out on the second click.
 */
function Examples({ onOpen }: { onOpen: (key: string) => void }) {
  return (
    <section className="border-t border-k-border py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Start from an example</h2>
        <span className="font-mono text-xs text-k-text-faint">
          {EXAMPLES.length} today · a full gallery in phase 5
        </span>
      </div>
      <p className="mt-2 max-w-prose text-k-text-muted">
        Each one opens in the editor, ready to edit. Nothing is saved anywhere until you change
        it, and then only here.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {EXAMPLES.map((example) => (
          <ExampleCard key={example.key} example={example} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

function ExampleCard({ example, onOpen }: { example: Example; onOpen: (key: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onOpen(example.key);
        }}
        className="h-full w-full rounded-[10px] border border-k-border bg-k-surface p-4 text-left transition-colors duration-(--duration-k-hover) hover:border-k-primary/50"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-medium text-k-text">{example.title}</h3>
          <span className="shrink-0 rounded-full border border-k-border px-2 py-0.5 font-mono text-[10px] text-k-text-faint">
            {example.tier}
          </span>
        </div>
        <p className="mt-2 font-mono text-xs text-k-text-muted">{example.language}</p>
        <p className="mt-2 text-sm text-k-text-muted">{example.teaches}</p>
      </button>
    </li>
  );
}

function Comparison() {
  return (
    <section className="border-t border-k-border py-16">
      <h2 className="text-2xl font-semibold tracking-tight">Why not JFLAP</h2>
      <p className="mt-2 max-w-prose text-k-text-muted">
        JFLAP has taught this subject for twenty years and is genuinely good at it. These are
        the things it does not do.
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-k-border text-left">
              <th className="py-2 pr-4 font-medium text-k-text-faint" />
              <th className="py-2 pr-4 font-medium text-k-text-muted">JFLAP</th>
              <th className="py-2 font-medium text-k-primary">Kleene</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.aspect} className="border-b border-k-border">
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  {row.aspect}
                </th>
                <td className="py-2.5 pr-4 text-k-text-muted">{row.jflap}</td>
                <td className="py-2.5 text-k-text">{row.kleene}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Closing({ onOpenEditor }: { onOpenEditor: () => void }) {
  return (
    <section className="border-t border-k-border py-16 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">Draw one now</h2>
      <p className="mx-auto mt-2 max-w-prose text-k-text-muted">
        It opens with a machine already on the canvas. Change it, break it, undo it.
      </p>
      <div className="mt-6">
        <PrimaryButton onClick={onOpenEditor} large>
          Open the editor
        </PrimaryButton>
      </div>
    </section>
  );
}

function PrimaryButton({
  children,
  onClick,
  large,
}: {
  children: React.ReactNode;
  onClick: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md bg-k-primary font-medium text-white transition-colors duration-(--duration-k-hover) hover:bg-k-primary-hover ${
        large ? 'px-5 py-2.5' : 'px-3 py-1.5 text-sm'
      }`}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-k-border px-3 py-1.5 text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text"
    >
      {children}
    </button>
  );
}
