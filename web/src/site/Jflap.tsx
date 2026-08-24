/**
 * The comparison page, for the search that actually gets typed.
 *
 * "JFLAP alternative" and "JFLAP won't open" are real queries with real intent behind them,
 * and the honest answer to both is a page rather than a landing funnel. Roadmap §6.1 asks for
 * one; roadmap §7 sets the constraint that makes it defensible — do not trade on the name.
 * Kleene is not "JFLAP for the web", the domain does not say JFLAP, and this page exists to
 * answer a question rather than to capture a term.
 *
 * The rule this file is written under: **name what JFLAP does better, specifically and
 * without hedging.** A comparison table where one column wins every row is an advertisement,
 * and a reader can tell inside five seconds. JFLAP has been the standard for two decades, is
 * cited in the textbooks, and does whole families of things Kleene has decided not to do at
 * all. Saying so is what makes the rest of the page worth believing — and for a reader who
 * needs a Turing machine today, sending them to JFLAP is the correct answer.
 */

import { Pill } from '@/site/Badge';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading, Masthead } from '@/site/page';
import type { Route } from '@/router';

interface Row {
  what: string;
  kleene: string;
  jflap: string;
  /** Which side this row actually favours. Drives the accent, and keeps the page honest. */
  favours: 'kleene' | 'jflap' | 'neither';
}

const ROWS: readonly Row[] = [
  {
    what: 'Getting started',
    kleene: 'Open a link. Nothing to install.',
    jflap: 'Install a JRE, download a .jar, allow it past Gatekeeper or SmartScreen.',
    favours: 'kleene',
  },
  {
    what: 'Sharing your work',
    kleene: 'The whole machine travels in a URL. Paste it into an email.',
    jflap: 'Send the .jff file and hope the other end has it working.',
    favours: 'kleene',
  },
  {
    what: 'Seeing why',
    kleene:
      'Every conversion steps, and every step says what it did — which subset, which string caused the split.',
    jflap: 'Steps through conversions, but tells you what happened more than why.',
    favours: 'kleene',
  },
  {
    what: 'Figures for a document',
    kleene: 'TikZ, SVG, PNG and Graphviz DOT, keeping the layout you arranged.',
    jflap: 'A screenshot.',
    favours: 'kleene',
  },
  {
    what: 'Grading a class',
    kleene:
      'A command line tool: `kleene equiv reference.kln submission.kln`, exit code and all.',
    jflap: 'By hand, one submission at a time.',
    favours: 'kleene',
  },
  {
    what: 'Pushdown automata',
    kleene: 'Not supported. Out of scope for v1.',
    jflap: 'Yes, including stack traces through a run.',
    favours: 'jflap',
  },
  {
    what: 'Turing machines',
    kleene: 'Not supported.',
    jflap: 'Yes — single and multi-tape, and building blocks.',
    favours: 'jflap',
  },
  {
    what: 'Grammars and parsing',
    kleene: 'Not supported.',
    jflap: 'CFGs, normal-form conversions, LL and LR parse tables, CYK, parse trees.',
    favours: 'jflap',
  },
  {
    what: 'L-systems, Moore and Mealy machines',
    kleene: 'Not supported, and not planned.',
    jflap: 'All three.',
    favours: 'jflap',
  },
  {
    what: 'Standing in the field',
    kleene: 'New. Written by one person in 2026.',
    jflap:
      'Two decades old, cited in the textbooks, and the tool your instructor probably learned on.',
    favours: 'jflap',
  },
  {
    what: 'Regular languages',
    kleene: 'Complete: automata, expressions, and every conversion between them.',
    jflap: 'Complete.',
    favours: 'neither',
  },
  {
    what: 'Price',
    kleene: 'Free. No account.',
    jflap: 'Free for non-commercial use.',
    favours: 'neither',
  },
];

