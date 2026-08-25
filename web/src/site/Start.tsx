/**
 * Getting started (Phase 5 D2).
 *
 * The task says "with a working automaton on screen immediately", and the reason is worth
 * keeping in view: a getting-started page whose first screen is prose is a page that assumes
 * the reader has already decided to invest. Someone who has just arrived has not.
 *
 * ## Why this is not the tour, and not the landing page
 *
 * The **tour** teaches two gestures inside the editor, to someone already there. The
 * **landing page** argues that the tool is worth trying. This is the third thing: a person who
 * is convinced, is in, and wants to know what the four things they can do actually are — which
 * neither of the other two answers, because answering it is not their job.
 *
 * Four steps, each ending in a link that opens the thing it just described with something
 * already in it. Nothing here explains automata theory; `/learn` does that, and mixing the two
 * produces a page that is too slow for the person who wants the tool and too shallow for the
 * person who wants the subject.
 */

import { useMemo } from 'react';

import { AutomatonView } from '@/canvas/AutomatonView';
import { rowLayout } from '@/canvas/geometry';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading, Masthead } from '@/site/page';
import type { Route } from '@/router';
import type { Engine } from '@/wasm/loader';

interface Step {
  number: string;
  title: string;
  detail: string;
  action: string;
  go: (open: Opener) => void;
}

interface Opener {
  navigate: (to: Route) => void;
  path: (path: string) => void;
  convert: (source: string) => void;
}

const STEPS: readonly Step[] = [
  {
    number: '01',
    title: 'Draw a machine',
    detail:
      'Drag the chip in the corner onto the canvas, or double-click empty space. To connect two states, drag from a state’s *rim* rather than its middle — the middle moves it. Everything is undoable, including the automatic layout.',
    action: 'Open the editor',
    go: (open) => {
      open.navigate('editor');
    },
  },
  {
    number: '02',
    title: 'Read it as a table',
    detail:
      'The same machine as a transition table, editable from either side: change a cell and the diagram moves, drag a state and the table follows. The 5-tuple is there too, in the notation a textbook uses.',
    action: 'Open an example',
    go: (open) => {
      open.navigate('examples');
    },
  },
  {
    number: '03',
    title: 'Watch a conversion happen',
    detail:
      'Type a regular expression and every stage appears: the ε-NFA, the DFA, the minimal DFA. Scrub through subset construction one round at a time and read the sentence explaining what each round did — every one of those was written in Rust, beside the line of the algorithm that produced it.',
    action: 'Convert (a|b)*abb',
    go: (open) => {
      open.convert('(a|b)*abb');
    },
  },
  {
    number: '04',
    title: 'Take it with you',
    detail:
      'Export the diagram as TikZ for an assignment, as SVG or PNG for anything else, or put the whole machine in a link that opens exactly what you drew. Nothing is uploaded — the link carries the machine itself.',
    action: 'See the LaTeX export',
    go: (open) => {
      open.path('/tools/dfa-to-latex');
    },
  },
];

export function Start({
  engine,
  onNavigate,
  onOpenPath,
  onConvert,
}: {
  /**
   * Passed rather than loaded here, because the shell already decides which routes wait for
   * the engine — and the diagram at the top has to be a real machine drawn by the real
   * renderer. A picture of one is the thing this page exists not to be.
   */
  engine: Engine | undefined;
  onNavigate: (to: Route) => void;
  onOpenPath: (path: string) => void;
  onConvert: (source: string) => void;
}) {
  const open: Opener = { navigate: onNavigate, path: onOpenPath, convert: onConvert };

  const shown = useMemo(() => {
    if (!engine) return undefined;
    const automaton = engine.example('ends_with_ab');
    return { automaton, layout: rowLayout(automaton.states.map((state) => state.id)) };
  }, [engine]);

  return (
    <main>
      <Masthead
        eyebrow="Getting started"
        title="Four things, and you have seen all of it."
        detail="Kleene is one editor, one converter, and a way of getting the result out. There is nothing to sign up for and nothing to configure, so this page is short on purpose."
      >
        <div className="flex flex-wrap gap-3">
          <Lift>
            <button
              type="button"
              onClick={() => {
                onNavigate('editor');
              }}
              className="k-glow rounded-full bg-k-primary px-5 py-3 font-medium text-white"
            >
              Skip this and open the editor →
            </button>
          </Lift>
        </div>
      </Masthead>

      <Band>
        <Reveal>
          <figure className="overflow-hidden rounded-3xl border border-k-border bg-k-surface">
            <div className="h-64 sm:h-80">
              {shown && (
                <AutomatonView
                  automaton={shown.automaton}
                  layout={shown.layout}
                  title="A DFA accepting strings that end in ab"
                  grid={false}
                  className="h-full w-full"
                />
              )}
            </div>
            <figcaption className="border-t border-k-border px-5 py-3 text-sm text-k-text-muted">
              A real machine, drawn by the same renderer the editor uses — strings over{' '}
              <span className="font-mono text-k-text">{'{a, b}'}</span> that end in{' '}
              <span className="font-mono text-k-text">ab</span>. Not a screenshot.
            </figcaption>
          </figure>
        </Reveal>
      </Band>

      <Band>
        <BandHeading title="The whole tool, in four steps" />
        <RevealGroup className="mt-8 space-y-4">
          {STEPS.map((step) => (
            <RevealItem
              key={step.number}
              className="grid gap-4 rounded-2xl border border-k-border bg-k-surface p-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start"
            >
              <span aria-hidden className="font-mono text-sm text-k-primary">
                {step.number}
              </span>
              <div>
                <h3 className="font-medium tracking-tight">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-k-text-muted">{step.detail}</p>
              </div>
              <Lift className="sm:ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    step.go(open);
                  }}
                  className="w-full rounded-full border border-k-border-strong bg-k-surface-raised px-4 py-2 text-sm font-medium whitespace-nowrap sm:w-auto"
                >
                  {step.action}
                </button>
              </Lift>
            </RevealItem>
          ))}
        </RevealGroup>
      </Band>

      <Band>
        <Reveal>
          <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-k-border p-8">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Wanting the theory rather than the tool?
              </h2>
              <p className="mt-2 max-w-xl text-sm text-k-text-muted">
                What a DFA is, what ε-closure means, why minimization is unique — with a machine
                beside each definition rather than under it.
              </p>
            </div>
            <Lift className="ml-auto">
              <button
                type="button"
                onClick={() => {
                  onNavigate('learn');
                }}
                className="rounded-full border border-k-border-strong bg-k-surface-raised px-5 py-3 font-medium"
              >
                Learn the subject →
              </button>
            </Lift>
          </div>
        </Reveal>
      </Band>
    </main>
  );
}
