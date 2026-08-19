/**
 * Documentation, most of which is not written.
 *
 * The honest shape for that is a *map* rather than an empty shell: every page that will exist,
 * named, with the ones that do exist linked and the ones that do not marked. A docs section
 * that hides its gaps behind a search box with nothing in it is worse than one that says which
 * six pages are coming.
 *
 * The two things that *are* documented here are documented properly, because they are the two
 * a reader needs before anything else: what the notation means, and what the file format is.
 */

import { Pill, StatusBadge } from '@/site/Badge';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading, Masthead } from '@/site/page';
import { READY, planned, type Status } from '@/overview/status';
import type { Route } from '@/router';

interface Article {
  title: string;
  detail: string;
  status: Status;
  /** Where it goes, when it goes anywhere. */
  route?: Route;
}

const SECTIONS: readonly { heading: string; blurb: string; articles: readonly Article[] }[] = [
  {
    heading: 'Getting started',
    blurb: 'Enough to draw a machine and run a string through it.',
    articles: [
      {
        title: 'Draw your first automaton',
        detail: 'Double-click to place a state, drag from its edge to make a transition.',
        status: READY,
        route: 'editor',
      },
      {
        title: 'Convert a regular expression',
        detail: 'Type an expression and watch all three stages build themselves.',
        status: READY,
        route: 'convert',
      },
      {
        title: 'Keyboard shortcuts',
        detail: 'Every gesture has one. Press ? in the editor for the full sheet.',
        status: READY,
        route: 'editor',
      },
      {
        title: 'Reading the trace',
        detail: 'What a step is, what the worklist means, and how to scrub one.',
        status: planned(4),
      },
    ],
  },
  {
    heading: 'The notation',
    blurb: 'What the symbols on screen mean, in the terms a course uses.',
    articles: [
      {
        title: 'Regular expression syntax',
        detail: 'Union, concatenation, Kleene star, ∅ and ε — and which spellings are accepted.',
        status: READY,
        route: 'convert',
      },
      {
        title: 'The 5-tuple',
        detail: 'M = (Q, Σ, δ, q₀, F), and where each part appears in the interface.',
        status: READY,
        route: 'editor',
      },
      {
        title: 'DFA, NFA and ε-NFA',
        detail: 'What the badge on your machine is telling you, and why it changes.',
        status: planned(4),
      },
      {
        title: 'Notation settings',
        detail: 'Choosing between + and |, between ε and λ, and between δ styles.',
        status: planned(3),
      },
    ],
  },
  {
    heading: 'The algorithms',
    blurb: 'What each conversion does, and the reasoning it produces while doing it.',
    articles: [
      {
        title: 'Thompson’s construction',
        detail: 'Regular expression to ε-NFA, one operator at a time.',
        status: READY,
        route: 'convert',
      },
      {
        title: 'Subset construction',
        detail: 'ε-NFA to DFA, with the worklist and the ε-closures behind each round.',
        status: READY,
        route: 'convert',
      },
      {
        title: 'Minimization',
        detail: 'Partition refinement, and why two states end up in the same block.',
        status: planned(3),
      },
      {
        title: 'State elimination',
        detail: 'DFA back to a regular expression, and why the order matters.',
        status: planned(3),
      },
    ],
  },
  {
    heading: 'Taking it away',
    blurb: 'Getting a machine out of the browser and into something else.',
    articles: [
      {
        title: 'The .kln file format',
        detail: 'A documented JSON schema with a version field, so old files keep opening.',
        status: planned(4),
      },
      { title: 'Exporting to TikZ', detail: 'The diagram, as LaTeX, with your layout kept.', status: planned(4) },
      { title: 'Sharing as a URL', detail: 'How a machine is encoded into a link.', status: planned(4) },
      { title: 'The command line', detail: 'Converting and checking equivalence in a script.', status: planned(4) },
    ],
  },
];

export function Docs({ onNavigate }: { onNavigate: (to: Route) => void }) {
  const ready = SECTIONS.flatMap((s) => s.articles).filter((a) => a.status.kind === 'ready');

  return (
    <main>
      <Masthead
        eyebrow="Docs"
        title="How to use it, and what it means"
        detail="Written as the features land, and mapped in full before they do — so you can see what is documented, what is not, and when the rest arrives."
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Pill tone="brand">{ready.length} pages live</Pill>
          <Pill tone="soon">
            {SECTIONS.flatMap((s) => s.articles).length - ready.length} coming soon
          </Pill>
        </div>
      </Masthead>

      <Band>
        <Reveal>
          <div className="k-glass flex flex-wrap items-center gap-4 rounded-2xl p-6">
            <div>
              <h2 className="font-medium tracking-tight">The fastest way in</h2>
              <p className="mt-1 max-w-md text-sm text-k-text-muted">
                Nothing here is a prerequisite. Open the editor, double-click the canvas, and
                the interface names every gesture as you make it.
              </p>
            </div>
            <Lift className="ml-auto">
              <button
                type="button"
                onClick={() => {
                  onNavigate('editor');
                }}
                className="k-glow rounded-xl bg-k-primary px-5 py-2.5 text-sm font-medium text-white"
              >
                Open the editor →
              </button>
            </Lift>
          </div>
        </Reveal>
      </Band>

      {SECTIONS.map((section) => (
        <Band key={section.heading}>
          <BandHeading title={section.heading} detail={section.blurb} />

          <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-2">
            {section.articles.map((article) => (
              <RevealItem key={article.title}>
                <Entry article={article} onNavigate={onNavigate} />
              </RevealItem>
            ))}
          </RevealGroup>
        </Band>
      ))}

      <Band>
        <div className="rounded-2xl border border-k-border bg-k-surface p-8 text-center">
          <h2 className="text-xl font-medium tracking-tight">
            Until the rest is written, the plan is public
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-k-text-muted">
            Every phase, every track, and every task — including the ones that turned out to be
            wrong. It is more detail than documentation usually carries, and it is all there.
          </p>
          <Lift className="mt-6 inline-block">
            <button
              type="button"
              onClick={() => {
                onNavigate('roadmap');
              }}
              className="rounded-xl border border-k-border-strong bg-k-surface-raised px-5 py-2.5 text-sm font-medium"
            >
              Read the roadmap →
            </button>
          </Lift>
        </div>
      </Band>
    </main>
  );
}

function Entry({
  article,
  onNavigate,
}: {
  article: Article;
  onNavigate: (to: Route) => void;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium tracking-tight">{article.title}</h3>
        <StatusBadge status={article.status} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-k-text-muted">{article.detail}</p>
    </>
  );

  if (article.route) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate(article.route as Route);
        }}
        className="k-card w-full rounded-2xl border border-k-border bg-k-surface p-5 text-left hover:border-k-primary/40"
      >
        {body}
        <span className="mt-3 block font-mono text-xs text-k-primary">try it →</span>
      </button>
    );
  }

  // Not a link. A docs card that opens an empty page is worse than one that says it is empty.
  return (
    <div className="rounded-2xl border border-dashed border-k-border p-5 opacity-80">{body}</div>
  );
}
