/**
 * The front door.
 *
 * Roadmap §2.8 calls this a different product from the workbench, and it is. The editor
 * optimises for density; this optimises for a stranger deciding, in about eight seconds,
 * whether to click through — and then for the rather different person who scrolls all the way
 * down because they are deciding whether to depend on it.
 *
 * Three rules it follows:
 *
 * **A working automaton, not a screenshot** (Phase 5 E1). The hero renders the same component
 * the editor does, running a string through it. A picture of a tool is a claim about a tool.
 *
 * **Every feature says whether it works.** Unbuilt ones carry "Coming soon" *and* the phase
 * they land in, for the reason in `status.ts`: the words serve the reader skimming, the number
 * serves the one deciding whether to rely on this.
 *
 * **Nothing here is unverifiable.** Every number under the hero can be checked from the
 * repository. A statistic nobody can check is decoration wearing a lab coat.
 */

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useState } from 'react';

import { COMPARISON, FEATURES } from '@/overview/content';
import { EXAMPLES } from '@/overview/examples';
import { statusHeadline } from '@/overview/status';
import { StatusBadge, Pill } from '@/site/Badge';
import { AUDIENCES, FAQ, PIPELINE, STATS, TRACE_CLAIM } from '@/site/content';
import { LiveHero } from '@/site/LiveHero';
import {
  CountUp,
  Lift,
  Lines,
  Reveal,
  RevealGroup,
  RevealItem,
  Spotlight,
} from '@/site/motion';
import type { Route } from '@/router';

export function Landing({
  onNavigate,
  onOpenExample,
}: {
  onNavigate: (to: Route) => void;
  onOpenExample: (key: string) => void;
}) {
  return (
    <main>
      <Hero onNavigate={onNavigate} />
      <Stats />
      <Pipeline />
      <Trace onNavigate={onNavigate} />
      <Bento />
      <Audiences />
      <Practise onNavigate={onNavigate} />
      <Examples
        onOpen={onOpenExample}
        onBrowseAll={() => {
          onNavigate('examples');
        }}
      />
      <Comparison onNavigate={onNavigate} />
      <Questions />
      <Closing onNavigate={onNavigate} />
    </main>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────────── */

function Hero({ onNavigate }: { onNavigate: (to: Route) => void }) {
  const still = useReducedMotion();
  const { scrollY } = useScroll();
  // The aurora drifts up at a third of the scroll speed. Enough to feel like depth, far short
  // of the parallax that makes a page feel like it is fighting the wheel.
  const lift = useTransform(scrollY, [0, 600], [0, still ? 0 : -120]);

  return (
    <section className="relative overflow-hidden">
      <motion.div
        aria-hidden
        style={{ y: lift }}
        className="k-aurora k-aurora-drift pointer-events-none absolute inset-x-0 -top-40 h-[46rem]"
      />
      <div aria-hidden className="k-grid-fade pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pt-20 pb-16 lg:grid-cols-[1fr_1.05fr] lg:pt-28 lg:pb-24">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-k-border bg-k-surface/70 px-3 py-1 font-mono text-[11px] text-k-text-muted backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-k-success" aria-hidden />
              Regex → ε-NFA → DFA → minimal DFA, live
            </span>
          </Reveal>

          {/*
            Set as three fixed lines rather than left to wrap. The break points are part of
            the writing — "Automata / theory you can / watch happen" lands the accent on its
            own line — and a headline that rewraps at every viewport cannot be composed.
          */}
          <h1 className="mt-6 text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-[4.25rem]">
            <Lines>
              {[
                'Automata',
                'theory you can',
                <>
                  <span className="k-gradient-text">watch happen</span>.
                </>,
              ]}
            </Lines>
          </h1>

          <Reveal delay={0.1}>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-k-text-muted">
              Draw a finite automaton, read it as a transition table, run a string through it
              one symbol at a time. Every conversion shows its working — not just its answer.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Lift>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('editor');
                  }}
                  className="k-glow rounded-full bg-k-primary px-5 py-3 text-[15px] font-medium text-white"
                >
                  Open the editor →
                </button>
              </Lift>
              <Lift>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('convert');
                  }}
                  className="rounded-full border border-k-border-strong bg-k-surface-raised px-5 py-3 text-[15px] font-medium text-k-text"
                >
                  Convert a regex
                </button>
              </Lift>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-k-text-faint">
              <span>free, forever</span>
              <span aria-hidden>·</span>
              <span>no account</span>
              <span aria-hidden>·</span>
              <span>nothing uploaded</span>
              <span aria-hidden>·</span>
              <span>open source</span>
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <LiveHero onNavigate={onNavigate} />
        </Reveal>
      </div>
    </section>
  );
}

