/**
 * `/roadmap` — what is built, what is next, and when.
 *
 * L4. This page exists so that **nothing else on the site carries a "coming soon" badge**. One
 * honest page beats a marker on every surface: markers accumulate, get missed when the feature
 * lands, and end up describing a product that no longer exists. A page has one owner and one
 * place to be wrong.
 *
 * It is also the page that survives v1. "What are you building next" keeps being asked; "coming
 * soon" stops being an answer the moment something ships.
 */

import { AFTER_V1, PHASES, type Phase, type PhaseState } from '@/overview/phases';

export function Roadmap() {
  const done = PHASES.filter((phase) => phase.state === 'done').length;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Roadmap</h1>
      <p className="mt-3 max-w-prose text-k-text-muted">
        Everything below is either working today or has a phase attached. Nothing on this site
        says &ldquo;coming soon&rdquo; — a promise without a date is not a plan, and this page
        is where the dates live.
      </p>
      <p className="mt-2 font-mono text-xs text-k-text-faint">
        {done} of {PHASES.length} phases complete
      </p>

      <ol className="mt-10 space-y-4">
        {PHASES.map((phase) => (
          <PhaseCard key={phase.number} phase={phase} />
        ))}
      </ol>

      <section className="mt-10 rounded-[10px] border border-dashed border-k-border p-5">
        <h2 className="font-medium text-k-text-muted">After v1 — {AFTER_V1.title}</h2>
        <p className="mt-2 max-w-prose text-sm text-k-text-muted">{AFTER_V1.detail}</p>
      </section>

      <p className="mt-10 max-w-prose text-sm text-k-text-faint">
        Phases are ordered by dependency, not by how interesting they are. The engine came
        before the editor because an editor for algorithms that do not exist is a drawing
        program, and the conversions came after both because they are the thing the other two
        were for.
      </p>
    </main>
  );
}

function PhaseCard({ phase }: { phase: Phase }) {
  const done = phase.state === 'done';

  return (
    <li
      className={`rounded-[10px] border p-5 ${
        done
          ? 'border-k-border bg-k-surface'
          : phase.state === 'building'
            ? 'border-k-primary/40 bg-k-primary/5'
            : 'border-dashed border-k-border'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">
          {/* Every card says "phase N". Special-casing the last one read as "v1 v1". */}
          <span className="font-mono text-sm text-k-text-faint">phase {phase.number}</span>
          <span className="ml-3 text-k-text">{phase.title}</span>
        </h2>
        <StateChip state={phase.state} />
      </div>

      <p className="mt-2 max-w-prose text-sm text-k-text-muted">{phase.summary}</p>

      <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {phase.items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-k-text-muted">
            {/*
              A tick for done and a dash for not — not colour alone, and not an icon font.
              Design-system §1.2, and this page in particular gets read on a phone in a lecture
              hall with the brightness turned down.
            */}
            <span aria-hidden className="text-k-text-faint">
              {done ? '✓' : '·'}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </li>
  );
}

function StateChip({ state }: { state: PhaseState }) {
  const tone =
    state === 'done'
      ? 'border-k-success/40 bg-k-success/10 text-k-success'
      : state === 'building'
        ? 'border-k-primary/40 bg-k-primary/10 text-k-primary'
        : 'border-k-border text-k-text-faint';

  const label =
    state === 'done' ? 'shipped' : state === 'building' ? 'building now' : 'planned';

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  );
}
