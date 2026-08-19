/**
 * No such page.
 *
 * This route replaced a deliberate decision, so it inherits that decision's job. The router
 * used to send every unknown path to the overview, reasoning that a stale link should land
 * somewhere that explains what Kleene is rather than on an apology. That goal was right; the
 * mechanism was not, because a visitor who is silently given the front page cannot tell
 * whether their URL was wrong or the site changed under them.
 *
 * So this page does both. It says plainly that the address did not exist — including the
 * address, so a typo is visible — and then does everything the overview would have done:
 * names what this is, and offers every route rather than a single "go home" button.
 */

import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, Masthead } from '@/site/page';
import type { Route } from '@/router';

const ELSEWHERE: readonly { route: Route; label: string; detail: string }[] = [
  {
    route: 'editor',
    label: 'The editor',
    detail: 'Draw a machine and run a string through it.',
  },
  {
    route: 'convert',
    label: 'Convert',
    detail: 'Type a regular expression and watch it build.',
  },
  { route: 'examples', label: 'Examples', detail: 'Machines worth reading before your own.' },
  {
    route: 'learn',
    label: 'Learn',
    detail: 'The vocabulary, and the mistakes that come with it.',
  },
  { route: 'docs', label: 'Docs', detail: 'What the notation means, and how to use it.' },
  { route: 'roadmap', label: 'Roadmap', detail: 'What is built, what is next, and when.' },
  { route: 'about', label: 'About', detail: 'Why this exists, and who builds it.' },
];

export function Missing({ onNavigate }: { onNavigate: (to: Route) => void }) {
  // Read once, at render. The URL does not change under this page — navigating away unmounts
  // it — and reading it live would mean an effect for a value that cannot move.
  const attempted = window.location.pathname;

  return (
    <main>
      <Masthead
        eyebrow="404"
        title="There is no page at that address"
        detail="Which is worth saying out loud rather than quietly showing you the front page — otherwise an old link in your notes looks like the site changed rather than like the link is old."
      >
        <Reveal>
          {/*
            The address that failed, shown back. A typo is invisible in a browser chrome bar
            you have already stopped looking at, and obvious the moment it is set in mono at
            18px in the middle of the page.
          */}
          <code className="inline-block rounded-full border border-k-border bg-k-surface px-4 py-1.5 font-mono text-sm break-all text-k-text-muted">
            {attempted}
          </code>
        </Reveal>
      </Masthead>

      <Band>
        <p className="mx-auto max-w-2xl text-center text-k-text-muted">
          Kleene is an automata theory workbench: draw a finite automaton, read it as a
          transition table, and watch a conversion happen one step at a time. Everything runs in
          your browser.
        </p>

        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ELSEWHERE.map((item) => (
            <RevealItem key={item.route}>
              <button
                type="button"
                onClick={() => {
                  onNavigate(item.route);
                }}
                className="k-card k-spotlight h-full w-full rounded-2xl border border-k-border bg-k-surface p-5 text-left hover:border-k-primary/40"
              >
                <span className="font-medium tracking-tight">{item.label}</span>
                <span className="mt-1 block text-sm text-k-text-muted">{item.detail}</span>
              </button>
            </RevealItem>
          ))}
        </RevealGroup>

        <div className="mt-10 flex justify-center">
          <Lift>
            <button
              type="button"
              onClick={() => {
                onNavigate('overview');
              }}
              className="k-glow rounded-full bg-k-primary px-6 py-3 font-medium text-white"
            >
              Start from the beginning →
            </button>
          </Lift>
        </div>
      </Band>
    </main>
  );
}
