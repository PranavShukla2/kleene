/**
 * Why this exists, and what it is built out of.
 *
 * The page a recruiter, a lecturer or a contributor lands on when they have decided the tool
 * is interesting and now want to know whether the person behind it is serious. So it answers
 * the two questions that actually decide that: what problem it solves, and what it is made of.
 *
 * No photograph, no origin story, no "our mission". The evidence is the architecture.
 */

import { Pill } from '@/site/Badge';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading, Masthead } from '@/site/page';
import type { Route } from '@/router';

const STACK: readonly { layer: string; what: string; why: string }[] = [
  {
    layer: 'kleene-core',
    what: 'Rust',
    why: 'Every algorithm, and every sentence of reasoning they produce. Over 300 tests, including property tests for the algebraic laws and differential tests that check the conversions agree with each other.',
  },
  {
    layer: 'kleene-wasm',
    what: 'WebAssembly',
    why: 'A deliberately thin binding layer. Anything that starts accumulating logic here belongs in the core, where it is testable without a browser and reusable by the command line.',
  },
  {
    layer: 'web',
    what: 'React · TypeScript · Tailwind',
    why: 'The views. TypeScript types are generated from the Rust definitions and checked in CI, so a change to the model that the interface has not caught up with fails the build rather than the user.',
  },
  {
    layer: 'kleene-cli',
    what: 'Rust',
    why: 'The same core, on the command line — so a conversion in a script and a conversion in the browser cannot disagree.',
  },
];

const PRINCIPLES: readonly { title: string; detail: string }[] = [
  {
    title: 'Reasoning is a return value',
    detail:
      'Every algorithm returns its explanation alongside its result, produced beside the line that made the move. The browser, the command line and the generated documentation read the same trace, so there is no second explanation to drift out of step with the first.',
  },
  {
    title: 'One implementation, everywhere',
    detail:
      'Nothing about automata is implemented twice. Whether a machine is a DFA, what an empty cell in δ means, what "stuck" means during a run — each is defined once, in Rust, and every surface asks the same question of the same code.',
  },
  {
    title: 'Motion explains causality, or it does not happen',
    detail:
      'On the canvas, something moves because an algorithm moved it. A state grows into place because it was just discovered; a ring is struck because a subset was recognised rather than created. Decoration lives on the pages where there is nothing to decorate over.',
  },
  {
    title: 'Say when, not soon',
    detail:
      'Unbuilt features carry the phase they land in as well as the words. A vague badge promises everything and dates nothing; a phase number is a claim specific enough to be wrong, and therefore worth making.',
  },
];

export function About({ onNavigate }: { onNavigate: (to: Route) => void }) {
  return (
    <main>
      <Masthead
        eyebrow="About"
        title="A tool that shows its working"
        detail="Automata theory is taught by working through algorithms by hand, and then checked with software that only shows the answer. Kleene closes that gap: every conversion it performs, it explains."
      />

      <Band>
        <BandHeading
          title="The problem"
          detail="Not that existing tools are bad — that they answer a different question."
        />
        <Reveal delay={0.05}>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-k-border p-6">
              <Pill>What a student is asked to do</Pill>
              <p className="mt-4 leading-relaxed text-k-text-muted">
                Convert this regular expression to an ε-NFA. Determinize it. Minimize the
                result. Show every step of your working, because the working is what is being
                examined — the final machine is worth almost nothing on its own.
              </p>
            </div>
            <div className="rounded-2xl border border-k-border p-6">
              <Pill>What a tool usually gives them</Pill>
              <p className="mt-4 leading-relaxed text-k-text-muted">
                The final machine. Which is precisely the part they already had at the back of
                the textbook, and precisely the part they cannot hand in.
              </p>
            </div>
          </div>
        </Reveal>
      </Band>

      <Band>
        <BandHeading
          title="What it is built out of"
          detail="Four layers, one definition of everything."
        />
        <RevealGroup className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-k-border bg-k-border">
          {STACK.map((layer) => (
            <RevealItem key={layer.layer} className="bg-k-bg p-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <code className="font-mono text-sm font-medium text-k-primary">
                  {layer.layer}
                </code>
                <span className="font-mono text-xs text-k-text-faint">{layer.what}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-k-text-muted">
                {layer.why}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Band>

      <Band>
        <BandHeading title="The rules it is built to" />
        <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <RevealItem
              key={principle.title}
              className="rounded-2xl border border-k-border bg-k-surface p-6"
            >
              <h3 className="font-medium tracking-tight">{principle.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-k-text-muted">
                {principle.detail}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Band>

      <Band>
        <div className="relative overflow-hidden rounded-3xl border border-k-border p-8 sm:p-12">
          <div
            aria-hidden
            className="k-aurora pointer-events-none absolute inset-0 opacity-50"
          />
          <div className="relative flex flex-wrap items-center gap-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Open source, plan included
              </h2>
              <p className="mt-2 max-w-xl text-k-text-muted">
                The Rust core, the bindings, the command line tool and this site are in one
                repository — along with the full implementation plan, the design system, and the
                notes on decisions that turned out to be wrong.
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-3">
              <Lift>
                <a
                  href="https://github.com/PranavShukla2/kleene"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="k-glow inline-block rounded-xl bg-k-primary px-5 py-3 font-medium text-white"
                >
                  View the source ↗
                </a>
              </Lift>
              <Lift>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('changelog');
                  }}
                  className="rounded-xl border border-k-border-strong bg-k-surface-raised px-5 py-3 font-medium"
                >
                  What has shipped
                </button>
              </Lift>
            </div>
          </div>
        </div>
      </Band>
    </main>
  );
}