/* ── Stats ─────────────────────────────────────────────────────────────────── */

function Stats() {
  return (
    <Section>
      <RevealGroup className="grid gap-px overflow-hidden rounded-2xl border border-k-border bg-k-border sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <RevealItem key={stat.label} className="bg-k-bg p-6">
            <CountUp
              value={stat.value}
              className="block font-mono text-3xl font-semibold tracking-tight text-k-text tabular-nums"
            />
            <div className="mt-1 font-mono text-[11px] tracking-wider text-k-primary uppercase">
              {stat.label}
            </div>
            <p className="mt-2 text-sm text-k-text-muted">{stat.detail}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

/* ── Pipeline ──────────────────────────────────────────────────────────────── */

function Pipeline() {
  return (
    <Section>
      <Heading
        eyebrow="How it works"
        title="Three moves, and you can enter at any of them"
        detail="The pipeline is not a wizard. Draw a machine and determinize it, or type an expression and edit what comes out — every stage is a document in its own right."
      />

      <RevealGroup className="mt-12 grid gap-5 lg:grid-cols-3">
        {PIPELINE.map((stage) => (
          <RevealItem key={stage.step}>
            <Spotlight className="k-card h-full rounded-2xl border border-k-border bg-k-surface p-6 hover:border-k-primary/40">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-k-text-faint">{stage.step}</span>
                <StatusBadge status={stage.status} />
              </div>
              <h3 className="mt-4 text-lg font-medium tracking-tight">{stage.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-k-text-muted">{stage.detail}</p>
            </Spotlight>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

/* ── The trace ─────────────────────────────────────────────────────────────── */

function Trace({ onNavigate }: { onNavigate: (to: Route) => void }) {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-3xl border border-k-border bg-k-surface">
        <div aria-hidden className="k-aurora pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative grid gap-10 p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-12">
          <div>
            <Reveal>
              <Pill tone="brand">The argument</Pill>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {TRACE_CLAIM.heading}
              </h2>
              <p className="mt-5 max-w-prose leading-relaxed text-k-text-muted">
                {TRACE_CLAIM.detail}
              </p>
              <button
                type="button"
                onClick={() => {
                  onNavigate('convert');
                }}
                className="mt-6 font-mono text-sm text-k-primary underline decoration-dotted underline-offset-4"
              >
                Watch one happen →
              </button>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="k-glass rounded-2xl p-1.5">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="font-mono text-[11px] text-k-text-faint">
                  subset construction · (a|b)*abb
                </span>
                <span className="ml-auto font-mono text-[10px] text-k-text-faint">
                  produced in Rust
                </span>
              </div>
              <ol className="space-y-1.5 rounded-xl bg-k-canvas/80 p-3">
                {TRACE_CLAIM.sample.map((line, index) => (
                  <li
                    key={line}
                    className="flex gap-3 rounded-lg px-2 py-1.5 font-mono text-[11px] leading-relaxed text-k-text-muted"
                  >
                    <span className="shrink-0 text-k-text-faint tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

/* ── Features ──────────────────────────────────────────────────────────────── */

function Bento() {
  return (
    <Section>
      <Heading
        eyebrow="What it does"
        title="A workbench, not a diagram editor"
        detail="Everything below is either working today or carries the phase it lands in. Nothing on this page is a maybe."
      />

      <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <RevealItem
            key={feature.title}
            className={
              // The first card is the one someone reads, so it gets the room. A grid where
              // every cell is the same size has no opinion about what matters.
              index === 0 ? 'sm:col-span-2' : ''
            }
          >
            <Spotlight className="k-card flex h-full flex-col rounded-2xl border border-k-border bg-k-surface p-6 hover:border-k-primary/40">
              <div className="flex items-start justify-between gap-3">
                <h3
                  className={`font-medium tracking-tight ${index === 0 ? 'text-xl' : 'text-base'}`}
                >
                  {feature.title}
                </h3>
                <StatusBadge status={feature.status} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-k-text-muted">{feature.detail}</p>
              {feature.status.kind === 'planned' && feature.status.detail && (
                <p className="mt-3 font-mono text-[11px] text-k-text-faint">
                  {feature.status.detail}
                </p>
              )}
            </Spotlight>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

/* ── Audiences ─────────────────────────────────────────────────────────────── */

function Audiences() {
  return (
    <Section>
      <Heading eyebrow="Who it is for" title="Three people, three different problems" />

      <RevealGroup className="mt-12 grid gap-5 lg:grid-cols-3">
        {AUDIENCES.map((audience) => (
          <RevealItem key={audience.who} className="rounded-2xl border border-k-border p-6">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tracking-wider text-k-primary uppercase">
                {audience.who}
              </span>
              <span className="ml-auto font-mono text-[10px] text-k-text-faint">
                {statusHeadline(audience.status)}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-medium tracking-tight text-balance">
              {audience.need}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-k-text-muted">{audience.detail}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

/* ── Examples ──────────────────────────────────────────────────────────────── */

function Examples({
  onOpen,
  onBrowseAll,
}: {
  onOpen: (key: string) => void;
  onBrowseAll: () => void;
}) {
  return (
    <Section>
      <Heading
        eyebrow="Start from something"
        title="Open a machine that already works"
        detail="Each one opens in the editor, editable, with nothing to install and nothing to download."
      />

      <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2">
        {EXAMPLES.map((example) => (
          <RevealItem key={example.key}>
            <button
              type="button"
              onClick={() => {
                onOpen(example.key);
              }}
              className="k-card flex w-full flex-col items-start rounded-2xl border border-k-border bg-k-surface p-6 text-left hover:border-k-primary/40"
            >
              <div className="flex w-full items-center gap-2">
                <h3 className="font-medium tracking-tight">{example.title}</h3>
                <Pill className="ml-auto">{example.tier}</Pill>
              </div>
              <code className="mt-2 font-mono text-xs text-k-secondary">
                {example.language}
              </code>
              <p className="mt-3 text-sm leading-relaxed text-k-text-muted">
                {example.teaches}
              </p>
              <span className="mt-4 font-mono text-xs text-k-primary">open in editor →</span>
            </button>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal delay={0.1}>
        <button
          type="button"
          onClick={onBrowseAll}
          className="mt-6 font-mono text-sm text-k-text-muted underline decoration-dotted underline-offset-4 hover:text-k-text"
        >
          Browse the gallery →
        </button>
      </Reveal>
    </Section>
  );
}

/* ── Practise ──────────────────────────────────────────────────────────────── */

/**
 * The teaching layer, on the page where people arrive.
 *
 * It was reachable only from the nav and the footer, which is close to not existing: a visitor
 * scrolling the landing page had no way to learn that any of it was there. The nav can hold
 * one word, and one word cannot say "there is a problem set, a game that plays the pumping
 * lemma against you, and a way to set an assignment without an account".
 *
 * Placed after the audiences band, which is where the page stops describing what the tool is
 * and starts saying who it is for — and these are the three things those people would do next.
 */
function Practise({ onNavigate }: { onNavigate: (to: Route) => void }) {
  const cards = [
    {
      route: 'practice' as Route,
      eyebrow: 'For practice',
      title: 'Twenty problems, in the order they get harder',
      detail:
        'Build a machine for a language and check it. A wrong answer comes back with the shortest string that proves it wrong — never just “incorrect”. Nothing is scored and nothing is timed.',
      action: 'Open the problem set',
    },
    {
      route: 'pumping' as Route,
      eyebrow: 'For the hard part',
      title: 'Play the pumping lemma instead of memorising it',
      detail:
        'The lemma alternates quantifiers, and alternating quantifiers are a game: the adversary picks n, you pick w, it splits, you pump. Win and it prints the proof you just played. Two of the languages are regular and cannot be beaten — that is the lesson.',
      action: 'Play a round',
    },
    {
      route: 'download' as Route,
      eyebrow: 'For teaching',
      title: 'Set an assignment without an account',
      detail:
        'One command prints a link you can paste into a slide. One more marks a folder of submissions to a spreadsheet, with a counterexample beside every wrong answer. No sign-up, no roster, no server holding anyone’s work.',
      action: 'See the command line',
    },
  ];

  return (
    <Section>
      <Heading
        eyebrow="Practise"
        title="Somewhere to use it, and something to be wrong at"
        detail="A tool you can only read about teaches nothing. These are the parts you work through — with the same engine checking your answer that drew the diagram."
      />

      <RevealGroup className="mt-12 grid gap-5 lg:grid-cols-3">
        {cards.map((card) => (
          <RevealItem key={card.route}>
            <button
              type="button"
              onClick={() => {
                onNavigate(card.route);
              }}
              className="k-card flex h-full w-full flex-col rounded-2xl border border-k-border bg-k-surface p-6 text-left hover:border-k-primary/50"
            >
              <span className="font-mono text-[10px] tracking-wider text-k-text-faint uppercase">
                {card.eyebrow}
              </span>
              <h3 className="mt-3 text-lg font-medium tracking-tight text-balance">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-k-text-muted">{card.detail}</p>
              <span className="mt-auto pt-5 font-mono text-xs text-k-primary">
                {card.action} →
              </span>
            </button>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}

/* ── Comparison ────────────────────────────────────────────────────────────── */

function Comparison({ onNavigate }: { onNavigate: (to: Route) => void }) {
  return (
    <Section>
      <Heading
        eyebrow="Why another one"
        title="The tool most courses use was written for a different decade"
        detail="This is not a criticism of JFLAP, which taught a generation. It is a statement of what has changed since: browsers got good, and a diagram in a PDF is no longer the end of the workflow."
      />

      <Reveal delay={0.05}>
        <div className="mt-10 overflow-hidden rounded-2xl border border-k-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-k-surface">
                <th className="px-5 py-3 text-left font-medium text-k-text-faint">&nbsp;</th>
                <th className="px-5 py-3 text-left font-medium text-k-text-muted">
                  Desktop tools
                </th>
                <th className="px-5 py-3 text-left font-medium text-k-primary">Kleene</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.aspect} className="border-t border-k-border">
                  <th
                    scope="row"
                    className="px-5 py-3 text-left font-normal whitespace-nowrap text-k-text-faint"
                  >
                    {row.aspect}
                  </th>
                  <td className="px-5 py-3 text-k-text-muted">{row.jflap}</td>
                  <td className="px-5 py-3 font-medium text-k-text">{row.kleene}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/*
        Five rows favourable to Kleene are an argument, not a comparison. The full page
        concedes the ones JFLAP wins — Turing machines, grammars, twenty years of standing —
        and a reader who suspects this table of being selective deserves to find that out
        from us rather than from someone else.
      */}
      <Reveal delay={0.1}>
        <button
          type="button"
          onClick={() => {
            onNavigate('jflap');
          }}
          className="mt-6 font-mono text-sm text-k-primary underline decoration-k-primary/30 underline-offset-4 hover:decoration-k-primary"
        >
          The longer comparison, including what JFLAP does better →
        </button>
      </Reveal>
    </Section>
  );
}

/* ── FAQ ───────────────────────────────────────────────────────────────────── */

function Questions() {
  const [open, setOpen] = useState<string | undefined>(FAQ[0]?.question);

  return (
    <Section>
      <Heading eyebrow="Questions" title="The ones people actually ask" />

      <div className="mx-auto mt-10 max-w-3xl divide-y divide-k-border border-y border-k-border">
        {FAQ.map((entry) => {
          const showing = open === entry.question;
          return (
            <div key={entry.question}>
              <h3>
                <button
                  type="button"
                  aria-expanded={showing}
                  onClick={() => {
                    setOpen(showing ? undefined : entry.question);
                  }}
                  className="flex w-full items-center gap-4 py-5 text-left"
                >
                  <span className="font-medium tracking-tight">{entry.question}</span>
                  <span
                    aria-hidden
                    className={`ml-auto font-mono text-k-text-faint transition-transform duration-(--duration-k-panel) ${
                      showing ? 'rotate-45' : ''
                    }`}
                  >
                    +
                  </span>
                </button>
              </h3>
              {/*
                Height animated by grid rather than by measuring the panel. `grid-template-rows`
                from 0fr to 1fr transitions natively, so the answer opens smoothly without a
                ResizeObserver and without hard-coding a height that a longer answer breaks.
              */}
              <div
                className={`grid transition-[grid-template-rows] duration-(--duration-k-panel) ease-(--ease-k) ${
                  showing ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="max-w-prose pb-5 text-sm leading-relaxed text-k-text-muted">
                    {entry.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ── Closing ───────────────────────────────────────────────────────────────── */

function Closing({ onNavigate }: { onNavigate: (to: Route) => void }) {
  return (
    <Section>
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-k-border px-8 py-16 text-center sm:px-16">
          <div
            aria-hidden
            className="k-aurora k-aurora-drift pointer-events-none absolute inset-0"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Open it and draw something. It takes about four seconds.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-k-text-muted">
              No account, no download, nothing to configure. Close the tab and your work is
              still there when you come back.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Lift>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('editor');
                  }}
                  className="k-glow rounded-full bg-k-primary px-6 py-3 font-medium text-white"
                >
                  Open the editor →
                </button>
              </Lift>
              <Lift>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('roadmap');
                  }}
                  className="rounded-full border border-k-border-strong bg-k-surface-raised px-6 py-3 font-medium text-k-text"
                >
                  Read the roadmap
                </button>
              </Lift>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

/* ── Shared furniture ──────────────────────────────────────────────────────── */

function Section({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">{children}</section>;
}

function Heading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <Reveal>
      <div className="max-w-2xl">
        <span className="font-mono text-xs tracking-wider text-k-primary uppercase">
          {eyebrow}
        </span>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
        {detail && <p className="mt-4 leading-relaxed text-k-text-muted">{detail}</p>}
      </div>
    </Reveal>
  );
}
