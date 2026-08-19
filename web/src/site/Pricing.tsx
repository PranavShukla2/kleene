/**
 * Pricing, for a thing that has no price.
 *
 * The page exists precisely *because* it is free. "Free" in a nav bar reads as a trial, a
 * freemium tier, or a hobby project that will start charging — three assumptions a visitor
 * makes silently and then acts on. A pricing page is where that gets answered properly: what
 * is free, why it can be, and what would have to change for it not to be.
 *
 * The honest version of that answer is the architecture. Kleene has no server, so there is no
 * marginal cost per user and therefore nothing to meter. That is a stronger promise than a
 * pledge, because it is structural rather than generous.
 */

import { StatusBadge } from '@/site/Badge';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading, Masthead } from '@/site/page';
import { READY, planned } from '@/overview/status';
import type { Route } from '@/router';

const INCLUDED: readonly { label: string; detail: string }[] = [
  { label: 'The whole editor', detail: 'Every drawing, editing and simulation feature.' },
  { label: 'Every conversion', detail: 'Regex, ε-NFA, DFA, minimal DFA — with the traces.' },
  {
    label: 'Unlimited machines',
    detail: 'Stored in your browser, so there is nothing to cap.',
  },
  { label: 'Every example', detail: 'The full gallery, all of it openable and editable.' },
  { label: 'No watermark', detail: 'Exports are yours, unbranded.' },
  { label: 'No telemetry', detail: 'Nothing is measured, because nothing is sent.' },
];

const LATER: readonly { label: string; detail: string; phase: number }[] = [
  { label: 'TikZ and SVG export', detail: 'Diagrams straight into LaTeX.', phase: 4 },
  { label: 'Share as a URL', detail: 'The machine encoded in the link itself.', phase: 4 },
  {
    label: 'Command line tool',
    detail: 'Equivalence checking and batch conversion.',
    phase: 4,
  },
  { label: 'Offline and desktop', detail: 'An installable app and a native build.', phase: 5 },
];

export function Pricing({ onNavigate }: { onNavigate: (to: Route) => void }) {
  return (
    <main>
      <Masthead
        eyebrow="Pricing"
        title="It is free, and there is no version that is not."
        detail="Kleene runs entirely in your browser. There is no server to pay for, no account to store, and no seat to sell — so there is nothing to charge for and nothing to upgrade to."
      >
        <Lift className="inline-block">
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
      </Masthead>

      <Band>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <div className="k-glass relative overflow-hidden rounded-3xl p-8">
              <div
                aria-hidden
                className="k-aurora pointer-events-none absolute inset-0 opacity-50"
              />
              <div className="relative">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-5xl font-semibold tracking-tight">£0</span>
                  <span className="text-k-text-muted">forever</span>
                </div>
                <p className="mt-3 max-w-sm text-sm text-k-text-muted">
                  Not a trial, not a tier, not a limited plan. The whole tool.
                </p>

                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  {INCLUDED.map((item) => (
                    <li key={item.label} className="flex gap-2.5">
                      <span aria-hidden className="mt-0.5 font-mono text-k-success">
                        ✓
                      </span>
                      <span>
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="block text-xs text-k-text-faint">{item.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-3xl border border-k-border p-8">
              <h2 className="text-lg font-medium tracking-tight">Also free, once it exists</h2>
              <p className="mt-2 text-sm text-k-text-muted">
                Nothing on the roadmap is being held back for a paid tier. These are simply not
                written yet, and each says when it lands.
              </p>
              <ul className="mt-6 space-y-4">
                {LATER.map((item) => (
                  <li key={item.label}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <StatusBadge status={planned(item.phase)} className="ml-auto" />
                    </div>
                    <p className="mt-1 text-xs text-k-text-faint">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Band>

      <Band>
        <BandHeading
          title="Why it can be free"
          detail="Not generosity — arithmetic. The costs a tool like this normally has are costs Kleene does not have."
        />

        <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'No servers',
              detail:
                'Every algorithm runs in your browser, compiled to WebAssembly. There is no backend to scale, so more users cost nothing.',
            },
            {
              title: 'No storage',
              detail:
                'Your machines live in your browser, in IndexedDB. There is no database, which is also why there is nothing to leak.',
            },
            {
              title: 'No accounts',
              detail:
                'Nothing to authenticate, reset, or support. The absence of a login is a feature and a cost saving at the same time.',
            },
          ].map((reason) => (
            <RevealItem
              key={reason.title}
              className="rounded-2xl border border-k-border bg-k-surface p-6"
            >
              <h3 className="font-medium tracking-tight">{reason.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-k-text-muted">{reason.detail}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Band>

      <Band>
        <div className="rounded-2xl border border-k-border bg-k-surface p-8">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h2 className="text-lg font-medium tracking-tight">Using it for a course?</h2>
              <p className="mt-1 max-w-xl text-sm text-k-text-muted">
                There is nothing to arrange — send your students a link. A course kit with
                problem sets and per-institution examples is planned, and it will be free too.
              </p>
            </div>
            <StatusBadge status={planned(5)} className="ml-auto" />
          </div>
        </div>
      </Band>

      <Band>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-k-border p-6">
          <StatusBadge status={READY} />
          <p className="text-sm text-k-text-muted">
            Everything marked live on this site works today. Try it before you believe any of
            it.
          </p>
          <Lift className="ml-auto">
            <button
              type="button"
              onClick={() => {
                onNavigate('convert');
              }}
              className="rounded-full border border-k-border-strong bg-k-surface-raised px-5 py-2.5 text-sm font-medium"
            >
              Convert a regex →
            </button>
          </Lift>
        </div>
      </Band>
    </main>
  );
}
