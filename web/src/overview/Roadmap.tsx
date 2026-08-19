/**
 * `/roadmap` — what is built, what is next, and when.
 *
 * L4. This is the page every "Coming soon" elsewhere on the site points at. A badge says a
 * feature is not here; only this page says *when*, and says it in enough detail to be wrong.
 * Markers scattered across a product accumulate, get missed when the feature lands, and end up
 * describing something that no longer exists — so they carry a phase number, and the number
 * resolves here.
 *
 * It is also the page that survives v1. "What are you building next" keeps being asked; a
 * badge stops being an answer the moment something ships.
 */

import { AFTER_V1, PHASES, type Phase, type PhaseState } from '@/overview/phases';
import { Reveal } from '@/site/motion';
import { Band, Masthead } from '@/site/page';

export function Roadmap() {
  const done = PHASES.filter((phase) => phase.state === 'done').length;

  return (
    <main>
      <Masthead
        eyebrow="Roadmap"
        title="What is built, what is next, and when"
        detail="Every “Coming soon” on this site carries a phase number, and this is where the numbers resolve. A promise without a date is not a plan."
      >
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <div className="flex items-baseline justify-between font-mono text-xs text-k-text-faint">
            <span>
              {done} of {PHASES.length} phases complete
            </span>
            <span>v1</span>
          </div>
          {/*
            A bar as well as a count. "3 of 6" is precise and takes a moment to picture; a bar
            is imprecise and takes none, and the two together are read faster than either.
          */}
          <div
            className="h-1.5 overflow-hidden rounded-full bg-k-border"
            role="img"
            aria-label={`${String(done)} of ${String(PHASES.length)} phases complete`}
          >
            <div
              className="h-full rounded-full bg-k-primary transition-[width] duration-700 ease-(--ease-k-spring)"
              style={{ width: `${String((done / PHASES.length) * 100)}%` }}
            />
          </div>
        </div>
      </Masthead>

      <Band>
        <ol className="mx-auto max-w-3xl space-y-4">
          {PHASES.map((phase, index) => (
            <Reveal as="li" key={phase.number} delay={Math.min(index, 4) * 0.04}>
              <PhaseCard phase={phase} />
            </Reveal>
          ))}
        </ol>

        <section className="mx-auto mt-4 max-w-3xl rounded-2xl border border-dashed border-k-border p-5">
          <h2 className="font-medium text-k-text-muted">After v1 — {AFTER_V1.title}</h2>
          <p className="mt-2 max-w-prose text-sm text-k-text-muted">{AFTER_V1.detail}</p>
        </section>

        <p className="mx-auto mt-10 max-w-3xl text-sm text-k-text-faint">
          Phases are ordered by dependency, not by how interesting they are. The engine came
          before the editor because an editor for algorithms that do not exist is a drawing
          program, and the conversions came after both because they are the thing the other two
          were for.
        </p>
      </Band>
    </main>
  );
}

function PhaseCard({ phase }: { phase: Phase }) {
  const done = phase.state === 'done';

  return (
    <div
      className={`k-card rounded-2xl border p-5 ${
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
    </div>
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