export function Jflap({
  onNavigate,
  onOpenPath,
}: {
  onNavigate: (to: Route) => void;
  onOpenPath: (path: string) => void;
}) {
  return (
    <main>
      <Masthead
        eyebrow="Comparison"
        title="Kleene and JFLAP"
        detail="An honest comparison, written by the person who made one of them. JFLAP does more than Kleene does. Kleene does one part of it better, and that part is most of a formal languages course."
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
              Open the editor
            </button>
          </Lift>
          <Lift>
            <button
              type="button"
              onClick={() => {
                onNavigate('convert');
              }}
              className="rounded-full border border-k-border-strong bg-k-surface-raised px-5 py-3 font-medium"
            >
              Watch a conversion
            </button>
          </Lift>
        </div>
      </Masthead>

      <Band>
        <BandHeading
          title="Your .jff files already open"
          detail="Import a JFLAP file directly — no conversion step, no export dance. It reads the finite-automaton files a course hands out, and tells you plainly if it had to change anything rather than changing it quietly."
        />
        <Reveal>
          <div className="mt-6 rounded-2xl border border-k-border bg-k-surface p-6">
            <p className="text-sm leading-relaxed text-k-text-muted">
              Drag a <code className="font-mono text-k-text">.jff</code> onto the editor, or use
              Open. If a machine uses something Kleene does not model, the import says so at the
              top of the page instead of silently producing a different automaton — the failure
              mode that makes file conversion untrustworthy.
            </p>
            <p className="mt-4 text-sm text-k-text-faint">
              Only finite automata. A <code className="font-mono">.jff</code> holding a pushdown
              automaton, a Turing machine or a grammar will not open, because Kleene has nothing
              honest to turn it into.
            </p>
          </div>
        </Reveal>
      </Band>

      <Band>
        <BandHeading
          title="Side by side"
          detail="Ten rows, and JFLAP wins five of them. A comparison table where one column sweeps is an advertisement."
        />
        <RevealGroup className="mt-8 space-y-3">
          {ROWS.map((row) => (
            <RevealItem
              key={row.what}
              className="grid gap-4 rounded-2xl border border-k-border bg-k-surface p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]"
            >
              <div className="flex items-start gap-2">
                <h3 className="font-medium tracking-tight">{row.what}</h3>
                {row.favours === 'jflap' && <Pill tone="soon">JFLAP</Pill>}
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-wider text-k-text-faint uppercase">
                  Kleene
                </p>
                <p
                  className={`mt-1 text-sm leading-relaxed ${
                    row.favours === 'kleene' ? 'text-k-text' : 'text-k-text-muted'
                  }`}
                >
                  {row.kleene}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-wider text-k-text-faint uppercase">
                  JFLAP
                </p>
                <p
                  className={`mt-1 text-sm leading-relaxed ${
                    row.favours === 'jflap' ? 'text-k-text' : 'text-k-text-muted'
                  }`}
                >
                  {row.jflap}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Band>

      <Band>
        <Reveal>
          <div className="rounded-3xl border border-k-border p-8 sm:p-12">
            <h2 className="text-2xl font-semibold tracking-tight">Use JFLAP if…</h2>
            <ul className="mt-4 space-y-3 text-k-text-muted">
              <li>
                …your course covers pushdown automata, Turing machines or grammars. Kleene does
                not do those, and will not before v2. This is the common case in the second half
                of a term.
              </li>
              <li>
                …your instructor grades <code className="font-mono">.jff</code> files or the
                assignment names JFLAP. Do the assignment you were set.
              </li>
              <li>
                …you need Moore machines, Mealy machines, L-systems, or parse tables. Kleene has
                no plans for any of them.
              </li>
            </ul>

            <h2 className="mt-10 text-2xl font-semibold tracking-tight">Use Kleene if…</h2>
            <ul className="mt-4 space-y-3 text-k-text-muted">
              <li>
                …you are on regular languages, which is where most of a course's difficulty
                actually lives.
              </li>
              <li>
                …you want to see <em>why</em> a conversion did what it did, not only what it
                produced.
              </li>
              <li>…you need the diagram in a LaTeX document.</li>
              <li>…you are grading, and would rather run a command than open 200 files.</li>
              <li>…you cannot install software on the machine you are using.</li>
            </ul>

            <p className="mt-8 text-sm leading-relaxed text-k-text-faint">
              Both, most likely. They are not the same size of thing and nothing stops you
              having one open beside the other — your <code className="font-mono">.jff</code>{' '}
              files open here, and the diagrams go into your document from here.
            </p>
          </div>
        </Reveal>
      </Band>

      <Band>
        <Reveal>
          <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-k-border bg-k-surface p-8">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Try it on something real</h2>
              <p className="mt-2 max-w-xl text-sm text-k-text-muted">
                Twenty worked examples, each stating the language it recognises in words. Or
                open a converter with an expression already in it.
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-3">
              <Lift>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('examples');
                  }}
                  className="rounded-full border border-k-border-strong bg-k-surface-raised px-5 py-3 font-medium"
                >
                  The examples
                </button>
              </Lift>
              <Lift>
                <button
                  type="button"
                  onClick={() => {
                    onOpenPath('/tools/nfa-to-dfa');
                  }}
                  className="k-glow rounded-full bg-k-primary px-5 py-3 font-medium text-white"
                >
                  NFA to DFA →
                </button>
              </Lift>
            </div>
          </div>
        </Reveal>
      </Band>
    </main>
  );
}
