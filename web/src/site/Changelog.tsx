/**
 * What has actually shipped, dated.
 *
 * The counterweight to every "coming soon" on this site. A roadmap is a promise; a changelog
 * is the record of promises kept, and a visitor comparing the two learns something no amount
 * of marketing copy can tell them — whether this project moves.
 *
 * Entries are written from the phase plan's own closing notes rather than composed for the
 * page, so what is claimed here is what was actually built.
 */

import { Pill } from '@/site/Badge';
import { Lift, Reveal } from '@/site/motion';
import { Band, Masthead } from '@/site/page';
import type { Route } from '@/router';

interface Entry {
  version: string;
  title: string;
  /** What landed, in the order it would be noticed. */
  changes: readonly string[];
  /** True for the one at the top, which gets the accent. */
  current?: boolean;
}

const ENTRIES: readonly Entry[] = [
  {
    version: 'Teaching layer',
    title: 'Assignment links, a problem set, and two games',
    current: true,
    changes: [
      'A lecturer can produce an assignment link from one command, with no account and nothing to install — and a student opening it is told the shortest string their answer gets wrong, never just that it is wrong.',
      '`kleene grade` marks a directory of submissions to CSV, with a counterexample beside every wrong answer. Unreadable files become rows rather than crashes.',
      'Twenty problems in difficulty order, with progress kept in your browser and exportable — there is no account, so the export is the backup.',
      'The pumping lemma played as the game it already is: the adversary picks n, you pick w, it splits, you pump. Win and it prints the proof you just played.',
      'State-budget golf: score against the smallest possible machine, and be shown which two states no string can tell apart.',
      'No XP, no badges, no streaks and no leaderboard. The mechanics are the subject.',
    ],
  },
  {
    version: 'Phase 5',
    title: 'Ready for other people',
    changes: [
      'Twenty worked examples, from a two-state DFA to Thompson’s construction of (a|b)*abb — each stating the language it recognises in words, and each a fixture the test suite runs against.',
      'Installable, and genuinely offline: the WebAssembly module and the fonts are precached, and a test switches the network off and opens a route the session has never visited.',
      'A prompt when a new version has been fetched, instead of a silent swap or a tab that never notices.',
      'A first-run tour in the editor, three cards long and dismissed for good. It exists for one gesture: a transition is drawn from a state’s rim, not its centre.',
    ],
  },
  {
    version: 'Phase 4',
    title: 'Getting work out of the tool',
    changes: [
      'TikZ export — LaTeX source, not a picture, matching the on-screen layout exactly. One test renders both and compares the geometry.',
      'SVG and PNG, rendered from a clean copy rather than scraped off the live canvas, so the grid and the selection glow stay out of your assignment.',
      'Graphviz DOT, including the invisible node the start arrow needs.',
      'Share links: the whole machine in the URL fragment, compressed, and never sent to a server by any browser.',
      'Save and open .kln files, drop one anywhere on the editor, and import JFLAP .jff directly — saying what it had to change rather than changing it quietly.',
    ],
  },
  {
    version: 'Phase 3 · Track D',
    title: 'The DFA builds itself while you watch',
    changes: [
      'Subset construction is drawn as it happens: states appear, edges draw from their source, and a subset that has been seen before is struck rather than duplicated.',
      'The worklist is shown as a queue you can watch drain — done, expanding, waiting.',
      'The transition table fills in cell by cell beside the diagram, distinguishing "not worked out yet" from "no move on this symbol".',
      'Any round can be unfolded into the ε-closure behind it, one state at a time.',
      'Scrubbing the DFA lights the subset it stands for in the ε-NFA beside it.',
    ],
  },
  {
    version: 'Phase 3 · Tracks A–C',
    title: 'Convert, with a scrubber',
    changes: [
      'A regular expression bar that compiles as you type, underlining the exact span of a syntax error.',
      'Three synchronised panes — ε-NFA, DFA, minimal DFA — from a single pass over what you typed.',
      'A step scrubber with play, speed control and deep links, so a link can point at round four.',
      'Every step’s reasoning shown as a sentence produced in Rust, not composed by the interface.',
    ],
  },
  {
    version: 'Phase 2',
    title: 'The editor',
    changes: [
      'Draw states and transitions directly, with undo across every surface.',
      'The transition table and the formal 5-tuple, both editable, both in step with the diagram.',
      'Run a string through a machine one symbol at a time, with the configuration set shown.',
      'Live validation: unreachable states, a partial δ, and every problem clicking through to the state it is about.',
    ],
  },
  {
    version: 'Phase 1',
    title: 'The engine',
    changes: [
      'A Rust core with Thompson’s construction, subset construction, minimization and state elimination.',
      'Every algorithm returns its reasoning alongside its result.',
      'Property tests for the algebraic laws, and differential tests that check the conversions agree.',
    ],
  },
  {
    version: 'Phase 0',
    title: 'Foundations',
    changes: [
      'Rust workspace, WebAssembly bindings, and TypeScript types generated from the Rust definitions.',
      'A design system with measured contrast, and a motion vocabulary tuned for algorithm steps.',
    ],
  },
];

export function Changelog({ onNavigate }: { onNavigate: (to: Route) => void }) {
  return (
    <main>
      <Masthead
        eyebrow="Changelog"
        title="What has actually shipped"
        detail="The counterweight to every roadmap. Written from the plan’s own closing notes, so what is claimed here is what was built."
      />

      <Band>
        <ol className="relative space-y-10 border-l border-k-border pl-8">
          {ENTRIES.map((entry, index) => (
            <Reveal as="li" key={entry.version} delay={index * 0.04}>
              {/* The node on the rail. The newest one is filled; the rest are hollow. */}
              <span
                aria-hidden
                className={`absolute -left-[6.5px] mt-2 h-3 w-3 rounded-full border-2 ${
                  entry.current
                    ? 'border-k-primary bg-k-primary'
                    : 'border-k-border-strong bg-k-bg'
                }`}
              />
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs tracking-wide text-k-text-faint">
                  {entry.version}
                </span>
                {entry.current && <Pill tone="brand">latest</Pill>}
              </div>
              <h2 className="mt-1.5 text-xl font-medium tracking-tight">{entry.title}</h2>
              <ul className="mt-3 space-y-2">
                {entry.changes.map((change) => (
                  <li
                    key={change}
                    className="flex gap-3 text-sm leading-relaxed text-k-text-muted"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-k-border-strong"
                    />
                    {change}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </ol>
      </Band>

      <Band>
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-k-border bg-k-surface p-6">
          <p className="max-w-xl text-sm text-k-text-muted">
            What comes next is written down in the same detail — every phase, every track, and
            the reasoning behind the decisions that turned out to be wrong.
          </p>
          <Lift className="ml-auto">
            <button
              type="button"
              onClick={() => {
                onNavigate('roadmap');
              }}
              className="rounded-full border border-k-border-strong bg-k-surface-raised px-5 py-2.5 text-sm font-medium"
            >
              Read the roadmap →
            </button>
          </Lift>
        </div>
      </Band>
    </main>
  );
}
